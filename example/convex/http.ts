import { httpRouter } from "convex/server";
import { registerRoutes } from "@djpanda/convex-tenants";
import { components } from "./_generated/api";

const http = httpRouter();

// Initialize the component

// Register HTTP routes for the component
// This will expose a GET endpoint at /comments/last that returns the most recent comment
registerRoutes(http, components.tenants, {
  pathPrefix: "/comments",
});

// You can also register routes at different paths
// tenants.registerRoutes(http, {
//   path: "/api/comments/latest",
// });

export default http;
