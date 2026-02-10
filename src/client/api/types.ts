/**
 * Shared types and helpers for the tenants API.
 */
import type { GenericDataModel, GenericMutationCtx, GenericQueryCtx } from "convex/server";

export type OrgRole = string;
export type InvitationRole = string;

export interface Organization {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  logo: string | null;
  metadata?: Record<string, unknown>;
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
  description: string | null;
  metadata?: Record<string, unknown>;
}

export interface TeamMember {
  _id: string;
  _creationTime: number;
  teamId: string;
  userId: string;
}

export interface Invitation {
  _id: string;
  _creationTime: number;
  organizationId: string;
  email: string;
  role: InvitationRole;
  teamId: string | null;
  inviterId: string;
  message?: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: number;
  isExpired: boolean;
}

export function orgScope(organizationId: string): { type: string; id: string } {
  return { type: "organization", id: organizationId };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
export type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
