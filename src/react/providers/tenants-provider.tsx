"use client";

import { type ReactNode, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useOrganizationStore } from "../stores/organization-store.js";
import {
  TenantsContext,
  type TenantsContextValue,
  type Organization,
  type Member,
  type Invitation,
  type Team,
} from "./tenants-context.js";

// ============================================================================
// API Interface Type
// ============================================================================

/**
 * The expected shape of the api namespace passed to TenantsProvider.
 * Your Convex module should export these functions with matching names.
 */
export interface TenantsAPI {
  // Organization queries/mutations
  listOrganizations: FunctionReference<"query", "public", Record<string, never>, Organization[]>;
  createOrganization: FunctionReference<
    "mutation",
    "public",
    { name: string; slug: string; logo?: string; metadata?: any },
    string
  >;

  // Member queries/mutations
  listMembers: FunctionReference<
    "query",
    "public",
    { organizationId: string },
    Member[]
  >;
  removeMember: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; memberUserId: string },
    null
  >;
  updateMemberRole: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; memberUserId: string; role: "owner" | "admin" | "member" },
    null
  >;

  // Invitation queries/mutations
  listInvitations: FunctionReference<
    "query",
    "public",
    { organizationId: string },
    Invitation[]
  >;
  inviteMember: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; email: string; role: "admin" | "member"; teamId?: string },
    { invitationId: string; email: string; expiresAt: number } | null
  >;
  resendInvitation: FunctionReference<
    "mutation",
    "public",
    { invitationId: string },
    null
  >;
  cancelInvitation: FunctionReference<
    "mutation",
    "public",
    { invitationId: string },
    null
  >;

  // Team queries/mutations
  listTeams: FunctionReference<
    "query",
    "public",
    { organizationId: string },
    Team[]
  >;
  createTeam: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; name: string; description?: string },
    string
  >;
  deleteTeam: FunctionReference<
    "mutation",
    "public",
    { teamId: string },
    null
  >;
  addTeamMember: FunctionReference<
    "mutation",
    "public",
    { teamId: string; userId: string },
    null
  >;
  removeTeamMember: FunctionReference<
    "mutation",
    "public",
    { teamId: string; userId: string },
    null
  >;
}

// ============================================================================
// Provider Props
// ============================================================================

export interface TenantsProviderProps {
  /**
   * The api namespace containing all tenants functions.
   * Should match the TenantsAPI interface.
   *
   * @example
   * ```tsx
   * import { api } from "../convex/_generated/api";
   * <TenantsProvider api={api.example}>
   * ```
   */
  api: TenantsAPI;

  /**
   * Children to render
   */
  children: ReactNode;

