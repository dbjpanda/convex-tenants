// Generated route tree for TanStack Router
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import React from "react";
import { RootLayout } from "./components/RootLayout";
import { MembersPage } from "./routes/MembersPage";
import { TeamsPage } from "./routes/TeamsPage";
import { PermissionsPage } from "./routes/PermissionsPage";
import { AuditPage } from "./routes/AuditPage";
import { SettingsPage } from "./routes/SettingsPage";
import { AcceptInvitationPage } from "./routes/AcceptInvitationPage";

// Root route with no component (just an outlet)
const rootRoute = createRootRoute({
  component: Outlet,
});

// Layout route for authenticated pages with sidebar
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "layout",
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/",
  component: MembersPage,
});

const teamsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/teams",
  component: TeamsPage,
});

const permissionsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/permissions",
  component: PermissionsPage,
});

const auditRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/audit",
  component: AuditPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/settings",
  component: SettingsPage,
});

// Standalone route without sidebar layout
const acceptInvitationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accept-invitation/$invitationId",
  component: AcceptInvitationPage,
});

// Build route tree
export const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    indexRoute,
    teamsRoute,
    permissionsRoute,
    auditRoute,
    settingsRoute,
  ]),
  acceptInvitationRoute,
]);

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
