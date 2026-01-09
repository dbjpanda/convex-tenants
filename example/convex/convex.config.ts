import { defineApp } from "convex/server";
import tenants from "@djpanda/convex-tenants/convex.config.js";

const app = defineApp();
app.use(tenants);

export default app;
