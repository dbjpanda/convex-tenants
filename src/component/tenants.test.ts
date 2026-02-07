import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";
import { api } from "./_generated/api.js";
import authzTest from "@djpanda/convex-authz/test";

const modules = import.meta.glob("./**/*.ts");

// Helper to create test instance with authz child registered
function createTestInstance() {
  const t = convexTest(schema, modules);
  authzTest.register(t, "authz");
  return t;
}

describe("tenants component", () => {
  // ============================================================================
  // Organization Tests
  // ============================================================================
  describe("organizations", () => {
    it("should create an organization", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Acme Corp",
        slug: "acme-corp",
      });

      expect(orgId).toBeDefined();
      expect(typeof orgId).toBe("string");
    });

    it("should create organization with logo and metadata", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Acme Corp",
        slug: "acme-corp",
        logo: "https://example.com/logo.png",
        metadata: { tier: "enterprise", industry: "tech" },
      });

      const org = await t.query(api.queries.getOrganization, {
        organizationId: orgId,
      });

      expect(org).not.toBeNull();
      expect(org?.name).toBe("Acme Corp");
      expect(org?.slug).toBe("acme-corp");
      expect(org?.logo).toBe("https://example.com/logo.png");
      expect(org?.metadata).toEqual({ tier: "enterprise", industry: "tech" });
    });

    it("should auto-assign creator as owner", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const member = await t.query(api.queries.getMember, {
        organizationId: orgId,
        userId: "user_123",
      });

      expect(member).not.toBeNull();
      expect(member?.role).toBe("owner");
    });

    it("should list user organizations with role", async () => {
      const t = createTestInstance();

      // Create two organizations
      await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Org One",
        slug: "org-one",
      });

      await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Org Two",
        slug: "org-two",
      });

      const orgs = await t.query(api.queries.listUserOrganizations, {
        userId: "user_123",
      });

      expect(orgs).toHaveLength(2);
      expect(orgs.map((o: any) => o.name)).toContain("Org One");
      expect(orgs.map((o: any) => o.name)).toContain("Org Two");
      orgs.forEach((org: any) => {
        expect(org.role).toBe("owner");
      });
    });

    it("should get organization by slug", async () => {
      const t = createTestInstance();

      await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Unique Org",
        slug: "unique-slug-123",
      });

      const org = await t.query(api.queries.getOrganizationBySlug, {
        slug: "unique-slug-123",
      });

      expect(org).not.toBeNull();
      expect(org?.name).toBe("Unique Org");
    });

    it("should ensure unique slugs", async () => {
      const t = createTestInstance();

      await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "First Org",
        slug: "duplicate",
      });

      // Second org with same slug should get a modified slug
      const org2Id = await t.mutation(api.mutations.createOrganization, {
        userId: "user_456",
        name: "Second Org",
        slug: "duplicate",
      });

      const org2 = await t.query(api.queries.getOrganization, {
        organizationId: org2Id,
      });

      expect(org2?.slug).not.toBe("duplicate");
      expect(org2?.slug).toMatch(/^duplicate-/);
    });

    it("should update organization", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Original Name",
        slug: "original",
      });

      await t.mutation(api.mutations.updateOrganization, {
        userId: "user_123",
        organizationId: orgId,
        name: "Updated Name",
        logo: "https://new-logo.png",
      });

      const org = await t.query(api.queries.getOrganization, {
        organizationId: orgId,
      });

      expect(org?.name).toBe("Updated Name");
      expect(org?.logo).toBe("https://new-logo.png");
    });

    it("should delete organization and all related data", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "To Delete",
        slug: "to-delete",
      });

      // Add some team and invitations
      await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Team A",
      });

      await t.mutation(api.mutations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        email: "test@example.com",
        role: "member",
      });

      // Delete
      await t.mutation(api.mutations.deleteOrganization, {
        userId: "user_123",
        organizationId: orgId,
      });

      const org = await t.query(api.queries.getOrganization, {
        organizationId: orgId,
      });
      expect(org).toBeNull();

      const teams = await t.query(api.queries.listTeams, {
        organizationId: orgId,
      });
      expect(teams).toHaveLength(0);
    });
  });

  // ============================================================================
  // Member Tests
  // ============================================================================
  describe("members", () => {
    it("should add a member to organization", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });

      const member = await t.query(api.queries.getMember, {
        organizationId: orgId,
        userId: "user_456",
      });

      expect(member).not.toBeNull();
      expect(member?.role).toBe("member");
    });

    it("should list organization members", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "admin",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_789",
        role: "member",
      });

      const members = await t.query(api.queries.listOrganizationMembers, {
        organizationId: orgId,
      });

      expect(members).toHaveLength(3); // owner + 2 members
    });

    it("should prevent duplicate member additions", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });

      await expect(
        t.mutation(api.mutations.addMember, {
          userId: "user_123",
          organizationId: orgId,
          memberUserId: "user_456",
          role: "admin",
        })
      ).rejects.toThrow();
    });

    it("should update member role", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });

      await t.mutation(api.mutations.updateMemberRole, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "admin",
      });

      const member = await t.query(api.queries.getMember, {
        organizationId: orgId,
        userId: "user_456",
      });

      expect(member?.role).toBe("admin");
    });

    it("should remove member from organization", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });

      await t.mutation(api.mutations.removeMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
      });

      const member = await t.query(api.queries.getMember, {
        organizationId: orgId,
        userId: "user_456",
      });

      expect(member).toBeNull();
    });

    it("should prevent removing an owner", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await expect(
        t.mutation(api.mutations.removeMember, {
          userId: "user_123",
          organizationId: orgId,
          memberUserId: "user_123",
        })
      ).rejects.toThrow();
    });

    it("should check member permission", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });

      // Owner has all permissions
      const ownerCheck = await t.query(api.queries.checkMemberPermission, {
        organizationId: orgId,
        userId: "user_123",
        minRole: "owner",
      });
      expect(ownerCheck.hasPermission).toBe(true);
      expect(ownerCheck.currentRole).toBe("owner");

      // Member has member but not admin
      const memberAdminCheck = await t.query(api.queries.checkMemberPermission, {
        organizationId: orgId,
        userId: "user_456",
        minRole: "admin",
      });
      expect(memberAdminCheck.hasPermission).toBe(false);
      expect(memberAdminCheck.currentRole).toBe("member");

      const memberMemberCheck = await t.query(api.queries.checkMemberPermission, {
        organizationId: orgId,
        userId: "user_456",
        minRole: "member",
      });
      expect(memberMemberCheck.hasPermission).toBe(true);
    });

    it("should allow member to leave organization", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });

      await t.mutation(api.mutations.leaveOrganization, {
        userId: "user_456",
        organizationId: orgId,
      });

      const member = await t.query(api.queries.getMember, {
        organizationId: orgId,
        userId: "user_456",
      });

      expect(member).toBeNull();
    });

    it("should prevent sole owner from leaving", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await expect(
        t.mutation(api.mutations.leaveOrganization, {
          userId: "user_123",
          organizationId: orgId,
        })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Team Tests
  // ============================================================================
  describe("teams", () => {
    it("should create a team", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const teamId = await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Engineering",
        description: "Engineering team",
      });

      expect(teamId).toBeDefined();

      const team = await t.query(api.queries.getTeam, { teamId });
      expect(team?.name).toBe("Engineering");
      expect(team?.description).toBe("Engineering team");
    });

    it("should list teams in organization", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Engineering",
      });

      await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Sales",
      });

      const teams = await t.query(api.queries.listTeams, {
        organizationId: orgId,
      });

      expect(teams).toHaveLength(2);
      expect(teams.map((t: any) => t.name)).toContain("Engineering");
      expect(teams.map((t: any) => t.name)).toContain("Sales");
    });

    it("should add member to team", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });

      const teamId = await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Engineering",
      });

      await t.mutation(api.mutations.addTeamMember, {
        userId: "user_123",
        teamId,
        memberUserId: "user_456",
      });

      const isTeamMember = await t.query(api.queries.isTeamMember, {
        teamId,
        userId: "user_456",
      });

      expect(isTeamMember).toBe(true);
    });

    it("should require org membership before team membership", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const teamId = await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Engineering",
      });

      // Try to add user who is not an org member
      await expect(
        t.mutation(api.mutations.addTeamMember, {
          userId: "user_123",
          teamId,
          memberUserId: "user_456",
        })
      ).rejects.toThrow();
    });

    it("should remove member from team", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });

      const teamId = await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Engineering",
      });

      await t.mutation(api.mutations.addTeamMember, {
        userId: "user_123",
        teamId,
        memberUserId: "user_456",
      });

      await t.mutation(api.mutations.removeTeamMember, {
        userId: "user_123",
        teamId,
        memberUserId: "user_456",
      });

      const isTeamMember = await t.query(api.queries.isTeamMember, {
        teamId,
        userId: "user_456",
      });

      expect(isTeamMember).toBe(false);
    });

    it("should delete team and all memberships", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const teamId = await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Engineering",
      });

      await t.mutation(api.mutations.deleteTeam, {
        userId: "user_123",
        teamId,
      });

      const team = await t.query(api.queries.getTeam, { teamId });
      expect(team).toBeNull();
    });

    it("should update team details", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const teamId = await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Original",
      });

      await t.mutation(api.mutations.updateTeam, {
        userId: "user_123",
        teamId,
        name: "Updated",
        description: "New description",
      });

      const team = await t.query(api.queries.getTeam, { teamId });
      expect(team?.name).toBe("Updated");
      expect(team?.description).toBe("New description");
    });
  });

  // ============================================================================
  // Invitation Tests
  // ============================================================================
  describe("invitations", () => {
    it("should create an invitation", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const result = await t.mutation(api.mutations.inviteMember, {
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

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        email: "user1@example.com",
        role: "member",
      });

      await t.mutation(api.mutations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        email: "user2@example.com",
        role: "admin",
      });

      const invitations = await t.query(api.queries.listInvitations, {
        organizationId: orgId,
      });

      expect(invitations).toHaveLength(2);
      expect(invitations.map((i: any) => i.email)).toContain("user1@example.com");
      expect(invitations.map((i: any) => i.email)).toContain("user2@example.com");
    });

    it("should prevent duplicate pending invitations", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        email: "user@example.com",
        role: "member",
      });

      await expect(
        t.mutation(api.mutations.inviteMember, {
          userId: "user_123",
          organizationId: orgId,
          email: "user@example.com",
          role: "admin",
        })
      ).rejects.toThrow();
    });

    it("should accept invitation and add member", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.mutations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        email: "newuser@example.com",
        role: "admin",
      });

      await t.mutation(api.mutations.acceptInvitation, {
        invitationId,
        acceptingUserId: "user_456",
      });

      const member = await t.query(api.queries.getMember, {
        organizationId: orgId,
        userId: "user_456",
      });

      expect(member).not.toBeNull();
      expect(member?.role).toBe("admin");

      const invitation = await t.query(api.queries.getInvitation, {
        invitationId,
      });
      expect(invitation?.status).toBe("accepted");
    });

    it("should cancel invitation", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.mutations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        email: "newuser@example.com",
        role: "member",
      });

      await t.mutation(api.mutations.cancelInvitation, {
        userId: "user_123",
        invitationId,
      });

      const invitation = await t.query(api.queries.getInvitation, {
        invitationId,
      });
      expect(invitation?.status).toBe("cancelled");
    });

    it("should prevent accepting already accepted invitation", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const { invitationId } = await t.mutation(api.mutations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        email: "newuser@example.com",
        role: "member",
      });

      await t.mutation(api.mutations.acceptInvitation, {
        invitationId,
        acceptingUserId: "user_456",
      });

      await expect(
        t.mutation(api.mutations.acceptInvitation, {
          invitationId,
          acceptingUserId: "user_789",
        })
      ).rejects.toThrow();
    });

    it("should get pending invitations for email", async () => {
      const t = createTestInstance();

      const org1Id = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Org One",
        slug: "org-one",
      });

      const org2Id = await t.mutation(api.mutations.createOrganization, {
        userId: "user_456",
        name: "Org Two",
        slug: "org-two",
      });

      await t.mutation(api.mutations.inviteMember, {
        userId: "user_123",
        organizationId: org1Id,
        email: "target@example.com",
        role: "member",
      });

      await t.mutation(api.mutations.inviteMember, {
        userId: "user_456",
        organizationId: org2Id,
        email: "target@example.com",
        role: "admin",
      });

      const pendingInvites = await t.query(
        api.queries.getPendingInvitationsForEmail,
        { email: "target@example.com" }
      );

      expect(pendingInvites).toHaveLength(2);
    });

    it("should include team in invitation acceptance", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const teamId = await t.mutation(api.mutations.createTeam, {
        userId: "user_123",
        organizationId: orgId,
        name: "Engineering",
      });

      const { invitationId } = await t.mutation(api.mutations.inviteMember, {
        userId: "user_123",
        organizationId: orgId,
        email: "engineer@example.com",
        role: "member",
        teamId,
      });

      await t.mutation(api.mutations.acceptInvitation, {
        invitationId,
        acceptingUserId: "user_456",
      });

      const isTeamMember = await t.query(api.queries.isTeamMember, {
        teamId,
        userId: "user_456",
      });

      expect(isTeamMember).toBe(true);
    });
  });

  // ============================================================================
  // Permission Tests
  // ============================================================================
  describe("permissions", () => {
    it("admins cannot perform owner-only operations", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "admin",
      });

      // Admin trying to delete org should fail
      await expect(
        t.mutation(api.mutations.deleteOrganization, {
          userId: "user_456",
          organizationId: orgId,
        })
      ).rejects.toThrow();

      // Admin trying to update member role should fail
      await expect(
        t.mutation(api.mutations.updateMemberRole, {
          userId: "user_456",
          organizationId: orgId,
          memberUserId: "user_123",
          role: "member",
        })
      ).rejects.toThrow();
    });

    it("members cannot perform admin operations", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      await t.mutation(api.mutations.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "member",
      });

      // Member trying to create team should fail
      await expect(
        t.mutation(api.mutations.createTeam, {
          userId: "user_456",
          organizationId: orgId,
          name: "New Team",
        })
      ).rejects.toThrow();

      // Member trying to invite should fail
      await expect(
        t.mutation(api.mutations.inviteMember, {
          userId: "user_456",
          organizationId: orgId,
          email: "new@example.com",
          role: "member",
        })
      ).rejects.toThrow();
    });

    it("non-members have no access", async () => {
      const t = createTestInstance();

      const orgId = await t.mutation(api.mutations.createOrganization, {
        userId: "user_123",
        name: "Test Org",
        slug: "test-org",
      });

      const check = await t.query(api.queries.checkMemberPermission, {
        organizationId: orgId,
        userId: "stranger_user",
        minRole: "member",
      });

      expect(check.hasPermission).toBe(false);
      expect(check.currentRole).toBeNull();
    });
  });
});
