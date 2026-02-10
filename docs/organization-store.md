# Organization Store

The organization store holds the **active organization ID** for the current user. It is persisted in a cookie (`tenants-active-org` by default) for SSR compatibility and uses React's built-in `useSyncExternalStore` — no external dependencies.

## Basic usage

```tsx
import { useOrganizationStore } from "@djpanda/convex-tenants/react";

function MyComponent() {
  const { activeOrganizationId, setActiveOrganizationId, clearActiveOrganization } = useOrganizationStore();

  return (
    <button onClick={() => setActiveOrganizationId("org_123")}>
      Switch to Org
    </button>
  );
}
```

## Configurable storage key

To avoid collisions when multiple apps or packages use the store on the same domain, you can set a custom cookie/key name. Call `configureOrganizationStore` **once** before any component uses the store (e.g. in your app entry or layout):

```tsx
import { configureOrganizationStore } from "@djpanda/convex-tenants/react";

// Optional: use a custom key for localStorage/cookie
configureOrganizationStore({ storageKey: "my-app-active-org" });
```

If you use `TenantsProvider`, call `configureOrganizationStore` before rendering the provider.

## Reading the cookie server-side

For SSR or Next.js middleware:

```ts
const activeOrgId = request.cookies.get("tenants-active-org")?.value;
```

If you configured a custom `storageKey`, use that name instead of `"tenants-active-org"`.
