import type { ClientSession, Types } from "mongoose";
import type { OperationStatus, OperationType } from "@/lib/constants";
import { round3, todayISO } from "@/lib/format";
import type { SessionUser } from "@/lib/types";
import {
  operationRules,
  packSchema,
  pickSchema,
  type OperationAction,
  type OperationCreateInput,
  type OperationFields,
} from "@/lib/validation/operations";
import { withTransaction } from "@/server/db";
import { conflict, notFound, validationError } from "@/server/errors";
import { Location, type LocationRecord } from "@/server/models/location";
import { Operation, type OperationDocument } from "@/server/models/operation";
import { Product } from "@/server/models/product";
import { StockQuant } from "@/server/models/stock-quant";
import { User, type UserRecord } from "@/server/models/user";
import { Warehouse, type WarehouseRecord } from "@/server/models/warehouse";
import type { ProductLean } from "./records";
import { nextReference } from "./sequence";
import { getSystemLocation } from "./system-locations";

/**
 * Inventory engine: the only place where stock quantities change.
 *
 * receipt     Vendors  -> internal   draft -To Do-> ready -Validate-> done   (+qty at destination)
 * delivery    internal -> Customers  draft -To Do-> ready | waiting; pick, pack, Validate -> done (-qty)
 * internal    internal -> internal   draft -To Do-> ready | waiting; Validate -> done (qty moves)
 * adjustment  internal <-> Virtual   draft -Validate-> done (on hand := counted, delta logged)
 *
 * Deliveries and transfers reserve stock on To Do (all lines or nothing, otherwise Waiting).
 * Every mutation runs in a transaction; done operations are immutable and form the ledger.
 */

export type Actor = Pick<SessionUser, "id" | "name">;

export interface Shortage {
  productName: string;
  required: number;
  available: number;
  uom: string;
}

export interface ActionOutcome {
  shortages: Shortage[];
  promoted: string[];
}

const RESERVING_TYPES: readonly OperationType[] = ["delivery", "internal"];

/* ------------------------------------------------------------------ quants */

interface QuantChange {
  product: Types.ObjectId;
  location: Types.ObjectId;
  warehouse: Types.ObjectId;
  quantity?: number;
  reserved?: number;
  label: string;
}

async function changeQuant(session: ClientSession, change: QuantChange) {
  const quant = await StockQuant.findOneAndUpdate(
    { product: change.product, location: change.location },
    { $setOnInsert: { warehouse: change.warehouse } },
    { upsert: true, new: true, session },
  );
  const quantity = round3(quant.quantity + (change.quantity ?? 0));
  const reserved = Math.max(0, round3(quant.reservedQuantity + (change.reserved ?? 0)));

  if (quantity < 0) {
    throw conflict(`Not enough stock of ${change.label}: ${quant.quantity} on hand`);
  }
  if (reserved > quantity) {
    throw conflict(`Stock of ${change.label} is reserved by other operations`);
  }
  quant.quantity = quantity;
  quant.reservedQuantity = reserved;
  await quant.save({ session });
}

async function freeQuantities(session: ClientSession, location: Types.ObjectId, products: Types.ObjectId[]) {
  const quants = await StockQuant.find({ location, product: { $in: products } })
    .session(session)
    .lean();
  return new Map(
    quants.map((quant) => [quant.product.toString(), round3(quant.quantity - quant.reservedQuantity)]),
  );
}

/** Reserves every line at the source location, or nothing (returns the shortages). */
async function reserve(op: OperationDocument, session: ClientSession): Promise<Shortage[]> {
  const free = await freeQuantities(session, op.sourceLocation, op.lines.map((line) => line.product));
  const shortages = op.lines
    .filter((line) => (free.get(line.product.toString()) ?? 0) < line.quantity)
    .map((line) => ({
      productName: line.productName,
      required: line.quantity,
      available: Math.max(0, free.get(line.product.toString()) ?? 0),
      uom: line.uom,
    }));
  if (shortages.length) return shortages;

  for (const line of op.lines) {
    await changeQuant(session, {
      product: line.product,
      location: op.sourceLocation,
      warehouse: op.warehouse,
      reserved: line.quantity,
      label: `${line.productName} at ${op.sourceName}`,
    });
  }
  return [];
}

async function release(op: OperationDocument, session: ClientSession) {
  for (const line of op.lines) {
    await changeQuant(session, {
      product: line.product,
      location: op.sourceLocation,
      warehouse: op.warehouse,
      reserved: -line.quantity,
      label: `${line.productName} at ${op.sourceName}`,
    });
  }
}

