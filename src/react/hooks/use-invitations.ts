import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";

// Type for invitation from the component
export interface Invitation {
  _id: string;
  _creationTime: number;
  organizationId: string;
  email: string;
  role: "admin" | "member";
  teamId: string | null;
  inviterId: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: number;
  isExpired: boolean;
}

export interface UseInvitationsOptions {
  /**
   * The organization ID to list invitations for
   */
  organizationId: string | undefined;
  
  /**
   * Query function reference to list organization invitations
   * Example: api.tenants.listInvitations
   */
  listInvitationsQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string },
    Invitation[]
  >;
  
  /**
   * Mutation function reference to invite a member
   * Example: api.tenants.inviteMember
   */
  inviteMemberMutation: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; email: string; role: "admin" | "member"; teamId?: string },
    { invitationId: string; email: string; expiresAt: number }
  >;
  
  /**
   * Mutation function reference to resend an invitation
   * Example: api.tenants.resendInvitation
   */
  resendInvitationMutation: FunctionReference<
    "mutation",
    "public",
    { invitationId: string },
    { invitationId: string; email: string }
  >;
  
  /**
   * Mutation function reference to cancel an invitation
   * Example: api.tenants.cancelInvitation
   */
  cancelInvitationMutation: FunctionReference<
    "mutation",
    "public",
    { invitationId: string },
    null
  >;
}

export function useInvitations(options: UseInvitationsOptions) {
  const {
    organizationId,
    listInvitationsQuery,
    inviteMemberMutation,
    resendInvitationMutation,
    cancelInvitationMutation,
  } = options;

  // Get invitations for the organization
  const invitations = useQuery(
    listInvitationsQuery,
    organizationId ? { organizationId } : "skip"
  );
  
  // Mutations
  const inviteMemberMut = useMutation(inviteMemberMutation);
  const resendInvitationMut = useMutation(resendInvitationMutation);
  const cancelInvitationMut = useMutation(cancelInvitationMutation);

  const inviteMember = useCallback(
    async (data: {
      email: string;
      role: "admin" | "member";
      teamId?: string;
    }) => {
      if (!organizationId) {
        throw new Error("No organization selected");
      }
      try {
        const result = await inviteMemberMut({
          organizationId,
          email: data.email,
          role: data.role,
          teamId: data.teamId,
        });
        return result;
      } catch (error) {
        console.error("Failed to invite member:", error);
        throw error;
      }
    },
    [organizationId, inviteMemberMut]
  );

  const resendInvitation = useCallback(
    async (invitationId: string) => {
      try {
        await resendInvitationMut({ invitationId });
      } catch (error) {
        console.error("Failed to resend invitation:", error);
        throw error;
      }
    },
    [resendInvitationMut]
  );

  const cancelInvitation = useCallback(
    async (invitationId: string) => {
      try {
        await cancelInvitationMut({ invitationId });
      } catch (error) {
        console.error("Failed to cancel invitation:", error);
        throw error;
      }
    },
    [cancelInvitationMut]
  );

  return {
    invitations: invitations ?? [],
    isLoading: invitations === undefined,
    inviteMember,
    cancelInvitation,
    resendInvitation,
  };
}
