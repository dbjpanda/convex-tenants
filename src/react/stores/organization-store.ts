import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OrganizationStore {
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string | null) => void;
  clearActiveOrganization: () => void;
}

/**
 * Store for managing the active organization state.
 * Persists the active organization ID in localStorage.
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
export const useOrganizationStore = create<OrganizationStore>()(
  persist(
    (set) => ({
      activeOrganizationId: null,
      setActiveOrganizationId: (id) => set({ activeOrganizationId: id }),
      clearActiveOrganization: () => set({ activeOrganizationId: null }),
    }),
    {
      name: "tenants-active-organization",
    }
  )
);
