/**
 * User journey tests for bulk operations.
 *
 * Journey 1: Bulk invite → partial accept → bulk remove
 * Journey 2: Bulk add members → verify roles → bulk remove with team cleanup
 * Journey 3: Bulk invite with validation (partial success)
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

/** Helper: check if a ReBAC team-member relation exists in authz. */
function hasTeamRelation(
  identity: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  userId: string,
  teamId: string,
) {
  return identity.query(api.testHelpers.hasAuthzRelation, {
    subjectType: "user",
    subjectId: userId,
    relation: "member",
    objectType: "team",
    objectId: teamId,
  });
}

describe("Journey: Bulk Operations", () => {
  // ────────────────────────────────────────────────────────────────────
  // Journey 1: Bulk invite → partial accept → bulk remove
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 1: Bulk invite → partial accept → bulk remove", () => {
    test("invite 4 people, 2 accept, bulk remove the accepted ones", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
      const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

      // Step 1: Alice creates org "GrowthCo"
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "GrowthCo",
      });
      expect(orgId).toBeDefined();

      // Step 2: Alice bulk invites 4 people
      const bulkResult = await asAlice.mutation(api.testHelpers.strictBulkInviteMembers, {
        organizationId: orgId,
        invitations: [
          { inviteeIdentifier: "bob@test.com", role: "admin" },
          { inviteeIdentifier: "charlie@test.com", role: "member" },
          { inviteeIdentifier: "diana@test.com", role: "member" },
          { inviteeIdentifier: "eve@test.com", role: "member" },
        ],
      });
      expect(bulkResult.success).toHaveLength(4);
      expect(bulkResult.errors).toHaveLength(0);

      // Step 3: Verify 4 pending invitations
      const pendingCount = await asAlice.query(api.testHelpers.strictCountInvitations, {
        organizationId: orgId,
        status: "pending",
      });
      expect(pendingCount).toBe(4);

      // Step 4: Bob and Charlie accept their invitations
      const bobInvitation = bulkResult.success.find(
        (s: { inviteeIdentifier: string }) => s.inviteeIdentifier === "bob@test.com",
      );
      const charlieInvitation = bulkResult.success.find(
        (s: { inviteeIdentifier: string }) => s.inviteeIdentifier === "charlie@test.com",
      );
      expect(bobInvitation).toBeDefined();
      expect(charlieInvitation).toBeDefined();

      await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
        invitationId: bobInvitation!.invitationId,
      });
      await asCharlie.mutation(api.testHelpers.strictAcceptInvitation, {
        invitationId: charlieInvitation!.invitationId,
      });

      // Step 5: Diana and Eve do NOT accept (simulate: they never show up)

      // Step 6: Verify 3 members total (alice + bob + charlie)
      // Diana and Eve only have pending invitations — they are not members
      const memberCount = await asAlice.query(api.testHelpers.strictCountMembers, {
        organizationId: orgId,
      });
      expect(memberCount).toBe(3);

      // Step 7: Verify bob has admin role, charlie has member role
      const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(bobMember).not.toBeNull();
      expect(bobMember?.role).toBe("admin");

      const charlieMember = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "charlie",
      });
      expect(charlieMember).not.toBeNull();
      expect(charlieMember?.role).toBe("member");

      // Step 8: Alice bulk removes bob and charlie
      const removeResult = await asAlice.mutation(api.testHelpers.strictBulkRemoveMembers, {
        organizationId: orgId,
        memberUserIds: ["bob", "charlie"],
      });
      expect(removeResult.success).toHaveLength(2);
      expect(removeResult.success).toContain("bob");
      expect(removeResult.success).toContain("charlie");
      expect(removeResult.errors).toHaveLength(0);

      // Step 9: Verify only alice remains
      const finalMemberCount = await asAlice.query(api.testHelpers.strictCountMembers, {
        organizationId: orgId,
      });
      expect(finalMemberCount).toBe(1);

      // Step 10: Verify 2 invitations still pending (diana, eve)
      const remainingPending = await asAlice.query(api.testHelpers.strictCountInvitations, {
        organizationId: orgId,
        status: "pending",
      });
      expect(remainingPending).toBe(2);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Journey 2: Bulk add members → verify roles → bulk remove with team cleanup
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 2: Bulk add → team assignments → bulk remove with cleanup", () => {
    test("bulk add members, assign to teams, bulk remove cleans up team relations", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // Step 1: Alice creates org and 2 teams
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "TeamCleanup Org",
      });

      const frontendId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Frontend",
      });
      const backendId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Backend",
      });

      // Step 2: Alice bulk adds bob(admin), charlie(member), diana(member)
      const addResult = await asAlice.mutation(api.testHelpers.strictBulkAddMembers, {
        organizationId: orgId,
        members: [
          { memberUserId: "bob", role: "admin" },
          { memberUserId: "charlie", role: "member" },
          { memberUserId: "diana", role: "member" },
        ],
      });

      // Step 3: Verify result.success has all 3
      expect(addResult.success).toHaveLength(3);
      expect(addResult.success).toContain("bob");
      expect(addResult.success).toContain("charlie");
      expect(addResult.success).toContain("diana");
      expect(addResult.errors).toHaveLength(0);

      // Step 4: Alice adds bob to Frontend, charlie to both teams, diana to Backend
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId: frontendId,
        memberUserId: "bob",
      });
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId: frontendId,
        memberUserId: "charlie",
      });
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId: backendId,
        memberUserId: "charlie",
      });
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId: backendId,
        memberUserId: "diana",
      });

      // Step 5: Verify all team memberships via hasAuthzRelation
      expect(await hasTeamRelation(asAlice, "bob", frontendId)).toBe(true);
      expect(await hasTeamRelation(asAlice, "charlie", frontendId)).toBe(true);
      expect(await hasTeamRelation(asAlice, "charlie", backendId)).toBe(true);
      expect(await hasTeamRelation(asAlice, "diana", backendId)).toBe(true);

      // Step 6: Alice bulk removes charlie and diana
      const removeResult = await asAlice.mutation(api.testHelpers.strictBulkRemoveMembers, {
        organizationId: orgId,
        memberUserIds: ["charlie", "diana"],
      });
      expect(removeResult.success).toHaveLength(2);
      expect(removeResult.success).toContain("charlie");
      expect(removeResult.success).toContain("diana");
      expect(removeResult.errors).toHaveLength(0);

      // Step 7: Verify all team ReBAC relations for charlie and diana are cleaned
      expect(await hasTeamRelation(asAlice, "charlie", frontendId)).toBe(false);
      expect(await hasTeamRelation(asAlice, "charlie", backendId)).toBe(false);
      expect(await hasTeamRelation(asAlice, "diana", backendId)).toBe(false);

      // Step 8: Verify bob is still in Frontend team
      expect(await hasTeamRelation(asAlice, "bob", frontendId)).toBe(true);

      // Step 9: Verify only alice and bob remain
      const finalCount = await asAlice.query(api.testHelpers.strictCountMembers, {
        organizationId: orgId,
      });
      expect(finalCount).toBe(2);

      const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(bobMember).not.toBeNull();
      expect(bobMember?.role).toBe("admin");
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Journey 3: Bulk invite with validation (partial success)
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 3: Bulk invite with validation (partial success)", () => {
    test("validateInvitationCreate rejects non-email identifiers in bulk", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // Step 1-2: Use validateCreateBulkInviteMembers (rejects non-email); Alice creates org
      const orgId = await asAlice.mutation(api.testHelpers.validateCreateOrg, {
        name: "Validation Bulk Org",
      });

      // Step 3: Alice bulk invites: good@test.com, bad_username, another@test.com
      const bulkResult = await asAlice.mutation(api.testHelpers.validateCreateBulkInviteMembers, {
        organizationId: orgId,
        invitations: [
          { inviteeIdentifier: "good@test.com", role: "member" },
          { inviteeIdentifier: "bad_username", role: "member" },
          { inviteeIdentifier: "another@test.com", role: "admin" },
        ],
      });

      // Step 4: Verify result.success has 2 (good@ and another@)
      expect(bulkResult.success).toHaveLength(2);
      const successIdentifiers = bulkResult.success.map(
        (s: { inviteeIdentifier: string }) => s.inviteeIdentifier,
      );
      expect(successIdentifiers).toContain("good@test.com");
      expect(successIdentifiers).toContain("another@test.com");

      // Step 5: Verify result.errors has 1 (bad_username with reason)
      expect(bulkResult.errors).toHaveLength(1);
      expect(bulkResult.errors[0].inviteeIdentifier).toBe("bad_username");
      expect(bulkResult.errors[0].message).toContain("Only email identifiers are allowed");

      // Step 6: Verify only 2 pending invitations exist
      const pendingCount = await asAlice.query(api.testHelpers.strictCountInvitations, {
        organizationId: orgId,
        status: "pending",
      });
      expect(pendingCount).toBe(2);
    });
  });
});
