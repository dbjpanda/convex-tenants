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
// Context Value Interface
// ============================================================================

export interface TenantsContextValue {
  // Data
  organizations: Organization[];
  currentOrganization: Organization | null;
  members: Member[];
  invitations: Invitation[];
  teams: Team[];

  // Loading states
  isLoading: boolean;
  isOrganizationsLoading: boolean;
  isMembersLoading: boolean;
  isInvitationsLoading: boolean;
  isTeamsLoading: boolean;

  // Current user's role in the active organization
  currentRole: string | null;

  /** Current user's email from tenants API (getCurrentUserEmail). Used by JoinByDomainSection when no prop is passed. */
  currentUserEmail?: string | null | undefined;

  // Organization actions
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

  // Member actions
  removeMember: (memberUserId: string) => Promise<void>;
  updateMemberRole: (
    memberUserId: string,
    role: string
  ) => Promise<void>;

  // Invitation actions
  inviteMember: (data: {
    inviteeIdentifier: string;
    identifierType?: string;
    role: string;
    teamId?: string;
    message?: string;
  }) => Promise<{ invitationId: string; inviteeIdentifier: string; expiresAt: number } | null>;
  resendInvitation: (invitationId: string) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;

  // Team actions
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

  // Toast callback
  onToast?: (message: string, type: "success" | "error") => void;

  /**
   * The api object passed to TenantsProvider. Used by extended components
   * (MemberModerationSection, BulkInviteSection, etc.) to call optional APIs.
   */
  api: Record<string, FunctionReference<"query" | "mutation", "public"> | undefined>;
}

// ============================================================================
// Context
// ============================================================================

export const TenantsContext = createContext<TenantsContextValue | null>(null);

/**
 * Hook to access the TenantsContext.
 * Must be used within a TenantsProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { currentOrganization, members, isOwnerOrAdmin } = useTenants();
 *   // ...
 * }
 * ```
 */
export function useTenants(): TenantsContextValue {
  const context = useContext(TenantsContext);
  if (!context) {
    throw new Error(
      "useTenants must be used within a TenantsProvider. " +
        "Wrap your app with <TenantsProvider api={api.yourModule}>...</TenantsProvider>"
    );
  }
  return context;
}
