"use client";

import type { ReactNode } from "react";
import { Loader2, CheckCircle, XCircle, Building2 } from "lucide-react";
import { cn } from "../utils.js";
import { Button } from "../ui/button.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card.js";
import type { Invitation } from "../hooks/use-invitations.js";

export interface AcceptInvitationProps {
  /**
   * The invitation data
   */
  invitation: Invitation | null;

  /**
   * The organization name
   */
  organizationName?: string;

  /**
   * Whether the invitation is loading
   */
  isLoading?: boolean;

  /**
   * Whether the user is authenticated
   */
  isAuthenticated?: boolean;

  /**
   * Whether the invitation is being accepted
   */
  isAccepting?: boolean;

  /**
   * Whether the invitation was accepted
   */
  accepted?: boolean;

  /**
   * Error message if any
   */
  error?: string | null;

  /**
   * Callback when accepting the invitation
   */
  onAccept: () => Promise<void>;

  /**
   * Callback when declining the invitation
   */
  onDecline: () => void;

  /**
   * Callback when navigating to login
   */
  onNavigateToLogin: () => void;

  /**
   * Callback when navigating home
   */
  onNavigateHome: () => void;

  /**
   * Custom class name
   */
  className?: string;

  // Icons (optional overrides — defaults to lucide-react)
  loadingIcon?: ReactNode;
  checkIcon?: ReactNode;
  errorIcon?: ReactNode;
  buildingIcon?: ReactNode;
}

/**
 * A page component for accepting an organization invitation.
 *
 * This component handles all states: loading, not found, unauthenticated,
 * accepting, success, and error.
 *
 * @example
 * ```tsx
 * import { AcceptInvitation } from "@djpanda/convex-tenants/react";
 *
 * function AcceptInvitationPage() {
 *   const { invitation, organization, isLoading, isAccepting, accepted, error, acceptInvitation } = useInvitation(...);
 *
 *   return (
 *     <AcceptInvitation
 *       invitation={invitation}
 *       organizationName={organization?.name}
 *       isLoading={isLoading}
 *       isAuthenticated={!!currentUser}
 *       isAccepting={isAccepting}
 *       accepted={accepted}
 *       error={error}
 *       onAccept={acceptInvitation}
 *       onDecline={() => navigate("/")}
 *       onNavigateToLogin={() => navigate("/login")}
 *       onNavigateHome={() => navigate("/")}
 *     />
 *   );
 * }
 * ```
 */
export function AcceptInvitation({
  invitation,
  organizationName,
  isLoading = false,
  isAuthenticated = false,
  isAccepting = false,
  accepted = false,
  error,
  onAccept,
  onDecline,
  onNavigateToLogin,
  onNavigateHome,
  className,
  loadingIcon,
  checkIcon,
  errorIcon,
  buildingIcon,
}: AcceptInvitationProps) {
  const LoadingIcon = loadingIcon ?? <Loader2 className="size-8 animate-spin" />;
  const CheckIcon = checkIcon ?? <CheckCircle className="size-6" />;
  const ErrorIcon = errorIcon ?? <XCircle className="size-6" />;
  const BuildingIcon = buildingIcon ?? <Building2 className="size-8" />;

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-8">
            <span className="text-muted-foreground">{LoadingIcon}</span>
            <p className="text-sm text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not found state
  if (!invitation) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              {ErrorIcon}
              <CardTitle>Invitation Not Found</CardTitle>
            </div>
            <CardDescription>
              This invitation link is invalid or has been removed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onNavigateHome} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (accepted) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              {CheckIcon}
              <CardTitle>Welcome Aboard!</CardTitle>
            </div>
            <CardDescription>
              You've successfully joined {organizationName || "the organization"}. Redirecting to dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-4">
            <span className="text-muted-foreground">{LoadingIcon}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Organization details block (reused in unauth + ready states)
  const orgDetails = (
    <div className="rounded-lg bg-muted p-4">
      <div className="flex items-start gap-3">
        <span className="text-primary">{BuildingIcon}</span>
        <div className="flex-1">
          <p className="text-lg font-semibold">
            {organizationName || "Loading..."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: <span className="font-medium capitalize">{invitation.role}</span>
          </p>
          {invitation.email && (
            <p className="text-sm text-muted-foreground">
              Invited as: <span className="font-medium">{invitation.email}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // Unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>You're Invited!</CardTitle>
            <CardDescription>Sign in to accept your invitation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orgDetails}
            <div className="space-y-2">
              <Button onClick={onNavigateToLogin} className="w-full">
                Sign in to Accept
              </Button>
              <Button variant="ghost" onClick={onDecline} className="w-full">
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              {ErrorIcon}
              <CardTitle>Error</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={onAccept} disabled={isAccepting} className="w-full">
              {isAccepting ? (
                <span className="flex items-center justify-center gap-2">
                  {LoadingIcon}
                  Trying again...
                </span>
              ) : (
                "Try Again"
              )}
            </Button>
            <Button variant="outline" onClick={onNavigateHome} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default: ready to accept
  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>You've been invited to join an organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orgDetails}
          <div className="space-y-2">
            <Button onClick={onAccept} disabled={isAccepting} className="w-full">
              {isAccepting ? (
                <span className="flex items-center justify-center gap-2">
                  {LoadingIcon}
                  Accepting...
                </span>
              ) : (
                "Accept Invitation"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={onDecline}
              disabled={isAccepting}
              className="w-full"
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
