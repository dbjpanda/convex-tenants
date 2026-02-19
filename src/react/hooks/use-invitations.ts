import { useState, useRef, useCallback } from "react";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import type { PaginatedQueryReference } from "convex/react";

// Type for invitation from the component
export interface Invitation {
  _id: string;
  _creationTime: number;
  organizationId: string;
  organizationName?: string;
  inviteeIdentifier: string;
  identifierType?: string;
  role: string;
  teamId: string | null;
  inviterId: string;
  message?: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: number;
  isExpired: boolean;
}

/** Extended invitation with organization details (e.g. for accept-invitation page) */
export interface InvitationWithOrg extends Invitation {
  organizationName: string;
}

/** Organization shape for optional getOrganization query (accept-invitation flow) */
export interface InvitationOrganization {
  _id: string;
  name: string;
  slug: string;
  logo: string | null;
}

// ---------------------------------------------------------------------------
// useOrganizationInvitations — list/manage invitations for an organization
// ---------------------------------------------------------------------------

export interface UseOrganizationInvitationsOptions {
  /**
   * The organization ID to list invitations for
   */
  organizationId: string | undefined;

  /**
   * Query function reference to list organization invitations.
   * Example: api.tenants.listInvitations
   * Pass `pagination: { initialNumItems }` to use cursor-based pagination.
   */
  listInvitationsQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string; paginationOpts?: { numItems: number; cursor: string | null } },
    | Invitation[]
    | { page: Invitation[]; isDone: boolean; continueCursor: string }
  >;

  /**
   * When set, uses usePaginatedQuery and returns status, loadMore.
   * Omit for a single useQuery that returns all invitations.
   */
  pagination?: { initialNumItems?: number };

  /**
   * Mutation function reference to invite a member
   * Example: api.tenants.inviteMember
   */
  inviteMemberMutation: FunctionReference<
    "mutation",
    "public",
    {
      organizationId: string;
      inviteeIdentifier: string;
      identifierType?: string;
      role: string;
      teamId?: string;
      message?: string;
    },
    { invitationId: string; inviteeIdentifier: string; expiresAt: number } | null
  >;

  /**
   * Mutation function reference to resend an invitation
   * Example: api.tenants.resendInvitation
   */
  resendInvitationMutation: FunctionReference<
    "mutation",
    "public",
    { invitationId: string },
    null
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

export function useOrganizationInvitations(options: UseOrganizationInvitationsOptions) {
  const {
    organizationId,
    listInvitationsQuery,
    pagination,
    inviteMemberMutation,
    resendInvitationMutation,
    cancelInvitationMutation,
  } = options;

  const inviteMemberMut = useMutation(inviteMemberMutation);
  const resendInvitationMut = useMutation(resendInvitationMutation);
  const cancelInvitationMut = useMutation(cancelInvitationMutation);

  const inviteMember = useCallback(
    async (data: {
      inviteeIdentifier: string;
      identifierType?: string;
      role: string;
      teamId?: string;
      message?: string;
    }) => {
      if (!organizationId) {
        throw new Error("No organization selected");
      }
      try {
        const result = await inviteMemberMut({
          organizationId,
          inviteeIdentifier: data.inviteeIdentifier,
          identifierType: data.identifierType,
          role: data.role,
          teamId: data.teamId,
          message: data.message,
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

  if (pagination !== undefined) {
    const { results, status, loadMore, isLoading } = usePaginatedQuery(
      listInvitationsQuery as PaginatedQueryReference,
      organizationId ? { organizationId } : "skip",
      { initialNumItems: pagination.initialNumItems ?? 20 }
    );
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

  const invitations = useQuery(
    listInvitationsQuery,
    organizationId ? { organizationId } : "skip"
  );
  return {
    invitations: (Array.isArray(invitations) ? invitations : []) as Invitation[],
    isLoading: invitations === undefined,
    inviteMember,
    resendInvitation,
    cancelInvitation,
  };
}

// ---------------------------------------------------------------------------
// useAcceptInvitation — load one invitation by ID and accept it (accept-invitation page)
// ---------------------------------------------------------------------------

export interface UseAcceptInvitationOptions {
  /**
   * The invitation ID to fetch
   */
  invitationId: string;

  /**
   * Query function reference to get invitation details
   * Example: api.tenants.getInvitation
   */
  getInvitationQuery: FunctionReference<
    "query",
    "public",
    { invitationId: string },
    InvitationWithOrg | null
  >;

  /**
   * Optional query function reference to get organization details
   * Example: api.tenants.getOrganization
   * @deprecated No longer needed as getInvitation now returns organizationName
   */
  getOrganizationQuery?: FunctionReference<
    "query",
    "public",
    { organizationId: string },
    InvitationOrganization | null
  >;

  /**
   * Mutation function reference to accept an invitation
   * Example: api.tenants.acceptInvitation
   */
  acceptInvitationMutation: FunctionReference<
    "mutation",
    "public",
    { invitationId: string },
    null
  >;
}

export function useAcceptInvitation(options: UseAcceptInvitationOptions) {
  const {
    invitationId,
    getInvitationQuery,
    getOrganizationQuery,
    acceptInvitationMutation,
  } = options;

  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const acceptingRef = useRef(false);

  const invitation = useQuery(getInvitationQuery, { invitationId });
  const isLoading = invitation === undefined;

  const organization = useQuery(
    getOrganizationQuery ?? ("skip" as any),
    invitation && getOrganizationQuery ? { organizationId: invitation.organizationId } : "skip"
  );

  const acceptMutation = useMutation(acceptInvitationMutation);

  const acceptInvitation = useCallback(async () => {
    if (acceptingRef.current || isAccepting) {
      return;
    }
    try {
      acceptingRef.current = true;
      setIsAccepting(true);
      setError(null);
      await acceptMutation({ invitationId });
      setAccepted(true);
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation");
      acceptingRef.current = false;
      setIsAccepting(false);
    }
  }, [invitationId, isAccepting, acceptMutation]);

  const resetError = useCallback(() => {
    setError(null);
    acceptingRef.current = false;
  }, []);

  return {
    invitation,
    organization,
    organizationName: invitation?.organizationName,
    isLoading,
    isAccepting,
    accepted,
    error,
    acceptInvitation,
    resetError,
  };
}
