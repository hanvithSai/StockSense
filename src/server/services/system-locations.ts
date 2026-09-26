import type { ClientSession } from "mongoose";
import type { LocationType } from "@/lib/constants";
import { Location, type LocationRecord } from "@/server/models/location";

type VirtualType = Exclude<LocationType, "internal">;

const SYSTEM_LOCATIONS: Record<VirtualType, { name: string; shortCode: string; fullName: string }> = {
  vendor: { name: "Vendors", shortCode: "Vendors", fullName: "Partners/Vendors" },
  customer: { name: "Customers", shortCode: "Customers", fullName: "Partners/Customers" },
  adjustment: {
    name: "Inventory Adjustment",
    shortCode: "Adjustment",
    fullName: "Virtual/Inventory Adjustment",
  },
};

/** Idempotently creates the virtual counterpart locations used by the stock engine. */
export async function ensureSystemLocations() {
  await Promise.all(
    (Object.entries(SYSTEM_LOCATIONS) as [VirtualType, (typeof SYSTEM_LOCATIONS)[VirtualType]][]).map(
      ([type, location]) =>
        Location.updateOne(
          { fullName: location.fullName },
          { $setOnInsert: { ...location, type, warehouse: null, isSystem: true } },
          { upsert: true },
        ),
    ),
  );
}

export async function getSystemLocation(type: VirtualType, session?: ClientSession): Promise<LocationRecord> {
  const location = await Location.findOne({ type, isSystem: true })
    .session(session ?? null)
    .lean<LocationRecord>();
  if (!location) throw new Error(`System location "${type}" is missing`);
  return location;
}
