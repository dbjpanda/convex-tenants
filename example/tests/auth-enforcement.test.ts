import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - auth enforcement", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  describe("auth enforcement - queries", () => {
    test("listOrganizations throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictListOrganizations, {})
      ).rejects.toThrow("Not authenticated");
    });

    test("getCurrentMember throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetCurrentMember, { organizationId: "nonexistent" })
      ).rejects.toThrow("Not authenticated");
    });

    test("isTeamMember throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictIsTeamMember, { teamId: "nonexistent" })
      ).rejects.toThrow("Not authenticated");
    });

    test("getOrganization throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetOrganization, { organizationId: "nonexistent" })
      ).rejects.toThrow("Not authenticated");
    });

    test("getOrganizationBySlug throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetOrganizationBySlug, { slug: "nonexistent" })
      ).rejects.toThrow("Not authenticated");
    });

    test("listMembers throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictListMembers, { organizationId: "nonexistent" })
      ).rejects.toThrow("Not authenticated");
    });

    test("getMember throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetMember, { organizationId: "nonexistent", userId: "anyone" })
      ).rejects.toThrow("Not authenticated");
    });

    test("listTeams throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictListTeams, { organizationId: "nonexistent" })
      ).rejects.toThrow("Not authenticated");
    });

    test("getTeam throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetTeam, { teamId: "nonexistent" })
      ).rejects.toThrow("Not authenticated");
    });

    test("listTeamMembers throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictListTeamMembers, { teamId: "nonexistent" })
      ).rejects.toThrow("Not authenticated");
    });

    test("listInvitations throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictListInvitations, { organizationId: "nonexistent" })
      ).rejects.toThrow("Not authenticated");
    });

    test("getPendingInvitations throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetPendingInvitations, { email: "someone@example.com" })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("auth enforcement - mutations", () => {
    test("createOrganization throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictCreateOrganization, { name: "Test Org" })
      ).rejects.toThrow("Not authenticated");
    });

    test("inviteMember throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictInviteMember, {
          organizationId: "nonexistent",
          email: "test@example.com",
          role: "member",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("leaveOrganization throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictLeaveOrganization, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });
});
