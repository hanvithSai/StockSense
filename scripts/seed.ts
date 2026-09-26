/**
 * Realistic demo data for StockSense.
 *
 * 1. Master data: users, three warehouses with locations, categories, ~50 products, reordering rules.
 * 2. 75 days of history from a deterministic simulation: opening balances, vendor receipts,
 *    customer deliveries, production and inter-warehouse transfers, cycle counts. Quantities are
 *    applied exactly like the inventory engine applies them, so stock, ledger and audit trail agree.
 *    History is inserted in bulk for speed.
 * 3. The problem statement walkthrough on STEEL001: receive 100 kg, move 40 kg to the production
 *    rack, deliver 20 kg, adjust 3 kg damaged (77 kg left).
 * 4. Today's open work (ready, waiting, late and upcoming operations) goes through the real
 *    inventory engine, including stock reservations.
 *
 *   npm run seed            seeds an empty database
 *   npm run seed -- --reset wipes existing data first
 */
import mongoose, { Types } from "mongoose";
import { OPERATION_META, operationPath, type OperationStatus, type OperationType } from "../src/lib/constants";
import { formatQty, round3, todayISO } from "../src/lib/format";
import type { OperationAction } from "../src/lib/validation/operations";
import { hashPassword } from "../src/server/auth/password";
import { connectDB } from "../src/server/db";
import * as models from "../src/server/models";
import { summarizeLines } from "../src/server/services/audit";
import { createOperation, createReturn, runOperationAction, type Actor } from "../src/server/services/inventory";
import { ensureSystemLocations, getSystemLocation } from "../src/server/services/system-locations";

/* ----------------------------------------------------------------- helpers */

const HISTORY_DAYS = 75;

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(2026);
const int = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
const chance = (probability: number) => random() < probability;
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
function sample<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  while (pool.length && result.length < count) result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return result;
}
const FRACTIONAL_UNITS = ["kg", "m", "L"];
/** Whole numbers for countable units, 3 decimals for weights and lengths. */
const unitQty = (product: { uom: string }, value: number) => (FRACTIONAL_UNITS.includes(product.uom) ? round3(value) : Math.round(value));
const nice = (value: number) => (value >= 50 ? Math.round(value / 10) * 10 : value >= 10 ? Math.round(value / 5) * 5 : Math.max(1, Math.round(value)));

function dayAt(offset: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, minute, 0, 0);
  return date;
}
const isoDay = (offset: number) => todayISO(dayAt(offset, 12));
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

/* ------------------------------------------------------------- master data */

const USERS = [
  { name: "Aarav Mehta", loginId: "manager", email: "manager@stocksense.demo", password: "Manager@123", role: "manager" },
  { name: "Kavya Reddy", loginId: "warehouse", email: "staff@stocksense.demo", password: "Staff@1234", role: "staff" },
  { name: "Rohan Iyer", loginId: "rohan.iyer", email: "rohan.iyer@stocksense.demo", password: "Rohan@1234", role: "manager" },
  { name: "Sneha Kapoor", loginId: "sneha.k", email: "sneha.kapoor@stocksense.demo", password: "Sneha@1234", role: "staff" },
  { name: "Vikram Singh", loginId: "vikram.s", email: "vikram.singh@stocksense.demo", password: "Vikram@1234", role: "staff" },
  { name: "Ananya Rao", loginId: "ananya.r", email: "ananya.rao@stocksense.demo", password: "Ananya@1234", role: "staff" },
  { name: "Arjun Nair", loginId: "arjun.n", email: "arjun.nair@stocksense.demo", password: "Arjun@1234", role: "staff", inactive: true },
] as const;

const WAREHOUSES = [
  {
    key: "WH",
    name: "Main Warehouse",
    address: "Plot 12, IDA Uppal, Hyderabad 500039",
    locations: [
      { key: "stock", name: "Main Stock", shortCode: "Stock" },
      { key: "rackA", name: "Rack A", shortCode: "RackA" },
      { key: "rackB", name: "Rack B", shortCode: "RackB" },
      { key: "prod", name: "Production Rack", shortCode: "Prod" },
      { key: "qc", name: "Quality Check", shortCode: "QC" },
      { key: "dispatch", name: "Dispatch Bay", shortCode: "Dispatch" },
    ],
  },
  {
    key: "WH2",
    name: "Medchal Depot",
    address: "Survey 118, Medchal Road, Hyderabad 501401",
    locations: [
      { key: "stock", name: "Depot Stock", shortCode: "Stock" },
      { key: "bulk", name: "Bulk Storage", shortCode: "Bulk" },
      { key: "rackC", name: "Rack C", shortCode: "RackC" },
    ],
  },
  {
    key: "BLR",
    name: "Bengaluru DC",
    address: "Plot 7, Peenya Industrial Area, Bengaluru 560058",
    locations: [
      { key: "stock", name: "DC Stock", shortCode: "Stock" },
      { key: "returns", name: "Returns Area", shortCode: "Returns" },
    ],
  },
] as const;

const CATEGORIES = [
  { name: "Furniture", description: "Finished desks, chairs, tables and storage" },
  { name: "Raw Materials", description: "Steel, wood, boards, foam and finishes" },
  { name: "Hardware & Fasteners", description: "Screws, bolts, slides, hinges and wheels" },
  { name: "Electronics", description: "Monitors, peripherals and lighting" },
  { name: "Packaging", description: "Boxes, tape, wrap and pallets" },
  { name: "Office Supplies", description: "Paper, toner and stationery" },
  { name: "Spare Parts", description: "Replacement parts for after-sales service" },
] as const;

type Kind = "finished" | "raw" | "hardware" | "electronics" | "packaging" | "office" | "spare";
type Range = readonly [number, number];

