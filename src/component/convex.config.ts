import { defineComponent } from "convex/server";
import authz from "@djpanda/convex-authz/convex.config";

const component = defineComponent("tenants");
component.use(authz);
export default component;
