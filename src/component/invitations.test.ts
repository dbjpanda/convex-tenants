import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";
import { api, internal } from "./_generated/api.js";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts")
  )
);

function createTestInstance() {
  return convexTest(schema, modules);
}

describe("invitations", () => {
  it("should create an invitation", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const result = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "newuser@example.com",
      identifierType: "email",
      role: "member",
    });

    expect(result.invitationId).toBeDefined();
    expect(result.inviteeIdentifier).toBe("newuser@example.com");
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should list pending invitations for organization", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "user1@example.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "user2@example.com",
      identifierType: "email",
      role: "admin",
    });

    const invitations = await t.query(api.invitations.listInvitations, {
      organizationId: orgId,
    });

    const invitationList = invitations as { inviteeIdentifier: string }[];
    expect(invitationList).toHaveLength(2);
    expect(invitationList.map((i) => i.inviteeIdentifier)).toContain("user1@example.com");
    expect(invitationList.map((i) => i.inviteeIdentifier)).toContain("user2@example.com");
  });

  it("should prevent duplicate pending invitations", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "user@example.com",
      identifierType: "email",
      role: "member",
    });

    await expect(
      t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "user@example.com",
        identifierType: "email",
        role: "admin",
      })
    ).rejects.toThrow();
  });

  it("should accept invitation and add member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "newuser@example.com",
      identifierType: "email",
      role: "admin",
    });

    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "user_456",
      acceptingUserIdentifier: "newuser@example.com",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member).not.toBeNull();
    expect(member?.role).toBe("admin");

    const invitation = await t.query(api.invitations.getInvitation, {
      invitationId,
    });
    expect(invitation?.status).toBe("accepted");
  });

  it("should cancel invitation", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "newuser@example.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.invitations.cancelInvitation, {
      userId: "user_123",
      invitationId,
    });

    const invitation = await t.query(api.invitations.getInvitation, {
      invitationId,
    });
    expect(invitation?.status).toBe("cancelled");
  });

  it("should prevent accepting already accepted invitation", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "newuser@example.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "user_456",
      acceptingUserIdentifier: "newuser@example.com",
    });

    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "user_789",
        acceptingUserIdentifier: "newuser@example.com",
      })
    ).rejects.toThrow();
  });

  it("should get pending invitations for email", async () => {
    const t = createTestInstance();

    const org1Id = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Org One",
      slug: "org-one",
    });

    const org2Id = await t.mutation(api.organizations.createOrganization, {
      userId: "user_456",
      name: "Org Two",
      slug: "org-two",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: org1Id,
      inviteeIdentifier: "target@example.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_456",
      organizationId: org2Id,
      inviteeIdentifier: "target@example.com",
      identifierType: "email",
      role: "admin",
    });

    const pendingInvites = await t.query(
      api.invitations.getPendingInvitationsForIdentifier,
      { identifier: "target@example.com" }
    );

    expect(pendingInvites).toHaveLength(2);
  });

  it("should include team in invitation acceptance", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "engineer@example.com",
      identifierType: "email",
      role: "member",
      teamId,
    });

    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "user_456",
      acceptingUserIdentifier: "engineer@example.com",
    });

    const isTeamMember = await t.query(api.teams.isTeamMember, {
      teamId,
      userId: "user_456",
    });

    expect(isTeamMember).toBe(true);
  });

  it("acceptInvitation throws for nonexistent invitation", async () => {
    const t = createTestInstance();

    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId: "nonexistent" as any,
        acceptingUserId: "bob",
      })
    ).rejects.toThrow("Invitation not found");
  });

  it("acceptInvitation throws for already accepted invitation", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "bob@test.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "bob",
      acceptingUserIdentifier: "bob@test.com",
    });

    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "charlie",
        acceptingUserIdentifier: "bob@test.com",
      })
    ).rejects.toThrow("Invitation has already been accepted");
  });

  it("acceptInvitation throws for expired invitation", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "expired@test.com",
      identifierType: "email",
      role: "member",
      expiresAt: Date.now() - 1000,
    });

    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "bob",
      })
    ).rejects.toThrow("Invitation has expired");
  });

  it("resendInvitation throws for nonexistent invitation", async () => {
    const t = createTestInstance();

    await expect(
      t.mutation(api.invitations.resendInvitation, {
        userId: "user_123",
        invitationId: "nonexistent" as any,
      })
    ).rejects.toThrow("Invitation not found");
  });

  it("resendInvitation throws for cancelled invitation", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "cancel@test.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.invitations.cancelInvitation, {
      userId: "user_123",
      invitationId,
    });

    await expect(
      t.mutation(api.invitations.resendInvitation, {
        userId: "user_123",
        invitationId,
      })
    ).rejects.toThrow("Cannot resend cancelled invitation");
  });

  it("resendInvitation throws for expired invitation", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "expired@test.com",
      identifierType: "email",
      role: "member",
      expiresAt: Date.now() - 1000,
    });

    await expect(
      t.mutation(api.invitations.resendInvitation, {
        userId: "user_123",
        invitationId,
      })
    ).rejects.toThrow("Invitation has expired");
  });

  it("cancelInvitation throws for nonexistent invitation", async () => {
    const t = createTestInstance();

    await expect(
      t.mutation(api.invitations.cancelInvitation, {
        userId: "user_123",
        invitationId: "nonexistent" as any,
      })
    ).rejects.toThrow("Invitation not found");
  });

  it("cancelInvitation throws for already cancelled invitation", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "double-cancel@test.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.invitations.cancelInvitation, {
      userId: "user_123",
      invitationId,
    });

    await expect(
      t.mutation(api.invitations.cancelInvitation, {
        userId: "user_123",
        invitationId,
      })
    ).rejects.toThrow("Invitation has already been cancelled");
  });

  it("should count invitations for organization", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "user1@example.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "user2@example.com",
      identifierType: "email",
      role: "admin",
    });

    const count = await t.query(api.invitations.countInvitations, {
      organizationId: orgId,
    });

    expect(count).toBe(2);
  });

  it("countInvitations returns 0 for org with no invitations", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const count = await t.query(api.invitations.countInvitations, {
      organizationId: orgId,
    });

    expect(count).toBe(0);
  });

  it("should bulk invite members", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const result = await t.mutation(api.invitations.bulkInviteMembers, {
      userId: "user_123",
      organizationId: orgId,
      invitations: [
        { inviteeIdentifier: "alice@example.com", identifierType: "email", role: "member" },
        { inviteeIdentifier: "bob@example.com", identifierType: "email", role: "admin" },
        { inviteeIdentifier: "carol@example.com", identifierType: "email", role: "member" },
      ],
    });

    expect(result.success).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(result.success.map((s: any) => s.inviteeIdentifier)).toContain("alice@example.com");
    expect(result.success.map((s: any) => s.inviteeIdentifier)).toContain("bob@example.com");
    expect(result.success.map((s: any) => s.inviteeIdentifier)).toContain("carol@example.com");

    const count = await t.query(api.invitations.countInvitations, {
      organizationId: orgId,
    });
    expect(count).toBe(3);
  });

  it("bulkInviteMembers reports errors for duplicate invitations", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "existing@example.com",
      identifierType: "email",
      role: "member",
    });

    const result = await t.mutation(api.invitations.bulkInviteMembers, {
      userId: "user_123",
      organizationId: orgId,
      invitations: [
        { inviteeIdentifier: "existing@example.com", identifierType: "email", role: "admin" },
        { inviteeIdentifier: "new@example.com", identifierType: "email", role: "member" },
      ],
    });

    expect(result.success).toHaveLength(1);
    expect(result.success[0].inviteeIdentifier).toBe("new@example.com");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].inviteeIdentifier).toBe("existing@example.com");
    expect(result.errors[0].code).toBe("ALREADY_EXISTS");
  });

  it("acceptInvitation rejects when identifier does not match", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Identifier Mismatch Org",
      slug: "id-mismatch-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "alice@example.com",
      identifierType: "email",
      role: "member",
    });

    // Wrong identifier — should be rejected
    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "bob",
        acceptingUserIdentifier: "bob@other.com",
      })
    ).rejects.toThrow("Invitation identifier does not match the accepting user");
  });

  it("acceptInvitation rejects when identifier is missing", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Missing Identifier Org",
      slug: "missing-id-org",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      inviteeIdentifier: "alice@example.com",
      identifierType: "email",
      role: "member",
    });

    // No identifier provided — should be rejected
    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "bob",
      })
    ).rejects.toThrow("acceptingUserIdentifier is required to accept this invitation");
  });

  // ==========================================================================
  // trustedSkipToken / skipIdentifierCheck on acceptInvitation
  // ==========================================================================
  describe("acceptInvitation trustedSkipToken handling", () => {
    async function createInvitation() {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "owner",
        name: "Trusted Skip Org",
        slug: "trusted-skip-org",
      });
      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "owner",
        organizationId: orgId,
        inviteeIdentifier: "alice@example.com",
        identifierType: "email",
        role: "member",
      });
      return { t, orgId, invitationId };
    }

    it("accepts with trustedSkipToken=TRUSTED_WRAPPER_SKIP (skips identifier check)", async () => {
      const { t, orgId, invitationId } = await createInvitation();
      await t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "bob",
        trustedSkipToken: "TRUSTED_WRAPPER_SKIP",
      });
      const member = await t.query(api.members.getMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member).not.toBeNull();
    });

    it("rejects with wrong trustedSkipToken value (still enforces identifier check)", async () => {
      const { t, invitationId } = await createInvitation();
      await expect(
        t.mutation(api.invitations.acceptInvitation, {
          invitationId,
          acceptingUserId: "bob",
          trustedSkipToken: "NOT_THE_REAL_TOKEN",
        })
      ).rejects.toThrow(/acceptingUserIdentifier is required/);
    });

    it("accepts with deprecated skipIdentifierCheck=true", async () => {
      const { t, orgId, invitationId } = await createInvitation();
      await t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "bob",
        skipIdentifierCheck: true,
      });
      const member = await t.query(api.members.getMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member).not.toBeNull();
    });
  });

  // ==========================================================================
  // pruneExpiredInvitations
  // ==========================================================================
  describe("pruneExpiredInvitations", () => {
    async function setupExpiredFixture() {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "owner",
        name: "Prune Org",
        slug: "prune-org",
      });
      const past = Date.now() - 1000;
      const future = Date.now() + 48 * 60 * 60 * 1000;

      // Expired pending
      const { invitationId: expiredId } = await t.mutation(
        api.invitations.inviteMember,
        {
          userId: "owner",
          organizationId: orgId,
          inviteeIdentifier: "expired@example.com",
          identifierType: "email",
          role: "member",
          expiresAt: past,
        }
      );

      // Still-valid pending
      const { invitationId: validId } = await t.mutation(
        api.invitations.inviteMember,
        {
          userId: "owner",
          organizationId: orgId,
          inviteeIdentifier: "valid@example.com",
          identifierType: "email",
          role: "member",
          expiresAt: future,
        }
      );

      // An already-cancelled invitation (status != pending)
      const { invitationId: cancelledId } = await t.mutation(
        api.invitations.inviteMember,
        {
          userId: "owner",
          organizationId: orgId,
          inviteeIdentifier: "cancel-me@example.com",
          identifierType: "email",
          role: "member",
          expiresAt: past,
        }
      );
      await t.mutation(api.invitations.cancelInvitation, {
        userId: "owner",
        invitationId: cancelledId,
      });

      return { t, orgId, expiredId, validId, cancelledId };
    }

    it("marks only pending invitations with expiresAt < now as expired (org scope)", async () => {
      const { t, orgId, expiredId, validId, cancelledId } = await setupExpiredFixture();
      const result = await t.mutation(internal.invitations.pruneExpiredInvitations, {
        organizationId: orgId,
      });
      expect(result.expired).toBe(1);

      const expiredInv = await t.query(api.invitations.getInvitation, {
        invitationId: expiredId,
      });
      expect(expiredInv?.status).toBe("expired");

      const validInv = await t.query(api.invitations.getInvitation, {
        invitationId: validId,
      });
      expect(validInv?.status).toBe("pending");

      const cancelledInv = await t.query(api.invitations.getInvitation, {
        invitationId: cancelledId,
      });
      expect(cancelledInv?.status).toBe("cancelled");
    });

    it("leaves already-expired invitations alone", async () => {
      const { t, orgId, expiredId } = await setupExpiredFixture();
      // First prune marks it expired
      await t.mutation(internal.invitations.pruneExpiredInvitations, { organizationId: orgId });
      // Second prune should see 0 more expirations (already-expired is not pending)
      const second = await t.mutation(internal.invitations.pruneExpiredInvitations, {
        organizationId: orgId,
      });
      expect(second.expired).toBe(0);
      const inv = await t.query(api.invitations.getInvitation, {
        invitationId: expiredId,
      });
      expect(inv?.status).toBe("expired");
    });

    it("respects limit arg", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "owner",
        name: "Limit Org",
        slug: "limit-org",
      });
      const past = Date.now() - 1000;
      // Create 3 expired pending invites
      for (let i = 0; i < 3; i += 1) {
        await t.mutation(api.invitations.inviteMember, {
          userId: "owner",
          organizationId: orgId,
          inviteeIdentifier: `u${i}@example.com`,
          identifierType: "email",
          role: "member",
          expiresAt: past,
        });
      }
      const result = await t.mutation(internal.invitations.pruneExpiredInvitations, {
        organizationId: orgId,
        limit: 2,
      });
      // Only 2 candidates scanned (and eligible) — at most 2 expired.
      expect(result.scanned).toBeLessThanOrEqual(2);
      expect(result.expired).toBeLessThanOrEqual(2);
    });

    it("returns { scanned, expired } shape", async () => {
      const { t, orgId } = await setupExpiredFixture();
      const result = await t.mutation(internal.invitations.pruneExpiredInvitations, {
        organizationId: orgId,
      });
      expect(typeof result.scanned).toBe("number");
      expect(typeof result.expired).toBe("number");
    });

    it("scans globally up to limit when organizationId is omitted", async () => {
      const t = createTestInstance();
      const orgAId = await t.mutation(api.organizations.createOrganization, {
        userId: "owner",
        name: "Global A",
        slug: "global-a",
      });
      const orgBId = await t.mutation(api.organizations.createOrganization, {
        userId: "owner",
        name: "Global B",
        slug: "global-b",
      });
      const past = Date.now() - 1000;
      await t.mutation(api.invitations.inviteMember, {
        userId: "owner",
        organizationId: orgAId,
        inviteeIdentifier: "a@example.com",
        identifierType: "email",
        role: "member",
        expiresAt: past,
      });
      await t.mutation(api.invitations.inviteMember, {
        userId: "owner",
        organizationId: orgBId,
        inviteeIdentifier: "b@example.com",
        identifierType: "email",
        role: "member",
        expiresAt: past,
      });

      const result = await t.mutation(internal.invitations.pruneExpiredInvitations, {
        limit: 200,
      });
      // Both orgs' invites should have been expired in the global scan.
      expect(result.expired).toBe(2);
      expect(result.scanned).toBeGreaterThanOrEqual(2);
    });
  });

  describe("declineInvitation", () => {
    it("should decline a pending invitation", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "member",
      });

      await t.mutation(api.invitations.declineInvitation, {
        invitationId,
        decliningUserId: "user_456",
      });

      const invitation = await t.query(api.invitations.getInvitation, {
        invitationId,
      });
      expect(invitation?.status).toBe("declined");
    });

    it("should throw when declining a non-existent invitation", async () => {
      const t = createTestInstance();

      await expect(
        t.mutation(api.invitations.declineInvitation, {
          invitationId: "nonexistent_id",
        })
      ).rejects.toThrow();
    });

    it("should throw when declining an already accepted invitation", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "member",
      });

      await t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "user_456",
        acceptingUserIdentifier: "newuser@example.com",
      });

      await expect(
        t.mutation(api.invitations.declineInvitation, {
          invitationId,
          decliningUserId: "user_456",
        })
      ).rejects.toThrow(/already been accepted/);
    });

    it("should throw when declining an already declined invitation", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "member",
      });

      await t.mutation(api.invitations.declineInvitation, {
        invitationId,
        decliningUserId: "user_456",
      });

      await expect(
        t.mutation(api.invitations.declineInvitation, {
          invitationId,
          decliningUserId: "user_456",
        })
      ).rejects.toThrow(/already been declined/);
    });

    it("should throw when declining a cancelled invitation", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "member",
      });

      await t.mutation(api.invitations.cancelInvitation, {
        userId: "user_123",
        invitationId,
      });

      await expect(
        t.mutation(api.invitations.declineInvitation, {
          invitationId,
          decliningUserId: "user_456",
        })
      ).rejects.toThrow(/already been cancelled/);
    });

    it("should throw when declining an expired invitation", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "member",
        expiresAt: Date.now() - 1000, // already expired
      });

      await expect(
        t.mutation(api.invitations.declineInvitation, {
          invitationId,
          decliningUserId: "user_456",
        })
      ).rejects.toThrow(/expired/);
    });

    it("declined invitation should not appear in pending list", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "member",
      });

      await t.mutation(api.invitations.declineInvitation, {
        invitationId,
        decliningUserId: "user_456",
      });

      const pending = await t.query(api.invitations.listInvitations, {
        organizationId: orgId,
        status: "pending",
      });
      expect(pending).toHaveLength(0);

      // But should appear when listing declined
      const declined = await t.query(api.invitations.listInvitations, {
        organizationId: orgId,
        status: "declined",
      });
      expect(declined).toHaveLength(1);
      expect((declined as any[])[0].status).toBe("declined");
    });

    it("should allow re-inviting after decline", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "member",
      });

      await t.mutation(api.invitations.declineInvitation, {
        invitationId,
        decliningUserId: "user_456",
      });

      // Re-invite the same person — should succeed since the old invite is declined, not pending
      const result = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "admin",
      });

      expect(result.invitationId).toBeDefined();
      expect(result.inviteeIdentifier).toBe("newuser@example.com");
    });
  });

  describe("edge cases", () => {
    it("resendInvitation throws for declined invitation", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });
      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "member",
      });
      await t.mutation(api.invitations.declineInvitation, {
        invitationId,
        decliningUserId: "user_456",
      });
      await expect(
        t.mutation(api.invitations.resendInvitation, { userId: "user_123", invitationId })
      ).rejects.toThrow(/Cannot resend declined invitation/);
    });

    it("acceptInvitation throws for declined invitation", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });
      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "newuser@example.com",
        identifierType: "email",
        role: "member",
      });
      await t.mutation(api.invitations.declineInvitation, {
        invitationId,
        decliningUserId: "user_456",
      });
      await expect(
        t.mutation(api.invitations.acceptInvitation, {
          invitationId,
          acceptingUserId: "user_456",
          acceptingUserIdentifier: "newuser@example.com",
        })
      ).rejects.toThrow(/already been declined/);
    });

    it("inviting an existing member creates invitation but accept throws ALREADY_EXISTS", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });
      await t.mutation(api.members.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });
      // Invitation creation succeeds (component doesn't check membership)
      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "existing@example.com",
        identifierType: "email",
        role: "member",
      });
      expect(invitationId).toBeDefined();

      // But accepting throws because user is already a member
      await expect(
        t.mutation(api.invitations.acceptInvitation, {
          invitationId,
          acceptingUserId: "user_456",
          acceptingUserIdentifier: "existing@example.com",
        })
      ).rejects.toThrow(/already a member/);
    });

    it("case-insensitive email dedup prevents duplicate pending invitations", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });
      await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "bob@example.com",
        identifierType: "email",
        role: "member",
      });
      // Same email, different case — should be rejected as duplicate
      await expect(
        t.mutation(api.invitations.inviteMember, {
          userId: "user_123",
          organizationId: orgId,
          inviteeIdentifier: "Bob@EXAMPLE.COM",
          identifierType: "email",
          role: "member",
        })
      ).rejects.toThrow(/pending invitation already exists/);
    });

    it("bulk invite succeeds for previously declined emails", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });
      // First invite then decline
      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "declined@example.com",
        identifierType: "email",
        role: "member",
      });
      await t.mutation(api.invitations.declineInvitation, {
        invitationId,
        decliningUserId: "user_456",
      });

      // Bulk invite should succeed for this email since the old one is declined
      const result = await t.mutation(api.invitations.bulkInviteMembers, {
        userId: "user_123",
        organizationId: orgId,
        invitations: [
          { inviteeIdentifier: "declined@example.com", role: "admin" },
          { inviteeIdentifier: "fresh@example.com", role: "member" },
        ],
      });
      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it("removed member can rejoin via invitation", async () => {
      const t = createTestInstance();
      const orgId = await t.mutation(api.organizations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });
      // Add and then remove member
      await t.mutation(api.members.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });
      await t.mutation(api.members.removeMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
      });

      // Invite the removed member
      const { invitationId } = await t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        inviteeIdentifier: "rejoiner@example.com",
        identifierType: "email",
        role: "admin",
      });

      // Accept — should succeed since they're no longer a member
      await t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "user_456",
        acceptingUserIdentifier: "rejoiner@example.com",
      });

      // Verify they're back with the new role
      const members = await t.query(api.members.listOrganizationMembers, {
        organizationId: orgId,
      });
      const rejoined = (members as any[]).find((m: any) => m.userId === "user_456");
      expect(rejoined).toBeDefined();
      expect(rejoined.role).toBe("admin");
    });
  });
});
