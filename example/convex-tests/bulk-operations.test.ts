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
          { email: "bob@test.com", role: "member" },
          { email: "carol@test.com", role: "admin" },
        ],
      });

      expect(result.success).toHaveLength(2);
      expect(result.success.map((s) => s.email)).toContain("bob@test.com");
      expect(result.success.map((s) => s.email)).toContain("carol@test.com");
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
        email: "bob@test.com",
        role: "member",
      });

      const result = await asAlice.mutation(api.testHelpers.strictBulkInviteMembers, {
        organizationId: orgId,
        invitations: [
          { email: "bob@test.com", role: "admin" },
          { email: "carol@test.com", role: "member" },
        ],
      });

      expect(result.success).toHaveLength(1);
      expect(result.success[0].email).toBe("carol@test.com");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].email).toBe("bob@test.com");
      expect(result.errors[0].code).toBe("ALREADY_EXISTS");
    });
  });
});