/** After stock arrives at a location, waiting operations sourcing from it become ready (FIFO). */
async function promoteWaiting(session: ClientSession, locations: Types.ObjectId[]): Promise<string[]> {
  if (!locations.length) return [];
  const waiting = await Operation.find({ status: "waiting", sourceLocation: { $in: locations } })
    .sort({ scheduledDate: 1, createdAt: 1 })
    .session(session);
  const promoted: string[] = [];
  for (const op of waiting) {
    if ((await reserve(op, session)).length === 0) {
      op.status = "ready";
      await op.save({ session });
      promoted.push(op.reference);
    }
  }
  return promoted;
}

/* --------------------------------------------------------------- resolving */

async function internalLocation(id: string | undefined, field: string, session: ClientSession) {
  const location = id
    ? await Location.findOne({ _id: id, type: "internal" }).session(session).lean<LocationRecord>()
    : null;
  if (!location?.warehouse) throw validationError({ [field]: "Select a valid internal location" });
  return location;
}

async function endpoints(type: OperationType, data: OperationFields, session: ClientSession) {
  switch (type) {
    case "receipt":
      return {
        source: await getSystemLocation("vendor", session),
        dest: await internalLocation(data.destLocation, "destLocation", session),
      };
    case "delivery":
      return {
        source: await internalLocation(data.sourceLocation, "sourceLocation", session),
        dest: await getSystemLocation("customer", session),
      };
    case "internal":
      return {
        source: await internalLocation(data.sourceLocation, "sourceLocation", session),
        dest: await internalLocation(data.destLocation, "destLocation", session),
      };
    case "adjustment":
      return {
        source: await getSystemLocation("adjustment", session),
        dest: await internalLocation(data.destLocation, "destLocation", session),
      };
  }
}

async function resolveLines(data: OperationFields, session: ClientSession) {
  const products = await Product.find({ _id: { $in: data.lines.map((line) => line.product) } })
    .session(session)
    .lean<(Omit<ProductLean, "category"> & { category: Types.ObjectId })[]>();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  const errors: Record<string, string> = {};
  data.lines.forEach((line, index) => {
    const product = byId.get(line.product);
    if (!product) errors[`lines.${index}.product`] = "Product not found";
    else if (!product.isActive) errors[`lines.${index}.product`] = `${product.name} is archived`;
  });
  if (Object.keys(errors).length) throw validationError(errors);

  return data.lines.map((line) => {
    const product = byId.get(line.product)!;
    return {
      product: product._id,
      productName: product.name,
      sku: product.sku,
      uom: product.uom,
      category: product.category ?? null,
      quantity: round3(line.quantity),
      picked: false,
      systemQty: null,
      delta: null,
    };
  });
}

/** Validates references and builds the denormalized document fields for an operation. */
async function resolveFields(
  type: OperationType,
  data: OperationFields,
  actor: Actor,
  session: ClientSession,
  includeLines: boolean,
) {
  const { source, dest } = await endpoints(type, data, session);
  const stockLocation = type === "receipt" || type === "adjustment" ? dest : source;
  const warehouse = await Warehouse.findById(stockLocation.warehouse)
    .session(session)
    .lean<WarehouseRecord>();
  if (!warehouse) throw validationError({ [type === "delivery" ? "sourceLocation" : "destLocation"]: "Location has no warehouse" });

  const responsible = await User.findById(data.responsible || actor.id)
    .session(session)
    .lean<UserRecord>();
  if (!responsible) throw validationError({ responsible: "Select a valid user" });

  const fields = {
    warehouse: warehouse._id,
    sourceLocation: source._id,
    destLocation: dest._id,
    sourceName: source.fullName,
    destName: dest.fullName,
    contact: type === "internal" || type === "adjustment" ? "" : data.contact,
    deliveryAddress: type === "delivery" ? data.deliveryAddress : "",
    scheduledDate: data.scheduledDate,
    responsible: responsible._id,
    responsibleName: responsible.name,
    notes: data.notes,
    ...(includeLines ? { lines: await resolveLines(data, session) } : {}),
  };
  return { warehouse, fields };
}

async function loadOperation(id: string, session: ClientSession): Promise<OperationDocument> {
  const op = await Operation.findById(id).session(session);
  if (!op) throw notFound("Operation");
  return op;
}

function assertStatus(op: OperationDocument, allowed: OperationStatus[], message: string) {
  if (!allowed.includes(op.status as OperationStatus)) throw conflict(message);
}

function assertRules(type: OperationType, data: OperationFields) {
  const errors = operationRules(type, data);
  if (Object.keys(errors).length) throw validationError(errors);
}

