import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - teams", () => {
  describe("team functions", () => {
    test("listTeams returns all teams in an organization", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Teams Org" }
      );

      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Design",
      });

      const teams = await asAlice.query(api.testHelpers.strictListTeams, {
        organizationId: orgId,
      });

      expect(teams).toHaveLength(2);
      expect(teams.map((team: any) => team.name)).toContain("Engineering");
      expect(teams.map((team: any) => team.name)).toContain("Design");
    });

    test("getTeam returns team by ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Get Team Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
        description: "The eng team",
      });

      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });

      expect(team).not.toBeNull();
      expect(team?.name).toBe("Engineering");
      expect(team?.description).toBe("The eng team");
    });

    test("getTeam returns null for nonexistent ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // Authenticated but team doesn't exist — underlying component returns null.
      const team = await asAlice.query(api.testHelpers.strictGetTeam, {
        teamId: "nonexistent",
      });

      expect(team).toBeNull();
    });

    test("updateTeam changes name and description", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Update Team Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Original",
      });

      await asAlice.mutation(api.testHelpers.strictUpdateTeam, {
        teamId,
        name: "Updated",
        description: "New description",
      });

      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team?.name).toBe("Updated");
      expect(team?.description).toBe("New description");
    });

    test("updateTeam throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictUpdateTeam, {
          teamId: "nonexistent",
          name: "New Name",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("deleteTeam removes team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Delete Team Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "To Delete",
      });

      await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId });

      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team).toBeNull();
    });

    test("deleteTeam throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictDeleteTeam, {
          teamId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("removeTeamMember removes member from team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Remove Team Member Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Check via listTeamMembers that bob is a team member
      const membersBefore: any[] = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId }
      );
      expect(membersBefore).toHaveLength(1);

      await asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      const membersAfter: any[] = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId }
      );
      expect(membersAfter).toHaveLength(0);
    });

    test("removeTeamMember throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictRemoveTeamMember, {
          teamId: "nonexistent",
          memberUserId: "bob",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });
});
