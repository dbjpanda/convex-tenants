"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  MoreHorizontal,
  UserMinus,
  Copy,
  Check,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { cn, getInvitationLink, copyToClipboard } from "../utils.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
import { Skeleton } from "../ui/skeleton.js";
import type { Member } from "../hooks/use-members.js";
import type { Invitation } from "../hooks/use-invitations.js";
import type { Team } from "../hooks/use-teams.js";

export type FilterValue = "all" | "active" | "suspended" | "pending";

export interface MembersTableProps {
  /**
   * List of organization members
   */
  members: Member[];

  /**
   * List of organization invitations
   */
  invitations: Invitation[];

  /**
   * List of teams in the organization
   */
  teams?: Team[];

  /**
   * Whether the data is loading
   */
  isLoading?: boolean;

  /**
   * Whether the current user is the owner
   */
  isOwner?: boolean;

  /**
   * Whether the current user is owner or admin
   */
  isOwnerOrAdmin?: boolean;

  /**
   * Base URL for invitation links (defaults to window.location.origin)
   */
  baseUrl?: string;

  /**
   * Custom invitation path pattern (defaults to "/accept-invitation/:id")
   * Use ":id" as placeholder for invitation ID
   */
  invitationPath?: string;

  /**
   * Callback to remove a member
   */
  onRemoveMember?: (memberUserId: string) => Promise<void>;

  /**
   * Callback to update member role
   */
  onUpdateMemberRole?: (
    memberUserId: string,
    role: string
  ) => Promise<void>;

  /**
   * Callback to add member to team
   */
  onAddToTeam?: (userId: string, teamId: string) => Promise<void>;

  /**
   * Callback to resend invitation
   */
  onResendInvitation?: (invitationId: string) => Promise<void>;

  /**
   * Custom callback to copy invitation link (if not provided, uses built-in copy)
   */
  onCopyInvitationLink?: (invitationId: string) => void;

  /**
   * Callback to cancel invitation
   */
  onCancelInvitation?: (invitationId: string) => Promise<void>;

  /**
   * Toast notification callback
   */
  onToast?: (message: string, type: "success" | "error") => void;

  /**
   * Available roles for the role selector dropdown.
   * Defaults to ["member", "admin", "owner"].
   */
  roles?: string[];

  /**
   * Custom class name
   */
  className?: string;

  // Icons (optional overrides — defaults to lucide-react)
  moreIcon?: ReactNode;
  userMinusIcon?: ReactNode;
  copyIcon?: ReactNode;
  checkIcon?: ReactNode;
  refreshIcon?: ReactNode;
  cancelIcon?: ReactNode;
}

interface UnifiedMember {
  type: "member";
  _id: string;
  email: string;
  name: string;
  role: string;
  status: "active" | "suspended";
  teams: Array<{ _id: string; name: string }>;
  userId: string;
}

interface UnifiedInvitation {
  type: "invitation";
  _id: string;
  email: string;
  name: null;
  role: string;
  teamId: string | null;
  expiresAt: number;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  isExpired: boolean;
}

type UnifiedData = UnifiedMember | UnifiedInvitation;

/**
 * A table component for displaying and managing organization members and invitations.
 *
 * @example
 * ```tsx
 * import { MembersTable } from "@djpanda/convex-tenants/react";
 *
 * function MyApp() {
 *   const { members, removeMember, updateMemberRole } = useMembers(...);
 *   const { invitations, resendInvitation, cancelInvitation } = useOrganizationInvitations(options);
 *
 *   return (
 *     <MembersTable
 *       members={members}
 *       invitations={invitations}
 *       isOwner={true}
 *       isOwnerOrAdmin={true}
 *       onRemoveMember={removeMember}
 *       onUpdateMemberRole={updateMemberRole}
 *       onResendInvitation={resendInvitation}
 *       onCancelInvitation={cancelInvitation}
 *     />
 *   );
 * }
 * ```
 */
