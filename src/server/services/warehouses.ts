import { isValidObjectId, type Types } from "mongoose";
import type { LocationType } from "@/lib/constants";
import type { LocationDTO, WarehouseDTO } from "@/lib/types";
import type { LocationInput, WarehouseInput } from "@/lib/validation/master";
import { withTransaction } from "@/server/db";
import { conflict, notFound, validationError } from "@/server/errors";
import { Location, type LocationRecord } from "@/server/models/location";
import { Operation } from "@/server/models/operation";
import { ReorderRule } from "@/server/models/reorder-rule";
import { StockQuant } from "@/server/models/stock-quant";
import { Warehouse, type WarehouseRecord } from "@/server/models/warehouse";

/* -------------------------------------------------------------- warehouses */

function toWarehouseDTO(warehouse: WarehouseRecord & { createdAt?: Date }, locationCount: number): WarehouseDTO {
  return {
    id: warehouse._id.toString(),
    name: warehouse.name,
    shortCode: warehouse.shortCode,
    address: warehouse.address ?? "",
    defaultLocationId: warehouse.defaultLocation?.toString() ?? null,
    locationCount,
    createdAt: (warehouse.createdAt ?? new Date()).toISOString(),
  };
}

export async function listWarehouses(): Promise<WarehouseDTO[]> {
  const [warehouses, counts] = await Promise.all([
    Warehouse.find().sort({ name: 1 }).lean<(WarehouseRecord & { createdAt: Date })[]>(),
    Location.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { type: "internal" } },
      { $group: { _id: "$warehouse", count: { $sum: 1 } } },
    ]),
  ]);
  const byWarehouse = new Map(counts.map((row) => [row._id?.toString(), row.count]));
  return warehouses.map((warehouse) => toWarehouseDTO(warehouse, byWarehouse.get(warehouse._id.toString()) ?? 0));
}

/** Creates a warehouse together with its main `<CODE>/Stock` location. */
export async function createWarehouse(input: WarehouseInput): Promise<string> {
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
    return warehouse._id.toString();
  });
}

export async function updateWarehouse(id: string, input: WarehouseInput): Promise<void> {
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
  });
}

export async function deleteWarehouse(id: string): Promise<void> {
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

async function warehouseFor(id: string) {
  const warehouse = isValidObjectId(id) ? await Warehouse.findById(id).lean<WarehouseRecord>() : null;
  if (!warehouse) throw validationError({ warehouse: "Select a valid warehouse" });
  return warehouse;
}

export async function createLocation(input: LocationInput): Promise<string> {
  const warehouse = await warehouseFor(input.warehouse);
  const location = await Location.create({
    name: input.name,
    shortCode: input.shortCode,
    warehouse: warehouse._id,
    type: "internal",
    fullName: `${warehouse.shortCode}/${input.shortCode}`,
  });
  return location._id.toString();
}

async function isLocationInUse(id: Types.ObjectId) {
  const [operation, stock] = await Promise.all([
    Operation.exists({ $or: [{ sourceLocation: id }, { destLocation: id }] }),
    StockQuant.exists({ location: id, $or: [{ quantity: { $gt: 0 } }, { reservedQuantity: { $gt: 0 } }] }),
  ]);
  return Boolean(operation || stock);
}

export async function updateLocation(id: string, input: LocationInput): Promise<void> {
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
}

export async function deleteLocation(id: string): Promise<void> {
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
}
