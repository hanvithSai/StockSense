/**
 * Demo data for StockSense. Every movement goes through the real inventory engine,
 * so quantities, reservations and the ledger are consistent.
 *
 *   npm run seed            seeds an empty database
 *   npm run seed -- --reset wipes existing data first
 */
import mongoose from "mongoose";
import type { OperationType } from "../src/lib/constants";
import { todayISO } from "../src/lib/format";
import type { OperationAction } from "../src/lib/validation/operations";
import { hashPassword } from "../src/server/auth/password";
import { connectDB } from "../src/server/db";
import * as models from "../src/server/models";
import { createCategory, createProduct, createReorderRule } from "../src/server/services/catalog";
import { createOperation, runOperationAction, type Actor } from "../src/server/services/inventory";
import { ensureSystemLocations } from "../src/server/services/system-locations";
import { createLocation, createWarehouse } from "../src/server/services/warehouses";

const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return todayISO(date);
};

async function main() {
  await connectDB();
  const reset = process.argv.includes("--reset");
  if ((await models.User.countDocuments()) > 0 && !reset) {
    console.error("Database already has data. Run `npm run seed -- --reset` to wipe and reseed.");
    process.exit(1);
  }
  if (reset) {
    await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
    await ensureSystemLocations();
  }

  console.log("Seeding users…");
  const [manager] = await models.User.create([
    {
      name: "Aarav Mehta",
      loginId: "manager",
      email: "manager@stocksense.demo",
      passwordHash: await hashPassword("Manager@123"),
      role: "manager",
    },
    {
      name: "Kavya Reddy",
      loginId: "warehouse",
      email: "staff@stocksense.demo",
      passwordHash: await hashPassword("Staff@1234"),
      role: "staff",
    },
  ]);
  const actor: Actor = { id: manager._id.toString(), name: manager.name };

  console.log("Seeding warehouses and locations…");
  const mainWarehouse = await createWarehouse({
    name: "Main Warehouse",
    shortCode: "WH",
    address: "Plot 12, IDA Uppal, Hyderabad 500039",
  });
  const secondWarehouse = await createWarehouse({
    name: "Medchal Depot",
    shortCode: "WH2",
    address: "Survey 118, Medchal Road, Hyderabad 501401",
  });
  const main = await models.Warehouse.findById(mainWarehouse).lean();
  const second = await models.Warehouse.findById(secondWarehouse).lean();
  const stock = main!.defaultLocation!.toString();
  const stock2 = second!.defaultLocation!.toString();
  const production = await createLocation({ name: "Production Rack", shortCode: "Prod", warehouse: mainWarehouse });
  const rackA = await createLocation({ name: "Rack A", shortCode: "RackA", warehouse: mainWarehouse });
  await createLocation({ name: "Rack B", shortCode: "RackB", warehouse: mainWarehouse });

  console.log("Seeding catalog…");
  const categories = {
    furniture: await createCategory({ name: "Furniture", description: "Desks, tables and seating" }),
    raw: await createCategory({ name: "Raw Materials", description: "Steel, wood and fasteners" }),
    electronics: await createCategory({ name: "Electronics", description: "Monitors and peripherals" }),
    packaging: await createCategory({ name: "Packaging", description: "Boxes, tape and wrap" }),
    office: await createCategory({ name: "Office Supplies", description: "Paper and stationery" }),
  };

  const product = (name: string, sku: string, category: string, uom: string, costPrice: number, extra = {}) =>
    createProduct({ name, sku, category, uom, costPrice, description: "", ...extra } as Parameters<typeof createProduct>[0], actor);

  const p = {
    desk: await product("Desk", "DESK001", categories.furniture, "Units", 3000),
    table: await product("Table", "TABLE001", categories.furniture, "Units", 3000),
    chair: await product("Office Chair", "CHAIR001", categories.furniture, "Units", 1800),
    steel: await product("Steel", "STEEL001", categories.raw, "kg", 65),
    rods: await product("Steel Rods", "ROD001", categories.raw, "Units", 450),
    plywood: await product("Plywood Sheet", "PLY001", categories.raw, "Units", 1200),
    screws: await product("Wood Screws", "SCREW001", categories.raw, "Box", 150),
    monitor: await product('LED Monitor 24"', "MON001", categories.electronics, "Units", 9500),
    keyboard: await product("Wireless Keyboard", "KEYB001", categories.electronics, "Units", 1200),
    carton: await product("Carton Box", "BOX001", categories.packaging, "Units", 25),
    tape: await product("Packing Tape", "TAPE001", categories.packaging, "Roll", 60),
    paper: await product("A4 Paper Ream", "PAPER001", categories.office, "Pack", 280, {
      initialQuantity: 15,
      initialLocation: stock,
    }),
  };

  const rules: [string, string, number, number][] = [
    [p.desk, mainWarehouse, 10, 50],
    [p.chair, mainWarehouse, 20, 80],
    [p.steel, mainWarehouse, 100, 300],
    [p.monitor, mainWarehouse, 5, 20],
    [p.carton, mainWarehouse, 150, 500],
    [p.tape, mainWarehouse, 20, 100],
    [p.paper, mainWarehouse, 10, 40],
  ];
  for (const [productId, warehouse, minQty, maxQty] of rules) {
    await createReorderRule({ product: productId, warehouse, minQty, maxQty });
  }

  console.log("Replaying stock operations…");
  async function operation(
    type: OperationType,
    fields: { source?: string; dest?: string; contact?: string; address?: string; date?: string; notes?: string },
    lines: [string, number][],
    actions: OperationAction[] = [],
  ) {
    const id = await createOperation(
      {
        type,
        sourceLocation: fields.source ?? "",
        destLocation: fields.dest ?? "",
        contact: fields.contact ?? "",
        deliveryAddress: fields.address ?? "",
        scheduledDate: fields.date ?? day(0),
        responsible: actor.id,
        notes: fields.notes ?? "",
        lines: lines.map(([productId, quantity]) => ({ product: productId, quantity })),
      },
      actor,
    );
    for (const action of actions) await runOperationAction(id, action, {}, actor);
    return id;
  }
  const receive: OperationAction[] = ["confirm", "validate"];
  const ship: OperationAction[] = ["confirm", "pick", "pack", "validate"];

  // The PDF walkthrough: receive 100 kg steel, move to production, deliver 20, adjust 3 kg damaged.
  await operation("receipt", { dest: stock, contact: "Azure Interior", date: day(-6) }, [[p.desk, 50], [p.table, 50], [p.chair, 40]], receive);
  await operation("receipt", { dest: stock, contact: "Tata Steel", date: day(-5) }, [[p.steel, 100], [p.rods, 50]], receive);
  await operation("internal", { source: stock, dest: production, date: day(-4), notes: "Main store to production rack" }, [[p.steel, 40]], ["confirm", "validate"]);
  await operation("delivery", { source: stock, contact: "Azure Interior", address: "Banjara Hills, Hyderabad", date: day(-3) }, [[p.steel, 20]], ship);
  await operation("adjustment", { dest: stock, date: day(-3), notes: "3 kg steel damaged" }, [[p.steel, 37]], ["validate"]);
  await operation("receipt", { dest: stock, contact: "Dell India", date: day(-2) }, [[p.monitor, 12], [p.keyboard, 30]], receive);
  await operation("receipt", { dest: stock2, contact: "PackRight Supplies", date: day(-2) }, [[p.carton, 300], [p.tape, 80]], receive);
  await operation("internal", { source: stock2, dest: stock, date: day(-1), notes: "Warehouse 2 to warehouse 1" }, [[p.carton, 120]], ["confirm", "validate"]);
  await operation("delivery", { source: stock, contact: "Modern Office Pvt Ltd", address: "HITEC City, Hyderabad", date: day(-1) }, [[p.chair, 5]], ship);

  // Open work for the dashboard: late, waiting, ready and upcoming operations.
  await operation("receipt", { dest: stock, contact: "Azure Interior", date: day(-1) }, [[p.desk, 20], [p.chair, 10]], ["confirm"]);
  await operation("receipt", { dest: stock, contact: "Tata Steel", date: day(0) }, [[p.steel, 200]], ["confirm"]);
  await operation("receipt", { dest: stock, contact: "Godrej Interio", date: day(3) }, [[p.table, 10], [p.plywood, 25]]);
  await operation("delivery", { source: stock, contact: "Azure Interior", address: "Banjara Hills, Hyderabad", date: day(0) }, [[p.desk, 5]], ["confirm"]);
  await operation("delivery", { source: stock, contact: "Nova Retail", address: "Kukatpally, Hyderabad", date: day(-1) }, [[p.monitor, 20]], ["confirm"]);
  await operation("delivery", { source: stock, contact: "Modern Office Pvt Ltd", address: "HITEC City, Hyderabad", date: day(2) }, [[p.keyboard, 10], [p.paper, 5]]);
  await operation("internal", { source: stock, dest: rackA, date: day(0), notes: "Shelve chairs on Rack A" }, [[p.chair, 10]], ["confirm"]);
  await operation("adjustment", { dest: stock, date: day(1), notes: "Cycle count: carton boxes" }, [[p.carton, 118]]);

  console.log("Done. Sign in with manager / Manager@123 or warehouse / Staff@1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
