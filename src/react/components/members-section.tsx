"use client";

import { type ReactNode, useMemo } from "react";
import { Users, Plus } from "lucide-react";
import { useTenants } from "../providers/tenants-context.js";
import { InviteMemberDialog } from "./invite-member-dialog.js";
import { MembersTable } from "./members-table.js";
import { Button } from "../ui/button.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "../ui/card.js";
import { Skeleton } from "../ui/skeleton.js";
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

  // Icons (optional overrides)
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
    isOrganizationsLoading,
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

  const isDataLoading = isMembersLoading || isInvitationsLoading;

  // Transform members for the table (hooks must be called before any early return)
  const transformedMembers: Member[] = useMemo(() => members.map((m) => ({
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
  })), [members]);

  // Transform invitations for the table
  const transformedInvitations: Invitation[] = useMemo(() => invitations.map((inv) => ({
    _id: inv._id,
    _creationTime: inv._creationTime,
    email: inv.email,
    organizationId: inv.organizationId,
    role: inv.role,
    teamId: inv.teamId ?? null,
    inviterId: inv.inviterId,
    expiresAt: inv.expiresAt,
    status: inv.status as "pending" | "accepted" | "cancelled" | "expired",
    isExpired: inv.isExpired ?? inv.status === "expired",
  })), [invitations]);

  // Transform teams
  const transformedTeams: Team[] = useMemo(() => teams.map((t) => ({
    _id: t._id,
    _creationTime: t._creationTime,
    name: t.name,
    organizationId: t.organizationId,
    description: t.description ?? null,
    slug: t.slug,
    metadata: undefined,
  })), [teams]);

  // Show full card skeleton while organizations load, or "select org" when done loading with none selected
  if (isOrganizationsLoading || !currentOrganization) {
    return (
      <MembersSectionSkeleton className={className} title={title} noOrg={!isOrganizationsLoading} />
    );
  }

  const shouldShowInviteButton = showInviteButton ?? isOwnerOrAdmin;

  const UsersIcon = usersIcon ?? (
    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
      <Users className="size-5 text-primary" />
    </div>
  );
  const PlusIcon = plusIcon ?? <Plus className="size-4" />;

  return (
    <Card className={className}>
      {/* Header */}
      <CardHeader>
        <div className="flex items-center gap-3">
          {UsersIcon}
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {isDataLoading ? (
              <Skeleton className="mt-1 h-4 w-48" />
            ) : (
              <CardDescription>
                {members.length} member{members.length !== 1 ? "s" : ""},{" "}
                {invitations.length} pending invitation
                {invitations.length !== 1 ? "s" : ""}
              </CardDescription>
            )}
          </div>
        </div>

        {shouldShowInviteButton && (
          <CardAction>
            <InviteMemberDialog
              organizationName={currentOrganization.name}
              teams={transformedTeams}
              showTeamSelection={showTeamSelection}
              showInvitationLink={showInvitationLink}
              invitationPath={invitationPath}
              expirationText={expirationText}
              onInvite={inviteMember}
              onToast={onToast}
              mailIcon={mailIcon}
              copyIcon={copyIcon}
              checkIcon={checkIcon}
              linkIcon={linkIcon}
              trigger={
                <Button>
                  {PlusIcon}
                  <span>Invite Member</span>
                </Button>
              }
            />
          </CardAction>
        )}
      </CardHeader>

      {/* Members Table */}
      <CardContent>
        <MembersTable
          members={transformedMembers}
          invitations={transformedInvitations}
          teams={transformedTeams}
          isLoading={isDataLoading}
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
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function MembersSectionSkeleton({
  className,
  title: _title,
  noOrg,
}: {
  className?: string;
  title: string;
  noOrg?: boolean;
}) {
  // When no org is selected (not loading), show a message
  if (noOrg) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            Select an organization to view members
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {/* Header skeleton */}
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <CardAction>
          <Skeleton className="h-9 w-32 rounded-md" />
        </CardAction>
      </CardHeader>

      {/* Table skeleton */}
      <CardContent>
        {/* Filter skeleton */}
        <div className="mb-4 flex items-center gap-4">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Table skeleton */}
        <div className="overflow-hidden rounded-lg border">
          {/* Header row */}
          <div className="flex items-center border-b bg-muted/50 px-4 py-3">
            <div className="flex-1"><Skeleton className="h-4 w-24" /></div>
            <div className="w-20"><Skeleton className="h-4 w-14" /></div>
            <div className="w-20"><Skeleton className="h-4 w-10" /></div>
            <div className="w-24"><Skeleton className="h-4 w-14" /></div>
            <div className="w-16 text-right"><Skeleton className="ml-auto h-4 w-14" /></div>
          </div>
          {/* Data rows */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center border-b px-4 py-4 last:border-0"
            >
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4" style={{ width: `${100 + i * 20}px` }} />
                <Skeleton className="h-3" style={{ width: `${140 + i * 15}px` }} />
              </div>
              <div className="w-20"><Skeleton className="h-5 w-14 rounded-full" /></div>
              <div className="w-20"><Skeleton className="h-5 w-14 rounded-full" /></div>
              <div className="w-24"><Skeleton className="h-5 w-20 rounded-full" /></div>
              <div className="w-16 text-right"><Skeleton className="ml-auto size-8 rounded-md" /></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
