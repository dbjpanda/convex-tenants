import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

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
      email: "newuser@example.com",
      role: "member",
    });

    expect(result.invitationId).toBeDefined();
    expect(result.email).toBe("newuser@example.com");
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
      email: "user1@example.com",
      role: "member",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_123",
      organizationId: orgId,
      email: "user2@example.com",
      role: "admin",
    });

    const invitations = await t.query(api.invitations.listInvitations, {
      organizationId: orgId,
    });

    expect(invitations).toHaveLength(2);
    expect(invitations.map((i: any) => i.email)).toContain("user1@example.com");
    expect(invitations.map((i: any) => i.email)).toContain("user2@example.com");
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
      email: "user@example.com",
      role: "member",
    });

    await expect(
      t.mutation(api.invitations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        email: "user@example.com",
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
      email: "newuser@example.com",
      role: "admin",
    });

    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "user_456",
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
      email: "newuser@example.com",
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
      email: "newuser@example.com",
      role: "member",
    });

    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "user_456",
    });

    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "user_789",
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
      email: "target@example.com",
      role: "member",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "user_456",
      organizationId: org2Id,
      email: "target@example.com",
      role: "admin",
    });

    const pendingInvites = await t.query(
      api.invitations.getPendingInvitationsForEmail,
      { email: "target@example.com" }
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
      email: "engineer@example.com",
      role: "member",
      teamId,
    });

    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "user_456",
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
      email: "bob@test.com",
      role: "member",
    });

    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "bob",
    });

    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "charlie",
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
      email: "expired@test.com",
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
      email: "cancel@test.com",
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
      email: "expired@test.com",
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
      email: "double-cancel@test.com",
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
});
