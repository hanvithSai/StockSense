import type { ClientSession, Types } from "mongoose";
import { planSplit } from "@/lib/backorder";
import { OPERATION_META, operationPath, type OperationStatus, type OperationType } from "@/lib/constants";
import { formatQty, round3, todayISO } from "@/lib/format";
import type { SessionUser } from "@/lib/types";
import {
  operationRules,
  packSchema,
  pickSchema,
  splitSchema,
  type OperationAction,
  type OperationCreateInput,
  type OperationFields,
} from "@/lib/validation/operations";
import { withTransaction } from "@/server/db";
import { AppError, conflict, notFound, validationError } from "@/server/errors";
import { Location, type LocationRecord } from "@/server/models/location";
import { Operation, type OperationDocument } from "@/server/models/operation";
import { Product } from "@/server/models/product";
import { StockQuant } from "@/server/models/stock-quant";
import { User, type UserRecord } from "@/server/models/user";
import { Warehouse, type WarehouseRecord } from "@/server/models/warehouse";
import { recordActivity, summarizeLines } from "./audit";
import type { ProductLean } from "./records";
import { nextReference } from "./sequence";
import { getSystemLocation } from "./system-locations";

/** Audit entry for an operation (label, link and entity filled in). */
function operationLog(op: OperationDocument, action: string, message: string) {
  return {
    entityType: "operation" as const,
    entityId: op._id,
    entityLabel: op.reference,
    action,
    message,
    link: operationPath(op.type as OperationType, op._id.toString()),
  };
}

