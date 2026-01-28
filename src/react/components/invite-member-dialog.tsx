"use client";

import { useState, type ReactNode } from "react";
import { cn, getInvitationLink as getLink } from "../utils.js";
import type { Team } from "../hooks/use-teams.js";

export interface InviteMemberDialogProps {
  /**
   * Organization name to display in the dialog
   */
  organizationName: string;
  
  /**
   * List of teams in the organization (optional)
   */
  teams?: Team[];
  
  /**
   * Whether to show team selection (defaults to true if teams provided)
   */
  showTeamSelection?: boolean;
  
  /**
   * Whether to show the invitation link after creating (defaults to true)
   */
  showInvitationLink?: boolean;
  
  /**
   * Custom invitation path pattern (defaults to "/accept-invitation/:id")
   * Use ":id" as placeholder for invitation ID
   */
  invitationPath?: string;
  
  /**
   * Callback when inviting a member
   */
  onInvite: (data: {
    email: string;
    role: "admin" | "member";
    teamId?: string;
  }) => Promise<{ invitationId: string; email: string; expiresAt: number } | null | undefined>;
  
  /**
   * Base URL for invitation links (defaults to window.location.origin)
   */
  baseUrl?: string;
  
  /**
   * Trigger element to open the dialog
   */
  trigger?: ReactNode;
  
  /**
   * Custom class name
   */
  className?: string;
  
  /**
   * Custom icon for mail
   */
  mailIcon?: ReactNode;
  
  /**
   * Custom icon for copy
   */
  copyIcon?: ReactNode;
  
  /**
   * Custom icon for check (for copied state)
   */
  checkIcon?: ReactNode;
  
  /**
   * Custom icon for link
   */
  linkIcon?: ReactNode;
  
  /**
   * Custom icon for close/X
   */
  closeIcon?: ReactNode;
  
  /**
   * Toast notification callback
   */
  onToast?: (message: string, type: "success" | "error") => void;
  
  /**
   * Invitation expiration text (defaults to "48 hours")
   */
  expirationText?: string;
}

/**
 * A dialog component for inviting new members to an organization.
 * 
 * @example
 * ```tsx
 * import { InviteMemberDialog } from "@djpanda/convex-tenants/react";
 * import { Mail, Copy, Link } from "lucide-react";
 * 
 * function MyApp() {
 *   const { inviteMember } = useInvitations(...);
 *   
 *   return (
 *     <InviteMemberDialog
 *       organizationName="Acme Inc"
 *       onInvite={inviteMember}
 *       mailIcon={<Mail className="h-4 w-4" />}
 *       copyIcon={<Copy className="h-4 w-4" />}
 *       linkIcon={<Link className="h-4 w-4" />}
 *     />
 *   );
 * }
 * ```
 */
export function InviteMemberDialog({
  organizationName,
  teams,
  showTeamSelection = true,
  showInvitationLink = true,
  invitationPath = "/accept-invitation/:id",
  onInvite,
  baseUrl,
  trigger,
  className,
  mailIcon,
  copyIcon,
  checkIcon,
  linkIcon,
  closeIcon,
  onToast,
  expirationText = "48 hours",
}: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [isInviting, setIsInviting] = useState(false);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shouldShowTeams = showTeamSelection && teams && teams.length > 0;

  const handleInvite = async () => {
    if (!email) return;

    setIsInviting(true);
    setError(null);
    try {
      const result = await onInvite({
        email,
        role,
        teamId: shouldShowTeams && teamId && teamId !== "none" ? teamId : undefined,
      });

      if (result && result.invitationId) {
        setInvitationId(result.invitationId);
        onToast?.("Invitation created successfully!", "success");
      } else if (!showInvitationLink) {
        // If not showing link, close the dialog
        handleClose();
        onToast?.("Invitation sent successfully!", "success");
      }
    } catch (err: any) {
      setError(err.message || "Failed to invite member");
      onToast?.(err.message || "Failed to invite member", "error");
    } finally {
      setIsInviting(false);
    }
  };

  const invitationLink = invitationId
    ? getLink(invitationId, baseUrl, invitationPath)
    : null;

  const handleCopyLink = async () => {
    if (invitationLink) {
      try {
        await navigator.clipboard.writeText(invitationLink);
        setCopied(true);
        onToast?.("Invitation link copied to clipboard!", "success");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for browsers that don't support clipboard API
        prompt("Copy this invitation link:", invitationLink);
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEmail("");
    setRole("member");
    setTeamId(undefined);
    setInvitationId(null);
    setError(null);
    setCopied(false);
  };

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setOpen(true)} className={className}>
        {trigger || (
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            {mailIcon}
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-[500px] p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Invite Member</h2>
              <p className="text-sm text-gray-500">
                Invite a new member to {organizationName}. They'll receive an invitation link to join.
              </p>
            </div>

            {!invitationLink ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-1">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isInviting}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium mb-1">
                      Role
                    </label>
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as "admin" | "member")}
                      disabled={isInviting}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <p className="text-sm text-gray-500 mt-1">
                      {role === "admin"
                        ? "Admins can invite members and manage teams"
                        : "Members have basic access to the organization"}
                    </p>
                  </div>

                  {shouldShowTeams && (
                    <div>
                      <label htmlFor="team" className="block text-sm font-medium mb-1">
                        Team (Optional)
                      </label>
                      <select
                        id="team"
                        value={teamId || "none"}
                        onChange={(e) => setTeamId(e.target.value === "none" ? undefined : e.target.value)}
                        disabled={isInviting}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="none">No team</option>
                        {teams!.map((team) => (
                          <option key={team._id} value={team._id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-500 mt-1">
                        Assign the new member to a team immediately
                      </p>
                    </div>
                  )}

                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isInviting}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={isInviting || !email}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isInviting ? "Creating..." : "Create Invitation"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  {/* Success message */}
                  <div className="text-center py-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                      {checkIcon || (
                        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">Invitation Created!</p>
                    <p className="text-sm text-gray-500 mt-1">
                      An invitation has been created for <strong>{email}</strong>
                    </p>
                  </div>
                  
                  {/* Invitation link */}
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      Invitation Link
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 p-2 bg-white border rounded-md overflow-hidden">
                        <span className="text-gray-400 flex-shrink-0">{linkIcon}</span>
                        <code className="text-sm text-gray-700 truncate">{invitationLink}</code>
                      </div>
                      <button
                        onClick={handleCopyLink}
                        className={cn(
                          "flex-shrink-0 p-2 rounded-md transition-colors",
                          copied 
                            ? "bg-green-100 text-green-600" 
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                        title={copied ? "Copied!" : "Copy link"}
                      >
                        {copied ? (
                          checkIcon || (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )
                        ) : (
                          copyIcon || (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Share this link with the invitee. It expires in {expirationText}.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-6">
                  <button
                    onClick={() => {
                      setInvitationId(null);
                      setEmail("");
                      setCopied(false);
                    }}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50"
                  >
                    Invite Another
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleClose}
        />
      )}
    </>
  );
}
