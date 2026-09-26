import mongoose, { type ClientSession } from "mongoose";
import * as models from "@/server/models";
import { ensureSystemLocations } from "@/server/services/system-locations";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Reuse the connection across hot reloads (dev) and warm serverless invocations (prod).
const globalForMongoose = globalThis as typeof globalThis & { mongooseCache?: MongooseCache };
const cache: MongooseCache = (globalForMongoose.mongooseCache ??= { conn: null, promise: null });

async function bootstrap() {
  // Create collections and indexes up front: transactions cannot build indexes.
  await Promise.all(Object.values(models).map((model) => model.init()));
  await ensureSystemLocations();
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured. Copy .env.example to .env.local.");

  cache.promise ??= mongoose
    .connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 10 })
    .then(async (instance) => {
      await bootstrap();
      return instance;
    })
    .catch((error) => {
      cache.promise = null;
      throw error;
    });

  cache.conn = await cache.promise;
  return cache.conn;
}

/**
 * Runs `work` inside a MongoDB transaction (retried automatically on transient conflicts).
 * Every stock mutation goes through here so quants and operations never diverge.
 */
export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