/**
 * Inventory engine: the only place where stock quantities change.
 *
 * receipt     Vendors  -> internal   draft -To Do-> ready -Validate-> done   (+qty at destination)
 * delivery    internal -> Customers  draft -To Do-> ready | waiting; pick, pack, Validate -> done (-qty)
 * internal    internal -> internal   draft -To Do-> ready | waiting; Validate -> done (qty moves)
 * adjustment  internal <-> Virtual   draft -Validate-> done (on hand := counted, delta logged)
 *
 * Split (backorder): a waiting delivery/transfer ships what is in stock now and the rest waits in a
 * backorder; a ready receipt books what arrived and the rest stays expected in a backorder.
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
  backorder: { id: string; reference: string } | null;
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
async function promoteWaiting(
  session: ClientSession,
  locations: Types.ObjectId[],
  actor: Actor,
  trigger: string,
): Promise<string[]> {
  if (!locations.length) return [];
  const waiting = await Operation.find({ status: "waiting", sourceLocation: { $in: locations } })
    .sort({ scheduledDate: 1, createdAt: 1 })
    .session(session);
  const promoted: string[] = [];
  for (const op of waiting) {
    if ((await reserve(op, session)).length === 0) {
      op.status = "ready";
      await op.save({ session });
      await recordActivity(actor, operationLog(op, "ready", `Stock arrived with ${trigger}: reserved and ready`), session);
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
    const count = op.lines.length;
    await recordActivity(
      actor,
      operationLog(op, "created", `Created ${OPERATION_META[input.type].label.toLowerCase()} with ${count} product${count === 1 ? "" : "s"}`),
      session,
    );
    return op._id.toString();
  });
}

const TRACKED_FIELDS: { key: "contact" | "deliveryAddress" | "scheduledDate" | "responsibleName" | "notes" | "sourceName" | "destName"; label: string }[] = [
  { key: "contact", label: "contact" },
  { key: "deliveryAddress", label: "delivery address" },
  { key: "scheduledDate", label: "schedule date" },
  { key: "responsibleName", label: "responsible" },
  { key: "notes", label: "notes" },
  { key: "sourceName", label: "source" },
  { key: "destName", label: "destination" },
];

export async function updateOperation(id: string, data: OperationFields, actor: Actor): Promise<void> {
  await withTransaction(async (session) => {
    const op = await loadOperation(id, session);
    const type = op.type as OperationType;
    const status = op.status as OperationStatus;
    if (status === "done" || status === "cancelled") {
      throw conflict("Done or cancelled operations can no longer be edited");
    }
    if (data.version && op.updatedAt && new Date(op.updatedAt).toISOString() !== data.version) {
      throw new AppError(409, "STALE", "Someone else changed this operation meanwhile. Reload to see the latest version.");
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
    const linesChanged = structureEditable && structureChanged(op, data);
    const changed = TRACKED_FIELDS.filter(({ key }) => key in fields && String(op[key] ?? "") !== String(fields[key as keyof typeof fields] ?? "")).map(
      ({ label }) => label,
    );
    if (linesChanged) changed.push("products");

    op.set(fields);
    await op.save({ session });
    if (changed.length) await recordActivity(actor, operationLog(op, "updated", `Updated ${changed.join(", ")}`), session);
  });
}

export async function deleteOperation(id: string, actor: Actor): Promise<void> {
  const op = await Operation.findById(id);
  if (!op) throw notFound("Operation");
  if (op.status !== "draft" && op.status !== "cancelled") {
    throw conflict("Only draft or cancelled operations can be deleted");
  }
  await op.deleteOne();
  await recordActivity(actor, { ...operationLog(op, "deleted", `Deleted ${op.reference}`), link: null });
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
  await recordActivity(actor, operationLog(op, "validated", validationMessage(op)), session);

  return increasedLocation ? promoteWaiting(session, [increasedLocation], actor, op.reference) : [];
}

function validationMessage(op: OperationDocument): string {
  const lines = op.lines.map((line) => ({ productName: line.productName, quantity: line.quantity, uom: line.uom }));
  switch (op.type as OperationType) {
    case "receipt":
      return `Validated: received ${summarizeLines(lines)} into ${op.destName}`;
    case "delivery":
      return `Validated: shipped ${summarizeLines(lines)} from ${op.sourceName}`;
    case "internal":
      return `Validated: moved ${summarizeLines(lines)} from ${op.sourceName} to ${op.destName}`;
    case "adjustment": {
      const deltas = op.lines
        .filter((line) => line.delta)
        .map((line) => `${line.productName} ${line.delta! > 0 ? "+" : "−"}${formatQty(Math.abs(line.delta!))} ${line.uom}`);
      return deltas.length ? `Validated count at ${op.destName}: ${deltas.join(", ")}` : `Validated count at ${op.destName}: no difference`;
    }
  }
}

function shortageText(shortages: Shortage[]): string {
  return shortages
    .map((item) => `${item.productName} (${formatQty(item.required)} needed, ${formatQty(item.available)} free)`)
    .join(", ");
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
    const outcome: ActionOutcome = { shortages: [], promoted: [], backorder: null };
    let log: { action: string; message: string } | null = null;

    switch (action) {
      case "confirm": {
        assertStatus(op, ["draft"], "Only draft operations can be marked as To Do");
        if (type === "adjustment") throw conflict("Adjustments are applied directly with Validate");
        if (!op.lines.length) throw conflict("Add at least one product first");
        if (type === "receipt") {
          op.status = "ready";
          log = { action: "ready", message: "Marked as To Do: ready to receive" };
        } else {
          outcome.shortages = await reserve(op, session);
          op.status = outcome.shortages.length ? "waiting" : "ready";
          log = outcome.shortages.length
            ? { action: "waiting", message: `Marked as To Do: waiting for ${shortageText(outcome.shortages)}` }
            : { action: "ready", message: "Marked as To Do: stock reserved" };
        }
        break;
      }
      case "check-availability": {
        assertStatus(op, ["waiting"], "Only waiting operations need an availability check");
        outcome.shortages = await reserve(op, session);
        if (!outcome.shortages.length) op.status = "ready";
        log = outcome.shortages.length
          ? { action: "waiting", message: `Checked availability: still waiting for ${shortageText(outcome.shortages)}` }
          : { action: "ready", message: "Checked availability: stock reserved" };
        break;
      }
      case "pick": {
        if (type !== "delivery") throw conflict("Picking applies to delivery orders only");
        assertStatus(op, ["ready"], "Items can be picked once the delivery is ready");
        const { lineIds, picked } = pickSchema.parse(body ?? {});
        const touched = op.lines.filter((line) => !lineIds || lineIds.includes(line._id.toString()));
        touched.forEach((line) => {
          line.picked = picked;
        });
        if (!op.lines.every((line) => line.picked)) op.packed = false;
        const names = touched.length === op.lines.length ? "all items" : touched.map((line) => line.productName).join(", ");
        log = { action: "picked", message: `${picked ? "Picked" : "Unpicked"} ${names}` };
        break;
      }
      case "pack": {
        if (type !== "delivery") throw conflict("Packing applies to delivery orders only");
        assertStatus(op, ["ready"], "Items can be packed once the delivery is ready");
        const { packed } = packSchema.parse(body ?? {});
        if (packed && !op.lines.every((line) => line.picked)) throw conflict("Pick all items before packing");
        op.packed = packed;
        log = { action: "packed", message: packed ? "Packed items for shipping" : "Unpacked items" };
        break;
      }
      case "validate": {
        outcome.promoted = await validate(op, actor, session);
        return outcome;
      }
      case "split": {
        const { lines, validate: receiveNow } = splitSchema.parse(body ?? {});
        if (receiveNow && type !== "receipt") throw conflict("Only receipts are validated while splitting");
        const split = await splitOperation(op, lines, actor, session);
        if (split) {
          outcome.backorder = split.backorder;
          await op.save({ session });
          await recordActivity(actor, operationLog(op, "split", split.message), session);
        } else if (!receiveNow) {
          throw conflict(
            type === "receipt" ? "Every quantity is received in full: validate instead" : "Everything is in stock: use Check availability instead",
          );
        }
        if (receiveNow) outcome.promoted = await validate(op, actor, session);
        return outcome;
      }
      case "cancel": {
        assertStatus(op, ["draft", "waiting", "ready"], "This operation can no longer be cancelled");
        const released = op.status === "ready" && RESERVING_TYPES.includes(type);
        if (released) await release(op, session);
        op.status = "cancelled";
        op.cancelledAt = new Date();
        resetPicking(op);
        log = { action: "cancelled", message: released ? "Cancelled and released reserved stock" : "Cancelled" };
        break;
      }
      case "reset": {
        assertStatus(op, ["waiting", "ready", "cancelled"], "Only waiting, ready or cancelled operations can be reset");
        if (op.status === "ready" && RESERVING_TYPES.includes(type)) await release(op, session);
        op.status = "draft";
        op.cancelledAt = null;
        resetPicking(op);
        log = { action: "reset", message: "Reset to draft" };
        break;
      }
    }

    await op.save({ session });
    if (log) await recordActivity(actor, operationLog(op, log.action, log.message), session);
    return outcome;
  });
}

/* ------------------------------------------------------------- backorders */

