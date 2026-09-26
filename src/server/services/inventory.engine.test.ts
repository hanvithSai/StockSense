import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OperationType } from "@/lib/constants";
import { connectDB } from "@/server/db";
import { Category } from "@/server/models/category";
import { Location } from "@/server/models/location";
import { Operation } from "@/server/models/operation";
import { Product } from "@/server/models/product";
import { StockQuant } from "@/server/models/stock-quant";
import { User } from "@/server/models/user";
import { createOperation, runOperationAction, updateOperation, type Actor } from "./inventory";
import { createLocation, createWarehouse } from "./warehouses";

/**
 * End-to-end tests of the stock engine on a real (in-memory) MongoDB replica set, so every
 * action runs inside a transaction exactly as in production.
 */

let replSet: MongoMemoryReplSet;
let actor: Actor;
let stock: string;
let rack: string;
let steel: string;
let bolts: string;
const TODAY = "2026-09-26";

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = replSet.getUri("stocksense-engine-test");
  await connectDB();

  const user = await User.create({ loginId: "tester", email: "tester@example.com", name: "Test Manager", passwordHash: "x", role: "manager" });
  actor = { id: user._id.toString(), name: user.name };
  const warehouseId = await createWarehouse({ name: "Main Warehouse", shortCode: "WH", address: "" }, actor);
  stock = (await Location.findOne({ fullName: "WH/Stock" }).lean())!._id.toString();
  rack = await createLocation({ name: "Production Rack", shortCode: "Prod", warehouse: warehouseId }, actor);
  const category = await Category.create({ name: "Raw Materials" });
  steel = (await Product.create({ name: "Steel", sku: "STEEL001", category: category._id, uom: "kg", costPrice: 65 }))._id.toString();
  bolts = (await Product.create({ name: "Hex Bolts", sku: "BOLT001", category: category._id, uom: "Units", costPrice: 4 }))._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

async function quant(product: string, location: string) {
  const row = await StockQuant.findOne({ product, location }).lean();
  return { onHand: row?.quantity ?? 0, reserved: row?.reservedQuantity ?? 0 };
}

async function operation(type: OperationType, lines: [string, number][], locations: { source?: string; dest?: string } = {}) {
  return createOperation(
    {
      type,
      contact: type === "receipt" ? "JSW Steel" : type === "delivery" ? "Azure Interior" : "",
      sourceLocation: locations.source ?? (type === "delivery" || type === "internal" ? stock : ""),
      destLocation: locations.dest ?? (type === "receipt" || type === "adjustment" ? stock : ""),
      deliveryAddress: "",
      scheduledDate: TODAY,
      responsible: "",
      notes: "",
      lines: lines.map(([product, quantity]) => ({ product, quantity })),
    },
    actor,
  );
}

const run = (id: string, action: Parameters<typeof runOperationAction>[1], body: unknown = {}) => runOperationAction(id, action, body, actor);
const status = async (id: string) => (await Operation.findById(id).lean())!.status;

