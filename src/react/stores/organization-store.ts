import { useSyncExternalStore } from "react";

export interface OrganizationStore {
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string | null) => void;
  clearActiveOrganization: () => void;
}

// ---------------------------------------------------------------------------
// Internal store (module-level singleton)
// ---------------------------------------------------------------------------

const DEFAULT_STORAGE_KEY = "tenants-active-organization";

/** Configurable storage key (set before first use to avoid key collisions when multiple apps use the package). */
let storageKey = DEFAULT_STORAGE_KEY;

/**
 * Configure the organization store (e.g. storage key for localStorage).
 * Call before first use of useOrganizationStore().
 *
 * @example
 * ```tsx
 * import { configureOrganizationStore } from "@djpanda/convex-tenants/react";
 * configureOrganizationStore({ storageKey: "my-app-active-org" });
 * ```
 */
export function configureOrganizationStore(options: { storageKey?: string }): void {
  if (options.storageKey !== undefined) {
    storageKey = options.storageKey;
  }
  // Re-initialize state from the new key on next access
  initialized = false;
  // Re-attach the cross-tab listener so it responds to the new key
  attachStorageListener();
}

function getStorageKey(): string {
  return storageKey;
}

type Listener = () => void;

interface StoreState {
  activeOrganizationId: string | null;
}

let state: StoreState = { activeOrganizationId: null };
const listeners = new Set<Listener>();

// Initialize from localStorage (handles both our format and legacy zustand format)
function initFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(getStorageKey());
    if (stored) {
      const parsed = JSON.parse(stored);
      // Legacy zustand persist format: {"state":{"activeOrganizationId":"..."},"version":0}
      if (parsed.state?.activeOrganizationId !== undefined) {
        state = { activeOrganizationId: parsed.state.activeOrganizationId };
      }
      // Our format: {"activeOrganizationId":"..."}
      else if (parsed.activeOrganizationId !== undefined) {
        state = { activeOrganizationId: parsed.activeOrganizationId };
      }
    }
  } catch {
    // Ignore parse errors
  }
}

// Lazy initialization flag — initFromStorage() runs on first access, not at import time.
// This allows configureOrganizationStore() to set a custom key before any read occurs.
let initialized = false;

// Cross-tab sync: listen for storage events from other tabs so state stays consistent.
// Storing the handler reference allows us to remove and re-register it if the storage key changes.
let storageListenerHandler: ((event: StorageEvent) => void) | null = null;

function attachStorageListener() {
  if (typeof window === "undefined") return;
  // Remove any previously registered listener before attaching a new one (handles key rotation
  // after configureOrganizationStore is called mid-session).
  if (storageListenerHandler) {
    window.removeEventListener("storage", storageListenerHandler);
  }
  storageListenerHandler = (event) => {
    if (event.key === getStorageKey()) {
      initFromStorage();
      emitChange();
    }
  };
  window.addEventListener("storage", storageListenerHandler);
}

function ensureInitialized() {
  if (!initialized) {
    initFromStorage();
    attachStorageListener();
    initialized = true;
  }
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function setState(newState: StoreState) {
  state = newState;
  // Persist to localStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(state));
    } catch {
      // Ignore storage errors (e.g. quota exceeded, private browsing)
    }
  }
  emitChange();
}

function subscribe(listener: Listener) {
  ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): StoreState {
  ensureInitialized();
  return state;
}

function getServerSnapshot(): StoreState {
  return { activeOrganizationId: null };
}

// Stable function references (so consumers can use them in dependency arrays)
function setActiveOrganizationId(id: string | null) {
  setState({ activeOrganizationId: id });
}

function clearActiveOrganization() {
  setState({ activeOrganizationId: null });
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

/**
 * Store for managing the active organization state.
 * Persists the active organization ID in localStorage.
 *
 * Uses React's built-in `useSyncExternalStore` — no external dependencies.
 *
 * @example
 * ```tsx
 * import { useOrganizationStore } from "@djpanda/convex-tenants/react";
 *
 * function MyComponent() {
 *   const { activeOrganizationId, setActiveOrganizationId } = useOrganizationStore();
 *
 *   return (
 *     <button onClick={() => setActiveOrganizationId("org_123")}>
 *       Switch Organization
 *     </button>
 *   );
 * }
 * ```
 */
export function useOrganizationStore(): OrganizationStore {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    activeOrganizationId: snap.activeOrganizationId,
    setActiveOrganizationId,
    clearActiveOrganization,
  };
}
