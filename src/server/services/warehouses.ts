import { isValidObjectId, type Types } from "mongoose";
import type { LocationType } from "@/lib/constants";
import type { LocationDTO, LocationStatsDTO, WarehouseDTO } from "@/lib/types";
import type { LocationInput, WarehouseInput } from "@/lib/validation/master";
import { withTransaction } from "@/server/db";
import { conflict, notFound, validationError } from "@/server/errors";
import { Location, type LocationRecord } from "@/server/models/location";
import { Operation } from "@/server/models/operation";
import { ReorderRule } from "@/server/models/reorder-rule";
import { StockQuant } from "@/server/models/stock-quant";
import { Warehouse, type WarehouseRecord } from "@/server/models/warehouse";
import { recordActivity, type AuditActor } from "./audit";

const warehouseLog = (id: Types.ObjectId, label: string, action: string, message: string) => ({
  entityType: "warehouse" as const,
  entityId: id,
  entityLabel: label,
  action,
  message,
  link: action === "deleted" ? null : "/settings/warehouses",
});

const locationLog = (id: Types.ObjectId, label: string, action: string, message: string) => ({
  entityType: "location" as const,
  entityId: id,
  entityLabel: label,
  action,
  message,
  link: action === "deleted" ? null : "/settings/locations",
});

/* -------------------------------------------------------------- warehouses */

interface WarehouseStats {
  locationCount: number;
  productCount: number;
  stockValue: number;
  openOperations: number;
}

function toWarehouseDTO(warehouse: WarehouseRecord & { createdAt?: Date }, stats: WarehouseStats): WarehouseDTO {
  return {
    id: warehouse._id.toString(),
    name: warehouse.name,
    shortCode: warehouse.shortCode,
    address: warehouse.address ?? "",
    defaultLocationId: warehouse.defaultLocation?.toString() ?? null,
    ...stats,
    createdAt: (warehouse.createdAt ?? new Date()).toISOString(),
  };
}

export async function listWarehouses(): Promise<WarehouseDTO[]> {
  const [warehouses, locations, stock, open] = await Promise.all([
    Warehouse.find().sort({ name: 1 }).lean<(WarehouseRecord & { createdAt: Date })[]>(),
    Location.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { type: "internal" } },
      { $group: { _id: "$warehouse", count: { $sum: 1 } } },
    ]),
    StockQuant.aggregate<{ _id: Types.ObjectId; value: number; products: number }>([
      { $match: { quantity: { $gt: 0 } } },
      { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$warehouse",
          value: { $sum: { $multiply: ["$quantity", "$product.costPrice"] } },
          products: { $addToSet: "$product._id" },
        },
      },
      { $project: { value: 1, products: { $size: "$products" } } },
    ]),
    Operation.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: { $in: ["draft", "waiting", "ready"] } } },
      { $group: { _id: "$warehouse", count: { $sum: 1 } } },
    ]),
  ]);
  const locationCounts = new Map(locations.map((row) => [row._id?.toString(), row.count]));
  const stockStats = new Map(stock.map((row) => [row._id.toString(), row]));
  const openCounts = new Map(open.map((row) => [row._id.toString(), row.count]));
  return warehouses.map((warehouse) => {
    const id = warehouse._id.toString();
    return toWarehouseDTO(warehouse, {
      locationCount: locationCounts.get(id) ?? 0,
      productCount: stockStats.get(id)?.products ?? 0,
      stockValue: Math.round((stockStats.get(id)?.value ?? 0) * 100) / 100,
      openOperations: openCounts.get(id) ?? 0,
    });
  });
}

/** Creates a warehouse together with its main `<CODE>/Stock` location. */
export async function createWarehouse(input: WarehouseInput, actor: AuditActor): Promise<string> {
  return withTransaction(async (session) => {
    const [warehouse] = await Warehouse.create([input], { session });
    const [stock] = await Location.create(
      [
        {
          name: "Stock",
          shortCode: "Stock",
          warehouse: warehouse._id,
          type: "internal",
          fullName: `${warehouse.shortCode}/Stock`,
        },
      ],
      { session },
    );
    warehouse.defaultLocation = stock._id;
    await warehouse.save({ session });
    await recordActivity(
      actor,
      warehouseLog(warehouse._id, warehouse.name, "created", `Created warehouse ${warehouse.name} (${warehouse.shortCode}) with location ${stock.fullName}`),
      session,
    );
    return warehouse._id.toString();
  });
}

export async function updateWarehouse(id: string, input: WarehouseInput, actor: AuditActor): Promise<void> {
  await withTransaction(async (session) => {
    const warehouse = await Warehouse.findById(id).session(session);
    if (!warehouse) throw notFound("Warehouse");

    if (warehouse.shortCode !== input.shortCode) {
      if (await Operation.exists({ warehouse: warehouse._id }).session(session)) {
        throw validationError({ shortCode: "The short code cannot change once operations reference it" });
      }
      const locations = await Location.find({ warehouse: warehouse._id }).session(session);
      for (const location of locations) {
        location.fullName = `${input.shortCode}/${location.shortCode}`;
        await location.save({ session });
      }
    }
    warehouse.set(input);
    await warehouse.save({ session });
    await recordActivity(actor, warehouseLog(warehouse._id, warehouse.name, "updated", `Updated warehouse ${warehouse.name}`), session);
  });
}

