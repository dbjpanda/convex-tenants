import { useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useInvitation, AcceptInvitation } from "@djpanda/convex-tenants/react";

export function AcceptInvitationPage() {
  const { invitationId } = useParams({ strict: false }) as { invitationId: string };
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();

  const {
    invitation,
    organizationName,
    isLoading,
    isAccepting,
    accepted,
    error,
    acceptInvitation,
  } = useInvitation({
    invitationId,
    getInvitationQuery: api.tenants.getInvitation as any,
    acceptInvitationMutation: api.tenants.acceptInvitation as any,
  });

  useEffect(() => {
    if (accepted) {
      const timer = setTimeout(() => {
        navigate({ to: "/" });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [accepted, navigate]);

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
      accepted={accepted}
      error={error}
      onAccept={acceptInvitation}
      onDecline={handleClose}
      onNavigateToLogin={handleClose}
      onNavigateHome={handleClose}
    />
  );
}
