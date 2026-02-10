import { useCallback } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";

export interface Member {
  _id: string;
  _creationTime: number;
  organizationId: string;
  userId: string;
  role: string;
  user?: {
    name?: string;
    email?: string;
    image?: string;
  } | null;
  teams?: Array<{ _id: string; name: string }>;
}

/** Pagination result page item type for listMembersPaginated */
export type MembersPaginatedPageItem = Member;

export interface UseMembersPaginatedOptions {
  organizationId: string | undefined;
  listMembersPaginatedQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string; paginationOpts: { numItems: number; cursor: string | null } },
    { page: MembersPaginatedPageItem[]; isDone: boolean; continueCursor: string }
  >;
  initialNumItems?: number;
  removeMemberMutation: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; memberUserId: string },
    null
  >;
  updateMemberRoleMutation: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; memberUserId: string; role: string },
    null
  >;
}

export function useMembersPaginated(options: UseMembersPaginatedOptions) {
  const {
    organizationId,
    listMembersPaginatedQuery,
    initialNumItems = 20,
    removeMemberMutation,
    updateMemberRoleMutation,
  } = options;

  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    listMembersPaginatedQuery,
    organizationId ? { organizationId } : "skip",
    { initialNumItems }
  );

  const removeMemberMut = useMutation(removeMemberMutation);
  const updateMemberRoleMut = useMutation(updateMemberRoleMutation);

  const removeMember = useCallback(
    async (memberUserId: string) => {
      if (!organizationId) throw new Error("No organization selected");
      await removeMemberMut({ organizationId, memberUserId });
    },
    [organizationId, removeMemberMut]
  );

  const updateMemberRole = useCallback(
    async (memberUserId: string, role: string) => {
      if (!organizationId) throw new Error("No organization selected");
      await updateMemberRoleMut({ organizationId, memberUserId, role });
    },
    [organizationId, updateMemberRoleMut]
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
