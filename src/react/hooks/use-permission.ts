import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";

export interface UsePermissionOptions {
  /**
   * Organization ID to check permission in. When undefined, the query is skipped and allowed is false.
   */
  organizationId: string | undefined;

  /**
   * Permission string to check (e.g. "members:add", "teams:create").
   */
  permission: string;

  /**
   * Query function reference that checks permission for the current user.
   * Example: api.tenants.checkPermission
   */
  checkPermissionQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string; permission: string },
    { allowed: boolean; reason?: string }
  >;
}

export interface UsePermissionResult {
  /** Whether the current user has the permission in the organization. */
  allowed: boolean;
  /** Reason string from the API (e.g. "Allowed" or "Permission denied"). */
  reason: string | undefined;
  /** True while the query is loading. */
  isLoading: boolean;
}

/**
 * React hook to check if the current user has a specific permission in an organization.
 * Uses the tenants API checkPermission query.
 *
 * @example
 * ```tsx
 * const { allowed, isLoading } = usePermission({
 *   organizationId: currentOrganization?._id,
 *   permission: "members:add",
 *   checkPermissionQuery: api.tenants.checkPermission,
 * });
 * if (allowed) {
 *   return <InviteButton />;
 * }
 * ```
 */
export function usePermission(options: UsePermissionOptions): UsePermissionResult {
  const { organizationId, permission, checkPermissionQuery } = options;
  const args = useMemo(
    () => (organizationId && permission ? { organizationId, permission } : "skip"),
    [organizationId, permission]
  );
  const result = useQuery(
    checkPermissionQuery,
    typeof args === "object" ? args : "skip"
  );

  return useMemo(() => {
    if (args === "skip") {
      return { allowed: false, reason: undefined, isLoading: false };
    }
    if (result === undefined) {
      return { allowed: false, reason: undefined, isLoading: true };
    }
    return {
      allowed: result.allowed,
      reason: result.reason,
      isLoading: false,
    };
  }, [args, result]);
}

export type UseCanOptions = UsePermissionOptions;
export type UseCanResult = UsePermissionResult;

/**
 * Alias for usePermission. Use when you want to express "can the user do X?".
 *
 * @example
 * ```tsx
 * const { allowed: canInvite } = useCan({
 *   organizationId: org._id,
 *   permission: "members:add",
 *   checkPermissionQuery: api.tenants.checkPermission,
 * });
 * ```
 */
export function useCan(options: UseCanOptions): UseCanResult {
  return usePermission(options);
}