interface ProductSpec {
  name: string;
  sku: string;
  category: (typeof CATEGORIES)[number]["name"];
  uom: string;
  cost: number;
  kind: Kind;
  /** [min, max] per warehouse where the product is stocked; drives opening stock and reorder rules. */
  WH?: Range;
  WH2?: Range;
  BLR?: Range;
  /** Products that are no longer replenished (they sell out during the simulation). */
  discontinued?: boolean;
  /** Excluded from the random simulation (used by the scripted walkthrough). */
  scripted?: boolean;
}

const PRODUCTS: ProductSpec[] = [
  { name: "Desk", sku: "DESK001", category: "Furniture", uom: "Units", cost: 3000, kind: "finished", WH: [10, 60], BLR: [5, 25] },
  { name: "Standing Desk", sku: "DESK002", category: "Furniture", uom: "Units", cost: 18500, kind: "finished", WH: [4, 20], BLR: [2, 10] },
  { name: "Office Chair", sku: "CHAIR001", category: "Furniture", uom: "Units", cost: 1800, kind: "finished", WH: [20, 90], BLR: [10, 40] },
  { name: "Ergonomic Chair", sku: "CHAIR002", category: "Furniture", uom: "Units", cost: 8900, kind: "finished", WH: [6, 30], BLR: [4, 18] },
  { name: "Table", sku: "TABLE001", category: "Furniture", uom: "Units", cost: 3000, kind: "finished", WH: [10, 60] },
  { name: "Conference Table", sku: "TABLE002", category: "Furniture", uom: "Units", cost: 24000, kind: "finished", WH: [2, 8] },
  { name: "Bookshelf", sku: "SHELF001", category: "Furniture", uom: "Units", cost: 5200, kind: "finished", WH: [5, 25], BLR: [3, 12] },
  { name: "Filing Cabinet", sku: "CAB001", category: "Furniture", uom: "Units", cost: 7400, kind: "finished", WH: [4, 20] },
  { name: "Sofa 3-Seater", sku: "SOFA001", category: "Furniture", uom: "Units", cost: 21000, kind: "finished", WH: [2, 8], discontinued: true },
  { name: "Bar Stool", sku: "STOOL001", category: "Furniture", uom: "Units", cost: 2100, kind: "finished", WH: [6, 24], discontinued: true },
  { name: "Steel", sku: "STEEL001", category: "Raw Materials", uom: "kg", cost: 65, kind: "raw", WH: [100, 300], scripted: true },
  { name: "Steel Rods", sku: "ROD001", category: "Raw Materials", uom: "Units", cost: 450, kind: "raw", WH: [40, 160], WH2: [60, 240] },
  { name: "Aluminium Sheet", sku: "ALU001", category: "Raw Materials", uom: "kg", cost: 240, kind: "raw", WH: [80, 300], WH2: [100, 400] },
  { name: "Plywood Sheet", sku: "PLY001", category: "Raw Materials", uom: "Units", cost: 1200, kind: "raw", WH: [30, 120], WH2: [40, 160] },
  { name: "MDF Board", sku: "MDF001", category: "Raw Materials", uom: "Units", cost: 950, kind: "raw", WH: [30, 120] },
  { name: "Teak Wood Plank", sku: "TEAK001", category: "Raw Materials", uom: "m", cost: 1800, kind: "raw", WH: [20, 80] },
  { name: "Foam Sheet", sku: "FOAM001", category: "Raw Materials", uom: "m", cost: 320, kind: "raw", WH: [40, 150] },
  { name: "Upholstery Fabric", sku: "FAB001", category: "Raw Materials", uom: "m", cost: 410, kind: "raw", WH: [50, 200] },
  { name: "Powder Coat Paint", sku: "PAINT001", category: "Raw Materials", uom: "L", cost: 520, kind: "raw", WH: [20, 80] },
  { name: "Wood Polish", sku: "POL001", category: "Raw Materials", uom: "L", cost: 380, kind: "raw", WH: [15, 60] },
  { name: "Wood Screws", sku: "SCREW001", category: "Hardware & Fasteners", uom: "Box", cost: 150, kind: "hardware", WH: [30, 120], WH2: [40, 160] },
  { name: "Hex Bolts M8", sku: "BOLT001", category: "Hardware & Fasteners", uom: "Box", cost: 260, kind: "hardware", WH: [20, 90] },
  { name: "Drawer Slides", sku: "SLIDE001", category: "Hardware & Fasteners", uom: "Pair", cost: 340, kind: "hardware", WH: [60, 240] },
  { name: "Cabinet Hinges", sku: "HINGE001", category: "Hardware & Fasteners", uom: "Pair", cost: 90, kind: "hardware", WH: [100, 400] },
  { name: "Castor Wheels", sku: "CAST001", category: "Hardware & Fasteners", uom: "Units", cost: 120, kind: "hardware", WH: [80, 320] },
  { name: "Gas Lift Cylinder", sku: "GAS001", category: "Hardware & Fasteners", uom: "Units", cost: 650, kind: "hardware", WH: [30, 120] },
  { name: "Door Handles", sku: "HAND001", category: "Hardware & Fasteners", uom: "Units", cost: 180, kind: "hardware", WH: [40, 160] },
  { name: 'LED Monitor 24"', sku: "MON001", category: "Electronics", uom: "Units", cost: 9500, kind: "electronics", WH: [5, 25], BLR: [4, 16] },
  { name: "Wireless Keyboard", sku: "KEYB001", category: "Electronics", uom: "Units", cost: 1200, kind: "electronics", WH: [15, 60], BLR: [10, 40] },
  { name: "Wireless Mouse", sku: "MOUSE001", category: "Electronics", uom: "Units", cost: 650, kind: "electronics", WH: [20, 80], BLR: [10, 40] },
  { name: "Laptop Stand", sku: "LSTAND01", category: "Electronics", uom: "Units", cost: 1450, kind: "electronics", WH: [10, 40], BLR: [6, 24] },
  { name: "USB-C Dock", sku: "DOCK001", category: "Electronics", uom: "Units", cost: 4800, kind: "electronics", WH: [5, 20] },
  { name: "LED Desk Lamp", sku: "LAMP001", category: "Electronics", uom: "Units", cost: 1350, kind: "electronics", WH: [10, 40] },
  { name: "Carton Box", sku: "BOX001", category: "Packaging", uom: "Units", cost: 25, kind: "packaging", WH: [150, 600], WH2: [200, 800] },
  { name: "Large Carton Box", sku: "BOX002", category: "Packaging", uom: "Units", cost: 45, kind: "packaging", WH: [100, 400] },
  { name: "Packing Tape", sku: "TAPE001", category: "Packaging", uom: "Roll", cost: 60, kind: "packaging", WH: [20, 100], WH2: [30, 120] },
  { name: "Bubble Wrap", sku: "WRAP001", category: "Packaging", uom: "Roll", cost: 480, kind: "packaging", WH: [8, 30] },
  { name: "Stretch Film", sku: "FILM001", category: "Packaging", uom: "Roll", cost: 390, kind: "packaging", WH: [8, 30] },
  { name: "Wooden Pallet", sku: "PAL001", category: "Packaging", uom: "Units", cost: 850, kind: "packaging", WH: [10, 40], WH2: [20, 60] },
  { name: "A4 Paper Ream", sku: "PAPER001", category: "Office Supplies", uom: "Pack", cost: 280, kind: "office", WH: [20, 80], BLR: [10, 40] },
  { name: "Printer Toner", sku: "TONER001", category: "Office Supplies", uom: "Units", cost: 3200, kind: "office", WH: [4, 16] },
  { name: "Whiteboard Marker", sku: "MARK001", category: "Office Supplies", uom: "Box", cost: 240, kind: "office", WH: [10, 40] },
  { name: "Notebook", sku: "NOTE001", category: "Office Supplies", uom: "Pack", cost: 450, kind: "office", WH: [10, 40], BLR: [6, 24] },
  { name: "Chair Armrest", sku: "ARM001", category: "Spare Parts", uom: "Pair", cost: 750, kind: "spare", WH: [10, 40] },
  { name: "Seat Cushion", sku: "CUSH001", category: "Spare Parts", uom: "Units", cost: 1100, kind: "spare", WH: [8, 30] },
  { name: "Desk Leg Set", sku: "LEG001", category: "Spare Parts", uom: "Units", cost: 1600, kind: "spare", WH: [6, 24] },
];