export function MembersTable({
  members,
  invitations,
  teams,
  isLoading = false,
  isOwner = false,
  isOwnerOrAdmin = false,
  baseUrl,
  invitationPath = "/accept-invitation/:id",
  onRemoveMember,
  onUpdateMemberRole,
  onAddToTeam,
  onResendInvitation,
  onCopyInvitationLink,
  onCancelInvitation,
  onToast,
  roles,
  className,
  moreIcon,
  userMinusIcon,
  copyIcon,
  checkIcon,
  refreshIcon,
  cancelIcon,
}: MembersTableProps) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const MoreIcon = moreIcon ?? <MoreHorizontal className="size-4" />;
  const UserMinusIcon = userMinusIcon ?? <UserMinus className="size-4" />;
  const CopyIcon = copyIcon ?? <Copy className="size-4" />;
  const CheckIcon = checkIcon ?? <Check className="size-4" />;
  const RefreshIcon = refreshIcon ?? <RefreshCw className="size-4" />;
  const CancelIcon = cancelIcon ?? <XCircle className="size-4" />;

  // Built-in copy handler
  const handleCopyLink = async (invitationId: string) => {
    if (onCopyInvitationLink) {
      onCopyInvitationLink(invitationId);
    } else {
      const link = getInvitationLink(invitationId, baseUrl, invitationPath);
      const success = await copyToClipboard(link);
      if (success) {
        setCopiedId(invitationId);
        onToast?.("Invitation link copied!", "success");
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        onToast?.("Failed to copy link", "error");
      }
    }
  };

  // Only show pending, non-expired invitations — accepted/cancelled/expired
  // invitations are just audit trails; the member record is the source of truth.
  const pendingInvitations = useMemo(
    () => invitations.filter((inv) => inv.status === "pending" && !inv.isExpired),
    [invitations]
  );

  // Counts
  const activeMembers = useMemo(() => members.filter((m) => m.status !== "suspended"), [members]);
  const suspendedMembers = useMemo(() => members.filter((m) => m.status === "suspended"), [members]);
  const activeCount = activeMembers.length;
  const suspendedCount = suspendedMembers.length;
  const pendingCount = pendingInvitations.length;
  const totalCount = activeCount + suspendedCount + pendingCount;

  const description = useMemo(() => {
    const parts: string[] = [];
    if (activeCount > 0) parts.push(`${activeCount} active`);
    if (suspendedCount > 0) parts.push(`${suspendedCount} suspended`);
    if (pendingCount > 0) parts.push(`${pendingCount} pending`);

    if (filter === "all")
      return `${totalCount} people${parts.length > 0 ? ` (${parts.join(", ")})` : ""}`;
    if (filter === "active")
      return `${activeCount} active member${activeCount !== 1 ? "s" : ""}`;
    if (filter === "suspended")
      return `${suspendedCount} suspended member${suspendedCount !== 1 ? "s" : ""}`;
    return `${pendingCount} pending invitation${pendingCount !== 1 ? "s" : ""}`;
  }, [filter, totalCount, activeCount, suspendedCount, pendingCount]);

  const toUnifiedMember = (member: Member): UnifiedMember => ({
    type: "member",
    _id: member._id,
    email: member.user?.email || "",
    name: member.user?.name || member.user?.email || "Unknown",
    role: member.role,
    status: member.status ?? "active",
    teams: member.teams || [],
    userId: member.userId,
  });

  const toUnifiedInvitation = (invitation: Invitation): UnifiedInvitation => ({
    type: "invitation",
    _id: invitation._id,
    email: invitation.inviteeIdentifier,
    name: null,
    role: invitation.role,
    teamId: invitation.teamId,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
    isExpired: invitation.isExpired,
  });

  // Unified data for the current filter
  const unifiedData: UnifiedData[] = useMemo(() => {
    if (filter === "all")
      return [
        ...members.map(toUnifiedMember),
        ...pendingInvitations.map(toUnifiedInvitation),
      ];
    if (filter === "active") return activeMembers.map(toUnifiedMember);
    if (filter === "suspended") return suspendedMembers.map(toUnifiedMember);
    if (filter === "pending") return pendingInvitations.map(toUnifiedInvitation);
    return [];
  }, [filter, members, activeMembers, suspendedMembers, pendingInvitations]);

  const handleRemoveMember = async (memberUserId: string) => {
    try {
      await onRemoveMember?.(memberUserId);
      onToast?.("Member removed successfully", "success");
    } catch (error: any) {
      onToast?.(error.message || "Failed to remove member", "error");
    }
  };

  const handleUpdateRole = async (
    memberUserId: string,
    role: string
  ) => {
    try {
      await onUpdateMemberRole?.(memberUserId, role);
      onToast?.("Role updated successfully", "success");
    } catch (error: any) {
      onToast?.(error.message || "Failed to update role", "error");
    }
  };

  const handleAddToTeam = async (userId: string, teamId: string) => {
    try {
      await onAddToTeam?.(userId, teamId);
      onToast?.("Member added to team", "success");
    } catch (error: any) {
      onToast?.(error.message || "Failed to add to team", "error");
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setResendingId(invitationId);
    try {
      await onResendInvitation?.(invitationId);
      onToast?.("Invitation resent successfully", "success");
    } catch (error: any) {
      onToast?.(error.message || "Failed to resend invitation", "error");
    } finally {
      setResendingId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await onCancelInvitation?.(invitationId);
      onToast?.("Invitation cancelled successfully", "success");
    } catch (error: any) {
      onToast?.(error.message || "Failed to cancel invitation", "error");
    }
  };

  const getStatusBadge = (status: string, isExpired: boolean) => {
    if (status === "pending" && !isExpired)
      return <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400">Pending</Badge>;
    if (status === "declined")
      return <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400">Declined</Badge>;
    if (status === "cancelled")
      return <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">Cancelled</Badge>;
    if (status === "accepted")
      return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">Accepted</Badge>;
    if (status === "expired" || isExpired)
      return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">Expired</Badge>;
    return null;
  };

  const getRoleBadge = (role: string) => {
    if (role === "owner")
      return <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400">Owner</Badge>;
    if (role === "admin")
      return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">Admin</Badge>;
    return <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">Member</Badge>;
  };

  if (isLoading) {
    return (
      <div className={className}>
        {/* Filter skeleton */}
        <div className="mb-4 flex items-center gap-4">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Table skeleton */}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="py-3 font-semibold">Name / Email</TableHead>
                <TableHead className="py-3 font-semibold">Status</TableHead>
                <TableHead className="py-3 font-semibold">Role</TableHead>
                <TableHead className="py-3 font-semibold">Teams</TableHead>
                <TableHead className="py-3 text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Row renderer for a member
  const renderMemberRow = (item: UnifiedMember) => (
    <TableRow key={`member-${item._id}`}>
      <TableCell className="py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{item.name || item.email || "Unknown User"}</span>
          {item.email && item.name && (
            <span className="text-xs text-muted-foreground">{item.email}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-3">
        {item.status === "suspended" ? (
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">Suspended</Badge>
        ) : (
          <Badge className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">Active</Badge>
        )}
      </TableCell>
      <TableCell className="py-3">
        {isOwner ? (
          <Select
            value={item.role}
            onValueChange={(v) => handleUpdateRole(item.userId, v)}
          >
            <SelectTrigger className="h-7 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(roles ?? ["member", "admin", "owner"]).map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          getRoleBadge(item.role)
        )}
      </TableCell>
      <TableCell className="py-3">
        {item.teams && item.teams.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.teams.map((team) => (
              <Badge key={team._id} variant="outline" className="text-xs">
                {team.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No teams</span>
        )}
      </TableCell>
      {isOwnerOrAdmin && (
        <TableCell className="py-3 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                {MoreIcon}
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {teams && teams.length > 0 && (
                <>
                  <DropdownMenuLabel>Add to Team</DropdownMenuLabel>
                  {teams.map((team) => (
                    <DropdownMenuItem
                      key={team._id}
                      onClick={() => handleAddToTeam(item.userId, team._id)}
                    >
                      {team.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => handleRemoveMember(item.userId)}
                disabled={item.role === "owner"}
                className="text-destructive focus:text-destructive"
              >
                {UserMinusIcon}
                Remove Member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );

  // Row renderer for an invitation
  const renderInvitationRow = (item: UnifiedInvitation) => (
    <TableRow key={`invitation-${item._id}`} className="text-muted-foreground">
      <TableCell className="py-3 font-medium text-foreground">{item.email}</TableCell>
      <TableCell className="py-3">{getStatusBadge(item.status, item.isExpired)}</TableCell>
      <TableCell className="py-3">{getRoleBadge(item.role)}</TableCell>
      <TableCell className="py-3">
        {item.teamId ? (
          <Badge variant="outline" className="text-xs">Team invited</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">No team</span>
        )}
      </TableCell>
      {isOwnerOrAdmin && (
        <TableCell className="py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {item.status === "pending" && !item.isExpired && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleResendInvitation(item._id)}
                  disabled={resendingId === item._id}
                  aria-label="Resend invitation"
                >
                  <span className={resendingId === item._id ? "animate-spin" : ""}>
                    {RefreshIcon}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleCopyLink(item._id)}
                  aria-label={copiedId === item._id ? "Copied!" : "Copy invitation link"}
                  className={cn(
                    copiedId === item._id &&
                      "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400"
                  )}
                >
                  {copiedId === item._id ? CheckIcon : CopyIcon}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleCancelInvitation(item._id)}
                  disabled={resendingId === item._id}
                  aria-label="Cancel invitation"
                  className="text-red-500 hover:text-red-600 dark:text-red-400"
                >
                  {CancelIcon}
                </Button>
              </>
            )}
            {(item.status === "cancelled" ||
              item.status === "expired" ||
              item.isExpired) && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleCopyLink(item._id)}
                aria-label={copiedId === item._id ? "Copied!" : "Copy invitation link"}
                className={cn(
                  copiedId === item._id &&
                    "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400"
                )}
              >
                {copiedId === item._id ? CheckIcon : CopyIcon}
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );

  return (
    <div className={className}>
      {/* Filter */}
      <div className="mb-4 flex items-center gap-4">
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            {suspendedCount > 0 && (
              <SelectItem value="suspended">Suspended</SelectItem>
            )}
            {pendingCount > 0 && (
              <SelectItem value="pending">Pending</SelectItem>
            )}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="py-3 font-semibold">Name / Email</TableHead>
              <TableHead className="py-3 font-semibold">Status</TableHead>
              <TableHead className="py-3 font-semibold">Role</TableHead>
              <TableHead className="py-3 font-semibold">Teams</TableHead>
              {isOwnerOrAdmin && (
                <TableHead className="py-3 text-right font-semibold">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {unifiedData.map((item) =>
              item.type === "member"
                ? renderMemberRow(item)
                : renderInvitationRow(item)
            )}
          </TableBody>
        </Table>

        {/* Empty state */}
        {unifiedData.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            {filter === "all" && "No members or invitations found"}
            {filter === "active" && "No active members"}
            {filter === "suspended" && "No suspended members"}
            {filter === "pending" && "No pending invitations"}
          </div>
        )}
      </div>
    </div>
  );
}
