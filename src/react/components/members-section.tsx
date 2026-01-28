"use client";

import { useState, type ReactNode } from "react";
import { cn } from "../utils.js";
import { useTenants, type Member as ContextMember, type Invitation as ContextInvitation, type Team as ContextTeam } from "../providers/tenants-context.js";
import { InviteMemberDialog } from "./invite-member-dialog.js";
import { MembersTable, type MembersTableProps } from "./members-table.js";
import type { Member } from "../hooks/use-members.js";
import type { Invitation } from "../hooks/use-invitations.js";
import type { Team } from "../hooks/use-teams.js";

export interface MembersSectionProps {
  /**
   * Custom class name for the section
   */
  className?: string;

  /**
   * Section title (default: "Members & Invitations")
   */
  title?: string;

  /**
   * Whether to show the invite button (default: true for owner/admin)
   */
  showInviteButton?: boolean;

  /**
   * Whether to show team selection in invite dialog
   */
  showTeamSelection?: boolean;

  /**
   * Whether to show invitation link after creating
   */
  showInvitationLink?: boolean;

  /**
   * Custom invitation path pattern (defaults to "/accept-invitation/:id")
   */
  invitationPath?: string;

  /**
   * Invitation expiration text
   */
  expirationText?: string;

  // Icons
  usersIcon?: ReactNode;
  plusIcon?: ReactNode;
  moreIcon?: ReactNode;
  userMinusIcon?: ReactNode;
  copyIcon?: ReactNode;
  checkIcon?: ReactNode;
  refreshIcon?: ReactNode;
  cancelIcon?: ReactNode;
  mailIcon?: ReactNode;
  linkIcon?: ReactNode;
}

/**
 * A complete section component for managing organization members and invitations.
 *
 * Includes:
 * - Header with member/invitation counts
 * - "Invite Member" button (for owners/admins)
 * - MembersTable with filtering and actions
 * - InviteMemberDialog
 *
 * Must be used within a TenantsProvider.
 *
 * @example
 * ```tsx
 * <TenantsProvider api={api.example}>
 *   <MembersSection />
 * </TenantsProvider>
 * ```
 */
