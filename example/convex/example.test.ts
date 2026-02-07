import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api } from "./_generated/api";

// ============================================================================
// Existing example tests (direct component calls)
// ============================================================================

describe("tenants example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("create organization with direct component call", async () => {
    const t = initConvexTest();

    const asUser = t.withIdentity({
      subject: "user123",
      issuer: "https://example.com",
    });

    const orgId = await asUser.mutation(api.testHelpers.directCreateOrganization, {
      name: "Test Org",
      slug: "test-org",
    });

    expect(orgId).toBeDefined();
    expect(typeof orgId).toBe("string");
  });

  test("list organizations returns empty for new user", async () => {
    const t = initConvexTest();

    const asUser = t.withIdentity({
      subject: "user456",
      issuer: "https://example.com",
    });

    const orgs = await asUser.query(api.testHelpers.directListOrganizations, {});

    expect(orgs).toEqual([]);
  });

  test("create and list organizations", async () => {
    const t = initConvexTest();

    const asUser = t.withIdentity({
      subject: "user789",
      issuer: "https://example.com",
    });

    const orgId = await asUser.mutation(api.testHelpers.directCreateOrganization, {
      name: "My Org",
      slug: "my-org",
    });

    expect(orgId).toBeDefined();

    const orgs = await asUser.query(api.testHelpers.directListOrganizations, {});

    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe("My Org");
    expect(orgs[0].slug).toBe("my-org");
    expect(orgs[0].role).toBe("owner");
  });
});

// ============================================================================
// makeTenantsAPI tests — auth enforcement, enrichment, callbacks
// Uses testHelpers.ts which has a strict auth API (ctx.auth.getUserIdentity)
// compatible with convex-test's withIdentity().
// ============================================================================

