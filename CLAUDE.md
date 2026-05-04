# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`@djpanda/convex-tenants` — a Convex component providing multi-tenant organization/team management with authorization via `@djpanda/convex-authz`. Published to npm as a reusable component.

## Commands

```sh
npm run dev              # Run all dev servers (backend + frontend + build watch)
npm run build            # TypeScript compilation (tsconfig.build.json)
npm run build:codegen    # Generate Convex types + build
npm run build:clean      # Clean dist + rebuild from scratch
npm run typecheck        # Typecheck main + example + example/convex
npm run lint             # ESLint
npm run test             # Vitest with typecheck (edge-runtime)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

Run a single test file: `npx vitest run src/component/organizations.test.ts --typecheck`

## Architecture

### Three-Layer Design

```
src/component/   → Convex backend (queries, mutations, schema) — runs in Convex runtime
src/client/      → TypeScript client layer (Tenants class, makeTenantsAPI factory, types)
src/react/       → React integration (hooks, providers, pre-built UI components)
```

### Component Layer (`src/component/`)
- **`schema.ts`** — Defines 5 tables: `organizations`, `members`, `teams`, `teamMembers`, `invitations`
- **`convex.config.ts`** — Registers as a Convex component via `defineComponent("tenants")`
- Each domain file (`organizations.ts`, `members.ts`, `teams.ts`, `invitations.ts`) exports Convex queries/mutations that operate on component-isolated tables
- `helpers.ts` — Shared internal utilities (pagination, member lookup, org status checks)
- All `userId` fields are `string` (not `Id<"users">`) because they reference the parent app's user table

### Client Layer (`src/client/`)
- **`makeTenantsAPI.ts`** — Main API factory. Takes component reference + options (authz, auth, getUser, permissionMap, hooks). Returns destructurable Convex query/mutation functions for file-based routing in the consumer app.
- **`tenants-class.ts`** — `Tenants` class for direct component interaction (lower-level than makeTenantsAPI)
- **`authz.ts`** — Exports `TENANTS_PERMISSIONS`, `TENANTS_ROLES`, `DEFAULT_TENANTS_PERMISSION_MAP`
- **`helpers.ts`** — `orgScope()` (namespaces authz to org), `normalizeEmail()`, `generateSlug()`

### React Layer (`src/react/`)
- **`providers/`** — `TenantsProvider` wraps the app with tenant context
- **`hooks/`** — `useOrganization`, `useMembers`, `useTeams`, `useInvitations`, `usePermission`, `useUserPermissions`
- **`stores/`** — `organization-store` for active org state (localStorage-backed)
- **`components/`** — Pre-built UI: `OrganizationSwitcher`, `MembersTable`, `TeamsGrid`, dialogs, settings panels
- **`ui/`** — Radix UI-based primitives (button, dialog, dropdown, table, etc.)

### Package Exports
- `@djpanda/convex-tenants` → client API (`dist/client/`)
- `@djpanda/convex-tenants/react` → React hooks/components (`dist/react/`)
- `@djpanda/convex-tenants/test` → Test helper (`src/test.ts`)
- `./convex.config.js` → Component registration

### Example App (`example/`)
Contains a full working integration: `convex/convex.config.ts` registers tenants + authz components, `convex/tenants.ts` uses `makeTenantsAPI`, `convex/authz.ts` defines permissions/roles.

## Testing

- **Framework**: Vitest with `edge-runtime` environment (matches Convex runtime)
- **Test location**: Co-located with source as `*.test.ts` files
- **Component tests** use `convex-test` library — create instances with `convexTest(schema, modules)`
- **Integration tests** for consumer apps register the component via the test helper:
  ```ts
  import tenantsTest from "@djpanda/convex-tenants/test";
  const t = convexTest(schema, modules);
  tenantsTest.register(t, "tenants");
  ```
- **`scenarios.test.ts`** — End-to-end multi-tenant workflows (org creation, member management, team operations, invitations)
- Path aliases in `vitest.config.js` allow self-referencing the package in example tests

## Convex Conventions

- Always include `args` and `returns` validators on all Convex functions (use `v.null()` for void returns)
- Use `internalQuery`/`internalMutation`/`internalAction` for private functions; `query`/`mutation`/`action` for public API
- Use `withIndex()` instead of `filter()` for queries — indexes are defined in `schema.ts`
- Roles are flexible strings defined by the consuming app in their `authz.ts`, not hardcoded enums
- The `permissionMap` pattern maps operations to permission strings, allowing consumers to override which permission is checked for each action

## Authz Integration (peer ^2.3.0)

Tenants depends on `@djpanda/convex-authz` as a peer. The `Tenants` class accepts an `Authz` instance (see `src/client/authz.ts` for the structural `AuthzClient` interface) and uses optional method probing (`if (this.authz.recomputeUser)`) to stay forward-compatible.

**Default roles & post-deploy sync.** `TENANTS_ROLES` (in `src/client/authz.ts`) defines the built-in `owner` / `admin` / `member` roles. Whenever those defaults change — or when a consumer extends them via `defineRoles(permissions, TENANTS_ROLES, {...})` and redeploys — existing users still carry the OLD materialized permissions in `effectivePermissions`. Consumers MUST run `authz.syncRoles(ctx)` once from an action after such a change, or existing members will see stale permissions. See `example/convex/authz.ts` for the recommended pattern.

## ESLint

Three separate ESLint configurations in `eslint.config.js`:
- **Component/backend code** (`src/**` excluding `src/react/`): Worker globals, `no-floating-promises: error`
- **React code** (`src/react/**`, `example/src/**`): Browser globals, react-hooks and react-refresh plugins
- **Test code** (`example/tests/**`): Relaxed rules for mocks
