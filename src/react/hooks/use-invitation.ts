import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import type { Invitation } from "./use-invitations.js";

// Extended invitation with organization details
export interface InvitationWithOrg extends Invitation {
  organizationName: string;
}

// Organization type
export interface Organization {
  _id: string;
  name: string;
  slug: string;
  logo: string | null;
}

export interface UseInvitationOptions {
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
    Organization | null
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

export function useInvitation(options: UseInvitationOptions) {
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

  // Load invitation data (now includes organizationName)
  const invitation = useQuery(getInvitationQuery, { invitationId });
  const isLoading = invitation === undefined;
  
  // Optionally load full organization details if query is provided and user has access
  // This is now optional since invitation includes organizationName
  const organization = useQuery(
    getOrganizationQuery ?? ("skip" as any),
    invitation && getOrganizationQuery ? { organizationId: invitation.organizationId } : "skip"
  );
  
  // Accept invitation mutation
  const acceptMutation = useMutation(acceptInvitationMutation);

  const acceptInvitation = useCallback(async () => {
    // Prevent multiple simultaneous calls
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
