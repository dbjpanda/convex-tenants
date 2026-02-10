# @djpanda/convex-tenants

A multi-tenant organization and team management component for [Convex](https://convex.dev) with flexible, developer-defined authorization via [`@djpanda/convex-authz`](https://github.com/dbjpanda/convex-authz).

## Features

- **Organizations** — Create, update, delete; unique slugs; optional status (`active` / `suspended` / `archived`); transfer ownership; list filtered by status; mutations blocked when org is suspended/archived (reactivate via `updateOrganization` with `status: "active"`)
- **Members** — Add, remove, update roles; roles are flexible strings you define in authz; cursor-based [paginated list](docs/api-reference.md) for large member lists
- **Teams** — Create teams with optional slug and metadata; manage membership; [paginated list](docs/api-reference.md)
- **Invitations** — Invite by email with optional message and team; customizable expiration; [paginated list](docs/api-reference.md)
- **Authorization** — Define permissions and roles in `authz.ts` with `@djpanda/convex-authz`; customizable [permission map](docs/permission-map.md)
- **React** — Hooks, `TenantsProvider`, and pre-built UI (switcher, members, teams, invitations); [organization store](docs/organization-store.md) with configurable storage key

## Installation

```bash
npm install @djpanda/convex-tenants @djpanda/convex-authz
```

For React UI: `npm install clsx tailwind-merge` (optional peer deps).

## Quick Start

1. Register `tenants` and `authz` in `convex/convex.config.ts`.
2. Create `convex/authz.ts` with permissions and roles (use `TENANTS_PERMISSIONS` / `TENANTS_ROLES` from this package).
3. Create `convex/tenants.ts` with `makeTenantsAPI(components.tenants, { authz, auth, getUser, ... })` and export the returned functions.
4. Use the exported queries/mutations in your app (e.g. `useQuery(api.tenants.listOrganizations)`).

**Full walkthrough:** [Quick Start](docs/quick-start.md).

## Documentation

| Topic | Description |
|-------|-------------|
| [Quick Start](docs/quick-start.md) | Step-by-step setup and first API usage |
| [API Reference](docs/api-reference.md) | All `makeTenantsAPI` options and functions |
| [Permission Map](docs/permission-map.md) | Default permissions per operation and overrides |
| [Flexible Roles](docs/flexible-roles.md) | Custom roles and structural owner rules |
| [React Components](docs/react-components.md) | TenantsProvider, OrganizationSwitcher, sections, dialogs |
| [Organization Store](docs/organization-store.md) | Active-org state and configurable storage key |

## Exported constants

| Export | Description |
|--------|-------------|
| `TENANTS_PERMISSIONS` | Default permissions; use with `definePermissions()` from `@djpanda/convex-authz`. |
| `TENANTS_ROLES` | Default roles (`owner`, `admin`, `member`); use with `defineRoles()`. |
| `DEFAULT_TENANTS_PERMISSION_MAP` | Operation → permission mapping. |
| `TENANTS_REQUIRED_PERMISSIONS` | Flat list of permission strings used by default. |

## License

MIT
