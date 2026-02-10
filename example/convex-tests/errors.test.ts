import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - error paths", () => {
  describe("error paths", () => {
    test("updateTeam throws for nonexistent team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictUpdateTeam, {
          teamId: "nonexistent",
          name: "New Name",
        })
      ).rejects.toThrow("Team not found");
    });

    test("deleteTeam throws for nonexistent team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictDeleteTeam, {
          teamId: "nonexistent",
        })
      ).rejects.toThrow("Team not found");
    });

    test("addTeamMember throws for nonexistent team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictAddTeamMember, {
          teamId: "nonexistent",
          memberUserId: "bob",
        })
      ).rejects.toThrow("Team not found");
    });

    test("removeTeamMember throws for nonexistent team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
          teamId: "nonexistent",
          memberUserId: "bob",
        })
      ).rejects.toThrow("Team not found");
    });

    test("resendInvitation throws for nonexistent invitation", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictResendInvitation, {
          invitationId: "nonexistent",
        })
      ).rejects.toThrow("Invitation not found");
    });

    test("cancelInvitation throws for nonexistent invitation", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictCancelInvitation, {
          invitationId: "nonexistent",
        })
      ).rejects.toThrow("Invitation not found");
    });

    test("updateOrganization with slug updates the slug", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Slug Update Org",
      });

      await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
        organizationId: orgId,
        slug: "custom-slug",
      });

      const org = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
        slug: "custom-slug",
      });
      expect(org).not.toBeNull();
      expect(org?.name).toBe("Slug Update Org");
    });

    test("removeMember cleans up team memberships", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Remove Member Cleanup Org",
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

      // Remove bob from org — should also clean up team membership
      await asAlice.mutation(api.testHelpers.strictRemoveMember, {
        organizationId: orgId,
        memberUserId: "bob",
      });

      const teamMembers = await asAlice.query(api.testHelpers.strictListTeamMembers, {
        teamId,
      });
      const bobInTeam = teamMembers.find((m: any) => m.userId === "bob");
      expect(bobInTeam).toBeUndefined();
    });

    test("deleteOrganization cleans up team members", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Delete Cleanup Org",
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

      // Delete org — should cascade cleanup
      await asAlice.mutation(api.testHelpers.strictDeleteOrganization, {
        organizationId: orgId,
      });

      // Org is gone, membership check should fail
      await expect(
        asAlice.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });
  });
});
