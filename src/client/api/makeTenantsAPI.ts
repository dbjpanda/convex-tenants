/**
 * API factory: build Convex query/mutation handlers from Tenants + auth.
 */
import type { Auth } from "convex/server";
import { mutationGeneric, queryGeneric, paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../../component/_generated/component.js";
import type { AuthzClient } from "../authz.js";
import type { TenantsPermissionMap } from "../authz.js";
import { Tenants } from "./tenants-class.js";
import type { Member, OrgRole, InvitationRole, QueryCtx } from "./types.js";
import { normalizeEmail } from "./types.js";

/**
 * Create an API for tenants that can be re-exported from your app.
 *
 * Requires an `Authz` instance (from `@djpanda/convex-authz`).
 *
 * Use the exported `TENANTS_PERMISSIONS` and `TENANTS_ROLES` as defaults
 * and extend them by passing extra objects to `definePermissions` /
 * `defineRoles` from `@djpanda/convex-authz`.
 *
 * Permission strings are configurable via the `permissionMap` option
 * (defaults to {@link DEFAULT_TENANTS_PERMISSION_MAP}).
 *
 * @example
 * ```ts
 * // convex/authz.ts — use exported defaults + app-specific extensions
 * import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
 * import { TENANTS_PERMISSIONS, TENANTS_ROLES } from "@djpanda/convex-tenants";
 * import { components } from "./_generated/api";
 *
 * const permissions = definePermissions(TENANTS_PERMISSIONS, {
 *   billing: { manage: true, view: true },
 * });
 *
 * const roles = defineRoles(permissions, TENANTS_ROLES, {
 *   owner: { billing: ["manage", "view"] },
 *   billing_admin: { organizations: ["read"], billing: ["manage", "view"] },
 * });
 *
 * export const authz = new Authz(components.authz, { permissions, roles });
 * ```
 *
 * ```ts
 * // convex/tenants.ts — wire everything together
 * import { makeTenantsAPI } from "@djpanda/convex-tenants";
 * import { components } from "./_generated/api";
 * import { getAuthUserId } from "@convex-dev/auth/server";
 * import { authz } from "./authz";
 *
 * export const {
 *   createOrganization, updateOrganization, deleteOrganization,
 *   addMember, removeMember, updateMemberRole,
 *   // ... other exports
 *   checkPermission, getUserPermissions, getUserRoles,
 * } = makeTenantsAPI(components.tenants, {
 *   authz,
 *   creatorRole: "owner",
 *   auth: async (ctx) => await getAuthUserId(ctx),
 * });
 * ```
 */
export function makeTenantsAPI(
  component: ComponentApi,
  options: {
    auth: (ctx: { auth: Auth }) => Promise<string | null>;
    authz: AuthzClient;
    creatorRole?: string;
    permissionMap?: Partial<TenantsPermissionMap>;
    getUser?: (
      ctx: { db: any },
      userId: string
    ) => Promise<{ name?: string; email?: string } | null>;

    onOrganizationCreated?: (
      ctx: any,
      data: { organizationId: string; name: string; slug: string; ownerId: string }
    ) => Promise<void>;

    onOrganizationDeleted?: (
      ctx: any,
      data: { organizationId: string; name: string; deletedBy: string }
    ) => Promise<void>;

    onMemberAdded?: (
      ctx: any,
      data: { organizationId: string; userId: string; role: OrgRole; addedBy: string }
    ) => Promise<void>;

    onMemberRemoved?: (
      ctx: any,
      data: { organizationId: string; userId: string; removedBy: string }
    ) => Promise<void>;

    onMemberRoleChanged?: (
      ctx: any,
      data: { organizationId: string; userId: string; oldRole: OrgRole; newRole: OrgRole; changedBy: string }
    ) => Promise<void>;

    onMemberLeft?: (
      ctx: any,
      data: { organizationId: string; userId: string }
    ) => Promise<void>;

    onTeamCreated?: (
      ctx: any,
      data: { teamId: string; name: string; organizationId: string; createdBy: string }
    ) => Promise<void>;

    onTeamDeleted?: (
      ctx: any,
      data: { teamId: string; name: string; organizationId: string; deletedBy: string }
    ) => Promise<void>;

    onTeamMemberAdded?: (
      ctx: any,
      data: { teamId: string; userId: string; addedBy: string }
    ) => Promise<void>;

    onTeamMemberRemoved?: (
      ctx: any,
      data: { teamId: string; userId: string; removedBy: string }
    ) => Promise<void>;

    onInvitationCreated?: (
      ctx: any,
      invitation: { invitationId: string; email: string; organizationId: string; organizationName: string; role: InvitationRole; inviterName?: string; expiresAt: number }
    ) => Promise<void>;

    onInvitationResent?: (
      ctx: any,
      invitation: { invitationId: string; email: string; organizationId: string; organizationName: string; role: InvitationRole; inviterName?: string; expiresAt: number }
    ) => Promise<void>;

    onInvitationAccepted?: (
      ctx: any,
      data: { invitationId: string; organizationId: string; organizationName: string; userId: string; role: InvitationRole; email: string }
    ) => Promise<void>;

    defaultInvitationExpiration?: number;

    /** Max organizations per user (enforced in createOrganization). Omit for no limit. */
    maxOrganizations?: number;
    /** Max members per organization (enforced in addMember). Omit for no limit. */
    maxMembers?: number;
    /** Max teams per organization (enforced in createTeam). Omit for no limit. */
    maxTeams?: number;
  }
) {
  const tenants = new Tenants(component, {
    authz: options.authz,
    creatorRole: options.creatorRole,
    defaultInvitationExpiration: options.defaultInvitationExpiration,
    permissionMap: options.permissionMap,
  });

  async function requireAuth(ctx: { auth: Auth }): Promise<string> {
    const userId = await options.auth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return userId;
  }

  async function requireMembership(
    ctx: QueryCtx,
    userId: string,
    organizationId: string
  ): Promise<Member> {
    const member = await tenants.getMember(ctx, organizationId, userId);
    if (!member) {
      throw new Error("Not a member of this organization");
    }
    return member;
  }

  async function requireActiveMembership(
    ctx: QueryCtx,
    userId: string,
    organizationId: string
  ): Promise<Member> {
    const member = await requireMembership(ctx, userId, organizationId);
    if ((member.status ?? "active") === "suspended") {
      throw new Error("Your membership is suspended. You cannot perform this action.");
    }
    return member;
  }

  async function requireActiveOrganization(
    ctx: QueryCtx,
    organizationId: string
  ): Promise<void> {
    const org = await tenants.getOrganization(ctx, organizationId);
    if (!org) return;
    const status = (org as { status?: "active" | "suspended" | "archived" }).status ?? "active";
    if (status === "suspended") {
      throw new Error("Organization is suspended");
    }
    if (status === "archived") {
      throw new Error("Organization is archived");
    }
  }

  return {
    listOrganizations: queryGeneric({
      args: {
        status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const orgs = await tenants.listOrganizations(ctx, userId);
        if (args.status !== undefined) {
          return orgs.filter((o) => (o as { status?: string }).status === args.status);
        }
        return orgs;
      },
    }),

    getOrganization: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.getOrganization(ctx, args.organizationId);
      },
    }),

    getOrganizationBySlug: queryGeneric({
      args: { slug: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const org = await tenants.getOrganizationBySlug(ctx, args.slug);
        if (org) {
          await requireMembership(ctx, userId, org._id);
        }
        return org;
      },
    }),

    createOrganization: mutationGeneric({
      args: {
        name: v.string(),
        slug: v.optional(v.string()),
        logo: v.optional(v.string()),
        metadata: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        if (typeof options.maxOrganizations === "number") {
          const orgs = await tenants.listOrganizations(ctx, userId);
          if (orgs.length >= options.maxOrganizations) {
            throw new Error(
              `Maximum number of organizations (${options.maxOrganizations}) reached.`
            );
          }
        }
        const organizationId = await tenants.createOrganization(
          ctx, userId, args.name,
          { slug: args.slug, logo: args.logo, metadata: args.metadata }
        );

        if (options.onOrganizationCreated) {
          const org = await tenants.getOrganization(ctx, organizationId);
          await options.onOrganizationCreated(ctx, {
            organizationId,
            name: org?.name ?? args.name,
            slug: org?.slug ?? args.slug ?? "",
            ownerId: userId,
          });
        }

        return organizationId;
      },
    }),

    updateOrganization: mutationGeneric({
      args: {
        organizationId: v.string(),
        name: v.optional(v.string()),
        slug: v.optional(v.string()),
        logo: v.optional(v.union(v.null(), v.string())),
        metadata: v.optional(v.any()),
        status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        if (args.status !== "active") {
          await requireActiveOrganization(ctx, args.organizationId);
        }
        await tenants.updateOrganization(ctx, userId, args.organizationId, {
          name: args.name, slug: args.slug, logo: args.logo, metadata: args.metadata, status: args.status,
        });
      },
    }),

    transferOwnership: mutationGeneric({
      args: {
        organizationId: v.string(),
        newOwnerUserId: v.string(),
        previousOwnerRole: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        await tenants.transferOwnership(ctx, userId, args.organizationId, args.newOwnerUserId, {
          previousOwnerRole: args.previousOwnerRole,
        });
      },
    }),

    deleteOrganization: mutationGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);

        let orgName = "Unknown";
        if (options.onOrganizationDeleted) {
          const org = await tenants.getOrganization(ctx, args.organizationId);
          orgName = org?.name ?? "Unknown";
        }

        await tenants.deleteOrganization(ctx, userId, args.organizationId);

        if (options.onOrganizationDeleted) {
          await options.onOrganizationDeleted(ctx, {
            organizationId: args.organizationId, name: orgName, deletedBy: userId,
          });
        }
      },
    }),

    listMembers: queryGeneric({
      args: {
        organizationId: v.string(),
        status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("all"))),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);

        const members = await tenants.listMembers(ctx, args.organizationId, {
          status: args.status,
        });
        if (options.getUser) {
          return await Promise.all(
            members.map(async (member) => ({
              ...member, user: await options.getUser!(ctx, member.userId),
            }))
          );
        }
        return members;
      },
    }),

    listMembersPaginated: queryGeneric({
      args: {
        organizationId: v.string(),
        paginationOpts: paginationOptsValidator,
        status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("all"))),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);

        const result = await tenants.listMembersPaginated(
          ctx,
          args.organizationId,
          args.paginationOpts,
          { status: args.status }
        );
        if (options.getUser && result.page.length > 0) {
          const page = await Promise.all(
            result.page.map(async (member) => ({
              ...member,
              user: await options.getUser!(ctx, member.userId),
            }))
          );
          return { ...result, page };
        }
        return result;
      },
    }),

    countMembers: queryGeneric({
      args: {
        organizationId: v.string(),
        status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("all"))),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.countMembers(ctx, args.organizationId, { status: args.status });
      },
    }),

    getMember: queryGeneric({
      args: { organizationId: v.string(), userId: v.string() },
      handler: async (ctx, args) => {
        const callerId = await requireAuth(ctx);
        await requireMembership(ctx, callerId, args.organizationId);

        const member = await tenants.getMember(ctx, args.organizationId, args.userId);
        if (member && options.getUser) {
          return { ...member, user: await options.getUser(ctx, member.userId) };
        }
        return member;
      },
    }),

    getCurrentMember: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.getMember(ctx, args.organizationId, userId);
      },
    }),

    addMember: mutationGeneric({
      args: { organizationId: v.string(), memberUserId: v.string(), role: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        if (typeof options.maxMembers === "number") {
          const count = await tenants.countMembers(ctx, args.organizationId, { status: "all" });
          if (count >= options.maxMembers) {
            throw new Error(
              `Maximum number of members (${options.maxMembers}) for this organization reached.`
            );
          }
        }
        await tenants.addMember(ctx, userId, args.organizationId, args.memberUserId, args.role);
        if (options.onMemberAdded) {
          await options.onMemberAdded(ctx, {
            organizationId: args.organizationId, userId: args.memberUserId, role: args.role, addedBy: userId,
          });
        }
      },
    }),

    removeMember: mutationGeneric({
      args: { organizationId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        await tenants.removeMember(ctx, userId, args.organizationId, args.memberUserId);
        if (options.onMemberRemoved) {
          await options.onMemberRemoved(ctx, {
            organizationId: args.organizationId, userId: args.memberUserId, removedBy: userId,
          });
        }
      },
    }),

    updateMemberRole: mutationGeneric({
      args: { organizationId: v.string(), memberUserId: v.string(), role: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        let oldRole: OrgRole | null = null;
        if (options.onMemberRoleChanged) {
          const member = await tenants.getMember(ctx, args.organizationId, args.memberUserId);
          oldRole = member?.role ?? null;
        }
        await tenants.updateMemberRole(ctx, userId, args.organizationId, args.memberUserId, args.role);
        if (options.onMemberRoleChanged && oldRole) {
          await options.onMemberRoleChanged(ctx, {
            organizationId: args.organizationId, userId: args.memberUserId,
            oldRole, newRole: args.role, changedBy: userId,
          });
        }
      },
    }),

    leaveOrganization: mutationGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        await tenants.leaveOrganization(ctx, userId, args.organizationId);
        if (options.onMemberLeft) {
          await options.onMemberLeft(ctx, { organizationId: args.organizationId, userId });
        }
      },
    }),

    suspendMember: mutationGeneric({
      args: { organizationId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        await tenants.suspendMember(ctx, userId, args.organizationId, args.memberUserId);
      },
    }),

    unsuspendMember: mutationGeneric({
      args: { organizationId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        await tenants.unsuspendMember(ctx, userId, args.organizationId, args.memberUserId);
      },
    }),

    listTeams: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.listTeams(ctx, args.organizationId);
      },
    }),

    listTeamsPaginated: queryGeneric({
      args: {
        organizationId: v.string(),
        paginationOpts: paginationOptsValidator,
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.listTeamsPaginated(
          ctx,
          args.organizationId,
          args.paginationOpts
        );
      },
    }),

    countTeams: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.countTeams(ctx, args.organizationId);
      },
    }),

    getTeam: queryGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const team = await tenants.getTeam(ctx, args.teamId);
        if (team) {
          await requireMembership(ctx, userId, team.organizationId);
        }
        return team;
      },
    }),

    listTeamMembers: queryGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const team = await tenants.getTeam(ctx, args.teamId);
        if (team) {
          await requireMembership(ctx, userId, team.organizationId);
        }

        const members = await tenants.listTeamMembers(ctx, args.teamId);
        if (options.getUser) {
          return await Promise.all(
            members.map(async (member) => ({
              ...member, user: await options.getUser!(ctx, member.userId),
            }))
          );
        }
        return members;
      },
    }),

    listTeamMembersPaginated: queryGeneric({
      args: {
        teamId: v.string(),
        paginationOpts: paginationOptsValidator,
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const team = await tenants.getTeam(ctx, args.teamId);
        if (team) {
          await requireMembership(ctx, userId, team.organizationId);
        }
        const result = await tenants.listTeamMembersPaginated(
          ctx,
          args.teamId,
          args.paginationOpts
        );
        if (options.getUser && result.page.length > 0) {
          const page = await Promise.all(
            result.page.map(async (member) => ({
              ...member,
              user: await options.getUser!(ctx, member.userId),
            }))
          );
          return { ...result, page };
        }
        return result;
      },
    }),

    isTeamMember: queryGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.isTeamMember(ctx, args.teamId, userId);
      },
    }),

    createTeam: mutationGeneric({
      args: {
        organizationId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        slug: v.optional(v.string()),
        metadata: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        if (typeof options.maxTeams === "number") {
          const count = await tenants.countTeams(ctx, args.organizationId);
          if (count >= options.maxTeams) {
            throw new Error(
              `Maximum number of teams (${options.maxTeams}) for this organization reached.`
            );
          }
        }
        const teamId = await tenants.createTeam(ctx, userId, args.organizationId, args.name, args.description, {
          slug: args.slug,
          metadata: args.metadata,
        });
        if (options.onTeamCreated) {
          await options.onTeamCreated(ctx, {
            teamId, name: args.name, organizationId: args.organizationId, createdBy: userId,
          });
        }
        return teamId;
      },
    }),

    updateTeam: mutationGeneric({
      args: {
        teamId: v.string(),
        name: v.optional(v.string()),
        slug: v.optional(v.string()),
        description: v.optional(v.union(v.null(), v.string())),
        metadata: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const team = await tenants.getTeam(ctx, args.teamId);
        if (team) {
          await requireActiveMembership(ctx, userId, team.organizationId);
          await requireActiveOrganization(ctx, team.organizationId);
        }
        await tenants.updateTeam(ctx, userId, args.teamId, {
          name: args.name,
          slug: args.slug,
          description: args.description,
          metadata: args.metadata,
        });
      },
    }),

    deleteTeam: mutationGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const teamForOrg = await tenants.getTeam(ctx, args.teamId);
        if (teamForOrg) {
          await requireActiveMembership(ctx, userId, teamForOrg.organizationId);
          await requireActiveOrganization(ctx, teamForOrg.organizationId);
        }
        let teamName = "Unknown";
        let teamOrgId = "";
        if (options.onTeamDeleted) {
          const team = await tenants.getTeam(ctx, args.teamId);
          teamName = team?.name ?? "Unknown";
          teamOrgId = team?.organizationId ?? "";
        }
        await tenants.deleteTeam(ctx, userId, args.teamId);
        if (options.onTeamDeleted) {
          await options.onTeamDeleted(ctx, {
            teamId: args.teamId, name: teamName, organizationId: teamOrgId, deletedBy: userId,
          });
        }
      },
    }),

    addTeamMember: mutationGeneric({
      args: { teamId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const team = await tenants.getTeam(ctx, args.teamId);
        if (team) {
          await requireActiveMembership(ctx, userId, team.organizationId);
          await requireActiveOrganization(ctx, team.organizationId);
        }
        await tenants.addTeamMember(ctx, userId, args.teamId, args.memberUserId);
        if (options.onTeamMemberAdded) {
          await options.onTeamMemberAdded(ctx, { teamId: args.teamId, userId: args.memberUserId, addedBy: userId });
        }
      },
    }),

    removeTeamMember: mutationGeneric({
      args: { teamId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const team = await tenants.getTeam(ctx, args.teamId);
        if (team) {
          await requireActiveMembership(ctx, userId, team.organizationId);
          await requireActiveOrganization(ctx, team.organizationId);
        }
        await tenants.removeTeamMember(ctx, userId, args.teamId, args.memberUserId);
        if (options.onTeamMemberRemoved) {
          await options.onTeamMemberRemoved(ctx, { teamId: args.teamId, userId: args.memberUserId, removedBy: userId });
        }
      },
    }),

    listInvitations: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.listInvitations(ctx, args.organizationId);
      },
    }),

    listInvitationsPaginated: queryGeneric({
      args: {
        organizationId: v.string(),
        paginationOpts: paginationOptsValidator,
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.listInvitationsPaginated(
          ctx,
          args.organizationId,
          args.paginationOpts
        );
      },
    }),

    countInvitations: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.countInvitations(ctx, args.organizationId);
      },
    }),

    getInvitation: queryGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        return await tenants.getInvitation(ctx, args.invitationId);
      },
    }),

    getPendingInvitations: queryGeneric({
      args: { email: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        if (!options.getUser) {
          throw new Error(
            "getUser callback with email is required for getPendingInvitations"
          );
        }

        const user = await options.getUser(ctx, userId);
        const userEmail = user?.email;
        if (!userEmail) {
          throw new Error(
            "Authenticated user email is required for getPendingInvitations"
          );
        }

        if (normalizeEmail(args.email) !== normalizeEmail(userEmail)) {
          throw new Error("Cannot query invitations for another email");
        }

        return await tenants.getPendingInvitations(ctx, normalizeEmail(userEmail));
      },
    }),

    inviteMember: mutationGeneric({
      args: {
        organizationId: v.string(),
        email: v.string(),
        role: v.string(),
        teamId: v.optional(v.string()),
        message: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        let inviterName: string | undefined;
        if (options.getUser) {
          const user = await options.getUser(ctx, userId);
          inviterName = user?.name;
        }
        const result = await tenants.inviteMember(ctx, userId, args.organizationId, args.email, args.role, {
          teamId: args.teamId,
          message: args.message,
          inviterName,
        });
        if (options.onInvitationCreated) {
          const org = await tenants.getOrganization(ctx, args.organizationId);
          await options.onInvitationCreated(ctx, {
            invitationId: result.invitationId, email: result.email,
            organizationId: args.organizationId, organizationName: org?.name ?? "Unknown",
            role: args.role, inviterName, expiresAt: result.expiresAt,
          });
        }
        return result;
      },
    }),

    acceptInvitation: mutationGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const inv = await tenants.getInvitation(ctx, args.invitationId);
        if (inv) await requireActiveOrganization(ctx, inv.organizationId);
        if (!options.getUser) {
          throw new Error(
            "getUser callback with email is required for invitation acceptance"
          );
        }

        const user = await options.getUser(ctx, userId);
        const acceptingEmail = user?.email;
        if (!acceptingEmail) {
          throw new Error(
            "Authenticated user email is required for invitation acceptance"
          );
        }

        let invitationData: { organizationId: string; role: InvitationRole; email: string } | null = null;
        if (options.onInvitationAccepted) {
          const inv = await tenants.getInvitation(ctx, args.invitationId);
          if (inv) {
            invitationData = { organizationId: inv.organizationId, role: inv.role, email: inv.email };
          }
        }
        await tenants.acceptInvitation(ctx, args.invitationId, userId, {
          acceptingEmail,
        });
        if (options.onInvitationAccepted && invitationData) {
          const org = await tenants.getOrganization(ctx, invitationData.organizationId);
          await options.onInvitationAccepted(ctx, {
            invitationId: args.invitationId, organizationId: invitationData.organizationId,
            organizationName: org?.name ?? "Unknown", userId, role: invitationData.role, email: invitationData.email,
          });
        }
      },
    }),

    resendInvitation: mutationGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const invitation = await tenants.getInvitation(ctx, args.invitationId);
        if (invitation) {
          await requireActiveMembership(ctx, userId, invitation.organizationId);
          await requireActiveOrganization(ctx, invitation.organizationId);
        }
        const result = await tenants.resendInvitation(ctx, userId, args.invitationId);
        if (options.onInvitationResent) {
          const invForCallback = await tenants.getInvitation(ctx, args.invitationId);
          if (invForCallback) {
            const org = await tenants.getOrganization(ctx, invForCallback.organizationId);
            let inviterName: string | undefined;
            if (options.getUser) {
              const user = await options.getUser(ctx, invForCallback.inviterId);
              inviterName = user?.name;
            }
            await options.onInvitationResent(ctx, {
              invitationId: result.invitationId, email: result.email,
              organizationId: invForCallback.organizationId, organizationName: org?.name ?? "Unknown",
              role: invForCallback.role, inviterName, expiresAt: invForCallback.expiresAt,
            });
          }
        }
        return result;
      },
    }),

    cancelInvitation: mutationGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const inv = await tenants.getInvitation(ctx, args.invitationId);
        if (inv) {
          await requireActiveMembership(ctx, userId, inv.organizationId);
          await requireActiveOrganization(ctx, inv.organizationId);
        }
        await tenants.cancelInvitation(ctx, userId, args.invitationId);
      },
    }),

    checkPermission: queryGeneric({
      args: { organizationId: v.string(), permission: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const allowed = await tenants.can(ctx, userId, args.permission, args.organizationId);
        return { allowed, reason: allowed ? "Allowed" : "Permission denied" };
      },
    }),

    getUserPermissions: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.getUserPermissions(ctx, userId, args.organizationId);
      },
    }),

    getUserRoles: queryGeneric({
      args: { organizationId: v.optional(v.string()) },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.getUserRoles(ctx, userId, args.organizationId);
      },
    }),

    grantPermission: mutationGeneric({
      args: {
        organizationId: v.string(),
        targetUserId: v.string(),
        permission: v.string(),
        scope: v.optional(v.object({ type: v.string(), id: v.string() })),
        reason: v.optional(v.string()),
        expiresAt: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        return await tenants.grantPermission(
          ctx, userId, args.organizationId, args.targetUserId, args.permission,
          { scope: args.scope, reason: args.reason, expiresAt: args.expiresAt }
        );
      },
    }),

    denyPermission: mutationGeneric({
      args: {
        organizationId: v.string(),
        targetUserId: v.string(),
        permission: v.string(),
        scope: v.optional(v.object({ type: v.string(), id: v.string() })),
        reason: v.optional(v.string()),
        expiresAt: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireActiveMembership(ctx, userId, args.organizationId);
        await requireActiveOrganization(ctx, args.organizationId);
        return await tenants.denyPermission(
          ctx, userId, args.organizationId, args.targetUserId, args.permission,
          { scope: args.scope, reason: args.reason, expiresAt: args.expiresAt }
        );
      },
    }),

    getAuditLog: queryGeneric({
      args: {
        organizationId: v.string(),
        userId: v.optional(v.string()),
        action: v.optional(v.string()),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.getAuditLog(
          ctx,
          userId,
          args.organizationId,
          { userId: args.userId, action: args.action, limit: args.limit }
        );
      },
    }),
  };
}
