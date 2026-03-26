/**
 * User journey tests — organization status and onboarding flows.
 *
 * Journey 1: Complete SaaS onboarding — new company gets set up
 * Journey 2: Organization suspension — everything freezes
 * Journey 3: Organization archival — permanent freeze
 * Journey 4: Member self-service — a day in the life
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

// ===========================================================================
// Journey 1: Complete SaaS onboarding — new company gets set up
// ===========================================================================

describe("Journey 1: Complete SaaS onboarding — new company gets set up", () => {
  test("full onboarding: create org, configure, invite team, verify permissions", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });
    const asDiana = t.withIdentity({ subject: "diana", issuer: "https://test.com" });
    const asEve = t.withIdentity({ subject: "eve", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice signs up and creates "TechStartup" org
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "TechStartup",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Verify org is active with default settings
    // -----------------------------------------------------------------------
    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org).not.toBeNull();
    expect(org?.name).toBe("TechStartup");
    expect(org?.status).toBe("active");

    // -----------------------------------------------------------------------
    // Step 3: Alice updates org with metadata: { plan: "pro", industry: "saas" }
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      metadata: { plan: "pro", industry: "saas" },
    });

    const orgAfterMeta = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(orgAfterMeta?.metadata).toEqual({ plan: "pro", industry: "saas" });

    // -----------------------------------------------------------------------
    // Step 4: Alice updates org settings
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      settings: { allowPublicSignup: false, requireInvitationToJoin: true },
    });

    const orgAfterSettings = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(orgAfterSettings?.settings).toEqual({
      allowPublicSignup: false,
      requireInvitationToJoin: true,
    });

    // -----------------------------------------------------------------------
    // Step 5: Alice creates 3 teams: Engineering, Design, Marketing
    // -----------------------------------------------------------------------
    const engineeringId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });
    const designId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Design",
    });
    const marketingId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Marketing",
    });
    expect(engineeringId).toBeDefined();
    expect(designId).toBeDefined();
    expect(marketingId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 6: Alice invites bob@test.com as admin (for Engineering lead)
    // -----------------------------------------------------------------------
    const { invitationId: bobInvId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "bob@test.com",
        identifierType: "email",
        role: "admin",
        teamId: engineeringId,
      }
    );
    expect(bobInvId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 7: Alice invites charlie@test.com as member (for Design)
    // -----------------------------------------------------------------------
    const { invitationId: charlieInvId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "charlie@test.com",
        identifierType: "email",
        role: "member",
        teamId: designId,
      }
    );
    expect(charlieInvId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 8: Alice invites diana@test.com as member (for Marketing)
    // -----------------------------------------------------------------------
    const { invitationId: dianaInvId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "diana@test.com",
        identifierType: "email",
        role: "member",
        teamId: marketingId,
      }
    );
    expect(dianaInvId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 9: Bob accepts, gets added to Engineering team
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId: bobInvId,
    });

    const bobInEngineering = await asBob.query(api.testHelpers.strictIsTeamMember, {
      teamId: engineeringId,
    });
    expect(bobInEngineering).toBe(true);

    // -----------------------------------------------------------------------
    // Step 10: Charlie accepts, gets added to Design team
    // -----------------------------------------------------------------------
    await asCharlie.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId: charlieInvId,
    });

    const charlieInDesign = await asCharlie.query(api.testHelpers.strictIsTeamMember, {
      teamId: designId,
    });
    expect(charlieInDesign).toBe(true);

    // -----------------------------------------------------------------------
    // Step 11: Diana accepts, gets added to Marketing team
    // -----------------------------------------------------------------------
    await asDiana.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId: dianaInvId,
    });

    const dianaInMarketing = await asDiana.query(api.testHelpers.strictIsTeamMember, {
      teamId: marketingId,
    });
    expect(dianaInMarketing).toBe(true);

    // -----------------------------------------------------------------------
    // Step 12: Verify final state: 4 members, 3 teams, each person in correct team
    // -----------------------------------------------------------------------
    const memberCount = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
    });
    expect(memberCount).toBe(4); // alice + bob + charlie + diana

    const teamCount = await asAlice.query(api.testHelpers.strictCountTeams, {
      organizationId: orgId,
    });
    expect(teamCount).toBe(3);

    // Verify each person is in the correct team
    expect(
      await asBob.query(api.testHelpers.strictIsTeamMember, { teamId: engineeringId })
    ).toBe(true);
    expect(
      await asCharlie.query(api.testHelpers.strictIsTeamMember, { teamId: designId })
    ).toBe(true);
    expect(
      await asDiana.query(api.testHelpers.strictIsTeamMember, { teamId: marketingId })
    ).toBe(true);

    // -----------------------------------------------------------------------
    // Step 13: Verify bob (admin) can add members, charlie (member) cannot
    // -----------------------------------------------------------------------
    const bobCanAdd = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "members:add",
    });
    expect(bobCanAdd.allowed).toBe(true);

    const charlieCanAdd = await asCharlie.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "members:add",
    });
    expect(charlieCanAdd.allowed).toBe(false);

    // -----------------------------------------------------------------------
    // Step 14: Bob adds eve as member (admin privilege)
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "eve",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 15: Verify 5 members total
    // -----------------------------------------------------------------------
    const finalMemberCount = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
    });
    expect(finalMemberCount).toBe(5); // alice + bob + charlie + diana + eve
  });
});

// ===========================================================================
// Journey 2: Organization suspension — everything freezes
// ===========================================================================

describe("Journey 2: Organization suspension — everything freezes", () => {
  test("suspended org blocks mutations but allows queries, reactivation restores", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org, adds bob as admin, charlie as member
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Suspension Corp",
    });
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

    // -----------------------------------------------------------------------
    // Step 2: Alice creates a team, adds bob
    // -----------------------------------------------------------------------
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Alpha Team",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId,
      memberUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 3: Alice suspends the org
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      status: "suspended",
    });

    const suspendedOrg = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(suspendedOrg?.status).toBe("suspended");

    // -----------------------------------------------------------------------
    // Step 4: Bob tries to create a team -> fails (org suspended)
    // -----------------------------------------------------------------------
    await expect(
      asBob.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "New Team",
      })
    ).rejects.toThrow("Organization is suspended");

    // -----------------------------------------------------------------------
    // Step 5: Bob tries to add a member -> fails (org suspended)
    // -----------------------------------------------------------------------
    await expect(
      asBob.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "dave",
        role: "member",
      })
    ).rejects.toThrow("Organization is suspended");

    // -----------------------------------------------------------------------
    // Step 6: Alice tries to invite someone -> fails (org suspended)
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "dave@test.com",
        identifierType: "email",
        role: "member",
      })
    ).rejects.toThrow("Organization is suspended");

    // -----------------------------------------------------------------------
    // Step 7: Verify queries still work (listMembers works for suspended org)
    // -----------------------------------------------------------------------
    const members = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(members).toHaveLength(3); // alice + bob + charlie

    // -----------------------------------------------------------------------
    // Step 8: Alice reactivates the org
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      status: "active",
    });

    const reactivatedOrg = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(reactivatedOrg?.status).toBe("active");

    // -----------------------------------------------------------------------
    // Step 9: Bob can now create a team again (org active)
    // -----------------------------------------------------------------------
    const newTeamId = await asBob.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Reactivated Team",
    });
    expect(newTeamId).toBeDefined();
  });
});

// ===========================================================================
// Journey 3: Organization archival — permanent freeze
// ===========================================================================

describe("Journey 3: Organization archival — permanent freeze", () => {
  test("archived org blocks all mutations but allows queries", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org, adds bob
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Archive Corp",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice archives the org
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      status: "archived",
    });

    const archivedOrg = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(archivedOrg?.status).toBe("archived");

    // -----------------------------------------------------------------------
    // Step 3: Bob tries to add member -> fails
    // -----------------------------------------------------------------------
    await expect(
      asBob.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "charlie",
        role: "member",
      })
    ).rejects.toThrow("Organization is archived");

    // -----------------------------------------------------------------------
    // Step 4: Alice tries to update org name -> fails (archived orgs can't be modified)
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
        organizationId: orgId,
        name: "New Name",
      })
    ).rejects.toThrow("Organization is archived");

    // -----------------------------------------------------------------------
    // Step 5: Verify members still queryable (listMembers works)
    // -----------------------------------------------------------------------
    const members = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(members).toHaveLength(2); // alice + bob

    const bobMember = members.find((m: any) => m.userId === "bob");
    expect(bobMember).toBeDefined();
    expect(bobMember?.role).toBe("admin");
  });
});

// ===========================================================================
// Journey 4: Member self-service — a day in the life
// ===========================================================================

describe("Journey 4: Member self-service — a day in the life", () => {
  test("member checks permissions, creates teams, adds members, then leaves", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org, creates Engineering team
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "SelfService Inc",
    });
    const engineeringId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice invites bob@test.com as admin to Engineering team
    // -----------------------------------------------------------------------
    const { invitationId } = await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "bob@test.com",
      identifierType: "email",
      role: "admin",
      teamId: engineeringId,
    });

    // -----------------------------------------------------------------------
    // Step 3: Bob accepts invitation
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId,
    });

    // -----------------------------------------------------------------------
    // Step 4: Bob checks his own membership: getCurrentMember -> confirms admin role
    // -----------------------------------------------------------------------
    const bobMember = await asBob.query(api.testHelpers.strictGetCurrentMember, {
      organizationId: orgId,
    });
    expect(bobMember).not.toBeNull();
    expect(bobMember?.role).toBe("admin");

    // -----------------------------------------------------------------------
    // Step 5: Bob checks his permissions: getUserPermissions -> lists admin permissions
    // -----------------------------------------------------------------------
    const bobPerms = await asBob.query(api.testHelpers.strictGetUserPermissions, {
      organizationId: orgId,
    });
    expect(bobPerms).toBeDefined();
    expect(Array.isArray(bobPerms)).toBe(true);
    // getUserPermissions returns objects with { effect, permission, ... }
    const permNames = bobPerms.map((p: any) => p.permission);
    // Admin should have members:add and teams:create
    expect(permNames).toContain("members:add");
    expect(permNames).toContain("teams:create");

    // -----------------------------------------------------------------------
    // Step 6: Bob checks a specific role: hasRole("admin") -> true
    // -----------------------------------------------------------------------
    const isAdmin = await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "admin",
    });
    expect(isAdmin).toBe(true);

    // -----------------------------------------------------------------------
    // Step 7: Bob creates a sub-team "Backend" under Engineering
    // -----------------------------------------------------------------------
    const backendId = await asBob.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Backend",
      parentTeamId: engineeringId,
    });
    expect(backendId).toBeDefined();

    // Verify the team exists and has the correct parent
    const backendTeam = await asBob.query(api.testHelpers.strictGetTeam, {
      teamId: backendId,
    });
    expect(backendTeam?.name).toBe("Backend");
    expect(backendTeam?.parentTeamId).toBe(engineeringId);

    // -----------------------------------------------------------------------
    // Step 8: Bob adds charlie as member to the org
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 9: Bob adds charlie to Backend team
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: backendId,
      memberUserId: "charlie",
    });

    // -----------------------------------------------------------------------
    // Step 10: Bob checks: isTeamMember for charlie in Backend -> true
    // -----------------------------------------------------------------------
    const charlieInBackend = await asCharlie.query(api.testHelpers.strictIsTeamMember, {
      teamId: backendId,
    });
    expect(charlieInBackend).toBe(true);

    // -----------------------------------------------------------------------
    // Step 11: Bob decides to leave the company: leaveOrganization
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
      organizationId: orgId,
    });

    // -----------------------------------------------------------------------
    // Step 12: Verify bob is gone from org and all teams
    // -----------------------------------------------------------------------
    const bobAfterLeave = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobAfterLeave).toBeNull();

    // Bob should be gone from Engineering team
    const engineeringMembers = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId: engineeringId,
    });
    const bobInEngineering = engineeringMembers.find((m: any) => m.userId === "bob");
    expect(bobInEngineering).toBeUndefined();

    // Bob should be gone from Backend team
    const backendMembers = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId: backendId,
    });
    const bobInBackend = backendMembers.find((m: any) => m.userId === "bob");
    expect(bobInBackend).toBeUndefined();

    // -----------------------------------------------------------------------
    // Step 13: Verify charlie still exists in org and Backend team
    // -----------------------------------------------------------------------
    const charlieAfterBobLeft = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "charlie",
    });
    expect(charlieAfterBobLeft).not.toBeNull();
    expect(charlieAfterBobLeft?.role).toBe("member");

    const charlieStillInBackend = await asCharlie.query(api.testHelpers.strictIsTeamMember, {
      teamId: backendId,
    });
    expect(charlieStillInBackend).toBe(true);
  });
});
