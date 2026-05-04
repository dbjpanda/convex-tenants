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

    test("listMembers with paginationOpts returns paginated members", async () => {
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

      const result = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(false);
      expect(result.continueCursor).toBeDefined();

      const nextPage = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
        paginationOpts: { numItems: 2, cursor: result.continueCursor },
      });
      expect(nextPage.page.length).toBeGreaterThanOrEqual(1);
    });

    /**
     * Regression pin for the tenants-provider.tsx bug fixed in commit dd802aa.
     *
     * Before the fix, TenantsProvider invoked `api.listMembers({ organizationId })`
     * with NO status arg. The server defaults `status` to "active", so suspended
     * members never reached the React layer — making the new "Suspended" tab
     * in MembersTable silently dead code in production. The fix passes
     * `status: "all"` from the provider and partitions active/suspended/pending
     * client-side.
     *
     * This test pins BOTH halves of the contract the provider depends on:
     *   1. Default (no status arg) returns ONLY active members. If anyone
     *      changes the server default to be "all", the provider's explicit
     *      `status: "all"` becomes a no-op AND every other caller relying on
     *      the active-only default silently changes meaning — both regressions
     *      worth catching.
     *   2. `status: "all"` returns active + suspended together, which is what
     *      the provider now relies on to populate the Suspended filter tab.
     */
    test("listMembers default vs status:'all' contract (provider regression dd802aa)", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Provider Status Contract Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });
      await asAlice.mutation(api.testHelpers.strictSuspendMember, {
        organizationId: orgId,
        memberUserId: "bob",
      });

      // (1) No status arg: server default of "active" hides suspended members.
      const defaulted = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
      });
      expect(Array.isArray(defaulted)).toBe(true);
      const defaultedList = defaulted as Array<{ userId: string; status?: string }>;
      expect(defaultedList).toHaveLength(1);
      expect(defaultedList[0].userId).toBe("alice");
      expect(defaultedList.find((m) => m.userId === "bob")).toBeUndefined();
      expect(
        defaultedList.every((m) => (m.status ?? "active") === "active")
      ).toBe(true);

      // (2) status: "all" — what the provider now passes — must include both
      // active and suspended members so the MembersTable filter tabs work.
      const all = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
        status: "all",
      });
      const allList = all as Array<{ userId: string; status?: string }>;
      expect(allList).toHaveLength(2);
      const userIds = allList.map((m) => m.userId).sort();
      expect(userIds).toEqual(["alice", "bob"]);
      const bob = allList.find((m) => m.userId === "bob");
      expect(bob?.status).toBe("suspended");
    });
  });
});
