import { useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAcceptInvitation, AcceptInvitation } from "@djpanda/convex-tenants/react";

export function AcceptInvitationPage() {
  const { invitationId } = useParams({ strict: false }) as { invitationId: string };
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();

  const {
    invitation,
    organizationName,
    isLoading,
    isAccepting,
    isDeclining,
    accepted,
    declined,
    error,
    acceptInvitation,
    declineInvitation,
  } = useAcceptInvitation({
    invitationId,
    getInvitationQuery: api.tenants.getInvitation as any,
    acceptInvitationMutation: api.tenants.acceptInvitation as any,
    declineInvitationMutation: api.tenants.declineInvitation as any,
  });

  useEffect(() => {
    if (accepted || declined) {
      const timer = setTimeout(() => {
        navigate({ to: "/" });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [accepted, declined, navigate]);

  const handleClose = () => {
    navigate({ to: "/" });
  };

  return (
    <AcceptInvitation
      invitation={invitation ?? null}
      organizationName={organizationName}
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      isAccepting={isAccepting}
      isDeclining={isDeclining}
      accepted={accepted}
      declined={declined}
      error={error}
      onAccept={acceptInvitation}
      onDecline={declineInvitation}
      onNavigateToLogin={handleClose}
      onNavigateHome={handleClose}
    />
  );
}
