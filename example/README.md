# @djpanda/convex-tenants — Example App

A complete working example demonstrating how to use `@djpanda/convex-tenants` in a React + Convex app.

## What's included

- **Convex backend** (`convex/example.ts`) — single-destructure API export pattern with demo auth
- **React frontend** (`src/App.tsx`) — `TenantsProvider`, `OrganizationSwitcher`, `MembersSection`, `TeamsSection`
- **Theming** (`src/index.css`) — shadcn/ui CSS variables for light and dark mode
- **Tests** (`convex/example.test.ts`) — integration tests for auth enforcement, user enrichment, and callbacks

## Setup

From the **package root** (one level up):

```bash
# Install dependencies
npm install

# Start the dev server (Convex backend + Vite frontend)
npm run dev
```

This will:
1. Start the Convex development server
2. Start the Vite frontend at `http://localhost:5173`

## How it works

### Backend (`convex/example.ts`)

```typescript
// One destructure exports everything:
export const {
  listOrganizations, createOrganization, listMembers, inviteMember,
  // ... all 27 functions
} = makeTenantsAPI(components.tenants, {
  auth: async (ctx) => await getAuthUserId(ctx),
  getUser: async (ctx, userId) => { /* fetch user data */ },
  onInvitationCreated: async (ctx, invitation) => { /* send email */ },
});
```

### Frontend (`src/App.tsx`)

```tsx
import {
  TenantsProvider,
  OrganizationSwitcher,
  MembersSection,
  TeamsSection,
} from "@djpanda/convex-tenants/react";

function App() {
  return (
    <TenantsProvider api={api.example} onToast={(msg, type) => toast(msg)}>
      <OrganizationSwitcher />   {/* Dropdown — icons included */}
      <MembersSection />          {/* Table + invite dialog */}
      <TeamsSection />            {/* Grid + create dialog */}
    </TenantsProvider>
  );
}
```

No icon props needed — all components ship with default `lucide-react` icons.
Components are themed via CSS variables, matching your shadcn/ui setup automatically.

## Running tests

```bash
npm test
```

This runs all Vitest tests including integration tests with `convex-test`.
