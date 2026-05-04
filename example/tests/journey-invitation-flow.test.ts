import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("User Journey: Invitation Flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("Journey 1: Email invitation → accept → full member with permissions", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice signs up and creates "ACME Corp" (becomes owner)
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "ACME Corp",
    });
    expect(orgId).toBeDefined();

    // Step 2: Alice creates "Engineering" team
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });
    expect(teamId).toBeDefined();

    // Step 3: Alice invites bob@test.com as admin, assigned to Engineering team
    // (bob's getUser returns { email: "bob@test.com" }, so we must use that
    //  to match the validateInvitationAccept check)
    const { invitationId } = await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "bob@test.com",
      identifierType: "email",
      role: "admin",
      teamId,
    });
    expect(invitationId).toBeDefined();

    // Step 4: Verify invitation shows as pending in listInvitations
    const invitations = await asAlice.query(api.testHelpers.strictListInvitations, {
      organizationId: orgId,
    });
    expect(invitations).toHaveLength(1);
    expect(invitations[0].inviteeIdentifier).toBe("bob@test.com");
    expect(invitations[0].status).toBe("pending");
    expect(invitations[0].role).toBe("admin");
    expect(invitations[0].teamId).toBe(teamId);

    // Step 5: Verify bob@test.com shows in getPendingInvitations
    const pending = await asBob.query(api.testHelpers.strictGetPendingInvitations, {
      identifier: "bob@test.com",
    });
    expect(pending).toHaveLength(1);
    expect(pending[0].organizationName).toBe("ACME Corp");

    // Step 6: Bob accepts the invitation
    await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId,
    });

    // Step 7: Verify bob is now a member with role "admin"
    const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember).not.toBeNull();
    expect(bobMember?.role).toBe("admin");

    // Step 8: Verify bob is in the Engineering team (isTeamMember)
    const isInTeam = await asBob.query(api.testHelpers.strictIsTeamMember, {
      teamId,
    });
    expect(isInTeam).toBe(true);

    // Step 9: Verify bob has admin permissions ("members:add" → allowed)
    const canAddMembers = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "members:add",
    });
    expect(canAddMembers.allowed).toBe(true);

    // Step 10: Verify bob does NOT have owner-only permissions ("organizations:delete" → not allowed)
    const canDeleteOrg = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(canDeleteOrg.allowed).toBe(false);

    // Step 11: Verify invitation status is now "accepted"
    const acceptedInvitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId,
    });
    expect(acceptedInvitation?.status).toBe("accepted");

    // Step 12: Verify bob appears in listMembers
    const members = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    const bobInList = members.find((m: any) => m.userId === "bob");
    expect(bobInList).toBeDefined();
    expect(bobInList?.role).toBe("admin");
  });

  test("Journey 2: Invite → cancel → re-invite → accept", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

    // Step 1: Alice creates org
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Cancel-Reinvite Org",
    });

    // Step 2: Alice invites charlie@test.com as member
    const { invitationId: firstInvitationId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "charlie@test.com",
        identifierType: "email",
        role: "member",
      }
    );

    // Step 3: Alice cancels the invitation
    await asAlice.mutation(api.testHelpers.strictCancelInvitation, {
      invitationId: firstInvitationId,
    });

    // Step 4: Verify invitation status is "cancelled"
    const cancelledInvitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId: firstInvitationId,
    });
    expect(cancelledInvitation?.status).toBe("cancelled");

    // Step 5: Alice sends a new invitation to charlie@test.com (now as admin)
    const { invitationId: secondInvitationId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "charlie@test.com",
        identifierType: "email",
        role: "admin",
      }
    );
    expect(secondInvitationId).not.toBe(firstInvitationId);

    // Step 6: Charlie accepts the new invitation
    await asCharlie.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId: secondInvitationId,
    });

    // Step 7: Verify charlie is member with role "admin" (not the original "member" role)
    const charlieMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "charlie",
    });
    expect(charlieMember).not.toBeNull();
    expect(charlieMember?.role).toBe("admin");

    // Verify the second invitation is now "accepted"
    const acceptedInvitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId: secondInvitationId,
    });
    expect(acceptedInvitation?.status).toBe("accepted");
  });

  test("Journey 3: Invitation with validation rejection", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Step 1-2: Use the apiWithValidateCreate that rejects non-email identifiers; Alice creates org
    const orgId = await asAlice.mutation(api.testHelpers.validateCreateOrg, {
      name: "Validation Org",
    });

    // Step 3: Alice tries to invite "bad_username" (no @) → should be rejected
    await expect(
      asAlice.mutation(api.testHelpers.validateCreateInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "bad_username",
        identifierType: "username",
        role: "member",
      })
    ).rejects.toThrow("Only email identifiers are allowed");

    // Step 4: Alice invites "good@example.com" → should succeed
    const { invitationId } = await asAlice.mutation(
      api.testHelpers.validateCreateInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "good@example.com",
        identifierType: "email",
        role: "member",
      }
    );
    expect(invitationId).toBeDefined();

    // Step 5: Verify only the good invitation exists
    const invitations = await asAlice.query(api.testHelpers.strictListInvitations, {
      organizationId: orgId,
    });
    expect(invitations).toHaveLength(1);
    expect(invitations[0].inviteeIdentifier).toBe("good@example.com");
    expect(invitations[0].status).toBe("pending");
  });

  test("Journey 4: Resend invitation", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice creates org, invites bob@test.com
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Resend Journey Org",
    });

    const { invitationId } = await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "bob@test.com",
      identifierType: "email",
      role: "member",
    });

    // Capture original expiresAt
    const originalInvitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId,
    });
    expect(originalInvitation).not.toBeNull();
    const originalExpiresAt = originalInvitation!.expiresAt;

    // Step 2: Advance time by 1 hour, then Alice resends the invitation
    vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour

    await asAlice.mutation(api.testHelpers.strictResendInvitation, {
      invitationId,
    });

    // Step 3: Verify invitation still pending, expiresAt is updated
    const resentInvitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId,
    });
    expect(resentInvitation).not.toBeNull();
    expect(resentInvitation!.status).toBe("pending");
    expect(resentInvitation!.expiresAt).toBeGreaterThan(originalExpiresAt);

    // Step 4: Bob accepts
    await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId,
    });

    // Step 5: Verify bob is a member
    const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember).not.toBeNull();
    expect(bobMember?.role).toBe("member");

    // Verify invitation is now accepted
    const finalInvitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId,
    });
    expect(finalInvitation?.status).toBe("accepted");
  });

  test("Journey 5: Invite → decline → re-invite → accept", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice creates org
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Decline Flow Corp",
    });

    // Step 2: Alice invites Bob as member
    const { invitationId: firstInvId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "bob@test.com",
        identifierType: "email",
        role: "member",
      }
    );

    // Step 3: Bob declines the invitation
    await asBob.mutation(api.testHelpers.strictDeclineInvitation, {
      invitationId: firstInvId,
    });

    // Verify: invitation is declined
    const declinedInv = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId: firstInvId,
    });
    expect(declinedInv?.status).toBe("declined");

    // Verify: Bob is NOT a member
    const membersAfterDecline = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(membersAfterDecline.find((m: any) => m.userId === "bob")).toBeUndefined();

    // Step 4: Alice re-invites Bob (as admin this time)
    const { invitationId: secondInvId } = await asAlice.mutation(
      api.testHelpers.strictInviteMember,
      {
        organizationId: orgId,
        inviteeIdentifier: "bob@test.com",
        identifierType: "email",
        role: "admin",
      }
    );
    expect(secondInvId).toBeDefined();
    expect(secondInvId).not.toBe(firstInvId);

    // Step 5: Bob accepts the second invitation
    await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId: secondInvId,
    });

    // Verify: Bob is now a member with admin role
    const membersAfterAccept = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    const bob = membersAfterAccept.find((m: any) => m.userId === "bob");
    expect(bob).toBeDefined();
    expect(bob.role).toBe("admin");

    // Verify: first invitation still declined, second accepted
    const inv1 = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId: firstInvId,
    });
    const inv2 = await asAlice.query(api.testHelpers.strictGetInvitation, {
      invitationId: secondInvId,
    });
    expect(inv1?.status).toBe("declined");
    expect(inv2?.status).toBe("accepted");

    // Verify: Bob (now admin) can list members
    const bobsView = await asBob.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(bobsView.length).toBeGreaterThanOrEqual(2);
  });
});
