import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - leaveOrganization", () => {
  describe("leaveOrganization", () => {
    test("member can leave organization", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Leave Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // Bob leaves
      await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
        organizationId: orgId,
      });

      // Verify via Alice that bob is gone
      const members = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
      });
      const bobMember = members.find((m: any) => m.userId === "bob");
      expect(bobMember).toBeUndefined();
    });

    test("last owner cannot leave organization", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Last Owner Org",
      });

      // Alice is the only owner — cannot leave
      await expect(
        asAlice.mutation(api.testHelpers.strictLeaveOrganization, {
          organizationId: orgId,
        })
      ).rejects.toThrow();
    });

    test("non-creator owner can leave if another owner exists", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Multi Owner Org",
      });

      // Add bob as owner
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "owner",
      });

      // Bob (non-creator owner) can leave — Alice (creator) remains
      await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
        organizationId: orgId,
      });

      const members = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
      });
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe("alice");
    });

    test("leaving cleans up team memberships", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Team Cleanup Org",
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
      const isTeamMemberBefore = await asBob.query(api.testHelpers.strictIsTeamMember, {
        teamId,
      });
      expect(isTeamMemberBefore).toBe(true);

      // Bob leaves the org
      await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
        organizationId: orgId,
      });

      // Verify bob is no longer a team member
      const teamMembers = await asAlice.query(api.testHelpers.strictListTeamMembers, {
        teamId,
      });
      const bobInTeam = teamMembers.find((m: any) => m.userId === "bob");
      expect(bobInTeam).toBeUndefined();
    });

    test("leaveOrganization throws for non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Non Member Leave Org",
      });

      // Bob is not a member — should throw
      await expect(
        asBob.mutation(api.testHelpers.strictLeaveOrganization, {
          organizationId: orgId,
        })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("onMemberLeft callback fires", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Leave Callback Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
        organizationId: orgId,
      });

      const logs = await t.query(api.testHelpers.getCallbackLogs, {});
      const leftLogs = logs.filter((l: any) => l.type === "memberLeft");
      expect(leftLogs).toHaveLength(1);
      expect(leftLogs[0].data.organizationId).toBe(orgId);
      expect(leftLogs[0].data.userId).toBe("bob");
    });
  });
});
