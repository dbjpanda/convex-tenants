import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";

export interface UseUserPermissionsOptions {
  /**
   * Organization ID to get permissions for. When undefined, the query is skipped.
   */
  organizationId: string | undefined;

  /**
   * Query function reference that returns the current user's effective permissions in the org.
   * Example: api.tenants.getUserPermissions
   */
  getUserPermissionsQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string },
    Record<string, unknown>
  >;
}

export interface UseUserPermissionsResult {
  /** Effective permissions for the current user in the organization (e.g. { "members:add": true }). */
  permissions: Record<string, unknown>;
  /** True while the query is loading. */
  isLoading: boolean;
  /** Helper: returns true if the user has the given permission. */
  has: (permission: string) => boolean;
}

/**
 * React hook to get the current user's effective permissions in an organization.
 * Uses the tenants API getUserPermissions query.
 *
 * @example
 * ```tsx
 * const { permissions, has, isLoading } = useUserPermissions({
 *   organizationId: currentOrganization?._id,
 *   getUserPermissionsQuery: api.tenants.getUserPermissions,
 * });
 * if (has("members:add")) {
 *   return <InviteButton />;
 * }
 * ```
 */
export function useUserPermissions(
  options: UseUserPermissionsOptions
): UseUserPermissionsResult {
  const { organizationId, getUserPermissionsQuery } = options;
  const args = useMemo(
    () => (organizationId ? { organizationId } : "skip"),
    [organizationId]
  );
  const permissionsRaw = useQuery(
    getUserPermissionsQuery,
    typeof args === "object" ? args : "skip"
  );

  return useMemo(() => {
    const permissions = args === "skip" || permissionsRaw === undefined ? {} : permissionsRaw;
    const has = (permission: string): boolean => {
      const v = (permissions as Record<string, unknown>)[permission];
      return v === true;
    };
    return {
      permissions: (permissions ?? {}) as Record<string, unknown>,
      isLoading: args !== "skip" && permissionsRaw === undefined,
      has,
    };
  }, [args, permissionsRaw]);
}
