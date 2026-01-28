"use client";

import { useState, type ReactNode } from "react";
import { cn, formatDate, getInvitationLink, copyToClipboard } from "../utils.js";
import type { Member } from "../hooks/use-members.js";
import type { Invitation } from "../hooks/use-invitations.js";
import type { Team } from "../hooks/use-teams.js";

export type FilterValue = "all" | "members" | "invitations";

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
  onUpdateMemberRole?: (memberUserId: string, role: "owner" | "admin" | "member") => Promise<void>;
  
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
   * Custom class name
   */
  className?: string;
  
  // Icons
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
  role: "owner" | "admin" | "member";
  teams: Array<{ _id: string; name: string }>;
  userId: string;
}

interface UnifiedInvitation {
  type: "invitation";
  _id: string;
  email: string;
  name: null;
  role: "admin" | "member";
  teamId: string | null;
  expiresAt: number;
  status: "pending" | "accepted" | "cancelled" | "expired";
  isExpired: boolean;
}

type UnifiedData = UnifiedMember | UnifiedInvitation;

/**
 * A table component for displaying and managing organization members and invitations.
 * 
 * @example
 * ```tsx
 * import { MembersTable } from "@djpanda/convex-tenants/react";
 * import { MoreHorizontal, UserMinus, Copy, RefreshCw, XCircle } from "lucide-react";
 * 
 * function MyApp() {
 *   const { members, removeMember, updateMemberRole } = useMembers(...);
 *   const { invitations, resendInvitation, cancelInvitation } = useInvitations(...);
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
 *       moreIcon={<MoreHorizontal className="h-4 w-4" />}
 *       userMinusIcon={<UserMinus className="h-4 w-4" />}
 *       copyIcon={<Copy className="h-4 w-4" />}
 *       refreshIcon={<RefreshCw className="h-4 w-4" />}
 *       cancelIcon={<XCircle className="h-4 w-4" />}
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
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Built-in copy handler
  const handleCopyLink = async (invitationId: string) => {
    if (onCopyInvitationLink) {
      // Use custom handler if provided
      onCopyInvitationLink(invitationId);
    } else {
      // Use built-in copy
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

  // Calculate counts
  const membersCount = members.length;
  const invitationsCount = invitations.length;
  const totalCount = membersCount + invitationsCount;

  // Get description based on filter
  const getDescription = () => {
    if (filter === "all") {
      return `${totalCount} people (${membersCount} members, ${invitationsCount} pending)`;
    } else if (filter === "members") {
      return `${membersCount} active member${membersCount !== 1 ? "s" : ""}`;
    } else {
      return `${invitationsCount} pending invitation${invitationsCount !== 1 ? "s" : ""}`;
    }
  };

  // Create unified data for "all" filter
  const unifiedData: UnifiedData[] =
    filter === "all"
      ? [
          ...members.map((member) => ({
            type: "member" as const,
            _id: member._id,
            email: member.user?.email || "",
            name: member.user?.name || member.user?.email || "Unknown",
            role: member.role,
            teams: member.teams || [],
            userId: member.userId,
          })),
          ...invitations.map((invitation) => ({
            type: "invitation" as const,
            _id: invitation._id,
            email: invitation.email,
            name: null,
            role: invitation.role,
            teamId: invitation.teamId,
            expiresAt: invitation.expiresAt,
            status: invitation.status,
            isExpired: invitation.isExpired,
          })),
        ]
      : [];

  const handleRemoveMember = async (memberUserId: string) => {
    try {
      await onRemoveMember?.(memberUserId);
      onToast?.("Member removed successfully", "success");
    } catch (error: any) {
      onToast?.(error.message || "Failed to remove member", "error");
    }
    setDropdownOpen(null);
  };

  const handleUpdateRole = async (memberUserId: string, role: "owner" | "admin" | "member") => {
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
    setDropdownOpen(null);
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
    if (status === "pending" && !isExpired) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          Pending
        </span>
      );
    }
    if (status === "cancelled") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
          Cancelled
        </span>
      );
    }
    if (status === "accepted") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Accepted
        </span>
      );
    }
    if (status === "expired" || isExpired) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          Expired
        </span>
      );
    }
    return null;
  };

  const getRoleBadge = (role: string) => {
    const colors =
      role === "owner"
        ? "bg-purple-100 text-purple-800"
        : role === "admin"
          ? "bg-blue-100 text-blue-800"
          : "bg-gray-100 text-gray-800";
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize", colors)}>
        {role}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className={cn("p-8 text-center text-gray-500", className)}>
        Loading...
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filter */}
      <div className="flex items-center gap-4 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterValue)}
          className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All</option>
          <option value="members">Members Only</option>
          <option value="invitations">Invitations Only</option>
        </select>
        <span className="text-sm text-gray-500">{getDescription()}</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name / Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teams
              </th>
              {isOwnerOrAdmin && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filter === "all" &&
              unifiedData.map((item) => (
                <tr key={`${item.type}-${item._id}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {item.type === "member" ? item.name || item.email || "Unknown User" : item.email}
                      </span>
                      {item.type === "member" && item.email && (
                        <span className="text-sm text-gray-500">{item.email}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.type === "member" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      getStatusBadge(item.status, item.isExpired)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.type === "member" && isOwner && item.role !== "owner" ? (
                      <select
                        value={item.role}
                        onChange={(e) => handleUpdateRole(item.userId, e.target.value as any)}
                        className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    ) : (
                      getRoleBadge(item.role)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.type === "member" ? (
                      item.teams && item.teams.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {item.teams.map((team) => (
                            <span key={team._id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {team.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">No teams</span>
                      )
                    ) : item.teamId ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Team invited
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">No team</span>
                    )}
                  </td>
                  {isOwnerOrAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {item.type === "member" ? (
                        <div className="relative inline-block">
                          <button
                            onClick={() => setDropdownOpen(dropdownOpen === item._id ? null : item._id)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {moreIcon}
                          </button>
                          {dropdownOpen === item._id && (
                            <>
                              <div className="absolute right-0 mt-1 w-48 bg-white border rounded-md shadow-lg z-10">
                                {teams && teams.length > 0 && (
                                  <>
                                    <div className="px-3 py-2 text-xs font-medium text-gray-500">
                                      Add to Team
                                    </div>
                                    {teams.map((team) => (
                                      <button
                                        key={team._id}
                                        onClick={() => handleAddToTeam(item.userId, team._id)}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                                      >
                                        {team.name}
                                      </button>
                                    ))}
                                    <div className="border-t my-1" />
                                  </>
                                )}
                                <button
                                  onClick={() => handleRemoveMember(item.userId)}
                                  disabled={item.role === "owner"}
                                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {userMinusIcon}
                                  Remove Member
                                </button>
                              </div>
                              <div className="fixed inset-0 z-0" onClick={() => setDropdownOpen(null)} />
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {item.status === "pending" && !item.isExpired && (
                            <>
                              <button
                                onClick={() => handleResendInvitation(item._id)}
                                disabled={resendingId === item._id}
                                className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                                title="Resend invitation"
                              >
                                <span className={resendingId === item._id ? "animate-spin" : ""}>
                                  {refreshIcon}
                                </span>
                              </button>
                              <button
                                onClick={() => handleCopyLink(item._id)}
                                className={cn(
                                  "p-1 rounded transition-colors",
                                  copiedId === item._id 
                                    ? "bg-green-100 text-green-600" 
                                    : "hover:bg-gray-100"
                                )}
                                title={copiedId === item._id ? "Copied!" : "Copy invitation link"}
                              >
                                {copiedId === item._id ? (checkIcon || copyIcon) : copyIcon}
                              </button>
                              <button
                                onClick={() => handleCancelInvitation(item._id)}
                                disabled={resendingId === item._id}
                                className="p-1 hover:bg-gray-100 rounded text-red-600 disabled:opacity-50"
                                title="Cancel invitation"
                              >
                                {cancelIcon}
                              </button>
                            </>
                          )}
                          {(item.status === "cancelled" || item.status === "expired" || item.isExpired) && (
                            <button
                              onClick={() => handleCopyLink(item._id)}
                              className={cn(
                                "p-1 rounded transition-colors",
                                copiedId === item._id 
                                  ? "bg-green-100 text-green-600" 
                                  : "hover:bg-gray-100"
                              )}
                              title={copiedId === item._id ? "Copied!" : "Copy invitation link"}
                            >
                              {copiedId === item._id ? (checkIcon || copyIcon) : copyIcon}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}

            {filter === "members" &&
              members.map((member) => (
                <tr key={member._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {member.user?.name || member.user?.email || "Unknown User"}
                      </span>
                      {member.user?.email && (
                        <span className="text-sm text-gray-500">{member.user.email}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isOwner && member.role !== "owner" ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.userId, e.target.value as any)}
                        className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    ) : (
                      getRoleBadge(member.role)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {member.teams && member.teams.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {member.teams.map((team) => (
                          <span key={team._id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {team.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">No teams</span>
                    )}
                  </td>
                  {isOwnerOrAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={member.role === "owner"}
                        className="p-1 hover:bg-gray-100 rounded text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove member"
                      >
                        {userMinusIcon}
                      </button>
                    </td>
                  )}
                </tr>
              ))}

            {filter === "invitations" &&
              invitations.map((invitation) => (
                <tr key={invitation._id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {invitation.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invitation.status, invitation.isExpired)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(invitation.role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {invitation.teamId ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Team invited
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">No team</span>
                    )}
                  </td>
                  {isOwnerOrAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {invitation.status === "pending" && !invitation.isExpired && (
                          <>
                            <button
                              onClick={() => handleResendInvitation(invitation._id)}
                              disabled={resendingId === invitation._id}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                              title="Resend invitation"
                            >
                              <span className={resendingId === invitation._id ? "animate-spin" : ""}>
                                {refreshIcon}
                              </span>
                            </button>
                            <button
                              onClick={() => handleCopyLink(invitation._id)}
                              className={cn(
                                "p-1 rounded transition-colors",
                                copiedId === invitation._id 
                                  ? "bg-green-100 text-green-600" 
                                  : "hover:bg-gray-100"
                              )}
                              title={copiedId === invitation._id ? "Copied!" : "Copy invitation link"}
                            >
                              {copiedId === invitation._id ? (checkIcon || copyIcon) : copyIcon}
                            </button>
                            <button
                              onClick={() => handleCancelInvitation(invitation._id)}
                              disabled={resendingId === invitation._id}
                              className="p-1 hover:bg-gray-100 rounded text-red-600 disabled:opacity-50"
                              title="Cancel invitation"
                            >
                              {cancelIcon}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>

        {/* Empty states */}
        {filter === "all" && unifiedData.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No members or invitations found
          </div>
        )}
        {filter === "members" && members.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No members found
          </div>
        )}
        {filter === "invitations" && invitations.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No pending invitations
          </div>
        )}
      </div>
    </div>
  );
}
