import type {
  Auth,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

// Re-export ComponentApi for consumers
export type { ComponentApi };

/**
 * Role types for organization members
 */
export type OrgRole = "owner" | "admin" | "member";

/**
 * Role types for invitations
 */
export type InvitationRole = "admin" | "member";

/**
 * Organization object type
 */
export interface Organization {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  logo: string | null;
  metadata?: any;
  ownerId: string;
}

/**
 * Organization with role info
 */
export interface OrganizationWithRole extends Organization {
  role: OrgRole;
}

/**
 * Member object type
 */
export interface Member {
  _id: string;
  _creationTime: number;
  organizationId: string;
  userId: string;
  role: OrgRole;
}

/**
 * Member with user info enrichment
 */
export interface MemberWithUser extends Member {
  user?: {
    name?: string;
    email?: string;
  } | null;
}

/**
 * Team object type
 */
export interface Team {
  _id: string;
  _creationTime: number;
  name: string;
  organizationId: string;
  description: string | null;
}

/**
 * Team member object type
 */
export interface TeamMember {
  _id: string;
  _creationTime: number;
  teamId: string;
  userId: string;
}

/**
 * Invitation object type
 */
export interface Invitation {
  _id: string;
  _creationTime: number;
  organizationId: string;
  email: string;
  role: InvitationRole;
  teamId: string | null;
  inviterId: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: number;
  isExpired: boolean;
}

/**
 * Tenants class for direct component interaction
 *
 * Use this class when you want to call the tenants component directly
 * from your Convex functions, handling user authentication yourself.
 *
 * @example
 * ```ts
 * import { components } from "./_generated/api";
 * import { Tenants } from "@djpanda/convex-tenants";
 *
 * const tenants = new Tenants(components.tenants);
 *
 * export const createOrg = mutation({
 *   args: { name: v.string() },
 *   handler: async (ctx, args) => {
 *     const userId = await getAuthUserId(ctx);
 *     return await tenants.createOrganization(ctx, userId, args.name);
 *   },
 * });
 * ```
 */
export class Tenants {
  constructor(
    public component: ComponentApi,
    private options?: {
      defaultInvitationExpiration?: number; // Default: 48 hours
    }
  ) {}

  // ================================
  // Organization Operations
  // ================================

  async listOrganizations(
    ctx: QueryCtx,
    userId: string
  ): Promise<OrganizationWithRole[]> {
    return await ctx.runQuery(this.component.queries.listUserOrganizations, {
      userId,
    });
  }

  async getOrganization(
    ctx: QueryCtx,
    organizationId: string
  ): Promise<Organization | null> {
    return await ctx.runQuery(this.component.queries.getOrganization, {
      organizationId,
    });
  }

  async getOrganizationBySlug(
    ctx: QueryCtx,
    slug: string
  ): Promise<Organization | null> {
    return await ctx.runQuery(this.component.queries.getOrganizationBySlug, {
      slug,
    });
  }

  async createOrganization(
    ctx: MutationCtx,
    userId: string,
    name: string,
    options?: {
      slug?: string;
      logo?: string;
      metadata?: any;
    }
  ): Promise<string> {
    const slug = options?.slug ?? this.generateSlug(name);
    return await ctx.runMutation(this.component.mutations.createOrganization, {
      userId,
      name,
      slug,
      logo: options?.logo,
      metadata: options?.metadata,
    });
  }

  async updateOrganization(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    updates: {
      name?: string;
      slug?: string;
      logo?: string | null;
      metadata?: any;
    }
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.updateOrganization, {
      userId,
      organizationId,
      ...updates,
    });
  }

  async deleteOrganization(
    ctx: MutationCtx,
    userId: string,
    organizationId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.deleteOrganization, {
      userId,
      organizationId,
    });
  }

  // ================================
  // Member Operations
  // ================================

  async listMembers(ctx: QueryCtx, organizationId: string): Promise<Member[]> {
    return await ctx.runQuery(
      this.component.queries.listOrganizationMembers,
      { organizationId }
    );
  }

  async getMember(
    ctx: QueryCtx,
    organizationId: string,
    userId: string
  ): Promise<Member | null> {
    return await ctx.runQuery(this.component.queries.getMember, {
      organizationId,
      userId,
    });
  }

  async addMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string,
    role: "admin" | "member"
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.addMember, {
      userId,
      organizationId,
      memberUserId,
      role,
    });
  }

  async removeMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.removeMember, {
      userId,
      organizationId,
      memberUserId,
    });
  }

  async updateMemberRole(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string,
    role: OrgRole
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.updateMemberRole, {
      userId,
      organizationId,
      memberUserId,
      role,
    });
  }

  async leaveOrganization(
    ctx: MutationCtx,
    userId: string,
    organizationId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.leaveOrganization, {
      userId,
      organizationId,
    });
  }

  async checkPermission(
    ctx: QueryCtx,
    organizationId: string,
    userId: string,
    minRole: "member" | "admin" | "owner"
  ): Promise<{ hasPermission: boolean; currentRole: OrgRole | null }> {
    return await ctx.runQuery(this.component.queries.checkMemberPermission, {
      organizationId,
      userId,
      minRole,
    });
  }

  // ================================
  // Team Operations
  // ================================

  async listTeams(ctx: QueryCtx, organizationId: string): Promise<Team[]> {
    return await ctx.runQuery(this.component.queries.listTeams, {
      organizationId,
    });
  }

  async getTeam(ctx: QueryCtx, teamId: string): Promise<Team | null> {
    return await ctx.runQuery(this.component.queries.getTeam, { teamId });
  }

  async createTeam(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    name: string,
    description?: string
  ): Promise<string> {
    return await ctx.runMutation(this.component.mutations.createTeam, {
      userId,
      organizationId,
      name,
      description,
    });
  }

  async updateTeam(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    updates: {
      name?: string;
      description?: string | null;
    }
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.updateTeam, {
      userId,
      teamId,
      ...updates,
    });
  }

  async deleteTeam(
    ctx: MutationCtx,
    userId: string,
    teamId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.deleteTeam, {
      userId,
      teamId,
    });
  }

  async listTeamMembers(
    ctx: QueryCtx,
    teamId: string
  ): Promise<TeamMember[]> {
    return await ctx.runQuery(this.component.queries.listTeamMembers, {
      teamId,
    });
  }

  async addTeamMember(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    memberUserId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.addTeamMember, {
      userId,
      teamId,
      memberUserId,
    });
  }

  async removeTeamMember(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    memberUserId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.removeTeamMember, {
      userId,
      teamId,
      memberUserId,
    });
  }

  async isTeamMember(
    ctx: QueryCtx,
    teamId: string,
    userId: string
  ): Promise<boolean> {
    return await ctx.runQuery(this.component.queries.isTeamMember, {
      teamId,
      userId,
    });
  }

  // ================================
  // Invitation Operations
  // ================================

  async listInvitations(
    ctx: QueryCtx,
    organizationId: string
  ): Promise<Invitation[]> {
    return await ctx.runQuery(this.component.queries.listInvitations, {
      organizationId,
    });
  }

  async getInvitation(
    ctx: QueryCtx,
    invitationId: string
  ): Promise<Invitation | null> {
    return await ctx.runQuery(this.component.queries.getInvitation, {
      invitationId,
    });
  }

  async getPendingInvitations(
    ctx: QueryCtx,
    email: string
  ): Promise<Array<Omit<Invitation, "status">>> {
    return await ctx.runQuery(
      this.component.queries.getPendingInvitationsForEmail,
      { email }
    );
  }

  async inviteMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    email: string,
    role: InvitationRole,
    options?: {
      teamId?: string;
      expiresAt?: number;
    }
  ): Promise<{ invitationId: string; email: string; expiresAt: number }> {
    const expiresAt =
      options?.expiresAt ??
      Date.now() + (this.options?.defaultInvitationExpiration ?? 48 * 60 * 60 * 1000);

    return await ctx.runMutation(this.component.mutations.inviteMember, {
      userId,
      organizationId,
      email,
      role,
      teamId: options?.teamId,
      expiresAt,
    });
  }

  async acceptInvitation(
    ctx: MutationCtx,
    invitationId: string,
    acceptingUserId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.acceptInvitation, {
      invitationId,
      acceptingUserId,
    });
  }

  async resendInvitation(
    ctx: MutationCtx,
    userId: string,
    invitationId: string
  ): Promise<{ invitationId: string; email: string }> {
    return await ctx.runMutation(this.component.mutations.resendInvitation, {
      userId,
      invitationId,
    });
  }

  async cancelInvitation(
    ctx: MutationCtx,
    userId: string,
    invitationId: string
  ): Promise<void> {
    await ctx.runMutation(this.component.mutations.cancelInvitation, {
      userId,
      invitationId,
    });
  }

  // ================================
  // Utility Methods
  // ================================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}

