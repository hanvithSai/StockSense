import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Stock engine tests against an in-memory MongoDB replica set (transactions included). */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.engine.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    // The first run downloads the MongoDB server binary (cached in node_modules/.cache).
    hookTimeout: 300_000,
  },
});
