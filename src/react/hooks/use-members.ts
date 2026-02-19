import { useCallback } from "react";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import type { PaginatedQueryReference } from "convex/react";

// Type for member from the component
export interface Member {
  _id: string;
  _creationTime: number;
  organizationId: string;
  userId: string;
  role: string;
  // User data from bridge (optional, if enriched)
  user?: {
    name?: string;
    email?: string;
    image?: string;
  } | null;
  // Teams the member belongs to (optional, if enriched)
  teams?: Array<{
    _id: string;
    name: string;
  }>;
}

export interface UseMembersOptions {
  /**
   * The organization ID to list members for
   */
  organizationId: string | undefined;

  /**
   * Query function reference to list organization members.
   * Example: api.tenants.listMembers
   * Pass `pagination: { initialNumItems }` to use cursor-based pagination.
   */
  listMembersQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string; paginationOpts?: { numItems: number; cursor: string | null } },
    | Member[]
    | { page: Member[]; isDone: boolean; continueCursor: string }
  >;

  /**
   * When set, uses usePaginatedQuery and returns status, loadMore.
   * Omit for a single useQuery that returns all members.
   */
  pagination?: { initialNumItems?: number };

  /**
   * Mutation function reference to remove a member
   * Example: api.tenants.removeMember
   */
  removeMemberMutation: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; memberUserId: string },
    null
  >;

  /**
   * Mutation function reference to update member role
   * Example: api.tenants.updateMemberRole
   */
  updateMemberRoleMutation: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; memberUserId: string; role: string },
    null
  >;
}

export function useMembers(options: UseMembersOptions) {
  const {
    organizationId,
    listMembersQuery,
    pagination,
    removeMemberMutation,
    updateMemberRoleMutation,
  } = options;

  const removeMemberMut = useMutation(removeMemberMutation);
  const updateMemberRoleMut = useMutation(updateMemberRoleMutation);

  const removeMember = useCallback(
    async (memberUserId: string) => {
      if (!organizationId) {
        throw new Error("No organization selected");
      }
      try {
        await removeMemberMut({ organizationId, memberUserId });
      } catch (error) {
        console.error("Failed to remove member:", error);
        throw error;
      }
    },
    [organizationId, removeMemberMut]
  );

  const updateMemberRole = useCallback(
    async (memberUserId: string, role: string) => {
      if (!organizationId) {
        throw new Error("No organization selected");
      }
      try {
        await updateMemberRoleMut({ organizationId, memberUserId, role });
      } catch (error) {
        console.error("Failed to update member role:", error);
        throw error;
      }
    },
    [organizationId, updateMemberRoleMut]
  );

  if (pagination !== undefined) {
    const { results, status, loadMore, isLoading } = usePaginatedQuery(
      listMembersQuery as PaginatedQueryReference,
      organizationId ? { organizationId } : "skip",
      { initialNumItems: pagination.initialNumItems ?? 20 }
    );
    return {
      members: results ?? [],
      status,
      loadMore,
      isLoading,
      removeMember,
      updateMemberRole,
    };
  }

  const members = useQuery(
    listMembersQuery,
    organizationId ? { organizationId } : "skip"
  );
  return {
    members: (Array.isArray(members) ? members : []) as Member[],
    isLoading: members === undefined,
    removeMember,
    updateMemberRole,
  };
}
