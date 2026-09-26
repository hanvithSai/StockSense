import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Engine tests need a MongoDB replica set: `npm run test:engine`.
    exclude: [...configDefaults.exclude, "src/**/*.engine.test.ts"],
  },
});
