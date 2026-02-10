# Organization Store

The organization store holds the **active organization ID** for the current user. State is persisted in **localStorage** (key `tenants-active-organization` by default) and uses React's built-in `useSyncExternalStore` — no external dependencies.

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

To avoid key collisions when multiple apps use the package on the same domain, you can set a custom storage key. Call `configureOrganizationStore` **once** before any component uses the store (e.g. in your app entry or layout):

```tsx
import { configureOrganizationStore } from "@djpanda/convex-tenants/react";

// Optional: use a custom key for localStorage
configureOrganizationStore({ storageKey: "my-app-org" });
```

If you use `TenantsProvider`, call `configureOrganizationStore` before rendering the provider.

## Reading the stored value

The store uses **localStorage**, so the active organization ID is only available in the browser. For SSR, pass the organization from the client or from your session/cookie layer. If you configured a custom `storageKey`, that key is used in localStorage.