function structureChanged(op: OperationDocument, data: OperationFields): boolean {
  const type = op.type as OperationType;
  const sourceChanged = (type === "delivery" || type === "internal") && op.sourceLocation.toString() !== data.sourceLocation;
  const destChanged = type !== "delivery" && op.destLocation.toString() !== data.destLocation;
  const linesChanged =
    op.lines.length !== data.lines.length ||
    op.lines.some(
      (line, index) =>
        line.product.toString() !== data.lines[index].product || line.quantity !== round3(data.lines[index].quantity),
    );
  return sourceChanged || destChanged || linesChanged;
}

/* --------------------------------------------------------------- lifecycle */

export async function createOperation(input: OperationCreateInput, actor: Actor): Promise<string> {
  assertRules(input.type, input);
  return withTransaction(async (session) => {
    const { warehouse, fields } = await resolveFields(input.type, input, actor, session, true);
    const reference = await nextReference(warehouse.shortCode, input.type, session);
    const [op] = await Operation.create(
      [{ ...fields, reference, type: input.type, status: "draft", createdBy: actor.id }],
      { session },
    );
    return op._id.toString();
  });
}

export async function updateOperation(id: string, data: OperationFields, actor: Actor): Promise<void> {
  await withTransaction(async (session) => {
    const op = await loadOperation(id, session);
    const type = op.type as OperationType;
    const status = op.status as OperationStatus;
    if (status === "done" || status === "cancelled") {
      throw conflict("Done or cancelled operations can no longer be edited");
    }
    assertRules(type, data);

    const structureEditable = status === "draft" || (type === "receipt" && status === "ready");
    if (!structureEditable && structureChanged(op, data)) {
      throw conflict("Reset the operation to draft to change its products or locations");
    }

    const { warehouse, fields } = await resolveFields(type, data, actor, session, structureEditable);
    if (!warehouse._id.equals(op.warehouse)) {
      throw validationError({
        [type === "delivery" || type === "internal" ? "sourceLocation" : "destLocation"]:
          "Choose a location in the operation's warehouse",
      });
    }
    op.set(fields);
    await op.save({ session });
  });
}

export async function deleteOperation(id: string): Promise<void> {
  const op = await Operation.findById(id);
  if (!op) throw notFound("Operation");
  if (op.status !== "draft" && op.status !== "cancelled") {
    throw conflict("Only draft or cancelled operations can be deleted");
  }
  await op.deleteOne();
}

async function locationWarehouse(location: Types.ObjectId, session: ClientSession) {
  const record = await Location.findById(location).session(session).lean<LocationRecord>();
  if (!record?.warehouse) throw conflict("Destination location no longer exists");
  return record.warehouse;
}

async function validate(op: OperationDocument, actor: Actor, session: ClientSession): Promise<string[]> {
  const type = op.type as OperationType;
  let increasedLocation: Types.ObjectId | null = null;

  if (type === "adjustment") {
    assertStatus(op, ["draft"], "This adjustment has already been processed");
    for (const line of op.lines) {
      const quant = await StockQuant.findOneAndUpdate(
        { product: line.product, location: op.destLocation },
        { $setOnInsert: { warehouse: op.warehouse } },
        { upsert: true, new: true, session },
      );
      if (line.quantity < quant.reservedQuantity) {
        throw conflict(
          `${line.productName}: ${quant.reservedQuantity} ${line.uom} are reserved by pending operations, so the counted quantity cannot be lower`,
        );
      }
      line.systemQty = quant.quantity;
      line.delta = round3(line.quantity - quant.quantity);
      if (line.delta > 0) increasedLocation = op.destLocation;
      quant.quantity = round3(line.quantity);
      await quant.save({ session });
    }
  } else {
    assertStatus(
      op,
      ["ready"],
      type === "receipt"
        ? "Mark the receipt as To Do before validating"
        : "The operation must be ready before it can be validated",
    );
    if (type === "delivery") {
      if (!op.lines.every((line) => line.picked)) throw conflict("Pick all items before validating the delivery");
      if (!op.packed) throw conflict("Pack the items before validating the delivery");
    }
    const destWarehouse = type === "internal" ? await locationWarehouse(op.destLocation, session) : op.warehouse;

    for (const line of op.lines) {
      if (type === "delivery" || type === "internal") {
        await changeQuant(session, {
          product: line.product,
          location: op.sourceLocation,
          warehouse: op.warehouse,
          quantity: -line.quantity,
          reserved: -line.quantity,
          label: `${line.productName} at ${op.sourceName}`,
        });
      }
      if (type === "receipt" || type === "internal") {
        await changeQuant(session, {
          product: line.product,
          location: op.destLocation,
          warehouse: destWarehouse,
          quantity: line.quantity,
          label: `${line.productName} at ${op.destName}`,
        });
        increasedLocation = op.destLocation;
      }
    }
  }

  op.status = "done";
  op.doneAt = new Date();
  op.doneBy = actor.id as unknown as Types.ObjectId;
  op.doneByName = actor.name;
  await op.save({ session });

  return increasedLocation ? promoteWaiting(session, [increasedLocation]) : [];
}