describe("stock engine", () => {
  it("reproduces the problem statement walkthrough: 100 kg steel ends at 77 kg", async () => {
    const receipt = await operation("receipt", [[steel, 100]]);
    await run(receipt, "confirm");
    await run(receipt, "validate");
    expect(await quant(steel, stock)).toEqual({ onHand: 100, reserved: 0 });

    const transfer = await operation("internal", [[steel, 40]], { source: stock, dest: rack });
    await run(transfer, "confirm");
    await run(transfer, "validate");
    const afterMove = [await quant(steel, stock), await quant(steel, rack)];
    expect(afterMove.map((row) => row.onHand)).toEqual([60, 40]);

    const delivery = await operation("delivery", [[steel, 20]]);
    await run(delivery, "confirm");
    expect(await quant(steel, stock)).toEqual({ onHand: 60, reserved: 20 });
    await run(delivery, "pick", { picked: true });
    await run(delivery, "pack", { packed: true });
    await run(delivery, "validate");
    expect(await quant(steel, stock)).toEqual({ onHand: 40, reserved: 0 });

    const count = await operation("adjustment", [[steel, 37]]);
    await run(count, "validate");
    const counted = (await Operation.findById(count).lean())!.lines[0];
    expect(counted.delta).toBe(-3);

    const total = (await quant(steel, stock)).onHand + (await quant(steel, rack)).onHand;
    expect(total).toBe(77);
  });

  it("refuses to validate a delivery before it is picked and packed", async () => {
    const delivery = await operation("delivery", [[steel, 1]]);
    await run(delivery, "confirm");
    await expect(run(delivery, "validate")).rejects.toThrow("Pick all items");
    await run(delivery, "pick", { picked: true });
    await expect(run(delivery, "validate")).rejects.toThrow("Pack the items");
    await run(delivery, "cancel");
    expect(await quant(steel, stock)).toEqual({ onHand: 37, reserved: 0 });
  });

  it("waits when stock is short and becomes ready by itself when a receipt arrives", async () => {
    const delivery = await operation("delivery", [[bolts, 50]]);
    const { shortages } = await run(delivery, "confirm");
    expect(await status(delivery)).toBe("waiting");
    expect(shortages[0]).toMatchObject({ productName: "Hex Bolts", required: 50, available: 0 });

    const receipt = await operation("receipt", [[bolts, 80]]);
    await run(receipt, "confirm");
    const { promoted } = await run(receipt, "validate");
    const reference = (await Operation.findById(delivery).lean())!.reference;
    expect(promoted).toContain(reference);
    expect(await status(delivery)).toBe("ready");
    expect(await quant(bolts, stock)).toEqual({ onHand: 80, reserved: 50 });

    await run(delivery, "cancel");
    expect(await quant(bolts, stock)).toEqual({ onHand: 80, reserved: 0 });
  });

  it("ships what is in stock and backorders the rest, then promotes the backorder", async () => {
    const delivery = await operation("delivery", [
      [bolts, 100],
      [steel, 10],
    ]);
    await run(delivery, "confirm");
    expect(await status(delivery)).toBe("waiting");

    const { backorder } = await run(delivery, "split");
    expect(backorder?.reference).toMatch(/^WH\/OUT\/\d{4}$/);
    const original = (await Operation.findById(delivery).lean())!;
    expect(original.status).toBe("ready");
    expect(original.lines.map((line) => [line.sku, line.quantity])).toEqual([
      ["BOLT001", 80],
      ["STEEL001", 10],
    ]);
    expect(await quant(bolts, stock)).toEqual({ onHand: 80, reserved: 80 });

    const rest = (await Operation.findById(backorder!.id).lean())!;
    expect(rest.status).toBe("waiting");
    expect(rest.origin).toBe(original.reference);
    expect(rest.lines.map((line) => [line.sku, line.quantity])).toEqual([["BOLT001", 20]]);

    const receipt = await operation("receipt", [[bolts, 20]]);
    await run(receipt, "confirm");
    const { promoted } = await run(receipt, "validate");
    expect(promoted).toContain(rest.reference);
  });

  it("receives part of a receipt and keeps the rest expected in a backorder", async () => {
    const receipt = await operation("receipt", [
      [steel, 50],
      [bolts, 10],
    ]);
    await run(receipt, "confirm");
    const lines = (await Operation.findById(receipt).lean())!.lines;
    const before = (await quant(steel, stock)).onHand;

    const { backorder } = await run(receipt, "split", {
      validate: true,
      lines: [
        { lineId: lines[0]._id.toString(), quantity: 30 },
        { lineId: lines[1]._id.toString(), quantity: 10 },
      ],
    });
    expect(await status(receipt)).toBe("done");
    expect((await quant(steel, stock)).onHand).toBe(before + 30);
    const rest = (await Operation.findById(backorder!.id).lean())!;
    expect(rest.status).toBe("ready");
    expect(rest.lines.map((line) => [line.sku, line.quantity])).toEqual([["STEEL001", 20]]);

    await expect(
      run(backorder!.id, "split", { validate: true, lines: [{ lineId: rest.lines[0]._id.toString(), quantity: 21 }] }),
    ).rejects.toThrow("at most 20 kg were ordered");
  });

  it("never lets a count go below stock reserved by other operations", async () => {
    const delivery = await operation("delivery", [[bolts, 5]]);
    await run(delivery, "confirm");
    const { reserved } = await quant(bolts, stock);
    const count = await operation("adjustment", [[bolts, reserved - 1]]);
    await expect(run(count, "validate")).rejects.toThrow("reserved by pending operations");
  });

  it("rejects an edit based on an outdated version", async () => {
    const receipt = await operation("receipt", [[steel, 5]]);
    const fields = {
      sourceLocation: "",
      destLocation: stock,
      contact: "JSW Steel",
      deliveryAddress: "",
      scheduledDate: TODAY,
      responsible: actor.id,
      notes: "Second truck",
      lines: [{ product: steel, quantity: 5 }],
    };
    await expect(updateOperation(receipt, { ...fields, version: new Date(0).toISOString() }, actor)).rejects.toMatchObject({
      status: 409,
      code: "STALE",
    });
    await expect(updateOperation(receipt, fields, actor)).resolves.toBeUndefined();
  });

  it("keeps every reference unique and sequential per warehouse and type", async () => {
    const references = await Operation.find({ type: "receipt" }).sort({ createdAt: 1 }).distinct("reference");
    expect(new Set(references).size).toBe(references.length);
    expect(references.every((reference: string) => /^WH\/IN\/\d{4}$/.test(reference))).toBe(true);
  });
});
