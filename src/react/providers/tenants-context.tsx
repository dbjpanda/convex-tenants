"use client";

import { createContext, useContext } from "react";
import type { FunctionReference } from "convex/server";

// ============================================================================
// Types
// ============================================================================

export interface Organization {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  logo: string | null;
  metadata?: Record<string, unknown>;
  ownerId: string;
  status?: "active" | "suspended" | "archived";
  role: string;
}

export interface Member {
  _id: string;
  _creationTime: number;
  userId: string;
  organizationId: string;
  role: string;
  user?: {
    name?: string;
    email?: string;
  };
  teams?: Array<{ _id: string; name: string }>;
}

export interface Invitation {
  _id: string;
  _creationTime: number;
  inviteeIdentifier: string;
  identifierType?: string;
  organizationId: string;
  role: string;
  teamId?: string | null;
  inviterId: string;
  message?: string;
  expiresAt: number;
  status: "pending" | "accepted" | "cancelled" | "expired";
  isExpired: boolean;
}

export interface Team {
  _id: string;
  _creationTime: number;
  name: string;
  slug?: string;
  description?: string | null;
  organizationId: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Split Context Values
// ============================================================================

/**
 * Read-only data provided by `TenantsProvider`. Re-renders when any slice of
 * tenant data changes (orgs, members, invitations, teams, loading states).
 */
export interface TenantsDataContextValue {
  organizations: Organization[];
  currentOrganization: Organization | null;
  members: Member[];
  invitations: Invitation[];
  teams: Team[];

  isLoading: boolean;
  isOrganizationsLoading: boolean;
  isMembersLoading: boolean;
  isInvitationsLoading: boolean;
  isTeamsLoading: boolean;

  currentRole: string | null;
  currentUserEmail?: string | null | undefined;

  /**
   * The api object passed to TenantsProvider. Used by extended components
   * (MemberModerationSection, BulkInviteSection, etc.) to call optional APIs.
   */
  api: Record<string, FunctionReference<"query" | "mutation", "public"> | undefined>;
}

/**
 * Stable actions/setters provided by `TenantsProvider`. The reference to this
 * context value is memoized and only changes when the active organization
 * identity changes, so components that only need actions rarely re-render.
 */
export interface TenantsActionsContextValue {
  switchOrganization: (organizationId: string) => void;
  createOrganization: (data: {
    name: string;
    slug: string;
    logo?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<string | null>;
  updateOrganization: (data: {
    name?: string;
    slug?: string;
    logo?: string | null;
    metadata?: Record<string, unknown>;
    status?: "active" | "suspended" | "archived";
  }) => Promise<void>;
  deleteOrganization: () => Promise<void>;
  leaveOrganization: () => Promise<void>;

  removeMember: (memberUserId: string) => Promise<void>;
  updateMemberRole: (memberUserId: string, role: string) => Promise<void>;

  inviteMember: (data: {
    inviteeIdentifier: string;
    identifierType?: string;
    role: string;
    teamId?: string;
    message?: string;
  }) => Promise<{ invitationId: string; inviteeIdentifier: string; expiresAt: number } | null>;
  resendInvitation: (invitationId: string) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;

  createTeam: (data: {
    name: string;
    description?: string;
    slug?: string;
    metadata?: Record<string, unknown>;
    parentTeamId?: string;
  }) => Promise<string | null>;
  deleteTeam: (teamId: string) => Promise<void>;
  addTeamMember: (memberUserId: string, teamId: string) => Promise<void>;
  removeTeamMember: (memberUserId: string, teamId: string) => Promise<void>;

  onToast?: (message: string, type: "success" | "error") => void;
}

/**
 * Combined shape returned by `useTenants()` for backward compatibility. New
 * code should prefer `useTenantsData()` / `useTenantsActions()` directly.
 */
export type TenantsContextValue = TenantsDataContextValue & TenantsActionsContextValue;

// ============================================================================
// Contexts
// ============================================================================

export const TenantsDataContext = createContext<TenantsDataContextValue | null>(null);
export const TenantsActionsContext = createContext<TenantsActionsContextValue | null>(null);

export function useTenantsData(): TenantsDataContextValue {
  const context = useContext(TenantsDataContext);
  if (!context) {
    throw new Error(
      "useTenantsData must be used within a TenantsProvider. " +
        "Wrap your app with <TenantsProvider api={api.yourModule}>...</TenantsProvider>"
    );
  }
  return context;
}

export function useTenantsActions(): TenantsActionsContextValue {
  const context = useContext(TenantsActionsContext);
  if (!context) {
    throw new Error(
      "useTenantsActions must be used within a TenantsProvider. " +
        "Wrap your app with <TenantsProvider api={api.yourModule}>...</TenantsProvider>"
    );
  }
  return context;
}

/**
 * Hook to access the combined TenantsContext (data + actions).
 * Provided for backward compatibility; prefer `useTenantsData` or
 * `useTenantsActions` when you only need one slice to avoid re-renders.
 */
export function useTenants(): TenantsContextValue {
  const data = useTenantsData();
  const actions = useTenantsActions();
  return { ...data, ...actions };
}