function resetPicking(op: OperationDocument) {
  op.lines.forEach((line) => {
    line.picked = false;
  });
  op.packed = false;
}

export async function runOperationAction(
  id: string,
  action: OperationAction,
  body: unknown,
  actor: Actor,
): Promise<ActionOutcome> {
  return withTransaction(async (session) => {
    const op = await loadOperation(id, session);
    const type = op.type as OperationType;
    const outcome: ActionOutcome = { shortages: [], promoted: [] };

    switch (action) {
      case "confirm": {
        assertStatus(op, ["draft"], "Only draft operations can be marked as To Do");
        if (type === "adjustment") throw conflict("Adjustments are applied directly with Validate");
        if (!op.lines.length) throw conflict("Add at least one product first");
        if (type === "receipt") {
          op.status = "ready";
        } else {
          outcome.shortages = await reserve(op, session);
          op.status = outcome.shortages.length ? "waiting" : "ready";
        }
        break;
      }
      case "check-availability": {
        assertStatus(op, ["waiting"], "Only waiting operations need an availability check");
        outcome.shortages = await reserve(op, session);
        if (!outcome.shortages.length) op.status = "ready";
        break;
      }
      case "pick": {
        if (type !== "delivery") throw conflict("Picking applies to delivery orders only");
        assertStatus(op, ["ready"], "Items can be picked once the delivery is ready");
        const { lineIds, picked } = pickSchema.parse(body ?? {});
        op.lines.forEach((line) => {
          if (!lineIds || lineIds.includes(line._id.toString())) line.picked = picked;
        });
        if (!op.lines.every((line) => line.picked)) op.packed = false;
        break;
      }
      case "pack": {
        if (type !== "delivery") throw conflict("Packing applies to delivery orders only");
        assertStatus(op, ["ready"], "Items can be packed once the delivery is ready");
        const { packed } = packSchema.parse(body ?? {});
        if (packed && !op.lines.every((line) => line.picked)) throw conflict("Pick all items before packing");
        op.packed = packed;
        break;
      }
      case "validate": {
        outcome.promoted = await validate(op, actor, session);
        return outcome;
      }
      case "cancel": {
        assertStatus(op, ["draft", "waiting", "ready"], "This operation can no longer be cancelled");
        if (op.status === "ready" && RESERVING_TYPES.includes(type)) await release(op, session);
        op.status = "cancelled";
        op.cancelledAt = new Date();
        resetPicking(op);
        break;
      }
      case "reset": {
        assertStatus(op, ["waiting", "ready", "cancelled"], "Only waiting, ready or cancelled operations can be reset");
        if (op.status === "ready" && RESERVING_TYPES.includes(type)) await release(op, session);
        op.status = "draft";
        op.cancelledAt = null;
        resetPicking(op);
        break;
      }
    }

    await op.save({ session });
    return outcome;
  });
}

/* ---------------------------------------------------------- adjustments */

/** Creates an adjustment and applies it immediately (quick stock update, initial stock). */
export async function createAppliedAdjustment(
  session: ClientSession,
  input: { location: string; lines: { product: string; quantity: number }[]; notes: string; actor: Actor },
) {
  const data: OperationFields = {
    sourceLocation: "",
    destLocation: input.location,
    contact: "",
    deliveryAddress: "",
    scheduledDate: todayISO(),
    responsible: input.actor.id,
    notes: input.notes,
    lines: input.lines,
  };
  const { warehouse, fields } = await resolveFields("adjustment", data, input.actor, session, true);
  const reference = await nextReference(warehouse.shortCode, "adjustment", session);
  const [op] = await Operation.create(
    [{ ...fields, reference, type: "adjustment", status: "draft", createdBy: input.actor.id }],
    { session },
  );
  const promoted = await validate(op, input.actor, session);
  return { id: op._id.toString(), reference, promoted };
}

export async function applyStockCount(
  input: { product: string; location: string; countedQty: number; note: string },
  actor: Actor,
) {
  return withTransaction((session) =>
    createAppliedAdjustment(session, {
      location: input.location,
      lines: [{ product: input.product, quantity: input.countedQty }],
      notes: input.note || "Stock updated from the stock page",
      actor,
    }),
  );
}
