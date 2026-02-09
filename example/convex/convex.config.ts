import { defineApp } from "convex/server";
import tenants from "@djpanda/convex-tenants/convex.config.js";
import authz from "@djpanda/convex-authz/convex.config";

const app = defineApp();
app.use(tenants);
app.use(authz);

export default app;