const VENDORS: Record<Kind, string[]> = {
  finished: ["Featherlite", "Godrej Interio", "Nilkamal Furniture"],
  raw: ["JSW Steel", "Greenply Industries", "Century Plyboards", "Asian Paints"],
  hardware: ["Hettich India", "Ebco Hardware"],
  electronics: ["Dell India", "Logitech India", "Philips Lighting"],
  packaging: ["PackRight Supplies", "Uflex Packaging"],
  office: ["Navneet Stationery", "Canon India"],
  spare: ["Featherlite", "Hettich India"],
};

const CUSTOMERS = [
  { name: "Azure Interior", address: "Road No. 12, Banjara Hills, Hyderabad" },
  { name: "Deco Addict", address: "Jubilee Hills Check Post, Hyderabad" },
  { name: "Gemini Furniture", address: "Kondapur Main Road, Hyderabad" },
  { name: "Nova Retail", address: "KPHB Colony, Kukatpally, Hyderabad" },
  { name: "Modern Office Pvt Ltd", address: "Mindspace, HITEC City, Hyderabad" },
  { name: "Kaveri Interiors", address: "Indiranagar 100 Ft Road, Bengaluru" },
  { name: "Deccan Office Solutions", address: "Begumpet, Hyderabad" },
  { name: "Sharma Traders", address: "Abids, Hyderabad" },
  { name: "UrbanNest Coworking", address: "Koramangala 5th Block, Bengaluru" },
  { name: "BrightPath Schools", address: "Gachibowli, Hyderabad" },
  { name: "Lotus Hospitals", address: "Whitefield, Bengaluru" },
  { name: "Metro Cafe Chain", address: "Ameerpet, Hyderabad" },
];

const SELLABLE: Kind[] = ["finished", "electronics", "office", "spare"];

/* ------------------------------------------------------------------ types */

interface UserInfo {
  _id: Types.ObjectId;
  name: string;
  role: "manager" | "staff";
}
interface LocationInfo {
  _id: Types.ObjectId;
  fullName: string;
  warehouseKey: string | null;
}
interface WarehouseInfo {
  _id: Types.ObjectId;
  key: string;
  name: string;
  locations: Record<string, LocationInfo>;
}
interface ProductInfo extends ProductSpec {
  _id: Types.ObjectId;
  categoryId: Types.ObjectId;
}
interface LineSpec {
  product: ProductInfo;
  quantity: number;
  systemQty?: number;
  delta?: number;
}

