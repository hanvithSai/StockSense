import { connectDB } from "@/server/db";
import { Operation } from "@/server/models/operation";
import { Product } from "@/server/models/product";
import { Warehouse } from "@/server/models/warehouse";

export interface LandingStats {
  products: number;
  warehouses: number;
  operations: number;
  moves: number;
}

/** Live numbers from the workspace shown on the public landing page. */
export async function getLandingStats(): Promise<LandingStats> {
  await connectDB();
  const [products, warehouses, operations, moves] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Warehouse.countDocuments(),
    Operation.countDocuments(),
    Operation.aggregate<{ total: number }>([
      { $match: { status: "done" } },
      { $group: { _id: null, total: { $sum: { $size: "$lines" } } } },
    ]),
  ]);
  return { products, warehouses, operations, moves: moves[0]?.total ?? 0 };
}
