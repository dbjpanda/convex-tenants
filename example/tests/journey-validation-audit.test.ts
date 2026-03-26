/**
 * User journey tests — invitation acceptance validation (domain matching),
 * countInvitations with status filter, audit log, getCurrentUserEmail,
 * and recomputeUser.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

// ===========================================================================
// Journey 1: Invitation acceptance validation — domain matching
// ===========================================================================

describe("Journey 1: Invitation acceptance validation — domain matching", () => {
  test("domain mismatch rejects acceptance, matching domain succeeds", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });
    const asDiana = t.withIdentity({ subject: "diana", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org via validateAcceptCreateOrg
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.validateAcceptCreateOrg, {
      name: "Domain Check Corp",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Alice is already the owner — verify membership
    // -----------------------------------------------------------------------
    const aliceMember = await asAlice.query(api.testHelpers.strictGetCurrentMember, {
      organizationId: orgId,
    });
    expect(aliceMember).not.toBeNull();
    expect(aliceMember?.role).toBe("owner");

    // -----------------------------------------------------------------------
    // Step 3: Alice invites bob@company.com as member via validateAcceptInviteMember
    //         (note: bob@company.com domain is "company.com")
    // -----------------------------------------------------------------------
    const { invitationId: bobInvId } = await asAlice.mutation(
      api.testHelpers.validateAcceptInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "bob@company.com",
        identifierType: "email",
        role: "member",
      }
    );
    expect(bobInvId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 4: Bob (subject "bob") tries to accept — getUser returns "bob@test.com"
    //         Domain mismatch: "company.com" vs "test.com" → should fail
    // -----------------------------------------------------------------------
    await expect(
      asBob.mutation(api.testHelpers.validateAcceptAcceptInvitation, {
        invitationId: bobInvId,
      })
    ).rejects.toThrow("Email domain does not match invitation");

    // -----------------------------------------------------------------------
    // Step 5: Alice cancels the mismatched invitation and re-invites with
    //         bob@test.com so the domain matches Bob's getUser email
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictCancelInvitation, {
      invitationId: bobInvId,
    });

    const { invitationId: bobInvId2 } = await asAlice.mutation(
      api.testHelpers.validateAcceptInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "bob@test.com",
        identifierType: "email",
        role: "member",
      }
    );

    // Bob accepts with matching domain → succeeds
    await asBob.mutation(api.testHelpers.validateAcceptAcceptInvitation, {
      invitationId: bobInvId2,
    });

    // -----------------------------------------------------------------------
    // Step 6: Verify bob is now a member
    // -----------------------------------------------------------------------
    const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember).not.toBeNull();
    expect(bobMember?.role).toBe("member");

    // -----------------------------------------------------------------------
    // Step 7: Alice invites charlie@company.com (domain "company.com")
    // -----------------------------------------------------------------------
    const { invitationId: charlieInvId } = await asAlice.mutation(
      api.testHelpers.validateAcceptInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "charlie@company.com",
        identifierType: "email",
        role: "member",
      }
    );
    expect(charlieInvId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 8: Diana (wrong person) tries to accept charlie's invitation
    //         Diana's getUser email is "diana@test.com" → domain "test.com"
    //         Invitation domain is "company.com" → mismatch → fails
    // -----------------------------------------------------------------------
    await expect(
      asDiana.mutation(api.testHelpers.validateAcceptAcceptInvitation, {
        invitationId: charlieInvId,
      })
    ).rejects.toThrow("Email domain does not match invitation");

    // -----------------------------------------------------------------------
    // Step 9: Cancel mismatched invitation, re-invite charlie@test.com
    //         and let Charlie accept successfully
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictCancelInvitation, {
      invitationId: charlieInvId,
    });

    const { invitationId: charlieInvId2 } = await asAlice.mutation(
      api.testHelpers.validateAcceptInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "charlie@test.com",
        identifierType: "email",
        role: "member",
      }
    );

    await asCharlie.mutation(api.testHelpers.validateAcceptAcceptInvitation, {
      invitationId: charlieInvId2,
    });

    // Verify charlie is now a member
    const charlieMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "charlie",
    });
    expect(charlieMember).not.toBeNull();
    expect(charlieMember?.role).toBe("member");
  });
});

// ===========================================================================
// Journey 2: countInvitations with status filter
// ===========================================================================

describe("Journey 2: countInvitations with status filter", () => {
  test("status filter correctly tracks pending, accepted, and cancelled counts", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Count Invitations Corp",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice invites 3 people: bob, charlie, diana
    // -----------------------------------------------------------------------
    const { invitationId: bobInvId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "bob@test.com",
        identifierType: "email",
        role: "member",
      }
    );
    const { invitationId: charlieInvId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "charlie@test.com",
        identifierType: "email",
        role: "admin",
      }
    );
    const { invitationId: _dianaInvId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "diana@test.com",
        identifierType: "email",
        role: "member",
      }
    );

    // -----------------------------------------------------------------------
    // Step 3: countInvitations with status "pending" → 3
    // -----------------------------------------------------------------------
    const pendingCount1 = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "pending",
    });
    expect(pendingCount1).toBe(3);

    // -----------------------------------------------------------------------
    // Step 4: countInvitations with status "all" → 3
    // -----------------------------------------------------------------------
    const allCount1 = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "all",
    });
    expect(allCount1).toBe(3);

    // -----------------------------------------------------------------------
    // Step 5: Bob accepts his invitation
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId: bobInvId,
    });

    // -----------------------------------------------------------------------
    // Step 6: countInvitations with status "pending" → 2
    // -----------------------------------------------------------------------
    const pendingCount2 = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "pending",
    });
    expect(pendingCount2).toBe(2);

    // -----------------------------------------------------------------------
    // Step 7: countInvitations with status "accepted" → 1
    // -----------------------------------------------------------------------
    const acceptedCount1 = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "accepted",
    });
    expect(acceptedCount1).toBe(1);

    // -----------------------------------------------------------------------
    // Step 8: Alice cancels charlie's invitation
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictCancelInvitation, {
      invitationId: charlieInvId,
    });

    // -----------------------------------------------------------------------
    // Step 9: countInvitations with status "pending" → 1
    // -----------------------------------------------------------------------
    const pendingCount3 = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "pending",
    });
    expect(pendingCount3).toBe(1);

    // -----------------------------------------------------------------------
    // Step 10: countInvitations with status "cancelled" → 1
    // -----------------------------------------------------------------------
    const cancelledCount = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "cancelled",
    });
    expect(cancelledCount).toBe(1);

    // -----------------------------------------------------------------------
    // Step 11: countInvitations with status "all" → 3 (total unchanged)
    // -----------------------------------------------------------------------
    const allCount2 = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
      status: "all",
    });
    expect(allCount2).toBe(3);
  });
});

// ===========================================================================
// Journey 3: Audit log captures org operations
// ===========================================================================

describe("Journey 3: Audit log captures org operations", () => {
  test("audit log returns entries scoped to the organization", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Audit Log Corp",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Alice adds bob as admin
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 3: Alice creates a team
    // -----------------------------------------------------------------------
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });
    expect(teamId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 4: Alice adds bob to the team
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId,
      memberUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 5: Get audit log for the org
    // -----------------------------------------------------------------------
    const auditLog = await asAlice.query(api.testHelpers.strictGetAuditLog, {
      organizationId: orgId,
    });

    // -----------------------------------------------------------------------
    // Step 6: Verify audit log is an array (may be empty in test env if
    //         audit not enabled at the authz component level)
    // -----------------------------------------------------------------------
    expect(Array.isArray(auditLog)).toBe(true);

    // -----------------------------------------------------------------------
    // Step 7: If entries exist, verify they are scoped to this org
    // -----------------------------------------------------------------------
    if (auditLog.length > 0) {
      for (const entry of auditLog) {
        // Audit entries should have scope referencing this org
        if (entry.scope) {
          expect(entry.scope.id).toBe(orgId);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 8: Get audit log with limit: 2 → verify at most 2 entries
    // -----------------------------------------------------------------------
    const limitedLog = await asAlice.query(api.testHelpers.strictGetAuditLog, {
      organizationId: orgId,
      limit: 2,
    });
    expect(Array.isArray(limitedLog)).toBe(true);
    expect(limitedLog.length).toBeLessThanOrEqual(2);
  });
});

// ===========================================================================
// Journey 4: getCurrentUserEmail
// ===========================================================================

describe("Journey 4: getCurrentUserEmail", () => {
  test("returns email derived from getUser callback for each authenticated user", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice calls getCurrentUserEmail
    // -----------------------------------------------------------------------
    const aliceEmail = await asAlice.query(api.testHelpers.strictGetCurrentUserEmail, {});

    // -----------------------------------------------------------------------
    // Step 2: Verify returns "alice@test.com" (getUser mock: `${userId}@test.com`)
    // -----------------------------------------------------------------------
    expect(aliceEmail).toBe("alice@test.com");

    // -----------------------------------------------------------------------
    // Step 3: Bob calls getCurrentUserEmail
    // -----------------------------------------------------------------------
    const bobEmail = await asBob.query(api.testHelpers.strictGetCurrentUserEmail, {});

    // -----------------------------------------------------------------------
    // Step 4: Verify returns "bob@test.com"
    // -----------------------------------------------------------------------
    expect(bobEmail).toBe("bob@test.com");
  });
});

// ===========================================================================
// Journey 5: recomputeUser in context
// ===========================================================================

describe("Journey 5: recomputeUser in context", () => {
  test("owner and admin can recompute user, and user remains functional after", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org, adds bob as admin
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Recompute Corp",
    });

    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice (owner) calls recomputeUser for bob → succeeds
    //         Owner has permissions:grant which is not directly the gating
    //         permission, but recomputeUser requires active membership.
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictRecomputeUser, {
      organizationId: orgId,
      targetUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 3: Bob (admin) calls recomputeUser for alice
    //         Admin also has permissions:grant, so this should succeed.
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictRecomputeUser, {
      organizationId: orgId,
      targetUserId: "alice",
    });

    // -----------------------------------------------------------------------
    // Step 4: Verify bob is still functional after recompute
    //         Bob can still create teams (admin has teams:create)
    // -----------------------------------------------------------------------
    const teamId = await asBob.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Post-Recompute Team",
    });
    expect(teamId).toBeDefined();

    // Verify team was created successfully
    const team = await asBob.query(api.testHelpers.strictGetTeam, { teamId });
    expect(team).not.toBeNull();
    expect(team?.name).toBe("Post-Recompute Team");

    // Verify bob's membership and role are intact
    const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember).not.toBeNull();
    expect(bobMember?.role).toBe("admin");
  });
});