  /**
   * Optional toast callback for notifications
   */
  onToast?: (message: string, type: "success" | "error") => void;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * TenantsProvider - The main context provider for the tenants package.
 *
 * Wraps your app and provides all tenants data and actions to child components.
 *
 * @example
 * ```tsx
 * import { TenantsProvider } from "@djpanda/convex-tenants/react";
 * import { api } from "../convex/_generated/api";
 *
 * function App() {
 *   return (
 *     <TenantsProvider api={api.example}>
 *       <OrganizationSwitcher />
 *       <MembersSection />
 *       <TeamsSection />
 *     </TenantsProvider>
 *   );
 * }
 * ```
 */
export function TenantsProvider({
  api,
  children,
  onToast,
}: TenantsProviderProps) {
  const { activeOrganizationId, setActiveOrganizationId } = useOrganizationStore();

  // ============================================================================
  // Queries
  // ============================================================================

  const organizationsRaw = useQuery(api.listOrganizations);
  const organizations = useMemo(() => organizationsRaw ?? [], [organizationsRaw]);

  // Get current organization
  const currentOrganization = useMemo(() => {
    if (activeOrganizationId) {
      const org = organizations.find((o) => o._id === activeOrganizationId);
      if (org) return org;
    }
    return organizations[0] || null;
  }, [organizations, activeOrganizationId]);

  // Auto-select first org if none selected
  useEffect(() => {
    if (organizations.length > 0 && !activeOrganizationId) {
      setActiveOrganizationId(organizations[0]._id);
    }
  }, [organizations, activeOrganizationId, setActiveOrganizationId]);

  // Organization-scoped queries (skip if no org)
  const membersRaw = useQuery(
    api.listMembers,
    currentOrganization ? { organizationId: currentOrganization._id } : "skip"
  );
  const members = useMemo(() => membersRaw ?? [], [membersRaw]);

  const invitationsRaw = useQuery(
    api.listInvitations,
    currentOrganization ? { organizationId: currentOrganization._id } : "skip"
  );
  const invitations = useMemo(() => invitationsRaw ?? [], [invitationsRaw]);

  const teamsRaw = useQuery(
    api.listTeams,
    currentOrganization ? { organizationId: currentOrganization._id } : "skip"
  );
  const teams = useMemo(() => teamsRaw ?? [], [teamsRaw]);

  // ============================================================================
  // Mutations
  // ============================================================================

  const createOrgMutation = useMutation(api.createOrganization);
  const removeMemberMutation = useMutation(api.removeMember);
  const updateMemberRoleMutation = useMutation(api.updateMemberRole);
  const inviteMemberMutation = useMutation(api.inviteMember);
  const resendInvitationMutation = useMutation(api.resendInvitation);
  const cancelInvitationMutation = useMutation(api.cancelInvitation);
  const createTeamMutation = useMutation(api.createTeam);
  const deleteTeamMutation = useMutation(api.deleteTeam);
  const addTeamMemberMutation = useMutation(api.addTeamMember);
  const removeTeamMemberMutation = useMutation(api.removeTeamMember);

  // ============================================================================
  // Loading States
  // ============================================================================

  const isOrganizationsLoading = organizationsRaw === undefined;
  const isMembersLoading = currentOrganization ? membersRaw === undefined : false;
  const isInvitationsLoading = currentOrganization ? invitationsRaw === undefined : false;
  const isTeamsLoading = currentOrganization ? teamsRaw === undefined : false;
  const isLoading = isOrganizationsLoading || isMembersLoading || isInvitationsLoading || isTeamsLoading;

  // ============================================================================
  // Role Checks
  // ============================================================================

  const isOwner = currentOrganization?.role === "owner";
  const isOwnerOrAdmin = currentOrganization?.role === "owner" || currentOrganization?.role === "admin";

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const switchOrganization = useCallback(
    (organizationId: string) => {
      setActiveOrganizationId(organizationId);
    },
    [setActiveOrganizationId]
  );

  const createOrganization = useCallback(
    async (data: { name: string; slug: string; logo?: string; metadata?: any }) => {
      try {
        const orgId = await createOrgMutation(data);
        if (orgId) {
          setActiveOrganizationId(orgId);
          onToast?.("Organization created successfully!", "success");
        }
        return orgId;
      } catch (error: any) {
        onToast?.(error.message || "Failed to create organization", "error");
        throw error;
      }
    },
    [createOrgMutation, setActiveOrganizationId, onToast]
  );

  const removeMember = useCallback(
    async (memberUserId: string) => {
      if (!currentOrganization) throw new Error("No organization selected");
      try {
        await removeMemberMutation({
          organizationId: currentOrganization._id,
          memberUserId,
        });
        onToast?.("Member removed successfully", "success");
      } catch (error: any) {
        onToast?.(error.message || "Failed to remove member", "error");
        throw error;
      }
    },
    [currentOrganization, removeMemberMutation, onToast]
  );

  const updateMemberRole = useCallback(
    async (memberUserId: string, role: "owner" | "admin" | "member") => {
      if (!currentOrganization) throw new Error("No organization selected");
      try {
        await updateMemberRoleMutation({
          organizationId: currentOrganization._id,
          memberUserId,
          role,
        });
        onToast?.("Member role updated successfully", "success");
      } catch (error: any) {
        onToast?.(error.message || "Failed to update member role", "error");
        throw error;
      }
    },
    [currentOrganization, updateMemberRoleMutation, onToast]
  );

  const inviteMember = useCallback(
    async (data: { email: string; role: "admin" | "member"; teamId?: string }) => {
      if (!currentOrganization) throw new Error("No organization selected");
      try {
        const result = await inviteMemberMutation({
          organizationId: currentOrganization._id,
          ...data,
        });
        onToast?.("Invitation sent successfully!", "success");
        return result;
      } catch (error: any) {
        onToast?.(error.message || "Failed to send invitation", "error");
        throw error;
      }
    },
    [currentOrganization, inviteMemberMutation, onToast]
  );

  const resendInvitation = useCallback(
    async (invitationId: string) => {
      try {
        await resendInvitationMutation({ invitationId });
        onToast?.("Invitation resent successfully", "success");
      } catch (error: any) {
        onToast?.(error.message || "Failed to resend invitation", "error");
        throw error;
      }
    },
    [resendInvitationMutation, onToast]
  );

  const cancelInvitation = useCallback(
    async (invitationId: string) => {
      try {
        await cancelInvitationMutation({ invitationId });
        onToast?.("Invitation cancelled successfully", "success");
      } catch (error: any) {
        onToast?.(error.message || "Failed to cancel invitation", "error");
        throw error;
      }
    },
    [cancelInvitationMutation, onToast]
  );

  const createTeam = useCallback(
    async (data: { name: string; description?: string }) => {
      if (!currentOrganization) throw new Error("No organization selected");
      try {
        const teamId = await createTeamMutation({
          organizationId: currentOrganization._id,
          ...data,
        });
        onToast?.("Team created successfully!", "success");
        return teamId;
      } catch (error: any) {
        onToast?.(error.message || "Failed to create team", "error");
        throw error;
      }
    },
    [currentOrganization, createTeamMutation, onToast]
  );

  const deleteTeam = useCallback(
    async (teamId: string) => {
      try {
        await deleteTeamMutation({ teamId });
        onToast?.("Team deleted successfully", "success");
      } catch (error: any) {
        onToast?.(error.message || "Failed to delete team", "error");
        throw error;
      }
    },
    [deleteTeamMutation, onToast]
  );

  const addTeamMember = useCallback(
    async (userId: string, teamId: string) => {
      try {
        await addTeamMemberMutation({ teamId, userId });
        onToast?.("Member added to team", "success");
      } catch (error: any) {
        onToast?.(error.message || "Failed to add member to team", "error");
        throw error;
      }
    },
    [addTeamMemberMutation, onToast]
  );

  const removeTeamMember = useCallback(
    async (userId: string, teamId: string) => {
      try {
        await removeTeamMemberMutation({ teamId, userId });
        onToast?.("Member removed from team", "success");
      } catch (error: any) {
        onToast?.(error.message || "Failed to remove member from team", "error");
        throw error;
      }
    },
    [removeTeamMemberMutation, onToast]
  );

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: TenantsContextValue = useMemo(
    () => ({
      // Data
      organizations,
      currentOrganization,
      members,
      invitations,
      teams,

      // Loading states
      isLoading,
      isOrganizationsLoading,
      isMembersLoading,
      isInvitationsLoading,
      isTeamsLoading,

      // Role checks
      isOwner,
      isOwnerOrAdmin,

      // Actions
      switchOrganization,
      createOrganization,
      removeMember,
      updateMemberRole,
      inviteMember,
      resendInvitation,
      cancelInvitation,
      createTeam,
      deleteTeam,
      addTeamMember,
      removeTeamMember,

      // Toast
      onToast,
    }),
    [
      organizations,
      currentOrganization,
      members,
      invitations,
      teams,
      isLoading,
      isOrganizationsLoading,
      isMembersLoading,
      isInvitationsLoading,
      isTeamsLoading,
      isOwner,
      isOwnerOrAdmin,
      switchOrganization,
      createOrganization,
      removeMember,
      updateMemberRole,
      inviteMember,
      resendInvitation,
      cancelInvitation,
      createTeam,
      deleteTeam,
      addTeamMember,
      removeTeamMember,
      onToast,
    ]
  );

  return (
    <TenantsContext.Provider value={value}>
      {children}
    </TenantsContext.Provider>
  );
}