export async function deleteWarehouse(id: string, actor: AuditActor): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Warehouse");
  await withTransaction(async (session) => {
    const warehouse = await Warehouse.findById(id).session(session);
    if (!warehouse) throw notFound("Warehouse");
    const [hasOperations, hasStock] = await Promise.all([
      Operation.exists({ warehouse: warehouse._id }).session(session),
      StockQuant.exists({ warehouse: warehouse._id, quantity: { $gt: 0 } }).session(session),
    ]);
    if (hasOperations || hasStock) {
      throw conflict("This warehouse has stock or operations and cannot be deleted");
    }
    await Location.deleteMany({ warehouse: warehouse._id }, { session });
    await ReorderRule.deleteMany({ warehouse: warehouse._id }, { session });
    await StockQuant.deleteMany({ warehouse: warehouse._id }, { session });
    await warehouse.deleteOne({ session });
    await recordActivity(actor, warehouseLog(warehouse._id, warehouse.name, "deleted", `Deleted warehouse ${warehouse.name}`), session);
  });
}

/* --------------------------------------------------------------- locations */

type LocationWithWarehouse = Omit<LocationRecord, "warehouse"> & {
  warehouse: { _id: Types.ObjectId; name: string; shortCode: string; defaultLocation?: Types.ObjectId | null } | null;
};

function toLocationDTO(location: LocationWithWarehouse): LocationDTO {
  return {
    id: location._id.toString(),
    name: location.name,
    shortCode: location.shortCode,
    fullName: location.fullName,
    type: location.type as LocationType,
    warehouse: location.warehouse
      ? {
          id: location.warehouse._id.toString(),
          name: location.warehouse.name,
          shortCode: location.warehouse.shortCode,
        }
      : null,
    isSystem: location.isSystem,
    isDefault: Boolean(location.warehouse?.defaultLocation?.equals(location._id)),
  };
}

export async function listLocations(options: { warehouse?: string; includeSystem?: boolean } = {}): Promise<LocationDTO[]> {
  const filter: Record<string, unknown> = options.includeSystem ? {} : { type: "internal" };
  if (options.warehouse && isValidObjectId(options.warehouse)) filter.warehouse = options.warehouse;
  const locations = await Location.find(filter)
    .populate("warehouse", "name shortCode defaultLocation")
    .sort({ fullName: 1 })
    .lean<LocationWithWarehouse[]>();
  return locations.map(toLocationDTO);
}

/** Locations with the number of products they hold and the stock value at cost. */
export async function listLocationStats(options: { warehouse?: string } = {}): Promise<LocationStatsDTO[]> {
  const [locations, stock] = await Promise.all([
    listLocations(options),
    StockQuant.aggregate<{ _id: Types.ObjectId; value: number; products: number }>([
      { $match: { quantity: { $gt: 0 } } },
      { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$location",
          value: { $sum: { $multiply: ["$quantity", "$product.costPrice"] } },
          products: { $sum: 1 },
        },
      },
    ]),
  ]);
  const stats = new Map(stock.map((row) => [row._id.toString(), row]));
  return locations.map((location) => ({
    ...location,
    productCount: stats.get(location.id)?.products ?? 0,
    stockValue: Math.round((stats.get(location.id)?.value ?? 0) * 100) / 100,
  }));
}

async function warehouseFor(id: string) {
  const warehouse = isValidObjectId(id) ? await Warehouse.findById(id).lean<WarehouseRecord>() : null;
  if (!warehouse) throw validationError({ warehouse: "Select a valid warehouse" });
  return warehouse;
}

export async function createLocation(input: LocationInput, actor: AuditActor): Promise<string> {
  const warehouse = await warehouseFor(input.warehouse);
  const location = await Location.create({
    name: input.name,
    shortCode: input.shortCode,
    warehouse: warehouse._id,
    type: "internal",
    fullName: `${warehouse.shortCode}/${input.shortCode}`,
  });
  await recordActivity(actor, locationLog(location._id, location.fullName, "created", `Created location ${location.fullName}`));
  return location._id.toString();
}

async function isLocationInUse(id: Types.ObjectId) {
  const [operation, stock] = await Promise.all([
    Operation.exists({ $or: [{ sourceLocation: id }, { destLocation: id }] }),
    StockQuant.exists({ location: id, $or: [{ quantity: { $gt: 0 } }, { reservedQuantity: { $gt: 0 } }] }),
  ]);
  return Boolean(operation || stock);
}

export async function updateLocation(id: string, input: LocationInput, actor: AuditActor): Promise<void> {
  const location = isValidObjectId(id) ? await Location.findById(id) : null;
  if (!location) throw notFound("Location");
  if (location.isSystem) throw conflict("System locations cannot be edited");

  const warehouse = await warehouseFor(input.warehouse);
  const moved = !location.warehouse?.equals(warehouse._id) || location.shortCode !== input.shortCode;
  if (moved && (await isLocationInUse(location._id))) {
    throw validationError({ shortCode: "Short code and warehouse cannot change once the location holds stock or history" });
  }
  location.set({
    name: input.name,
    shortCode: input.shortCode,
    warehouse: warehouse._id,
    fullName: `${warehouse.shortCode}/${input.shortCode}`,
  });
  await location.save();
  await recordActivity(actor, locationLog(location._id, location.fullName, "updated", `Updated location ${location.fullName}`));
}

export async function deleteLocation(id: string, actor: AuditActor): Promise<void> {
  const location = isValidObjectId(id) ? await Location.findById(id) : null;
  if (!location) throw notFound("Location");
  if (location.isSystem) throw conflict("System locations cannot be deleted");
  if (await Warehouse.exists({ defaultLocation: location._id })) {
    throw conflict("This is the main stock location of its warehouse and cannot be deleted");
  }
  if (await isLocationInUse(location._id)) {
    throw conflict("This location holds stock or is used by operations and cannot be deleted");
  }
  await StockQuant.deleteMany({ location: location._id });
  await location.deleteOne();
  await recordActivity(actor, locationLog(location._id, location.fullName, "deleted", `Deleted location ${location.fullName}`));
}
