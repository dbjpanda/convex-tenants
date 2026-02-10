import { useCallback } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";

export interface Invitation {
  _id: string;
  _creationTime: number;
  organizationId: string;
  email: string;
  role: string;
  teamId: string | null;
  inviterId: string;
  message?: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: number;
  isExpired: boolean;
}

export interface UseInvitationsPaginatedOptions {
  organizationId: string | undefined;
  listInvitationsPaginatedQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string; paginationOpts: { numItems: number; cursor: string | null } },
    { page: Invitation[]; isDone: boolean; continueCursor: string }
  >;
  initialNumItems?: number;
  inviteMemberMutation: FunctionReference<
    "mutation",
    "public",
    {
      organizationId: string;
      email: string;
      role: string;
      teamId?: string;
      message?: string;
    },
    { invitationId: string; email: string; expiresAt: number } | null
  >;
  resendInvitationMutation: FunctionReference<
    "mutation",
    "public",
    { invitationId: string },
    null
  >;
  cancelInvitationMutation: FunctionReference<
    "mutation",
    "public",
    { invitationId: string },
    null
  >;
}

export function useInvitationsPaginated(options: UseInvitationsPaginatedOptions) {
  const {
    organizationId,
    listInvitationsPaginatedQuery,
    initialNumItems = 20,
    inviteMemberMutation,
    resendInvitationMutation,
    cancelInvitationMutation,
  } = options;

  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    listInvitationsPaginatedQuery,
    organizationId ? { organizationId } : "skip",
    { initialNumItems }
  );

  const inviteMemberMut = useMutation(inviteMemberMutation);
  const resendInvitationMut = useMutation(resendInvitationMutation);
  const cancelInvitationMut = useMutation(cancelInvitationMutation);

  const inviteMember = useCallback(
    async (data: { email: string; role: string; teamId?: string; message?: string }) => {
      if (!organizationId) throw new Error("No organization selected");
      return await inviteMemberMut({
        organizationId,
        email: data.email,
        role: data.role,
        teamId: data.teamId,
        message: data.message,
      });
    },
    [organizationId, inviteMemberMut]
  );

  const resendInvitation = useCallback(async (invitationId: string) => {
    await resendInvitationMut({ invitationId });
  }, [resendInvitationMut]);

  const cancelInvitation = useCallback(async (invitationId: string) => {
    await cancelInvitationMut({ invitationId });
  }, [cancelInvitationMut]);

  return {
    invitations: results ?? [],
    status,
    loadMore,
    isLoading,
    inviteMember,
    resendInvitation,
    cancelInvitation,
  };
}
