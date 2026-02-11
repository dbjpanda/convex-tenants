import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - members", () => {
  describe("member functions", () => {
    test("getCurrentMember returns current user membership", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Current Member Org",
      });

      const member = await asAlice.query(api.testHelpers.strictGetCurrentMember, {
        organizationId: orgId,
      });
      expect(member).not.toBeNull();
      expect(member?.userId).toBe("alice");
      expect(member?.role).toBe("owner");
    });

    test("removeMember removes a member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Remove Member Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictRemoveMember, {
        organizationId: orgId,
        memberUserId: "bob",
      });

      const member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member).toBeNull();
    });

    test("removeMember throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictRemoveMember, {
          organizationId: "nonexistent",
          memberUserId: "bob",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("updateMemberRole changes role", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Role Update Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictUpdateMemberRole, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "admin",
      });

      const member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member?.role).toBe("admin");
    });

    test("updateMemberRole throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictUpdateMemberRole, {
          organizationId: "nonexistent",
          memberUserId: "bob",
          role: "admin",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("countMembers returns member count", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Count Members Org" }
      );
      expect(await asAlice.query(api.testHelpers.strictCountMembers, { organizationId: orgId })).toBe(1);

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });
      expect(await asAlice.query(api.testHelpers.strictCountMembers, { organizationId: orgId })).toBe(2);
    });

    test("suspendMember and unsuspendMember soft-disable and re-enable member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Suspend Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      let member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member?.status ?? "active").toBe("active");
      expect(await asAlice.query(api.testHelpers.strictCountMembers, { organizationId: orgId })).toBe(2);

      await asAlice.mutation(api.testHelpers.strictSuspendMember, {
        organizationId: orgId,
        memberUserId: "bob",
      });

      member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member?.status).toBe("suspended");
      expect(member?.suspendedAt).toBeDefined();
      expect(await asAlice.query(api.testHelpers.strictCountMembers, { organizationId: orgId })).toBe(1);
      expect(await asAlice.query(api.testHelpers.strictCountMembers, { organizationId: orgId, status: "all" })).toBe(2);

      await expect(
        asBob.mutation(api.testHelpers.strictUpdateMemberRole, {
          organizationId: orgId,
          memberUserId: "bob",
          role: "admin",
        })
      ).rejects.toThrow("Your membership is suspended");

      await asAlice.mutation(api.testHelpers.strictUnsuspendMember, {
        organizationId: orgId,
        memberUserId: "bob",
      });

      member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member?.status).toBe("active");
      expect(await asAlice.query(api.testHelpers.strictCountMembers, { organizationId: orgId })).toBe(2);
    });

    test("addMember sets joinedAt and getMember/listMembers return it", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "JoinedAt Org",
        slug: "joinedat",
      });
      const beforeAdd = Date.now();
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });
      const afterAdd = Date.now();

      const member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member?.joinedAt).toBeDefined();
      expect(typeof member?.joinedAt).toBe("number");
      expect((member?.joinedAt ?? 0) >= beforeAdd && (member?.joinedAt ?? 0) <= afterAdd + 1000).toBe(true);

      const list = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
      });
      const bobInList = list.find((m) => m.userId === "bob");
      expect(bobInList?.joinedAt).toBeDefined();
    });

    test("listMembers with status suspended returns only suspended members", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Status Filter Org",
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
      await asAlice.mutation(api.testHelpers.strictSuspendMember, {
        organizationId: orgId,
        memberUserId: "bob",
      });

      const suspended = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
        status: "suspended",
      });
      expect(suspended).toHaveLength(1);
      expect(suspended[0].userId).toBe("bob");

      const all = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
        status: "all",
      });
      expect(all).toHaveLength(3);
    });

    test("listMembersPaginated returns paginated members", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Paginated Members Org",
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

      const result = await asAlice.query(api.testHelpers.strictListMembersPaginated, {
        organizationId: orgId,
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(false);
      expect(result.continueCursor).toBeDefined();

      const nextPage = await asAlice.query(api.testHelpers.strictListMembersPaginated, {
        organizationId: orgId,
        paginationOpts: { numItems: 2, cursor: result.continueCursor },
      });
      expect(nextPage.page.length).toBeGreaterThanOrEqual(1);
    });
  });
});
