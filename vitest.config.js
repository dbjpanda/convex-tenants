import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@djpanda/convex-authz/test": path.resolve(
        __dirname,
        "node_modules/@djpanda/convex-authz/src/test.ts",
      ),
      // Self-reference for example folder tests
      "@djpanda/convex-tenants/test": path.resolve(__dirname, "src/test.ts"),
      "@djpanda/convex-tenants": path.resolve(__dirname, "src/client/index.ts"),
    },
  },
  test: {
    environment: "edge-runtime",
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});
