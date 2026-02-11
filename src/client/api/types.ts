/**
 * Shared types for the tenants API.
 */
import type { GenericDataModel, GenericMutationCtx, GenericQueryCtx } from "convex/server";

export type OrgRole = string;
export type InvitationRole = string;

/** Structured organization settings (typed). Use metadata for custom data. */
export interface OrganizationSettings {
  allowPublicSignup?: boolean;
  requireInvitationToJoin?: boolean;
}

export interface Organization {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  logo: string | null;
  metadata?: Record<string, unknown>;
  settings?: OrganizationSettings;
  allowedDomains?: string[];
  ownerId: string;
  status?: "active" | "suspended" | "archived";
}

export interface OrganizationWithRole extends Organization {
  role: OrgRole;
}

export type MemberStatus = "active" | "suspended";

export interface Member {
  _id: string;
  _creationTime: number;
  organizationId: string;
  userId: string;
  role: OrgRole;
  status?: MemberStatus;
  suspendedAt?: number;
  joinedAt?: number;
}

export interface MemberWithUser extends Member {
  user?: { name?: string; email?: string } | null;
}

export interface Team {
  _id: string;
  _creationTime: number;
  name: string;
  slug?: string;
  organizationId: string;
  parentTeamId?: string;
  description: string | null;
  metadata?: Record<string, unknown>;
}

export interface TeamMember {
  _id: string;
  _creationTime: number;
  teamId: string;
  userId: string;
  role?: string;
}

export interface Invitation {
  _id: string;
  _creationTime: number;
  organizationId: string;
  email: string;
  role: InvitationRole;
  teamId: string | null;
  inviterId: string;
  inviterName?: string;
  message?: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: number;
  isExpired: boolean;
}

export type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
export type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
