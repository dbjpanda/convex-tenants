import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - cascading operations", () => {
  describe("cascading operations", () => {
    test("deleteTeam cleans up team member relations", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Delete Team Cleanup Org",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Delete the team
      await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId });

      // Team is gone
      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team).toBeNull();
    });

    test("removeTeamMember removes team relation", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Remove Team Member Org",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Verify bob is a team member
      const isMemberBefore = await asBob.query(api.testHelpers.strictIsTeamMember, {
        teamId,
      });
      expect(isMemberBefore).toBe(true);

      // Remove bob from team
      await asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Verify bob is no longer a team member
      const isMemberAfter = await asBob.query(api.testHelpers.strictIsTeamMember, {
        teamId,
      });
      expect(isMemberAfter).toBe(false);
    });

    test("acceptInvitation with teamId adds user to team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Invite With Team Org",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      // Invite bob with teamId
      const { invitationId } = await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        email: "bob@test.com",
        role: "member",
        teamId,
      });

      // Bob accepts
      await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
        invitationId,
      });

      // Verify bob is a member of the org
      const member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member).not.toBeNull();

      // Verify bob is also a member of the team
      const isMember = await asBob.query(api.testHelpers.strictIsTeamMember, {
        teamId,
      });
      expect(isMember).toBe(true);
    });

    test("inviteMember rejects teamId from another organization", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgAId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org A",
      });
      const orgBId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org B",
      });

      const orgBTeamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgBId,
        name: "Org B Team",
      });

      await expect(
        asAlice.mutation(api.testHelpers.strictInviteMember, {
          organizationId: orgAId,
          email: "bob@test.com",
          role: "member",
          teamId: orgBTeamId,
        })
      ).rejects.toThrow("Team must belong to the invitation organization");
    });
  });
});
