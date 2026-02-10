import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - team slug and metadata", () => {
  test("createTeam with slug and metadata persists them", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Team Slug Org",
    });

    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
      slug: "eng",
      metadata: { tier: "core", lead: "alice" },
    });

    const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
    expect(team?.slug).toBe("eng");
    expect(team?.metadata).toEqual({ tier: "core", lead: "alice" });
  });

  test("createTeam without slug derives slug from name", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Derived Slug Org",
    });

    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Product & Design",
    });

    const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
    expect(team?.slug).toBeDefined();
    expect(team?.slug).toMatch(/^product-design/);
  });

  test("updateTeam can update slug and metadata", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Update Team Slug Org",
    });

    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Original",
      slug: "orig",
    });

    await asAlice.mutation(api.testHelpers.strictUpdateTeam, {
      teamId,
      slug: "updated-slug",
      metadata: { updated: true },
    });

    const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
    expect(team?.slug).toBe("updated-slug");
    expect(team?.metadata).toEqual({ updated: true });
  });

  test("ensureUniqueTeamSlug appends number when slug conflicts in same org", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Unique Slug Org",
    });

    const team1Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Team",
      slug: "dev",
    });

    const team2Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Other Team",
      slug: "dev",
    });

    const team1 = await asAlice.query(api.testHelpers.strictGetTeam, { teamId: team1Id });
    const team2 = await asAlice.query(api.testHelpers.strictGetTeam, { teamId: team2Id });

    expect(team1?.slug).toBe("dev");
    expect(team2?.slug).toMatch(/^dev-/);
    expect(team2?.slug).not.toBe(team1?.slug);
  });
});
