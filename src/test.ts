/// <reference types="vite/client" />
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import authzTest from "@djpanda/convex-authz/test";
import schema from "./component/schema.js";
const modules = import.meta.glob("./component/**/*.ts");

/**
 * Register the tenants component with the test convex instance.
 *
 * This will also register the authz child component automatically.
 *
 * @example
 * ```typescript
 * import { convexTest } from "convex-test";
 * import tenantsTest from "@djpanda/convex-tenants/test";
 *
 * test("tenants test", async () => {
 *   const t = convexTest(schema, modules);
 *   tenantsTest.register(t, "tenants");
 *
 *   // Your tests here
 * });
 * ```
 *
 * @param t - The test convex instance, e.g. from calling `convexTest`.
 * @param name - The name of the component, as registered in convex.config.ts. Defaults to "tenants".
 */
export function register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name: string = "tenants",
) {
  // Register the authz child component (use "/" as separator for nested components)
  authzTest.register(t, `${name}/authz`);
  // Register the tenants component
  t.registerComponent(name, schema, modules);
}
export default { register, schema, modules };