/* ------------------------------------------------------------------- seed */

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
  const started = Date.now();
  const auditDocs: Record<string, unknown>[] = [];
  const audit = (
    at: Date,
    actor: UserInfo | null,
    entry: { entityType: string; entityId: Types.ObjectId; entityLabel: string; action: string; message: string; link: string | null },
  ) => auditDocs.push({ ...entry, user: actor?._id ?? null, userName: actor?.name ?? "System", createdAt: at });

  /* users */
  console.log("Users…");
  const users: UserInfo[] = [];
  for (const spec of USERS) {
    const _id = new Types.ObjectId();
    await models.User.collection.insertOne({
      _id,
      name: spec.name,
      loginId: spec.loginId,
      email: spec.email,
      passwordHash: await hashPassword(spec.password),
      role: spec.role,
      isActive: !("inactive" in spec),
      sessionVersion: 0,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: "inactive" in spec ? dayAt(-30, 9) : dayAt(-int(0, 2), 9, int(0, 40)),
      createdAt: dayAt(-HISTORY_DAYS - 2, 10),
      updatedAt: dayAt(-HISTORY_DAYS - 2, 10),
    });
    users.push({ _id, name: spec.name, role: spec.role });
  }
  const managers = users.filter((user) => user.role === "manager");
  const staff = users.filter((user) => user.role === "staff" && user.name !== "Arjun Nair");
  const [admin] = managers;
  users.forEach((user, index) =>
    audit(addMinutes(dayAt(-HISTORY_DAYS - 2, 10), index * 7), admin, {
      entityType: "user",
      entityId: user._id,
      entityLabel: user.name,
      action: index === 0 ? "signed_up" : "created",
      message: index === 0 ? "Created the workspace as Inventory Manager" : `Invited ${user.name} as ${user.role === "manager" ? "Inventory Manager" : "Warehouse Staff"}`,
      link: "/settings/users",
    }),
  );

  /* warehouses and locations */
  console.log("Warehouses and locations…");
  const warehouses: Record<string, WarehouseInfo> = {};
  for (const [index, spec] of WAREHOUSES.entries()) {
    const _id = new Types.ObjectId();
    const locations: Record<string, LocationInfo> = {};
    const locationDocs = spec.locations.map((location) => {
      const doc = {
        _id: new Types.ObjectId(),
        name: location.name,
        shortCode: location.shortCode,
        warehouse: _id,
        type: "internal",
        fullName: `${spec.key}/${location.shortCode}`,
        isSystem: false,
        createdAt: dayAt(-HISTORY_DAYS - 1, 11),
        updatedAt: dayAt(-HISTORY_DAYS - 1, 11),
      };
      locations[location.key] = { _id: doc._id, fullName: doc.fullName, warehouseKey: spec.key };
      return doc;
    });
    await models.Warehouse.collection.insertOne({
      _id,
      name: spec.name,
      shortCode: spec.key,
      address: spec.address,
      defaultLocation: locations.stock._id,
      createdAt: addMinutes(dayAt(-HISTORY_DAYS - 1, 11), index * 20),
      updatedAt: addMinutes(dayAt(-HISTORY_DAYS - 1, 11), index * 20),
    });
    await models.Location.collection.insertMany(locationDocs);
    warehouses[spec.key] = { _id, key: spec.key, name: spec.name, locations };
    const at = addMinutes(dayAt(-HISTORY_DAYS - 1, 11), index * 20);
    audit(at, admin, {
      entityType: "warehouse",
      entityId: _id,
      entityLabel: spec.name,
      action: "created",
      message: `Created warehouse ${spec.name} (${spec.key}) with location ${locations.stock.fullName}`,
      link: "/settings/warehouses",
    });
    for (const doc of locationDocs.slice(1)) {
      audit(addMinutes(at, 3), admin, {
        entityType: "location",
        entityId: doc._id,
        entityLabel: doc.fullName,
        action: "created",
        message: `Created location ${doc.fullName}`,
        link: "/settings/locations",
      });
    }
  }
  const vendorLoc = await getSystemLocation("vendor");
  const customerLoc = await getSystemLocation("customer");
  const adjustLoc = await getSystemLocation("adjustment");
  const virtual = {
    vendor: { _id: vendorLoc._id, fullName: vendorLoc.fullName, warehouseKey: null },
    customer: { _id: customerLoc._id, fullName: customerLoc.fullName, warehouseKey: null },
    adjustment: { _id: adjustLoc._id, fullName: adjustLoc.fullName, warehouseKey: null },
  };

  /* catalog */
  console.log("Catalog…");
  const categoryIds: Record<string, Types.ObjectId> = {};
  for (const [index, category] of CATEGORIES.entries()) {
    const _id = new Types.ObjectId();
    categoryIds[category.name] = _id;
    await models.Category.collection.insertOne({ _id, ...category, createdAt: dayAt(-HISTORY_DAYS, 9), updatedAt: dayAt(-HISTORY_DAYS, 9) });
    audit(addMinutes(dayAt(-HISTORY_DAYS, 9), index), admin, {
      entityType: "category",
      entityId: _id,
      entityLabel: category.name,
      action: "created",
      message: `Created category ${category.name}`,
      link: "/products/categories",
    });
  }
  const products: ProductInfo[] = PRODUCTS.map((spec) => ({ ...spec, _id: new Types.ObjectId(), categoryId: categoryIds[spec.category] }));
  await models.Product.collection.insertMany(
    products.map((product) => ({
      _id: product._id,
      name: product.name,
      sku: product.sku,
      category: product.categoryId,
      uom: product.uom,
      costPrice: product.cost,
      description: "",
      isActive: true,
      createdAt: dayAt(-HISTORY_DAYS, 10),
      updatedAt: dayAt(-HISTORY_DAYS, 10),
    })),
  );
  products.forEach((product, index) =>
    audit(addMinutes(dayAt(-HISTORY_DAYS, 10), index), pick(managers), {
      entityType: "product",
      entityId: product._id,
      entityLabel: product.name,
      action: "created",
      message: `Created product ${product.name} (${product.sku})`,
      link: `/products/${product._id.toString()}`,
    }),
  );

  const ruleDocs: Record<string, unknown>[] = [];
  for (const product of products) {
    for (const key of ["WH", "WH2", "BLR"] as const) {
      const range = product[key];
      if (!range || (product.kind === "raw" && key === "WH2" && !chance(0.7))) continue;
      ruleDocs.push({
        _id: new Types.ObjectId(),
        product: product._id,
        warehouse: warehouses[key]._id,
        minQty: range[0],
        maxQty: range[1],
        createdAt: dayAt(-HISTORY_DAYS, 11),
        updatedAt: dayAt(-HISTORY_DAYS, 11),
      });
    }
  }
  await models.ReorderRule.collection.insertMany(ruleDocs);

  /* simulation state */
  const stock = new Map<string, number>();
  const stockKey = (location: LocationInfo, product: ProductInfo) => `${location._id.toString()}:${product._id.toString()}`;
  const onHand = (location: LocationInfo, product: ProductInfo) => stock.get(stockKey(location, product)) ?? 0;
  const move = (location: LocationInfo, product: ProductInfo, delta: number) => {
    const next = round3(onHand(location, product) + delta);
    if (next < 0) throw new Error(`Simulation drove ${product.sku} negative at ${location.fullName}`);
    stock.set(stockKey(location, product), next);
  };
  const counters = new Map<string, number>();
  const nextReference = (warehouseKey: string, type: OperationType) => {
    const key = `${warehouseKey}/${OPERATION_META[type].prefix}`;
    const seq = (counters.get(key) ?? 0) + 1;
    counters.set(key, seq);
    return `${key}/${String(seq).padStart(4, "0")}`;
  };

  const opDocs: Record<string, unknown>[] = [];
  function record(spec: {
    type: OperationType;
    warehouse: WarehouseInfo;
    source: LocationInfo;
    dest: LocationInfo;
    lines: LineSpec[];
    day: number;
    hour?: number;
    creator: UserInfo;
    processor?: UserInfo;
    contact?: string;
    address?: string;
    notes?: string;
    cancel?: boolean;
  }) {
    const _id = new Types.ObjectId();
    // References are assigned after sorting by date, so numbering follows creation time.
    const reference = "";
    const link = operationPath(spec.type, _id.toString());
    const createdAt = dayAt(spec.day, spec.hour ?? int(8, 11), int(0, 59));
    const processor = spec.processor ?? pick(staff);
    const status: OperationStatus = spec.cancel ? "cancelled" : "done";
    // About one in eight operations is validated a day or two after its scheduled date.
    const lateBy = spec.day < -3 && chance(0.12) ? int(1, 2) * 24 * 60 : 0;
    const doneAt = spec.cancel ? null : addMinutes(createdAt, int(60, 360) + lateBy);
    const entity = { entityType: "operation", entityId: _id, entityLabel: reference, link };

    audit(createdAt, spec.creator, {
      ...entity,
      action: "created",
      message:
        spec.type === "adjustment" && spec.notes
          ? `Created stock count: ${spec.notes}`
          : `Created ${OPERATION_META[spec.type].label.toLowerCase()} with ${spec.lines.length} product${spec.lines.length === 1 ? "" : "s"}`,
    });
    if (spec.type !== "adjustment") {
      audit(addMinutes(createdAt, int(5, 40)), spec.creator, {
        ...entity,
        action: "ready",
        message: spec.type === "receipt" ? "Marked as To Do: ready to receive" : "Marked as To Do: stock reserved",
      });
    }
    const summary = summarizeLines(spec.lines.map((line) => ({ productName: line.product.name, quantity: line.quantity, uom: line.product.uom })));
    if (spec.cancel) {
      audit(addMinutes(createdAt, int(60, 240)), spec.creator, {
        ...entity,
        action: "cancelled",
        message: spec.type === "receipt" ? "Cancelled" : "Cancelled and released reserved stock",
      });
    } else if (doneAt) {
      if (spec.type === "delivery") {
        audit(addMinutes(doneAt, -int(40, 70)), processor, { ...entity, action: "picked", message: "Picked all items" });
        audit(addMinutes(doneAt, -int(10, 30)), processor, { ...entity, action: "packed", message: "Packed items for shipping" });
      }
      const message = {
        receipt: `Validated: received ${summary} into ${spec.dest.fullName}`,
        delivery: `Validated: shipped ${summary} from ${spec.source.fullName}`,
        internal: `Validated: moved ${summary} from ${spec.source.fullName} to ${spec.dest.fullName}`,
        adjustment: (() => {
          const deltas = spec.lines
            .filter((line) => line.delta)
            .map((line) => `${line.product.name} ${line.delta! > 0 ? "+" : "−"}${formatQty(Math.abs(line.delta!))} ${line.product.uom}`);
          return deltas.length ? `Validated count at ${spec.dest.fullName}: ${deltas.join(", ")}` : `Validated count at ${spec.dest.fullName}: no difference`;
        })(),
      }[spec.type];
      audit(doneAt, processor, { ...entity, action: "validated", message });

      for (const line of spec.lines) {
        if (spec.type === "receipt") move(spec.dest, line.product, line.quantity);
        if (spec.type === "delivery") move(spec.source, line.product, -line.quantity);
        if (spec.type === "internal") {
          move(spec.source, line.product, -line.quantity);
          move(spec.dest, line.product, line.quantity);
        }
        if (spec.type === "adjustment") move(spec.dest, line.product, line.delta ?? 0);
      }
    }

    opDocs.push({
      _id,
      reference,
      type: spec.type,
      status,
      warehouseKey: spec.warehouse.key,
      warehouse: spec.warehouse._id,
      sourceLocation: spec.source._id,
      destLocation: spec.dest._id,
      sourceName: spec.source.fullName,
      destName: spec.dest.fullName,
      contact: spec.contact ?? "",
      deliveryAddress: spec.address ?? "",
      scheduledDate: isoDay(spec.day),
      responsible: spec.creator._id,
      responsibleName: spec.creator.name,
      notes: spec.notes ?? "",
      packed: spec.type === "delivery" && !spec.cancel,
      lines: spec.lines.map((line) => ({
        _id: new Types.ObjectId(),
        product: line.product._id,
        productName: line.product.name,
        sku: line.product.sku,
        uom: line.product.uom,
        category: line.product.categoryId,
        quantity: line.quantity,
        picked: spec.type === "delivery" && !spec.cancel,
        systemQty: line.systemQty ?? null,
        delta: line.delta ?? null,
      })),
      doneAt,
      doneBy: doneAt ? processor._id : null,
      doneByName: doneAt ? processor.name : "",
      cancelledAt: spec.cancel ? addMinutes(createdAt, 120) : null,
      createdBy: spec.creator._id,
      createdAt,
      updatedAt: doneAt ?? addMinutes(createdAt, 120),
      __v: 0,
    });
  }

  const stockOf = (key: string) => warehouses[key].locations.stock;
  const adjust = (location: LocationInfo, product: ProductInfo, counted: number): LineSpec => {
    const systemQty = onHand(location, product);
    return { product, quantity: counted, systemQty, delta: round3(counted - systemQty) };
  };

  /* opening balances */
  console.log("Simulating 75 days of operations…");
  const start = -HISTORY_DAYS;
  const openingLocation: Record<string, LocationInfo> = {
    WH: stockOf("WH"),
    WH2: warehouses.WH2.locations.bulk,
    BLR: stockOf("BLR"),
  };
  for (const key of ["WH", "WH2", "BLR"] as const) {
    const lines = products
      .filter((product) => product[key] && !product.scripted)
      .map((product) => adjust(openingLocation[key], product, nice(int(product[key]![0] * 1.3, product[key]![1]))));
    record({
      type: "adjustment",
      warehouse: warehouses[key],
      source: virtual.adjustment,
      dest: openingLocation[key],
      lines,
      day: start,
      hour: 9,
      creator: admin,
      processor: admin,
      notes: "Opening balance",
    });
  }
  // Shelve part of the main stock on racks.
  record({
    type: "internal",
    warehouse: warehouses.WH,
    source: stockOf("WH"),
    dest: warehouses.WH.locations.rackA,
    lines: sample(products.filter((product) => product.kind === "hardware"), 3).map((product) => ({
      product,
      quantity: nice(onHand(stockOf("WH"), product) * 0.25),
    })),
    day: start + 1,
    creator: pick(staff),
    notes: "Shelve fast-moving hardware on Rack A",
  });

  /* daily simulation */
  const rules = (key: "WH" | "WH2" | "BLR") => products.filter((product) => product[key] && !product.scripted);
  for (let day = start + 1; day <= -1; day += 1) {
    const weekday = dayAt(day, 12).getDay();
    if (weekday === 0) continue; // Sundays closed
    const busy = weekday === 6 ? 0.4 : 1;

    // Customer deliveries from Hyderabad and Bengaluru stock.
    const deliveries = weekday === 6 ? int(0, 1) : int(1, 4);
    for (let index = 0; index < deliveries; index += 1) {
      const key = chance(0.72) ? "WH" : "BLR";
      const source = stockOf(key);
      const candidates = products.filter((product) => SELLABLE.includes(product.kind) && product[key] && onHand(source, product) >= 1);
      if (!candidates.length) continue;
      const customer = pick(CUSTOMERS);
      const lines = sample(candidates, int(1, 3)).map((product) => {
        const cap = product.kind === "office" ? 20 : product.cost > 10000 ? 4 : 10;
        return { product, quantity: Math.min(onHand(source, product), int(1, cap)) };
      });
      record({
        type: "delivery",
        warehouse: warehouses[key],
        source,
        dest: virtual.customer,
        lines,
        day,
        creator: pick(managers),
        contact: customer.name,
        address: customer.address,
        cancel: chance(0.05),
      });
    }

    // Replenishment: vendor receipts when stock drops near the reorder minimum.
    for (const key of ["WH", "WH2", "BLR"] as const) {
      const location = openingLocation[key];
      const low = rules(key).filter(
        (product) => !product.discontinued && onHand(location, product) <= product[key]![0] * 1.4,
      );
      const byKind = new Map<Kind, ProductInfo[]>();
      for (const product of low) byKind.set(product.kind, [...(byKind.get(product.kind) ?? []), product]);
      for (const [kind, items] of byKind) {
        // Replenishment slows down in the last two weeks, so some products end below their minimum.
        if (!chance((day > -14 ? 0.04 : 0.45) * busy)) continue;
        const lines = items.slice(0, 4).map((product) => ({
          product,
          quantity: nice(product[key]![1] - onHand(location, product) + int(0, product[key]![0])),
        }));
        record({
          type: "receipt",
          warehouse: warehouses[key],
          source: virtual.vendor,
          dest: location,
          lines,
          day,
          creator: pick(managers),
          contact: pick(VENDORS[kind]),
          cancel: chance(0.03),
        });
      }
    }

    // Production: raw materials to the production rack on Mondays and Thursdays.
    if (weekday === 1 || weekday === 4) {
      const main = stockOf("WH");
      const materials = sample(
        products.filter((product) => (product.kind === "raw" || product.kind === "hardware") && !product.scripted && onHand(main, product) > 10),
        int(2, 4),
      );
      if (materials.length) {
        record({
          type: "internal",
          warehouse: warehouses.WH,
          source: main,
          dest: warehouses.WH.locations.prod,
          lines: materials.map((product) => ({ product, quantity: nice(onHand(main, product) * (0.15 + random() * 0.2)) })),
          day,
          creator: pick(staff),
          notes: "Materials for this week's production run",
        });
      }
    }

    // Fridays: production consumption count and a cycle count at the main store.
    if (weekday === 5) {
      const prod = warehouses.WH.locations.prod;
      const consumed = products.filter((product) => onHand(prod, product) > 0 && !product.scripted).slice(0, 4);
      if (consumed.length) {
        record({
          type: "adjustment",
          warehouse: warehouses.WH,
          source: virtual.adjustment,
          dest: prod,
          lines: consumed.map((product) => adjust(prod, product, unitQty(product, onHand(prod, product) * (0.2 + random() * 0.3)))),
          day,
          hour: 17,
          creator: pick(staff),
          notes: "Weekly count at production rack (consumed in production)",
        });
      }
      const main = stockOf("WH");
      const counted = sample(products.filter((product) => onHand(main, product) > 5 && !product.scripted), 3);
      if (counted.length) {
        record({
          type: "adjustment",
          warehouse: warehouses.WH,
          source: virtual.adjustment,
          dest: main,
          lines: counted.map((product) => adjust(main, product, Math.max(0, onHand(main, product) + pick([-3, -2, -1, -1, 1, 2])))),
          day,
          hour: 18,
          creator: pick(staff),
          notes: "Weekly cycle count",
        });
      }
    }

    // Wednesdays: inter-warehouse replenishment.
    if (weekday === 3) {
      const bulk = warehouses.WH2.locations.bulk;
      const main = stockOf("WH");
      const toMain = products.filter(
        (product) => product.WH && product.WH2 && onHand(main, product) < product.WH[0] * 1.6 && onHand(bulk, product) > 20,
      );
      if (toMain.length) {
        record({
          type: "internal",
          warehouse: warehouses.WH2,
          source: bulk,
          dest: main,
          lines: toMain.slice(0, 3).map((product) => ({ product, quantity: nice(onHand(bulk, product) * 0.35) })),
          day,
          creator: pick(staff),
          notes: "Replenish main warehouse from Medchal depot",
        });
      }
      const blr = stockOf("BLR");
      const toBlr = products.filter(
        (product) => product.BLR && !product.discontinued && onHand(blr, product) < product.BLR[0] * 1.5 && onHand(main, product) > product.WH![0] + 5,
      );
      if (toBlr.length) {
        record({
          type: "internal",
          warehouse: warehouses.WH,
          source: main,
          dest: blr,
          lines: toBlr.slice(0, 3).map((product) => ({ product, quantity: nice(Math.min(onHand(main, product) - product.WH![0], product.BLR![1] / 2)) })),
          day,
          creator: pick(staff),
          notes: "Stock transfer to Bengaluru DC",
        });
      }
    }
  }

  /* the problem statement walkthrough */
  console.log("Replaying the steel walkthrough…");
  const steel = products.find((product) => product.sku === "STEEL001")!;
  const main = stockOf("WH");
  record({ type: "receipt", warehouse: warehouses.WH, source: virtual.vendor, dest: main, lines: [{ product: steel, quantity: 100 }], day: -20, hour: 10, creator: admin, contact: "Tata Steel" });
  record({ type: "internal", warehouse: warehouses.WH, source: main, dest: warehouses.WH.locations.prod, lines: [{ product: steel, quantity: 40 }], day: -18, hour: 11, creator: pick(staff), notes: "Main store to production rack" });
  record({ type: "delivery", warehouse: warehouses.WH, source: main, dest: virtual.customer, lines: [{ product: steel, quantity: 20 }], day: -15, hour: 10, creator: admin, contact: "Azure Interior", address: CUSTOMERS[0].address });
  record({ type: "adjustment", warehouse: warehouses.WH, source: virtual.adjustment, dest: main, lines: [adjust(main, steel, 37)], day: -12, hour: 16, creator: pick(staff), notes: "3 kg steel damaged" });

  /* bulk insert history */
  console.log(`Writing ${opDocs.length} operations…`);
  opDocs.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  const references = new Map<string, string>();
  for (const doc of opDocs) {
    doc.reference = nextReference(doc.warehouseKey as string, doc.type as OperationType);
    references.set((doc._id as Types.ObjectId).toString(), doc.reference as string);
    delete doc.warehouseKey;
  }
  for (const entry of auditDocs) {
    if (entry.entityType === "operation") entry.entityLabel = references.get((entry.entityId as Types.ObjectId).toString());
  }
  await models.Operation.collection.insertMany(opDocs);
  const locationWarehouse = new Map<string, Types.ObjectId>();
  for (const warehouse of Object.values(warehouses)) {
    for (const location of Object.values(warehouse.locations)) locationWarehouse.set(location._id.toString(), warehouse._id);
  }
  const quantDocs = [...stock.entries()]
    .filter(([, quantity]) => quantity !== 0)
    .map(([key, quantity]) => {
      const [locationId, productId] = key.split(":");
      return {
        _id: new Types.ObjectId(),
        product: new Types.ObjectId(productId),
        location: new Types.ObjectId(locationId),
        warehouse: locationWarehouse.get(locationId)!,
        quantity,
        reservedQuantity: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  await models.StockQuant.collection.insertMany(quantDocs);
  await models.Counter.bulkWrite(
    [...counters.entries()].map(([key, seq]) => ({ updateOne: { filter: { _id: key }, update: { $set: { seq } }, upsert: true } })),
  );

  // Recent sign-ins for the audit trail.
  for (let day = -6; day <= 0; day += 1) {
    if (dayAt(day, 12).getDay() === 0) continue;
    for (const user of sample([...managers, ...staff], 4)) {
      audit(dayAt(day, 8, int(30, 59)), user, {
        entityType: "user",
        entityId: user._id,
        entityLabel: user.name,
        action: "signed_in",
        message: "Signed in",
        link: "/settings/users",
      });
    }
  }
  await models.AuditLog.collection.insertMany(auditDocs);

  /* today's open work through the real engine */
  console.log("Creating today's open work through the inventory engine…");
  const byName = (sku: string) => products.find((product) => product.sku === sku)!;
  const actorOf = (user: UserInfo): Actor => ({ id: user._id.toString(), name: user.name });
  const kavya = actorOf(staff[0]);
  async function open(
    type: OperationType,
    fields: { source?: LocationInfo; dest?: LocationInfo; contact?: string; address?: string; day: number; notes?: string },
    lines: [string, number][],
    actions: OperationAction[],
    creator = actorOf(admin),
  ): Promise<string | null> {
    try {
      const id = await createOperation(
        {
          type,
          sourceLocation: fields.source?._id.toString() ?? "",
          destLocation: fields.dest?._id.toString() ?? "",
          contact: fields.contact ?? "",
          deliveryAddress: fields.address ?? "",
          scheduledDate: isoDay(fields.day),
          responsible: creator.id,
          notes: fields.notes ?? "",
          lines: lines.map(([sku, quantity]) => ({ product: byName(sku)._id.toString(), quantity })),
        },
        creator,
      );
      for (const action of actions) {
        await runOperationAction(id, action, action === "pick" ? { picked: true } : action === "pack" ? { packed: true } : {}, action === "confirm" ? creator : kavya);
      }
      return id;
    } catch (error) {
      console.warn(`  skipped ${type}: ${(error as Error).message}`);
      return null;
    }
  }
  const blr = stockOf("BLR");
  const bulk = warehouses.WH2.locations.bulk;
  await open("receipt", { dest: main, contact: "Hettich India", day: -2 }, [["SLIDE001", 200], ["HINGE001", 300]], ["confirm"]);
  await open("receipt", { dest: main, contact: "Dell India", day: 0 }, [["MON001", 15], ["DOCK001", 10]], ["confirm"]);
  await open("receipt", { dest: main, contact: "Greenply Industries", day: 2 }, [["PLY001", 60], ["MDF001", 40]], []);
  await open("receipt", { dest: blr, contact: "Featherlite", day: 1 }, [["CHAIR002", 20]], ["confirm"]);
  await open("receipt", { dest: bulk, contact: "JSW Steel", day: 4 }, [["ROD001", 120], ["ALU001", 200]], []);
  await open("delivery", { source: main, contact: "Azure Interior", address: CUSTOMERS[0].address, day: 0 }, [["DESK001", 5], ["CHAIR001", 10]], ["confirm", "pick"]);
  await open("delivery", { source: main, contact: "BrightPath Schools", address: CUSTOMERS[9].address, day: 0 }, [["SHELF001", 2], ["LAMP001", 2]], ["confirm", "pick", "pack"]);
  await open("delivery", { source: main, contact: "Lotus Hospitals", address: CUSTOMERS[10].address, day: -2 }, [["SOFA001", 4]], ["confirm"]);
  await open("delivery", { source: main, contact: "UrbanNest Coworking", address: CUSTOMERS[8].address, day: -1 }, [["DESK002", 30], ["CHAIR002", 30]], ["confirm"]);
  await open("delivery", { source: main, contact: "Deccan Office Solutions", address: CUSTOMERS[6].address, day: 1 }, [["PAPER001", 12], ["TONER001", 2]], []);
  await open("delivery", { source: blr, contact: "Kaveri Interiors", address: CUSTOMERS[5].address, day: 0 }, [["KEYB001", 4], ["MOUSE001", 4]], ["confirm"]);
  await open("delivery", { source: main, contact: "Metro Cafe Chain", address: CUSTOMERS[11].address, day: 3 }, [["STOOL001", 12]], []);
  await open("internal", { source: main, dest: warehouses.WH.locations.prod, day: 0, notes: "Materials for tomorrow's production run" }, [["FOAM001", 10], ["FAB001", 15]], ["confirm"], kavya);
  await open("internal", { source: bulk, dest: main, day: 1, notes: "Replenish packaging from Medchal depot" }, [["BOX001", 100]], [], kavya);
  await open("adjustment", { dest: warehouses.WH.locations.rackA, day: 1, notes: "Quarterly count of Rack A" }, [["SCREW001", 20]], [], kavya);

  // A partial receipt with its backorder and a customer return, so both flows show in lists and the team feed.
  const tables = await open("receipt", { dest: main, contact: "Godrej Interio", day: 0 }, [["TABLE002", 6]], ["confirm"]);
  try {
    if (tables) {
      const [line] = (await models.Operation.findById(tables).lean())!.lines;
      await runOperationAction(tables, "split", { validate: true, lines: [{ lineId: line._id.toString(), quantity: 4 }] }, kavya);
    }
    const shipped = await models.Operation.findOne({ type: "delivery", status: "done", sourceLocation: main._id, "lines.sku": "LAMP001" })
      .sort({ doneAt: -1 })
      .lean();
    const lamp = shipped?.lines.find((line) => line.sku === "LAMP001");
    if (shipped && lamp) {
      const { id } = await createReturn(shipped._id.toString(), [{ lineId: lamp._id.toString(), quantity: 1 }], actorOf(admin));
      await runOperationAction(id, "confirm", {}, actorOf(admin));
      await runOperationAction(id, "validate", {}, kavya);
    }
  } catch (error) {
    console.warn(`  skipped backorder and return examples: ${(error as Error).message}`);
  }

  const [operations, lines, logs] = await Promise.all([
    models.Operation.countDocuments(),
    models.Operation.aggregate([{ $unwind: "$lines" }, { $count: "n" }]),
    models.AuditLog.countDocuments(),
  ]);
  console.log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)}s: ${products.length} products, ${operations} operations, ${lines[0]?.n ?? 0} moves, ${logs} audit events.`,
  );
  console.log("Sign in with manager / Manager@123 or warehouse / Staff@1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
