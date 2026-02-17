import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - bulk operations", () => {
  describe("bulkAddMembers", () => {
    test("adds multiple members and returns success/errors", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Bulk Add Org",
      });

      const result = await asAlice.mutation(api.testHelpers.strictBulkAddMembers, {
        organizationId: orgId,
        members: [
          { memberUserId: "bob", role: "member" },
          { memberUserId: "carol", role: "admin" },
        ],
      });

      expect(result.success).toHaveLength(2);
      expect(result.success).toContain("bob");
      expect(result.success).toContain("carol");
      expect(result.errors).toHaveLength(0);

      const members = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
      });
      expect(members).toHaveLength(3); // alice + bob + carol
    });

    test("skips already-existing members and reports in errors", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Bulk Add Dup Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      const result = await asAlice.mutation(api.testHelpers.strictBulkAddMembers, {
        organizationId: orgId,
        members: [
          { memberUserId: "bob", role: "admin" },
          { memberUserId: "carol", role: "member" },
        ],
      });

      expect(result.success).toHaveLength(1);
      expect(result.success).toContain("carol");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].userId).toBe("bob");
      expect(result.errors[0].code).toBe("ALREADY_EXISTS");
    });
  });

  describe("bulkRemoveMembers", () => {
    test("removes multiple members and returns success/errors", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Bulk Remove Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "carol",
        role: "member",
      });

      const result = await asAlice.mutation(api.testHelpers.strictBulkRemoveMembers, {
        organizationId: orgId,
        memberUserIds: ["bob", "carol"],
      });

      expect(result.success).toHaveLength(2);
      expect(result.success).toContain("bob");
      expect(result.success).toContain("carol");
      expect(result.errors).toHaveLength(0);

      const members = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
      });
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe("alice");
    });

    test("reports NOT_FOUND for non-members", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Bulk Remove Partial Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      const result = await asAlice.mutation(api.testHelpers.strictBulkRemoveMembers, {
        organizationId: orgId,
        memberUserIds: ["bob", "carol"],
      });

      expect(result.success).toHaveLength(1);
      expect(result.success).toContain("bob");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].userId).toBe("carol");
      expect(result.errors[0].code).toBe("NOT_FOUND");
    });
  });

  describe("bulkInviteMembers", () => {
    test("sends multiple invitations and returns success/errors", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Bulk Invite Org",
      });

      const result = await asAlice.mutation(api.testHelpers.strictBulkInviteMembers, {
        organizationId: orgId,
        invitations: [
          { inviteeIdentifier: "bob@test.com", identifierType: "email", role: "member" },
          { inviteeIdentifier: "carol@test.com", identifierType: "email", role: "admin" },
        ],
      });

      expect(result.success).toHaveLength(2);
      expect(result.success.map((s) => s.inviteeIdentifier)).toContain("bob@test.com");
      expect(result.success.map((s) => s.inviteeIdentifier)).toContain("carol@test.com");
      expect(result.errors).toHaveLength(0);

      const invitations = await asAlice.query(api.testHelpers.strictListInvitations, {
        organizationId: orgId,
      });
      expect(invitations).toHaveLength(2);
    });

    test("reports ALREADY_EXISTS for duplicate pending invitation", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Bulk Invite Dup Org",
      });
      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "bob@test.com",
        identifierType: "email",
        role: "member",
      });

      const result = await asAlice.mutation(api.testHelpers.strictBulkInviteMembers, {
        organizationId: orgId,
        invitations: [
          { inviteeIdentifier: "bob@test.com", identifierType: "email", role: "admin" },
          { inviteeIdentifier: "carol@test.com", identifierType: "email", role: "member" },
        ],
      });

      expect(result.success).toHaveLength(1);
      expect(result.success[0].inviteeIdentifier).toBe("carol@test.com");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].inviteeIdentifier).toBe("bob@test.com");
      expect(result.errors[0].code).toBe("ALREADY_EXISTS");
    });

    test("reports NOT_FOUND when teamId does not exist", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Bulk Invite Team Org",
      });

      const result = await asAlice.mutation(api.testHelpers.strictBulkInviteMembers, {
        organizationId: orgId,
        invitations: [
          { inviteeIdentifier: "bob@test.com", identifierType: "email", role: "member", teamId: "teams:000000000000000000000" },
        ],
      });

      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("NOT_FOUND");
      expect(result.errors[0].message).toContain("Team not found");
    });

    test("reports FORBIDDEN when teamId belongs to different org", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const org1Id = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org One",
      });
      const org2Id = await asBob.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org Two",
      });

      const teamInOrg2 = await asBob.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: org2Id,
        name: "Org2 Team",
      });

      const result = await asAlice.mutation(api.testHelpers.strictBulkInviteMembers, {
        organizationId: org1Id,
        invitations: [
          { inviteeIdentifier: "carol@test.com", identifierType: "email", role: "member", teamId: teamInOrg2 },
        ],
      });

      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("FORBIDDEN");
      expect(result.errors[0].message).toContain("must belong to the organization");
    });
  });
});
