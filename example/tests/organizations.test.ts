import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - organizations", () => {
  describe("cross-org membership enforcement", () => {
    test("getOrganization rejects non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Alice Private Org",
      });

      // Bob is authenticated but not a member — should be rejected
      await expect(
        asBob.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("listMembers rejects non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Alice Members Org",
      });

      await expect(
        asBob.query(api.testHelpers.strictListMembers, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("listTeams rejects non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Alice Teams Org",
      });

      await expect(
        asBob.query(api.testHelpers.strictListTeams, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("listInvitations rejects non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Alice Invitations Org",
      });

      await expect(
        asBob.query(api.testHelpers.strictListInvitations, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });
  });

  describe("getUser enrichment", () => {
    test("listMembers enriches results with user data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      // Create org and add a member
      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Enrichment Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // List members — each should have a `user` field from getUser.
      // The `user` field is added dynamically by getUser enrichment,
      // so we cast to `any` for the assertion.
      const members: any[] = await asAlice.query(
        api.testHelpers.strictListMembers,
        { organizationId: orgId }
      );

      expect(members).toHaveLength(2); // alice (owner) + bob (member)
      for (const member of members) {
        expect(member.user).toBeDefined();
        expect(member.user.name).toMatch(/^User /);
        expect(member.user.email).toMatch(/@test\.com$/);
      }

      // Verify specific user data
      const alice = members.find((m: any) => m.userId === "alice");
      expect(alice?.user).toEqual({
        name: "User alice",
        email: "alice@test.com",
      });

      const bob = members.find((m: any) => m.userId === "bob");
      expect(bob?.user).toEqual({
        name: "User bob",
        email: "bob@test.com",
      });
    });

    test("getMember enriches result with user data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Get Member Org" }
      );

      const member: any = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "alice",
      });

      expect(member).not.toBeNull();
      expect(member?.user).toEqual({
        name: "User alice",
        email: "alice@test.com",
      });
    });

    test("listTeamMembers enriches results with user data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      // Create org, add member, create team, add to team
      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Team Enrichment Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "charlie",
        role: "member",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "charlie",
      });

      // List team members — should have user data
      const teamMembers: any[] = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId }
      );

      expect(teamMembers).toHaveLength(1);
      expect(teamMembers[0].user).toEqual({
        name: "User charlie",
        email: "charlie@test.com",
      });
    });
  });

  describe("organization functions", () => {
    test("listOrganizations returns orgs for authenticated user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org A",
      });
      await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org B",
      });

      const orgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
      expect(orgs).toHaveLength(2);
      expect(orgs.map((o: any) => o.name)).toContain("Org A");
      expect(orgs.map((o: any) => o.name)).toContain("Org B");
    });

    test("getOrganization returns org by ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Get Org Test" }
      );

      const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
        organizationId: orgId,
      });

      expect(org).not.toBeNull();
      expect(org?.name).toBe("Get Org Test");
      expect(org?._id).toBe(orgId);
    });

    test("getOrganization throws for nonexistent ID (does not leak existence)", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // Membership check runs before data fetch — a nonexistent org returns
      // the same error as a real org the user doesn't belong to, preventing
      // existence-leaking via error messages.
      await expect(
        asAlice.query(api.testHelpers.strictGetOrganization, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("getOrganizationBySlug returns org by slug", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Slug Test Org",
      });

      const org = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
        slug: "slug-test-org",
      });

      expect(org).not.toBeNull();
      expect(org?.name).toBe("Slug Test Org");
    });

    test("getOrganizationBySlug returns null for nonexistent slug", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const org = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
        slug: "does-not-exist",
      });

      expect(org).toBeNull();
    });

    test("updateOrganization updates name and logo", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Before Update" }
      );

      await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
        organizationId: orgId,
        name: "After Update",
        logo: "https://example.com/logo.png",
      });

      const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
        organizationId: orgId,
      });

      expect(org?.name).toBe("After Update");
      expect(org?.logo).toBe("https://example.com/logo.png");
    });

    test("updateOrganization throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictUpdateOrganization, {
          organizationId: "nonexistent",
          name: "New Name",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("deleteOrganization removes org and its data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "To Delete" }
      );

      // Add a team so we can verify cascading delete
      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Team A",
      });

      await asAlice.mutation(api.testHelpers.strictDeleteOrganization, {
        organizationId: orgId,
      });

      // After deletion, Alice is no longer a member — membership check fails.
      // Verify the org is gone by checking that membership throws.
      await expect(
        asAlice.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");

      await expect(
        asAlice.query(api.testHelpers.strictListTeams, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("deleteOrganization throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictDeleteOrganization, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });
});