export function MembersSection({
  className,
  title = "Members & Invitations",
  showInviteButton,
  showTeamSelection = true,
  showInvitationLink = true,
  invitationPath = "/accept-invitation/:id",
  expirationText = "48 hours",
  usersIcon,
  plusIcon,
  moreIcon,
  userMinusIcon,
  copyIcon,
  checkIcon,
  refreshIcon,
  cancelIcon,
  mailIcon,
  linkIcon,
}: MembersSectionProps) {
  const {
    currentOrganization,
    members,
    invitations,
    teams,
    isOwnerOrAdmin,
    isOwner,
    isMembersLoading,
    isInvitationsLoading,
    removeMember,
    updateMemberRole,
    inviteMember,
    resendInvitation,
    cancelInvitation,
    addTeamMember,
    onToast,
  } = useTenants();

  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const shouldShowInviteButton = showInviteButton ?? isOwnerOrAdmin;

  // Transform members for the table (add user info if not present)
  const transformedMembers: Member[] = members.map((m) => ({
    _id: m._id,
    _creationTime: m._creationTime,
    userId: m.userId,
    organizationId: m.organizationId,
    role: m.role,
    user: m.user || {
      name: m.userId,
      email: `${m.userId}@example.com`,
    },
    teams: m.teams || [],
  }));

  // Transform invitations for the table
  const transformedInvitations: Invitation[] = invitations.map((inv) => ({
    _id: inv._id,
    _creationTime: inv._creationTime,
    email: inv.email,
    organizationId: inv.organizationId,
    role: inv.role,
    teamId: inv.teamId ?? null,
    inviterId: inv.inviterId,
    expiresAt: inv.expiresAt,
    status: inv.status as "pending" | "accepted" | "cancelled" | "expired",
    isExpired: inv.isExpired ?? inv.expiresAt < Date.now(),
  }));
  
  // Transform teams for components
  const transformedTeams: Team[] = teams.map((t) => ({
    _id: t._id,
    _creationTime: t._creationTime,
    name: t.name,
    organizationId: t.organizationId,
    description: t.description ?? null,
    slug: t.slug,
    metadata: undefined,
  }));

  if (!currentOrganization) {
    return (
      <div className={cn("bg-white border rounded-lg p-8 text-center", className)}>
        <p className="text-gray-500">Select an organization to view members</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-white border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          {usersIcon || (
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">
              {members.length} member{members.length !== 1 ? "s" : ""},{" "}
              {invitations.length} pending invitation{invitations.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {shouldShowInviteButton && (
          <button
            onClick={() => setShowInviteDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {plusIcon || (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Members Table */}
      <div className="p-6">
        <MembersTable
          members={transformedMembers}
          invitations={transformedInvitations}
          teams={transformedTeams}
          isLoading={isMembersLoading || isInvitationsLoading}
          isOwner={isOwner}
          isOwnerOrAdmin={isOwnerOrAdmin}
          invitationPath={invitationPath}
          onRemoveMember={removeMember}
          onUpdateMemberRole={updateMemberRole}
          onAddToTeam={addTeamMember}
          onResendInvitation={resendInvitation}
          onCancelInvitation={cancelInvitation}
          onToast={onToast}
          moreIcon={moreIcon}
          userMinusIcon={userMinusIcon}
          copyIcon={copyIcon}
          checkIcon={checkIcon}
          refreshIcon={refreshIcon}
          cancelIcon={cancelIcon}
        />
      </div>

      {/* Invite Dialog - this one is unused, only renders for old prop pattern */}

      {/* Inline Invite Dialog Trigger (controlled) */}
      {showInviteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <InviteDialogContent
            organizationName={currentOrganization.name}
            teams={transformedTeams}
            showTeamSelection={showTeamSelection}
            showInvitationLink={showInvitationLink}
            invitationPath={invitationPath}
            expirationText={expirationText}
            onInvite={inviteMember}
            onClose={() => setShowInviteDialog(false)}
            onToast={onToast}
            mailIcon={mailIcon}
            copyIcon={copyIcon}
            checkIcon={checkIcon}
            linkIcon={linkIcon}
          />
        </div>
      )}
    </div>
  );
}

// Internal component for the dialog content
function InviteDialogContent({
  organizationName,
  teams,
  showTeamSelection,
  showInvitationLink,
  invitationPath,
  expirationText,
  onInvite,
  onClose,
  onToast,
  mailIcon,
  copyIcon,
  checkIcon,
  linkIcon,
}: {
  organizationName: string;
  teams: Team[];
  showTeamSelection: boolean;
  showInvitationLink: boolean;
  invitationPath: string;
  expirationText: string;
  onInvite: (data: { email: string; role: "admin" | "member"; teamId?: string }) => Promise<{ invitationId: string; email: string; expiresAt: number } | null>;
  onClose: () => void;
  onToast?: (message: string, type: "success" | "error") => void;
  mailIcon?: ReactNode;
  copyIcon?: ReactNode;
  checkIcon?: ReactNode;
  linkIcon?: ReactNode;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [isInviting, setIsInviting] = useState(false);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shouldShowTeams = showTeamSelection && teams && teams.length > 0;

  const getLink = (id: string) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}${invitationPath.replace(":id", id)}`;
  };

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
      } else if (!showInvitationLink) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = async () => {
    if (invitationId) {
      try {
        await navigator.clipboard.writeText(getLink(invitationId));
        setCopied(true);
        onToast?.("Link copied!", "success");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        prompt("Copy this link:", getLink(invitationId));
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">
          {invitationId ? "Invitation Sent!" : "Invite Member"}
        </h2>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!invitationId ? (
        <>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Invite a new member to {organizationName}.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                disabled={isInviting}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "member")}
                disabled={isInviting}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {shouldShowTeams && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team (optional)</label>
                <select
                  value={teamId || "none"}
                  onChange={(e) => setTeamId(e.target.value === "none" ? undefined : e.target.value)}
                  disabled={isInviting}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="none">No team</option>
                  {teams.map((team) => (
                    <option key={team._id} value={team._id}>{team.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button onClick={onClose} className="px-4 py-2 border rounded-md hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={handleInvite}
              disabled={isInviting || !email}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isInviting ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="p-6 space-y-4">
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
                Share this link with <strong>{email}</strong>
              </p>
            </div>

            <div className="bg-gray-50 border rounded-lg p-4">
              <label className="block text-xs font-medium text-gray-500 mb-2">Invitation Link</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 p-2 bg-white border rounded-md overflow-hidden">
                  {linkIcon}
                  <code className="text-sm text-gray-700 truncate">{getLink(invitationId)}</code>
                </div>
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    "flex-shrink-0 p-2 rounded-md transition-colors",
                    copied ? "bg-green-100 text-green-600" : "bg-blue-600 text-white hover:bg-blue-700"
                  )}
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
              <p className="text-xs text-gray-500 mt-2">Expires in {expirationText}</p>
            </div>
          </div>

          <div className="flex justify-between px-6 py-4 border-t bg-gray-50">
            <button
              onClick={() => {
                setInvitationId(null);
                setEmail("");
                setCopied(false);
              }}
              className="px-4 py-2 border rounded-md hover:bg-gray-100"
            >
              Invite Another
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
