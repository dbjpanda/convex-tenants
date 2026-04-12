import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts")
  )
);

function createTestInstance() {
  return convexTest(schema, modules);
}

describe("organizations", () => {
  it("should create an organization", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Acme Corp",
      slug: "acme-corp",
    });

    expect(orgId).toBeDefined();
    expect(typeof orgId).toBe("string");
  });

  it("should create organization with logo and metadata", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Acme Corp",
      slug: "acme-corp",
      logo: "https://example.com/logo.png",
      metadata: { tier: "enterprise", industry: "tech" },
    });

    const org = await t.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });

    expect(org).not.toBeNull();
    expect(org?.name).toBe("Acme Corp");
    expect(org?.slug).toBe("acme-corp");
    expect(org?.logo).toBe("https://example.com/logo.png");
    expect(org?.metadata).toEqual({ tier: "enterprise", industry: "tech" });
  });

  it("should auto-assign creator as owner", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_123",
    });

    expect(member).not.toBeNull();
    expect(member?.role).toBe("owner");
  });

  it("should list user organizations with role", async () => {
    const t = createTestInstance();

    await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Org One",
      slug: "org-one",
    });

    await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Org Two",
      slug: "org-two",
    });

    const orgs = await t.query(api.organizations.listUserOrganizations, {
      userId: "user_123",
    });

    expect(orgs).toHaveLength(2);
    expect(orgs.map((o: any) => o.name)).toContain("Org One");
    expect(orgs.map((o: any) => o.name)).toContain("Org Two");
    orgs.forEach((org: any) => {
      expect(org.role).toBe("owner");
    });
  });

  it("should get organization by slug", async () => {
    const t = createTestInstance();

    await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Unique Org",
      slug: "unique-slug-123",
    });

    const org = await t.query(api.organizations.getOrganizationBySlug, {
      slug: "unique-slug-123",
    });

    expect(org).not.toBeNull();
    expect(org?.name).toBe("Unique Org");
  });

  it("should ensure unique slugs", async () => {
    const t = createTestInstance();

    await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "First Org",
      slug: "duplicate",
    });

    const org2Id = await t.mutation(api.organizations.createOrganization, {
      userId: "user_456",
      name: "Second Org",
      slug: "duplicate",
    });

    const org2 = await t.query(api.organizations.getOrganization, {
      organizationId: org2Id,
    });

    expect(org2?.slug).not.toBe("duplicate");
    expect(org2?.slug).toMatch(/^duplicate-/);
  });

  it("should update organization", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Original Name",
      slug: "original",
    });

    await t.mutation(api.organizations.updateOrganization, {
      userId: "user_123",
      organizationId: orgId,
      name: "Updated Name",
      logo: "https://new-logo.png",
    });

    const org = await t.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });

    expect(org?.name).toBe("Updated Name");
    expect(org?.logo).toBe("https://new-logo.png");
  });

  it("should update organization with slug updates the slug", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Slug Org",
      slug: "original-slug",
    });

    await t.mutation(api.organizations.updateOrganization, {
      userId: "user_123",
      organizationId: orgId,
      slug: "new-slug",
    });

    const org = await t.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org?.slug).toBe("new-slug");
  });

  it("should transfer ownership to another member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    await t.mutation(api.organizations.transferOwnership, {
      userId: "user_123",
      organizationId: orgId,
      newOwnerUserId: "user_456",
    });

    const org = await t.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org?.ownerId).toBe("user_456");

    const newOwner = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });
    expect(newOwner?.role).toBe("owner");

    const previousOwner = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_123",
    });
    expect(previousOwner?.role).toBe("admin");
  });

  it("should transfer ownership with custom previousOwnerRole", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    await t.mutation(api.organizations.transferOwnership, {
      userId: "user_123",
      organizationId: orgId,
      newOwnerUserId: "user_456",
      previousOwnerRole: "member",
    });

    const previousOwner = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_123",
    });
    expect(previousOwner?.role).toBe("member");
  });

  it("transferOwnership throws when non-owner attempts transfer", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "admin",
    });

    await expect(
      t.mutation(api.organizations.transferOwnership, {
        userId: "user_456",
        organizationId: orgId,
        newOwnerUserId: "user_123",
      })
    ).rejects.toThrow("Only the current owner can transfer ownership");
  });

  it("transferOwnership throws when transferring to self", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.organizations.transferOwnership, {
        userId: "user_123",
        organizationId: orgId,
        newOwnerUserId: "user_123",
      })
    ).rejects.toThrow("Cannot transfer ownership to yourself");
  });

  it("transferOwnership throws when new owner is not a member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.organizations.transferOwnership, {
        userId: "user_123",
        organizationId: orgId,
        newOwnerUserId: "non_member",
      })
    ).rejects.toThrow("New owner must already be a member of the organization");
  });

  it("should delete organization and all related data", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "To Delete",
      slug: "to-delete",
    });

    await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Team A",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "test@example.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.organizations.deleteOrganization, {
      userId: "user_123",
      organizationId: orgId,
    });

    const org = await t.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org).toBeNull();

    const teams = await t.query(api.teams.listTeams, {
      organizationId: orgId,
    });
    expect(teams).toHaveLength(0);
  });

  // ==========================================================================
  // updateOrganization authz + metadata caps
  // ==========================================================================
  describe("updateOrganization invariants", () => {
    it("rejects non-admin/non-owner caller (FORBIDDEN)", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "owner",
        name: "Update Authz Org",
        slug: "update-authz-org",
      });
      await t.mutation(api.members.addMember, {
        userId: "owner",
        organizationId: orgId,
        memberUserId: "member_user",
        role: "member",
      });
      await expect(
        t.mutation(api.organizations.updateOrganization, {
          userId: "member_user",
          organizationId: orgId,
          name: "Mutated By Member",
        })
      ).rejects.toThrow(/FORBIDDEN|Only admins or owners/);
    });

    it("rejects metadata > 10KB on updateOrganization", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "owner",
        name: "Big Metadata Org",
        slug: "big-metadata-org",
      });
      const huge = { blob: "x".repeat(10_001) };
      await expect(
        t.mutation(api.organizations.updateOrganization, {
          userId: "owner",
          organizationId: orgId,
          metadata: huge,
        })
      ).rejects.toThrow(/Metadata exceeds maximum size/);
    });
  });

  describe("createOrganization metadata cap", () => {
    it("rejects metadata > 10KB at create time", async () => {
      const t = createTestInstance();
      const huge = { blob: "x".repeat(10_001) };
      await expect(
        t.mutation(api.organizations.createOrganization, {
          userId: "owner",
          name: "Too Big Org",
          slug: "too-big-org",
          metadata: huge,
        })
      ).rejects.toThrow(/Metadata exceeds maximum size/);
    });
  });

  // ==========================================================================
  // deleteOrganization cascade
  // ==========================================================================
  describe("deleteOrganization cascade", () => {
    it("fully removes org doc and all child rows", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "owner",
        name: "Full Cascade Org",
        slug: "full-cascade-org",
      });
      await t.mutation(api.members.addMember, {
        userId: "owner",
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });
      const teamId = await t.mutation(api.teams.createTeam, {
        userId: "owner",
        organizationId: orgId,
        name: "Team Alpha",
      });
      await t.mutation(api.teams.addTeamMember, {
        userId: "owner",
        teamId,
        memberUserId: "bob",
      });
      await t.mutation(api.invitations.inviteMember, {
        userId: "owner",
        organizationId: orgId,
        inviteeIdentifier: "pending@example.com",
        identifierType: "email",
        role: "member",
      });

      await t.mutation(api.organizations.deleteOrganization, {
        userId: "owner",
        organizationId: orgId,
      });

      const org = await t.query(api.organizations.getOrganization, {
        organizationId: orgId,
      });
      expect(org).toBeNull();

      const teams = await t.query(api.teams.listTeams, { organizationId: orgId });
      expect(teams).toHaveLength(0);

      const members = await t.query(api.members.listOrganizationMembers, {
        organizationId: orgId,
      });
      expect(members).toHaveLength(0);
    });
  });

  // ==========================================================================
  // listUserOrganizations status filter
  // ==========================================================================
  describe("listUserOrganizations status filter", () => {
    async function setup() {
      const t = createTestInstance();
      const activeOrgId = await t.mutation(api.organizations.createOrganization, {
        userId: "u",
        name: "Active",
        slug: "active",
      });
      // Owner of another org that will be suspended for this user via suspend.
      // We create it as owner, then add a second user "u" as a member, and suspend that member.
      const suspendedOrgId = await t.mutation(api.organizations.createOrganization, {
        userId: "admin_owner",
        name: "Suspended",
        slug: "suspended",
      });
      await t.mutation(api.members.addMember, {
        userId: "admin_owner",
        organizationId: suspendedOrgId,
        memberUserId: "u",
        role: "member",
      });
      await t.mutation(api.members.suspendMember, {
        userId: "admin_owner",
        organizationId: suspendedOrgId,
        memberUserId: "u",
      });
      return { t, activeOrgId, suspendedOrgId };
    }

    it("defaults to status='active' returning only active memberships", async () => {
      const { t, activeOrgId } = await setup();
      const orgs = await t.query(api.organizations.listUserOrganizations, {
        userId: "u",
        status: "active",
      });
      expect(orgs.map((o: any) => o._id)).toEqual([activeOrgId]);
    });

    it("status='suspended' returns only suspended memberships", async () => {
      const { t, suspendedOrgId } = await setup();
      const orgs = await t.query(api.organizations.listUserOrganizations, {
        userId: "u",
        status: "suspended",
      });
      expect(orgs.map((o: any) => o._id)).toEqual([suspendedOrgId]);
    });

    it("status='all' returns both active and suspended memberships", async () => {
      const { t, activeOrgId, suspendedOrgId } = await setup();
      const orgs = await t.query(api.organizations.listUserOrganizations, {
        userId: "u",
        status: "all",
      });
      const ids = orgs.map((o: any) => o._id).sort();
      expect(ids).toEqual([activeOrgId, suspendedOrgId].sort());
    });
  });
});
