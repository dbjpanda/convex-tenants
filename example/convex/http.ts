import { httpRouter } from "convex/server";

const http = httpRouter();

// The tenants component can be extended with HTTP routes
// for handling invitation acceptance links, webhooks, etc.
//
// Example:
// http.route({
//   path: "/invite/accept",
//   method: "GET",
//   handler: httpAction(async (ctx, request) => {
//     const url = new URL(request.url);
//     const invitationId = url.searchParams.get("id");
//     // Redirect to app with invitation ID
//     return Response.redirect(`/app/invite?id=${invitationId}`);
//   }),
// });

export default http;
