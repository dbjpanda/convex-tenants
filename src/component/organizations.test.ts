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
});
