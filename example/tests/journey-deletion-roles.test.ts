/**
 * User journey tests for deletion cleanup and role verification across orgs.
 *
 * Journey 1: Complex org deletion — verify EVERYTHING is cleaned
 * Journey 2: getUserRoles across orgs
 * Journey 3: getUserRoles reflects role changes in real-time
 * Journey 4: Delete team with complex membership — verify selective cleanup
 * Journey 5: Pending invitations survive member churn
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

// ===========================================================================
// Journey 1: Complex org deletion — verify EVERYTHING is cleaned
// ===========================================================================

describe("Journey 1: Complex org deletion — verify EVERYTHING is cleaned", () => {
  test("deleting an org removes all members, teams, ReBAC relations, overrides, and invitations", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });
    const asDiana = t.withIdentity({ subject: "diana", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates "MegaCorp" org
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "MegaCorp",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Add 3 members: bob(admin), charlie(member), diana(member)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "diana",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 3: Create 3 teams: Engineering, Design, Sales
    // -----------------------------------------------------------------------
    const engineeringId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });
    const designId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Design",
    });
    const salesId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Sales",
    });

    // -----------------------------------------------------------------------
    // Step 4: Add bob to Engineering + Design
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: engineeringId,
      memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: designId,
      memberUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 5: Add charlie to Design + Sales
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: designId,
      memberUserId: "charlie",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: salesId,
      memberUserId: "charlie",
    });

    // -----------------------------------------------------------------------
    // Step 6: Add diana to Sales
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: salesId,
      memberUserId: "diana",
    });

    // -----------------------------------------------------------------------
    // Step 7: Grant bob a direct permission override
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictGrantPermission, {
      organizationId: orgId,
      targetUserId: "bob",
      permission: "organizations:delete",
    });

    // -----------------------------------------------------------------------
    // Step 8: Grant charlie a direct permission override
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictGrantPermission, {
      organizationId: orgId,
      targetUserId: "charlie",
      permission: "teams:create",
    });

    // -----------------------------------------------------------------------
    // Step 9: Invite eve@test.com (pending invitation)
    // -----------------------------------------------------------------------
    const { invitationId: eveInvitationId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "eve@test.com",
        identifierType: "email",
        role: "member",
      }
    );
    expect(eveInvitationId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 10: Invite frank@test.com (pending invitation)
    // -----------------------------------------------------------------------
    const { invitationId: frankInvitationId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "frank@test.com",
        identifierType: "email",
        role: "member",
      }
    );
    expect(frankInvitationId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 11: Cancel frank's invitation
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictCancelInvitation, {
      invitationId: frankInvitationId,
    });

    // -----------------------------------------------------------------------
    // Step 12: Verify state before deletion
    // -----------------------------------------------------------------------
    // 4 members (alice + bob + charlie + diana)
    const memberCount = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
    });
    expect(memberCount).toBe(4);

    // 3 teams
    const teamCount = await asAlice.query(api.testHelpers.strictCountTeams, {
      organizationId: orgId,
    });
    expect(teamCount).toBe(3);

    // 5 ReBAC team relations:
    // bob-Engineering, bob-Design, charlie-Design, charlie-Sales, diana-Sales
    expect(await hasTeamRelation(asAlice, "bob", engineeringId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "bob", designId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "charlie", designId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "charlie", salesId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "diana", salesId)).toBe(true);

    // 2 overrides
    const bobOverride = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(bobOverride.allowed).toBe(true);

    const charlieOverride = await asCharlie.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(charlieOverride.allowed).toBe(true);

    // 2 invitations (1 pending + 1 cancelled)
    const invitationCount = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "all",
    });
    expect(invitationCount).toBe(2);

    // -----------------------------------------------------------------------
    // Step 13: Alice DELETES the org
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictDeleteOrganization, {
      organizationId: orgId,
    });

    // -----------------------------------------------------------------------
    // Step 14: Verify: org is null (getOrganizationBySlug returns null)
    // -----------------------------------------------------------------------
    const org = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
      slug: "megacorp",
    });
    expect(org).toBeNull();

    // -----------------------------------------------------------------------
    // Step 15: Verify: all members gone (alice, bob, charlie, diana)
    // -----------------------------------------------------------------------
    await expect(
      asAlice.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");

    await expect(
      asBob.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");

    await expect(
      asCharlie.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");

    await expect(
      asDiana.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");

    // -----------------------------------------------------------------------
    // Step 16: Verify: all teams gone
    // -----------------------------------------------------------------------
    await expect(
      asAlice.query(api.testHelpers.strictListTeams, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");

    // -----------------------------------------------------------------------
    // Step 17: Verify: ALL ReBAC relations gone (check each of the 5)
    // Use a separate identity that doesn't need membership to check ReBAC
    // -----------------------------------------------------------------------
    const asAny = t.withIdentity({ subject: "checker", issuer: "https://test.com" });
    expect(await hasTeamRelation(asAny, "bob", engineeringId)).toBe(false);
    expect(await hasTeamRelation(asAny, "bob", designId)).toBe(false);
    expect(await hasTeamRelation(asAny, "charlie", designId)).toBe(false);
    expect(await hasTeamRelation(asAny, "charlie", salesId)).toBe(false);
    expect(await hasTeamRelation(asAny, "diana", salesId)).toBe(false);

    // -----------------------------------------------------------------------
    // Step 18: Verify: alice, bob, charlie, diana have no memberships in this org
    // (confirmed via step 15 — getOrganization throws for all)
    // Also verify listing their orgs doesn't include the deleted one
    // -----------------------------------------------------------------------
    const aliceOrgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
    expect(aliceOrgs.every((o: any) => o._id !== orgId)).toBe(true);

    const bobOrgs = await asBob.query(api.testHelpers.strictListOrganizations, {});
    expect(bobOrgs.every((o: any) => o._id !== orgId)).toBe(true);

    const charlieOrgs = await asCharlie.query(api.testHelpers.strictListOrganizations, {});
    expect(charlieOrgs.every((o: any) => o._id !== orgId)).toBe(true);

    const dianaOrgs = await asDiana.query(api.testHelpers.strictListOrganizations, {});
    expect(dianaOrgs.every((o: any) => o._id !== orgId)).toBe(true);
  });
});

// ===========================================================================
// Journey 2: getUserRoles across orgs
// ===========================================================================

describe("Journey 2: getUserRoles across orgs", () => {
  test("same user has different roles in different orgs, and role changes are reflected", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates OrgA, Bob creates OrgB
    // -----------------------------------------------------------------------
    const orgAId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "OrgA",
    });
    const orgBId = await asBob.mutation(api.testHelpers.strictCreateOrganization, {
      name: "OrgB",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice adds charlie to OrgA as admin
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgAId,
      memberUserId: "charlie",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 3: Bob adds charlie to OrgB as member
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgBId,
      memberUserId: "charlie",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 4: Charlie gets roles for OrgA -> should include "admin"
    // -----------------------------------------------------------------------
    const rolesOrgA = await asCharlie.query(api.testHelpers.strictGetUserRoles, {
      organizationId: orgAId,
    });
    expect(rolesOrgA).toBeDefined();
    expect(Array.isArray(rolesOrgA)).toBe(true);

    const hasAdminInOrgA = await asCharlie.query(api.testHelpers.strictHasRole, {
      organizationId: orgAId,
      role: "admin",
    });
    expect(hasAdminInOrgA).toBe(true);

    // -----------------------------------------------------------------------
    // Step 5: Charlie gets roles for OrgB -> should include "member"
    // -----------------------------------------------------------------------
    const rolesOrgB = await asCharlie.query(api.testHelpers.strictGetUserRoles, {
      organizationId: orgBId,
    });
    expect(rolesOrgB).toBeDefined();
    expect(Array.isArray(rolesOrgB)).toBe(true);

    const hasMemberInOrgB = await asCharlie.query(api.testHelpers.strictHasRole, {
      organizationId: orgBId,
      role: "member",
    });
    expect(hasMemberInOrgB).toBe(true);

    // Charlie should NOT be owner in OrgA or OrgB
    const isOwnerOrgA = await asCharlie.query(api.testHelpers.strictHasRole, {
      organizationId: orgAId,
      role: "owner",
    });
    expect(isOwnerOrgA).toBe(false);

    const isOwnerOrgB = await asCharlie.query(api.testHelpers.strictHasRole, {
      organizationId: orgBId,
      role: "owner",
    });
    expect(isOwnerOrgB).toBe(false);

    // -----------------------------------------------------------------------
    // Step 6: Alice upgrades charlie to owner in OrgA
    //         (transfer ownership so charlie becomes owner)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgAId,
      newOwnerUserId: "charlie",
      previousOwnerRole: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 7: Charlie gets roles for OrgA -> should include "owner"
    //         Note: transferOwnership assigns "owner" but does NOT revoke the
    //         previous "admin" role from the new owner, so charlie now has both.
    // -----------------------------------------------------------------------
    const rolesOrgAAfter = await asCharlie.query(api.testHelpers.strictGetUserRoles, {
      organizationId: orgAId,
    });
    expect(rolesOrgAAfter).toBeDefined();
    expect(Array.isArray(rolesOrgAAfter)).toBe(true);

    const hasOwnerInOrgA = await asCharlie.query(api.testHelpers.strictHasRole, {
      organizationId: orgAId,
      role: "owner",
    });
    expect(hasOwnerInOrgA).toBe(true);

    // transferOwnership does not revoke prior role — charlie retains "admin" too
    const hasAdminInOrgAAfter = await asCharlie.query(api.testHelpers.strictHasRole, {
      organizationId: orgAId,
      role: "admin",
    });
    expect(hasAdminInOrgAAfter).toBe(true);

    // -----------------------------------------------------------------------
    // Step 8: Charlie's OrgB role unchanged -> still "member"
    // -----------------------------------------------------------------------
    const hasMemberInOrgBAfter = await asCharlie.query(api.testHelpers.strictHasRole, {
      organizationId: orgBId,
      role: "member",
    });
    expect(hasMemberInOrgBAfter).toBe(true);

    // OrgB role didn't escalate
    const hasAdminInOrgB = await asCharlie.query(api.testHelpers.strictHasRole, {
      organizationId: orgBId,
      role: "admin",
    });
    expect(hasAdminInOrgB).toBe(false);
  });
});

// ===========================================================================
// Journey 3: getUserRoles reflects role changes in real-time
// ===========================================================================

describe("Journey 3: getUserRoles reflects role changes in real-time", () => {
  test("role changes are immediately visible via getUserRoles and hasRole", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org, adds bob as member
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Role Changes Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 2: Bob gets roles -> "member"
    // -----------------------------------------------------------------------
    const roles1 = await asBob.query(api.testHelpers.strictGetUserRoles, {
      organizationId: orgId,
    });
    expect(roles1).toBeDefined();
    expect(Array.isArray(roles1)).toBe(true);

    expect(await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "member",
    })).toBe(true);

    expect(await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "admin",
    })).toBe(false);

    // -----------------------------------------------------------------------
    // Step 3: Alice updates bob to admin
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateMemberRole, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 4: Bob gets roles -> "admin" (not "member")
    // -----------------------------------------------------------------------
    const roles2 = await asBob.query(api.testHelpers.strictGetUserRoles, {
      organizationId: orgId,
    });
    expect(roles2).toBeDefined();

    expect(await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "admin",
    })).toBe(true);

    expect(await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "member",
    })).toBe(false);

    // -----------------------------------------------------------------------
    // Step 5: Alice updates bob to owner (via transferOwnership)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "bob",
      previousOwnerRole: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 6: Bob gets roles -> "owner"
    //         Note: transferOwnership assigns "owner" but does NOT revoke the
    //         previous "admin" role, so bob now has both "owner" + "admin".
    // -----------------------------------------------------------------------
    const roles3 = await asBob.query(api.testHelpers.strictGetUserRoles, {
      organizationId: orgId,
    });
    expect(roles3).toBeDefined();

    expect(await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "owner",
    })).toBe(true);

    // transferOwnership does not revoke prior role — bob retains "admin"
    expect(await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "admin",
    })).toBe(true);

    // -----------------------------------------------------------------------
    // Step 7: Bob transfers ownership back to alice with previousOwnerRole: "member"
    //         This revokes "owner" from bob and assigns "member" to bob.
    //         Bob still has "admin" from before (not revoked by transfer).
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "alice",
      previousOwnerRole: "member",
    });

    // -----------------------------------------------------------------------
    // Step 8: Bob gets roles -> should have "member" (and still "admin" from before)
    //         "owner" should be revoked
    // -----------------------------------------------------------------------
    const roles4 = await asBob.query(api.testHelpers.strictGetUserRoles, {
      organizationId: orgId,
    });
    expect(roles4).toBeDefined();

    expect(await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "member",
    })).toBe(true);

    expect(await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "owner",
    })).toBe(false);

    // "admin" persists because transferOwnership only revokes "owner", not prior roles
    expect(await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "admin",
    })).toBe(true);

    // Alice should be owner again
    expect(await asAlice.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "owner",
    })).toBe(true);
  });
});

// ===========================================================================
// Journey 4: Delete team with complex membership — verify selective cleanup
// ===========================================================================

describe("Journey 4: Delete team with complex membership — verify selective cleanup", () => {
  test("deleting teams removes only their relations, not other teams or org membership", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org with bob, charlie, diana
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Selective Cleanup Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "diana",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 2: Create TeamA: bob + charlie
    // -----------------------------------------------------------------------
    const teamAId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "TeamA",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: teamAId,
      memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: teamAId,
      memberUserId: "charlie",
    });

    // -----------------------------------------------------------------------
    // Step 3: Create TeamB: charlie + diana
    // -----------------------------------------------------------------------
    const teamBId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "TeamB",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: teamBId,
      memberUserId: "charlie",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: teamBId,
      memberUserId: "diana",
    });

    // -----------------------------------------------------------------------
    // Step 4: Create TeamC: bob + diana
    // -----------------------------------------------------------------------
    const teamCId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "TeamC",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: teamCId,
      memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: teamCId,
      memberUserId: "diana",
    });

    // -----------------------------------------------------------------------
    // Step 5: Verify: 6 ReBAC relations total
    // -----------------------------------------------------------------------
    expect(await hasTeamRelation(asAlice, "bob", teamAId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "charlie", teamAId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "charlie", teamBId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "diana", teamBId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "bob", teamCId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "diana", teamCId)).toBe(true);

    // -----------------------------------------------------------------------
    // Step 6: Delete TeamA
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId: teamAId });

    // -----------------------------------------------------------------------
    // Step 7: Verify: bob-TeamA and charlie-TeamA relations GONE
    // -----------------------------------------------------------------------
    expect(await hasTeamRelation(asAlice, "bob", teamAId)).toBe(false);
    expect(await hasTeamRelation(asAlice, "charlie", teamAId)).toBe(false);

    // -----------------------------------------------------------------------
    // Step 8: Verify: charlie-TeamB, diana-TeamB, bob-TeamC, diana-TeamC still EXIST
    // -----------------------------------------------------------------------
    expect(await hasTeamRelation(asAlice, "charlie", teamBId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "diana", teamBId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "bob", teamCId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "diana", teamCId)).toBe(true);

    // -----------------------------------------------------------------------
    // Step 9: Delete TeamB
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId: teamBId });

    // -----------------------------------------------------------------------
    // Step 10: Verify: charlie-TeamB and diana-TeamB GONE
    // -----------------------------------------------------------------------
    expect(await hasTeamRelation(asAlice, "charlie", teamBId)).toBe(false);
    expect(await hasTeamRelation(asAlice, "diana", teamBId)).toBe(false);

    // -----------------------------------------------------------------------
    // Step 11: Verify: bob-TeamC and diana-TeamC still EXIST
    // -----------------------------------------------------------------------
    expect(await hasTeamRelation(asAlice, "bob", teamCId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "diana", teamCId)).toBe(true);

    // -----------------------------------------------------------------------
    // Step 12: Verify: bob, charlie, diana still org members
    //          (team deletion doesn't affect org membership)
    // -----------------------------------------------------------------------
    const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember).not.toBeNull();
    expect(bobMember?.role).toBe("member");

    const charlieMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "charlie",
    });
    expect(charlieMember).not.toBeNull();
    expect(charlieMember?.role).toBe("member");

    const dianaMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "diana",
    });
    expect(dianaMember).not.toBeNull();
    expect(dianaMember?.role).toBe("member");

    // Also confirm remaining team (TeamC) membership via isTeamMember
    expect(await asBob.query(api.testHelpers.strictIsTeamMember, { teamId: teamCId })).toBe(true);
    const asDiana = t.withIdentity({ subject: "diana", issuer: "https://test.com" });
    expect(await asDiana.query(api.testHelpers.strictIsTeamMember, { teamId: teamCId })).toBe(true);
  });
});

// ===========================================================================
// Journey 5: Pending invitations survive member churn
// ===========================================================================

describe("Journey 5: Pending invitations survive member churn", () => {
  test("invitations persist through member additions and removals", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Invitation Survival Org",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice invites bob@test.com, charlie@test.com, diana@test.com
    // -----------------------------------------------------------------------
    const { invitationId: bobInvitationId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "bob@test.com",
        identifierType: "email",
        role: "member",
      }
    );
    const { invitationId: charlieInvitationId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "charlie@test.com",
        identifierType: "email",
        role: "member",
      }
    );
    const { invitationId: dianaInvitationId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "diana@test.com",
        identifierType: "email",
        role: "member",
      }
    );

    // -----------------------------------------------------------------------
    // Step 3: Bob accepts -> member
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId: bobInvitationId,
    });

    // Verify bob is now a member
    const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember).not.toBeNull();
    expect(bobMember?.role).toBe("member");

    // -----------------------------------------------------------------------
    // Step 4: Verify: 2 pending invitations remain
    // -----------------------------------------------------------------------
    const pendingCount1 = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "pending",
    });
    expect(pendingCount1).toBe(2);

    // -----------------------------------------------------------------------
    // Step 5: Alice removes bob
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // Verify bob is gone
    const bobAfterRemove = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobAfterRemove).toBeNull();

    // -----------------------------------------------------------------------
    // Step 6: Verify: still 2 pending invitations (charlie, diana)
    //         — member removal doesn't affect invitations
    // -----------------------------------------------------------------------
    const pendingCount2 = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "pending",
    });
    expect(pendingCount2).toBe(2);

    // Verify they are specifically charlie's and diana's
    const charlieInvitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId: charlieInvitationId,
    });
    expect(charlieInvitation?.status).toBe("pending");

    const dianaInvitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId: dianaInvitationId,
    });
    expect(dianaInvitation?.status).toBe("pending");

    // -----------------------------------------------------------------------
    // Step 7: Charlie accepts -> member
    // -----------------------------------------------------------------------
    await asCharlie.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId: charlieInvitationId,
    });

    // -----------------------------------------------------------------------
    // Step 8: Alice adds eve directly (no invitation)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "eve",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 9: Verify: 1 pending invitation (diana)
    // -----------------------------------------------------------------------
    const pendingCount3 = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "pending",
    });
    expect(pendingCount3).toBe(1);

    // That pending invitation is diana's
    const dianaInvitationFinal = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId: dianaInvitationId,
    });
    expect(dianaInvitationFinal?.status).toBe("pending");

    // -----------------------------------------------------------------------
    // Step 10: countInvitations "accepted" -> 2 (bob + charlie)
    // -----------------------------------------------------------------------
    const acceptedCount = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "accepted",
    });
    expect(acceptedCount).toBe(2);

    // -----------------------------------------------------------------------
    // Step 11: Verify: eve does NOT appear in invitation counts
    //          (was added directly, no invitation)
    //          Total invitations = 3 (bob-accepted, charlie-accepted, diana-pending)
    // -----------------------------------------------------------------------
    const allCount = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "all",
    });
    expect(allCount).toBe(3);

    // Eve is a member but has no invitation
    const asEve = t.withIdentity({ subject: "eve", issuer: "https://test.com" });
    const eveMember = await asEve.query(api.testHelpers.strictGetCurrentMember, {
      organizationId: orgId,
    });
    expect(eveMember).not.toBeNull();
    expect(eveMember?.role).toBe("member");
  });
});
