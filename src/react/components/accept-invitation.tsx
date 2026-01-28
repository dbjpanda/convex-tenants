"use client";

import type { ReactNode } from "react";
import { cn } from "../utils.js";
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
  
  // Icons
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
 * import { Loader2, CheckCircle, XCircle, Building2 } from "lucide-react";
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
 *       loadingIcon={<Loader2 className="h-8 w-8 animate-spin" />}
 *       checkIcon={<CheckCircle className="h-6 w-6" />}
 *       errorIcon={<XCircle className="h-6 w-6" />}
 *       buildingIcon={<Building2 className="h-8 w-8" />}
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
  // Loading state
  if (isLoading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <span className="text-gray-500">{loadingIcon}</span>
            <p className="text-sm text-gray-500">Loading invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!invitation) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            {errorIcon}
            <h2 className="text-lg font-semibold">Invitation Not Found</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            This invitation link is invalid or has been removed.
          </p>
          <button
            onClick={onNavigateHome}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (accepted) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            {checkIcon}
            <h2 className="text-lg font-semibold">Welcome Aboard!</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            You've successfully joined {organizationName || "the organization"}. Redirecting to dashboard...
          </p>
          <div className="flex items-center justify-center py-4">
            <span className="text-gray-500">{loadingIcon}</span>
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
          <h2 className="text-lg font-semibold mb-1">You're Invited!</h2>
          <p className="text-sm text-gray-500 mb-4">
            Sign in to accept your invitation.
          </p>

          {/* Organization Details */}
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <span className="text-blue-600">{buildingIcon}</span>
              <div className="flex-1">
                <p className="font-semibold text-lg">
                  {organizationName || "Loading..."}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Role: <span className="font-medium capitalize">{invitation.role}</span>
                </p>
                {invitation.email && (
                  <p className="text-sm text-gray-500">
                    Invited as: <span className="font-medium">{invitation.email}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={onNavigateToLogin}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Sign in to Accept
            </button>
            <button
              onClick={onDecline}
              className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            {errorIcon}
            <h2 className="text-lg font-semibold">Error</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={onAccept}
              disabled={isAccepting}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isAccepting ? (
                <span className="flex items-center justify-center gap-2">
                  {loadingIcon}
                  Trying again...
                </span>
              ) : (
                "Try Again"
              )}
            </button>
            <button
              onClick={onNavigateHome}
              className="w-full px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default: ready to accept
  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4", className)}>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-1">You're Invited!</h2>
        <p className="text-sm text-gray-500 mb-4">
          You've been invited to join an organization.
        </p>

        {/* Organization Details */}
        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-600">{buildingIcon}</span>
            <div className="flex-1">
              <p className="font-semibold text-lg">
                {organizationName || "Loading..."}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Role: <span className="font-medium capitalize">{invitation.role}</span>
              </p>
              {invitation.email && (
                <p className="text-sm text-gray-500">
                  Invited as: <span className="font-medium">{invitation.email}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onAccept}
            disabled={isAccepting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isAccepting ? (
              <span className="flex items-center justify-center gap-2">
                {loadingIcon}
                Accepting...
              </span>
            ) : (
              "Accept Invitation"
            )}
          </button>
          <button
            onClick={onDecline}
            disabled={isAccepting}
            className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
