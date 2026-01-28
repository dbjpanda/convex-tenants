import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";

// Type for member from the component
export interface Member {
  _id: string;
  _creationTime: number;
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  // User data from bridge (optional, if enriched)
  user?: {
    name?: string;
    email?: string;
    image?: string;
  };
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
   * Query function reference to list organization members
   * Example: api.tenants.listMembers
   */
  listMembersQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string },
    Member[]
  >;
  
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
    { organizationId: string; memberUserId: string; role: "owner" | "admin" | "member" },
    null
  >;
}

export function useMembers(options: UseMembersOptions) {
  const {
    organizationId,
    listMembersQuery,
    removeMemberMutation,
    updateMemberRoleMutation,
  } = options;

  // Get members with user data
  const members = useQuery(
    listMembersQuery,
    organizationId ? { organizationId } : "skip"
  );
  
  // Mutations
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
    async (memberUserId: string, role: "owner" | "admin" | "member") => {
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

  return {
    members: members ?? [],
    isLoading: members === undefined,
    removeMember,
    updateMemberRole,
  };
}