// ================================
// Context Types
// ================================

type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;

// ================================
// API Factory
// ================================

/**
 * Create an API for tenants that can be re-exported from your app.
 *
 * This function creates query and mutation functions that can be
 * exported directly from your Convex files, handling authentication
 * and providing callbacks for invitation emails.
 *
 * @example
 * ```ts
 * // convex/tenants.ts
 * import { components } from "./_generated/api";
 * import { makeTenantsAPI } from "@djpanda/convex-tenants";
 * import { getAuthUserId } from "@convex-dev/auth/server";
 *
 * export const {
 *   listOrganizations,
 *   createOrganization,
 *   inviteMember,
 *   // ... etc
 * } = makeTenantsAPI(components.tenants, {
 *   auth: async (ctx) => await getAuthUserId(ctx),
 *   getUser: async (ctx, userId) => {
 *     const user = await ctx.db.get(userId as Id<"users">);
 *     return user ? { name: user.name, email: user.email } : null;
 *   },
 *   onInvitationCreated: async (ctx, invitation) => {
 *     // Send invitation email
 *     await sendEmail(invitation.email, {
 *       type: "invitation",
 *       organizationName: invitation.organizationName,
 *     });
 *   },
 * });
 * ```
 */
export function makeTenantsAPI(
  component: ComponentApi,
  options: {
    /**
     * Authentication function that returns the current user's ID.
     * Should throw or return null if user is not authenticated.
     */
    auth: (ctx: { auth: Auth }) => Promise<string | null>;

    /**
     * Optional function to get user details for member enrichment.
     */
    getUser?: (
      ctx: { db: any },
      userId: string
    ) => Promise<{ name?: string; email?: string } | null>;

    /**
     * Callback when an invitation is created (for sending emails).
     */
    onInvitationCreated?: (
      ctx: any,
      invitation: {
        invitationId: string;
        email: string;
        organizationId: string;
        organizationName: string;
        role: InvitationRole;
        inviterName?: string;
        expiresAt: number;
      }
    ) => Promise<void>;

    /**
     * Callback when an invitation is resent.
     */
    onInvitationResent?: (
      ctx: any,
      invitation: {
        invitationId: string;
        email: string;
        organizationId: string;
        organizationName: string;
        role: InvitationRole;
        inviterName?: string;
        expiresAt: number;
      }
    ) => Promise<void>;

    /**
     * Default invitation expiration in milliseconds. Default: 48 hours.
     */
    defaultInvitationExpiration?: number;
  }
) {
  const tenants = new Tenants(component, {
    defaultInvitationExpiration: options.defaultInvitationExpiration,
  });

  async function requireAuth(ctx: { auth: Auth }): Promise<string> {
    const userId = await options.auth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return userId;
  }

  return {
    // ================================
    // Organization Queries
    // ================================
    listOrganizations: queryGeneric({
      args: {},
      handler: async (ctx) => {
        const userId = await options.auth(ctx);
        if (!userId) return [];
        return await tenants.listOrganizations(ctx, userId);
      },
    }),

    getOrganization: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        return await tenants.getOrganization(ctx, args.organizationId);
      },
    }),

    getOrganizationBySlug: queryGeneric({
      args: { slug: v.string() },
      handler: async (ctx, args) => {
        return await tenants.getOrganizationBySlug(ctx, args.slug);
      },
    }),

    // ================================
    // Organization Mutations
    // ================================
    createOrganization: mutationGeneric({
      args: {
        name: v.string(),
        slug: v.optional(v.string()),
        logo: v.optional(v.string()),
        metadata: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.createOrganization(ctx, userId, args.name, {
          slug: args.slug,
          logo: args.logo,
          metadata: args.metadata,
        });
      },
    }),

    updateOrganization: mutationGeneric({
      args: {
        organizationId: v.string(),
        name: v.optional(v.string()),
        slug: v.optional(v.string()),
        logo: v.optional(v.union(v.null(), v.string())),
        metadata: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.updateOrganization(ctx, userId, args.organizationId, {
          name: args.name,
          slug: args.slug,
          logo: args.logo,
          metadata: args.metadata,
        });
      },
    }),

    deleteOrganization: mutationGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.deleteOrganization(ctx, userId, args.organizationId);
      },
    }),

    // ================================
    // Member Queries
    // ================================
    listMembers: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const members = await tenants.listMembers(ctx, args.organizationId);

        if (options.getUser) {
          return await Promise.all(
            members.map(async (member) => ({
              ...member,
              user: await options.getUser!(ctx, member.userId),
            }))
          );
        }

        return members;
      },
    }),

    getMember: queryGeneric({
      args: { organizationId: v.string(), userId: v.string() },
      handler: async (ctx, args) => {
        const member = await tenants.getMember(
          ctx,
          args.organizationId,
          args.userId
        );

        if (member && options.getUser) {
          return {
            ...member,
            user: await options.getUser(ctx, member.userId),
          };
        }

        return member;
      },
    }),

    getCurrentMember: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx);
        if (!userId) return null;
        return await tenants.getMember(ctx, args.organizationId, userId);
      },
    }),

    checkPermission: queryGeneric({
      args: {
        organizationId: v.string(),
        minRole: v.union(
          v.literal("member"),
          v.literal("admin"),
          v.literal("owner")
        ),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx);
        if (!userId) return { hasPermission: false, currentRole: null };
        return await tenants.checkPermission(
          ctx,
          args.organizationId,
          userId,
          args.minRole
        );
      },
    }),

    // ================================
    // Member Mutations
    // ================================
    addMember: mutationGeneric({
      args: {
        organizationId: v.string(),
        memberUserId: v.string(),
        role: v.union(v.literal("admin"), v.literal("member")),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.addMember(
          ctx,
          userId,
          args.organizationId,
          args.memberUserId,
          args.role
        );
      },
    }),

    removeMember: mutationGeneric({
      args: { organizationId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.removeMember(
          ctx,
          userId,
          args.organizationId,
          args.memberUserId
        );
      },
    }),

    updateMemberRole: mutationGeneric({
      args: {
        organizationId: v.string(),
        memberUserId: v.string(),
        role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.updateMemberRole(
          ctx,
          userId,
          args.organizationId,
          args.memberUserId,
          args.role
        );
      },
    }),

    leaveOrganization: mutationGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.leaveOrganization(ctx, userId, args.organizationId);
      },
    }),

    // ================================
    // Team Queries
    // ================================
    listTeams: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        return await tenants.listTeams(ctx, args.organizationId);
      },
    }),

    getTeam: queryGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        return await tenants.getTeam(ctx, args.teamId);
      },
    }),

    listTeamMembers: queryGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const members = await tenants.listTeamMembers(ctx, args.teamId);

        if (options.getUser) {
          return await Promise.all(
            members.map(async (member) => ({
              ...member,
              user: await options.getUser!(ctx, member.userId),
            }))
          );
        }

        return members;
      },
    }),

    isTeamMember: queryGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx);
        if (!userId) return false;
        return await tenants.isTeamMember(ctx, args.teamId, userId);
      },
    }),

    // ================================
    // Team Mutations
    // ================================
    createTeam: mutationGeneric({
      args: {
        organizationId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.createTeam(
          ctx,
          userId,
          args.organizationId,
          args.name,
          args.description
        );
      },
    }),

    updateTeam: mutationGeneric({
      args: {
        teamId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.union(v.null(), v.string())),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.updateTeam(ctx, userId, args.teamId, {
          name: args.name,
          description: args.description,
        });
      },
    }),

    deleteTeam: mutationGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.deleteTeam(ctx, userId, args.teamId);
      },
    }),

    addTeamMember: mutationGeneric({
      args: { teamId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.addTeamMember(ctx, userId, args.teamId, args.memberUserId);
      },
    }),

    removeTeamMember: mutationGeneric({
      args: { teamId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.removeTeamMember(
          ctx,
          userId,
          args.teamId,
          args.memberUserId
        );
      },
    }),

    // ================================
    // Invitation Queries
    // ================================
    listInvitations: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        return await tenants.listInvitations(ctx, args.organizationId);
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
        return await tenants.getPendingInvitations(ctx, args.email);
      },
    }),

    // ================================
    // Invitation Mutations
    // ================================
    inviteMember: mutationGeneric({
      args: {
        organizationId: v.string(),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("member")),
        teamId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);

        const result = await tenants.inviteMember(
          ctx,
          userId,
          args.organizationId,
          args.email,
          args.role,
          { teamId: args.teamId }
        );

        // Trigger callback for sending emails
        if (options.onInvitationCreated) {
          const org = await tenants.getOrganization(ctx, args.organizationId);
          let inviterName: string | undefined;
          if (options.getUser) {
            const user = await options.getUser(ctx, userId);
            inviterName = user?.name;
          }

          await options.onInvitationCreated(ctx, {
            invitationId: result.invitationId,
            email: result.email,
            organizationId: args.organizationId,
            organizationName: org?.name ?? "Unknown",
            role: args.role,
            inviterName,
            expiresAt: result.expiresAt,
          });
        }

        return result;
      },
    }),

    acceptInvitation: mutationGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.acceptInvitation(ctx, args.invitationId, userId);
      },
    }),

    resendInvitation: mutationGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const result = await tenants.resendInvitation(
          ctx,
          userId,
          args.invitationId
        );

        // Trigger callback for resending emails
        if (options.onInvitationResent) {
          const invitation = await tenants.getInvitation(
            ctx,
            args.invitationId
          );
          if (invitation) {
            const org = await tenants.getOrganization(
              ctx,
              invitation.organizationId
            );
            let inviterName: string | undefined;
            if (options.getUser) {
              const user = await options.getUser(ctx, invitation.inviterId);
              inviterName = user?.name;
            }

            await options.onInvitationResent(ctx, {
              invitationId: result.invitationId,
              email: result.email,
              organizationId: invitation.organizationId,
              organizationName: org?.name ?? "Unknown",
              role: invitation.role,
              inviterName,
              expiresAt: invitation.expiresAt,
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
        await tenants.cancelInvitation(ctx, userId, args.invitationId);
      },
    }),
  };
}

/**
 * Helper function to generate a slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