/**
 * Keeps part of each line on the operation and moves the rest to a new backorder (same partner,
 * locations and schedule). Waiting deliveries/transfers keep what is free at the source and become
 * ready; the backorder waits for stock and is promoted automatically when it arrives.
 * Returns null when nothing would move to a backorder.
 */
async function splitOperation(
  op: OperationDocument,
  requested: { lineId: string; quantity: number }[] | undefined,
  actor: Actor,
  session: ClientSession,
) {
  const type = op.type as OperationType;
  if (type === "adjustment") throw conflict("Adjustments cannot be split");
  if (type === "receipt") assertStatus(op, ["ready"], "Mark the receipt as To Do before receiving part of it");
  else assertStatus(op, ["waiting"], "Only operations waiting for stock can move what is available now");

  const wanted = new Map((requested ?? []).map((line) => [line.lineId, line.quantity]));
  if ([...wanted.keys()].some((lineId) => !op.lines.some((line) => line._id.toString() === lineId))) {
    throw validationError({ lines: "This product line no longer exists. Reload and try again" });
  }
  const free = type === "receipt" ? null : await freeQuantities(session, op.sourceLocation, op.lines.map((line) => line.product));

  const limits = op.lines.map((line) => ({
    id: line._id.toString(),
    quantity: line.quantity,
    limit: free ? (free.get(line.product.toString()) ?? 0) : line.quantity,
  }));
  const plan = planSplit(limits, wanted).map((item, index) => {
    const line = op.lines[index];
    if (item.overLimit) {
      const limit = Math.max(0, Math.min(line.quantity, limits[index].limit));
      throw conflict(`${line.productName}: at most ${formatQty(limit)} ${line.uom} ${free ? "are in stock" : "were ordered"}`);
    }
    return { line, keep: item.keep, rest: item.rest };
  });
  const rest = plan.filter((item) => item.rest > 0);
  if (!rest.length) return null;
  if (plan.every((item) => item.keep === 0)) {
    throw conflict(type === "receipt" ? "Enter the quantities received now" : `Nothing is in stock yet at ${op.sourceName}`);
  }

  const warehouse = await Warehouse.findById(op.warehouse).session(session).lean<WarehouseRecord>();
  if (!warehouse) throw conflict("The warehouse of this operation no longer exists");
  const reference = await nextReference(warehouse.shortCode, type, session);
  const [backorder] = await Operation.create(
    [
      {
        reference,
        type,
        status: type === "receipt" ? "ready" : "waiting",
        warehouse: op.warehouse,
        sourceLocation: op.sourceLocation,
        destLocation: op.destLocation,
        sourceName: op.sourceName,
        destName: op.destName,
        contact: op.contact,
        deliveryAddress: op.deliveryAddress,
        scheduledDate: op.scheduledDate,
        responsible: op.responsible,
        responsibleName: op.responsibleName,
        notes: op.notes,
        origin: op.reference,
        backorderOf: op._id,
        createdBy: actor.id,
        lines: rest.map(({ line, rest: quantity }) => ({
          product: line.product,
          productName: line.productName,
          sku: line.sku,
          uom: line.uom,
          category: line.category,
          quantity,
        })),
      },
    ],
    { session },
  );

  // The original keeps what moves now.
  for (const { line, keep } of plan) {
    if (keep === 0) op.lines.pull(line._id);
    else line.quantity = keep;
  }
  resetPicking(op);
  if (type !== "receipt") {
    if ((await reserve(op, session)).length) throw conflict("Stock changed meanwhile. Reload and try again");
    op.status = "ready";
  }

  const restSummary = summarizeLines(rest.map(({ line, rest: quantity }) => ({ productName: line.productName, quantity, uom: line.uom })));
  await recordActivity(
    actor,
    operationLog(backorder, "created", `Created as backorder of ${op.reference}: ${restSummary}`),
    session,
  );
  const now = type === "receipt" ? "Received part now" : type === "delivery" ? "Shipping what is in stock now" : "Moving what is in stock now";
  return {
    backorder: { id: backorder._id.toString(), reference },
    message: `${now}; backorder ${reference} created for ${restSummary}`,
  };
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
  await recordActivity(input.actor, operationLog(op, "created", `Created stock count: ${input.notes}`), session);
  const promoted = await validate(op, input.actor, session);
  return { id: op._id.toString(), reference, promoted };
}

/**
 * Starts a full count of a location: a draft adjustment listing every product stored there,
 * with the counted quantity pre-filled to the recorded one so only differences need typing.
 */
export async function startLocationCount(location: string, actor: Actor): Promise<string> {
  const record = await Location.findOne({ _id: location, type: "internal" }).lean<LocationRecord>();
  if (!record) throw validationError({ location: "Select a valid internal location" });
  const quants = await StockQuant.find({ location: record._id, quantity: { $gt: 0 } })
    .sort({ quantity: -1 })
    .lean<{ product: Types.ObjectId; quantity: number }[]>();
  if (!quants.length) throw conflict(`${record.fullName} holds no stock to count`);
  if (quants.length > 100) throw conflict(`${record.fullName} holds more than 100 products; count it in parts from the Adjustments page`);

  return createOperation(
    {
      type: "adjustment",
      sourceLocation: "",
      destLocation: record._id.toString(),
      contact: "",
      deliveryAddress: "",
      scheduledDate: todayISO(),
      responsible: actor.id,
      notes: `Full count of ${record.fullName}`,
      lines: quants.map((quant) => ({ product: quant.product.toString(), quantity: quant.quantity })),
    },
    actor,
  );
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