describe("makeTenantsAPI", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Auth enforcement: unauthenticated queries return safe defaults
  // --------------------------------------------------------------------------

  describe("auth enforcement - queries", () => {
    test("listOrganizations returns empty array when unauthenticated", async () => {
      const t = initConvexTest();

      const orgs = await t.query(api.testHelpers.strictListOrganizations, {});

      expect(orgs).toEqual([]);
    });

    test("getCurrentMember returns null when unauthenticated", async () => {
      const t = initConvexTest();

      const member = await t.query(api.testHelpers.strictGetCurrentMember, {
        organizationId: "nonexistent",
      });

      expect(member).toBeNull();
    });

    test("checkPermission returns no permission when unauthenticated", async () => {
      const t = initConvexTest();

      const result = await t.query(api.testHelpers.strictCheckPermission, {
        organizationId: "nonexistent",
        minRole: "member",
      });

      expect(result).toEqual({ hasPermission: false, currentRole: null });
    });

    test("isTeamMember returns false when unauthenticated", async () => {
      const t = initConvexTest();

      const result = await t.query(api.testHelpers.strictIsTeamMember, {
        teamId: "nonexistent",
      });

      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Auth enforcement: unauthenticated mutations throw
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // getUser enrichment
  // --------------------------------------------------------------------------

  describe("getUser enrichment", () => {
    test("listMembers enriches results with user data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      // Create org and add a member
      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Enrichment Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // List members — each should have a `user` field from getUser.
      // The `user` field is added dynamically by getUser enrichment,
      // so we cast to `any` for the assertion.
      const members: any[] = await asAlice.query(
        api.testHelpers.strictListMembers,
        { organizationId: orgId }
      );

      expect(members).toHaveLength(2); // alice (owner) + bob (member)
      for (const member of members) {
        expect(member.user).toBeDefined();
        expect(member.user.name).toMatch(/^User /);
        expect(member.user.email).toMatch(/@test\.com$/);
      }

      // Verify specific user data
      const alice = members.find((m: any) => m.userId === "alice");
      expect(alice?.user).toEqual({
        name: "User alice",
        email: "alice@test.com",
      });

      const bob = members.find((m: any) => m.userId === "bob");
      expect(bob?.user).toEqual({
        name: "User bob",
        email: "bob@test.com",
      });
    });

    test("getMember enriches result with user data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Get Member Org" }
      );

      const member: any = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "alice",
      });

      expect(member).not.toBeNull();
      expect(member?.user).toEqual({
        name: "User alice",
        email: "alice@test.com",
      });
    });

    test("listTeamMembers enriches results with user data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      // Create org, add member, create team, add to team
      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Team Enrichment Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "charlie",
        role: "member",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "charlie",
      });

      // List team members — should have user data
      const teamMembers: any[] = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId }
      );

      expect(teamMembers).toHaveLength(1);
      expect(teamMembers[0].user).toEqual({
        name: "User charlie",
        email: "charlie@test.com",
      });
    });
  });

  // --------------------------------------------------------------------------
  // onInvitationCreated callback
  // --------------------------------------------------------------------------

  describe("onInvitationCreated callback", () => {
    test("callback receives correct invitation data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Callback Test Org" }
      );

      const result = await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        email: "invited@example.com",
        role: "admin",
      });

      // Verify the callback wrote to the callbackLog table
      const allLogs = await t.query(api.testHelpers.getCallbackLogs, {});
      const logs = allLogs.filter((l: any) => l.type === "invitationCreated");

      expect(logs).toHaveLength(1);
      expect(logs[0].data.email).toBe("invited@example.com");
      expect(logs[0].data.organizationName).toBe("Callback Test Org");
      expect(logs[0].data.role).toBe("admin");
      expect(logs[0].data.inviterName).toBe("User alice");
      expect(logs[0].data.invitationId).toBe(result.invitationId);
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.expiresAt).toBeGreaterThan(0);
    });

    test("callback receives inviterName from getUser", async () => {
      const t = initConvexTest();
      const asBob = t.withIdentity({
        subject: "bob-the-admin",
        issuer: "https://test.com",
      });

      const orgId = await asBob.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Inviter Name Org" }
      );

      await asBob.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        email: "someone@example.com",
        role: "member",
      });

      const allLogs = await t.query(api.testHelpers.getCallbackLogs, {});
      const logs = allLogs.filter((l: any) => l.type === "invitationCreated");

      expect(logs).toHaveLength(1);
      // inviterName comes from getUser which returns `User ${userId}`
      expect(logs[0].data.inviterName).toBe("User bob-the-admin");
    });
  });

  // --------------------------------------------------------------------------
  // onInvitationResent callback
  // --------------------------------------------------------------------------

  describe("onInvitationResent callback", () => {
    test("callback receives correct data on resend", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Resend Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          email: "resend@example.com",
          role: "member",
        }
      );

      // Resend the invitation
      await asAlice.mutation(api.testHelpers.strictResendInvitation, {
        invitationId,
      });

      // Should have logs for invitationCreated + invitationResent
      const allLogs = await t.query(api.testHelpers.getCallbackLogs, {});

      const createdLog = allLogs.find((l: any) => l.type === "invitationCreated");
      const resentLog = allLogs.find((l: any) => l.type === "invitationResent");

      expect(createdLog).toBeDefined();
      expect(resentLog).toBeDefined();

      expect(resentLog!.data.email).toBe("resend@example.com");
      expect(resentLog!.data.organizationName).toBe("Resend Org");
      expect(resentLog!.data.role).toBe("member");
      expect(resentLog!.data.inviterName).toBe("User alice");
      expect(resentLog!.data.organizationId).toBe(orgId);
    });
  });

  // --------------------------------------------------------------------------
  // Organization queries/mutations — full coverage
  // --------------------------------------------------------------------------

  describe("organization functions", () => {
    test("getOrganization returns org by ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Get Org Test" }
      );

      const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
        organizationId: orgId,
      });

      expect(org).not.toBeNull();
      expect(org?.name).toBe("Get Org Test");
      expect(org?._id).toBe(orgId);
    });

    test("getOrganization returns null for nonexistent ID", async () => {
      const t = initConvexTest();

      const org = await t.query(api.testHelpers.strictGetOrganization, {
        organizationId: "nonexistent",
      });

      expect(org).toBeNull();
    });

    test("getOrganizationBySlug returns org by slug", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Slug Test Org",
      });

      const org = await t.query(api.testHelpers.strictGetOrganizationBySlug, {
        slug: "slug-test-org",
      });

      expect(org).not.toBeNull();
      expect(org?.name).toBe("Slug Test Org");
    });

    test("getOrganizationBySlug returns null for nonexistent slug", async () => {
      const t = initConvexTest();

      const org = await t.query(api.testHelpers.strictGetOrganizationBySlug, {
        slug: "does-not-exist",
      });

      expect(org).toBeNull();
    });

    test("updateOrganization updates name and logo", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Before Update" }
      );

      await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
        organizationId: orgId,
        name: "After Update",
        logo: "https://example.com/logo.png",
      });

      const org = await t.query(api.testHelpers.strictGetOrganization, {
        organizationId: orgId,
      });

      expect(org?.name).toBe("After Update");
      expect(org?.logo).toBe("https://example.com/logo.png");
    });

    test("updateOrganization throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictUpdateOrganization, {
          organizationId: "nonexistent",
          name: "New Name",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("deleteOrganization removes org and its data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "To Delete" }
      );

      // Add a team so we can verify cascading delete
      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Team A",
      });

      await asAlice.mutation(api.testHelpers.strictDeleteOrganization, {
        organizationId: orgId,
      });

      const org = await t.query(api.testHelpers.strictGetOrganization, {
        organizationId: orgId,
      });
      expect(org).toBeNull();

      const teams = await t.query(api.testHelpers.strictListTeams, {
        organizationId: orgId,
      });
      expect(teams).toHaveLength(0);
    });

    test("deleteOrganization throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictDeleteOrganization, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });

  // --------------------------------------------------------------------------
  // Member mutations — full coverage
  // --------------------------------------------------------------------------

  describe("member functions", () => {
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
  });

  // --------------------------------------------------------------------------
  // Team functions — full coverage
  // --------------------------------------------------------------------------

  describe("team functions", () => {
    test("listTeams returns all teams in an organization", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Teams Org" }
      );

      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Design",
      });

      const teams = await t.query(api.testHelpers.strictListTeams, {
        organizationId: orgId,
      });

      expect(teams).toHaveLength(2);
      expect(teams.map((t: any) => t.name)).toContain("Engineering");
      expect(teams.map((t: any) => t.name)).toContain("Design");
    });

    test("getTeam returns team by ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Get Team Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
        description: "The eng team",
      });

      const team = await t.query(api.testHelpers.strictGetTeam, { teamId });

      expect(team).not.toBeNull();
      expect(team?.name).toBe("Engineering");
      expect(team?.description).toBe("The eng team");
    });

    test("getTeam returns null for nonexistent ID", async () => {
      const t = initConvexTest();

      const team = await t.query(api.testHelpers.strictGetTeam, {
        teamId: "nonexistent",
      });

      expect(team).toBeNull();
    });

    test("updateTeam changes name and description", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Update Team Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Original",
      });

      await asAlice.mutation(api.testHelpers.strictUpdateTeam, {
        teamId,
        name: "Updated",
        description: "New description",
      });

      const team = await t.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team?.name).toBe("Updated");
      expect(team?.description).toBe("New description");
    });

    test("updateTeam throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictUpdateTeam, {
          teamId: "nonexistent",
          name: "New Name",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("deleteTeam removes team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Delete Team Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "To Delete",
      });

      await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId });

      const team = await t.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team).toBeNull();
    });

    test("deleteTeam throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictDeleteTeam, {
          teamId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("removeTeamMember removes member from team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Remove Team Member Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Check via listTeamMembers that bob is a team member
      const membersBefore: any[] = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId }
      );
      expect(membersBefore).toHaveLength(1);

      await asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      const membersAfter: any[] = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId }
      );
      expect(membersAfter).toHaveLength(0);
    });

    test("removeTeamMember throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictRemoveTeamMember, {
          teamId: "nonexistent",
          memberUserId: "bob",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });

  // --------------------------------------------------------------------------
  // Invitation functions — full coverage
  // --------------------------------------------------------------------------

  describe("invitation functions", () => {
    test("listInvitations returns all invitations for an org", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "List Invitations Org" }
      );

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        email: "user1@example.com",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        email: "user2@example.com",
        role: "admin",
      });

      const invitations = await t.query(api.testHelpers.strictListInvitations, {
        organizationId: orgId,
      });

      expect(invitations).toHaveLength(2);
      expect(invitations.map((i: any) => i.email)).toContain(
        "user1@example.com"
      );
      expect(invitations.map((i: any) => i.email)).toContain(
        "user2@example.com"
      );
    });

    test("getInvitation returns invitation by ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Get Invitation Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          email: "invited@example.com",
          role: "member",
        }
      );

      const invitation = await t.query(api.testHelpers.strictGetInvitation, {
        invitationId,
      });

      expect(invitation).not.toBeNull();
      expect(invitation?.email).toBe("invited@example.com");
      expect(invitation?.role).toBe("member");
      expect(invitation?.status).toBe("pending");
      expect(invitation?.organizationId).toBe(orgId);
    });

    test("getInvitation returns null for nonexistent ID", async () => {
      const t = initConvexTest();

      const invitation = await t.query(api.testHelpers.strictGetInvitation, {
        invitationId: "nonexistent",
      });

      expect(invitation).toBeNull();
    });

    test("getPendingInvitations returns invitations for email across orgs", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asBob = t.withIdentity({
        subject: "bob",
        issuer: "https://test.com",
      });

      const org1Id = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Pending Org 1" }
      );

      const org2Id = await asBob.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Pending Org 2" }
      );

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: org1Id,
        email: "target@example.com",
        role: "member",
      });

      await asBob.mutation(api.testHelpers.strictInviteMember, {
        organizationId: org2Id,
        email: "target@example.com",
        role: "admin",
      });

      const pending = await t.query(
        api.testHelpers.strictGetPendingInvitations,
        { email: "target@example.com" }
      );

      expect(pending).toHaveLength(2);
    });

    test("acceptInvitation adds user as member with invited role", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asBob = t.withIdentity({
        subject: "bob",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Accept Invitation Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          email: "bob@example.com",
          role: "admin",
        }
      );

      await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
        invitationId,
      });

      // Verify bob is now a member with admin role
      const member = await t.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member).not.toBeNull();
      expect(member?.role).toBe("admin");

      // Verify invitation status changed
      const invitation = await t.query(api.testHelpers.strictGetInvitation, {
        invitationId,
      });
      expect(invitation?.status).toBe("accepted");
    });

    test("acceptInvitation throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictAcceptInvitation, {
          invitationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("cancelInvitation sets status to cancelled", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Cancel Invitation Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          email: "cancel@example.com",
          role: "member",
        }
      );

      await asAlice.mutation(api.testHelpers.strictCancelInvitation, {
        invitationId,
      });

      const invitation = await t.query(api.testHelpers.strictGetInvitation, {
        invitationId,
      });
      expect(invitation?.status).toBe("cancelled");
    });

    test("cancelInvitation throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictCancelInvitation, {
          invitationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });

  // --------------------------------------------------------------------------
  // Event hook callbacks — all 11 new hooks + existing 2
  // --------------------------------------------------------------------------

  describe("event hook callbacks", () => {
    // Helper: get logs of a specific type
    async function getLogsOfType(t: any, type: string) {
      const logs = await t.query(api.testHelpers.getCallbackLogs, {});
      return logs.filter((l: any) => l.type === type);
    }

    // -- Organization hooks --

    test("onOrganizationCreated fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Hook Org" }
      );

      const logs = await getLogsOfType(t, "organizationCreated");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.name).toBe("Hook Org");
      expect(logs[0].data.ownerId).toBe("alice");
      expect(logs[0].data.slug).toBeDefined();
    });

    test("onOrganizationDeleted fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Delete Hook Org" }
      );

      await asAlice.mutation(api.testHelpers.strictDeleteOrganization, {
        organizationId: orgId,
      });

      const logs = await getLogsOfType(t, "organizationDeleted");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.name).toBe("Delete Hook Org");
      expect(logs[0].data.deletedBy).toBe("alice");
    });

    // -- Member hooks --

    test("onMemberAdded fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Member Hook Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "admin",
      });

      const logs = await getLogsOfType(t, "memberAdded");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.userId).toBe("bob");
      expect(logs[0].data.role).toBe("admin");
      expect(logs[0].data.addedBy).toBe("alice");
    });

    test("onMemberRemoved fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Remove Hook Org" }
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

      const logs = await getLogsOfType(t, "memberRemoved");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.userId).toBe("bob");
      expect(logs[0].data.removedBy).toBe("alice");
    });

    test("onMemberRoleChanged fires with old and new role", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Role Change Org" }
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

      const logs = await getLogsOfType(t, "memberRoleChanged");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.userId).toBe("bob");
      expect(logs[0].data.oldRole).toBe("member");
      expect(logs[0].data.newRole).toBe("admin");
      expect(logs[0].data.changedBy).toBe("alice");
    });

    test("onMemberLeft fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asBob = t.withIdentity({
        subject: "bob",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Leave Hook Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
        organizationId: orgId,
      });

      const logs = await getLogsOfType(t, "memberLeft");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.userId).toBe("bob");
    });

    // -- Team hooks --

    test("onTeamCreated fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Team Hook Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      const logs = await getLogsOfType(t, "teamCreated");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.teamId).toBe(teamId);
      expect(logs[0].data.name).toBe("Engineering");
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.createdBy).toBe("alice");
    });

    test("onTeamDeleted fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Team Delete Hook Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "To Delete Team",
      });

      await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId });

      const logs = await getLogsOfType(t, "teamDeleted");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.teamId).toBe(teamId);
      expect(logs[0].data.name).toBe("To Delete Team");
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.deletedBy).toBe("alice");
    });

    test("onTeamMemberAdded fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Team Member Hook Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      const logs = await getLogsOfType(t, "teamMemberAdded");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.teamId).toBe(teamId);
      expect(logs[0].data.userId).toBe("bob");
      expect(logs[0].data.addedBy).toBe("alice");
    });

    test("onTeamMemberRemoved fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Team Remove Hook Org" }
      );

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      await asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      const logs = await getLogsOfType(t, "teamMemberRemoved");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.teamId).toBe(teamId);
      expect(logs[0].data.userId).toBe("bob");
      expect(logs[0].data.removedBy).toBe("alice");
    });

    // -- Invitation hooks --

    test("onInvitationAccepted fires with correct data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asBob = t.withIdentity({
        subject: "bob",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Accept Hook Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          email: "bob@example.com",
          role: "admin",
        }
      );

      await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
        invitationId,
      });

      const logs = await getLogsOfType(t, "invitationAccepted");
      expect(logs).toHaveLength(1);
      expect(logs[0].data.invitationId).toBe(invitationId);
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.organizationName).toBe("Accept Hook Org");
      expect(logs[0].data.userId).toBe("bob");
      expect(logs[0].data.role).toBe("admin");
      expect(logs[0].data.email).toBe("bob@example.com");
    });
  });
});
