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
  // Cross-org membership enforcement: authenticated user can't see another org
  // --------------------------------------------------------------------------

  describe("cross-org membership enforcement", () => {
    test("getOrganization rejects non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Alice Private Org",
      });

      // Bob is authenticated but not a member — should be rejected
      await expect(
        asBob.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("listMembers rejects non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Alice Members Org",
      });

      await expect(
        asBob.query(api.testHelpers.strictListMembers, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("listTeams rejects non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Alice Teams Org",
      });

      await expect(
        asBob.query(api.testHelpers.strictListTeams, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("listInvitations rejects non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Alice Invitations Org",
      });

      await expect(
        asBob.query(api.testHelpers.strictListInvitations, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
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
    test("listOrganizations returns orgs for authenticated user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org A",
      });
      await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org B",
      });

      const orgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
      expect(orgs).toHaveLength(2);
      expect(orgs.map((o: any) => o.name)).toContain("Org A");
      expect(orgs.map((o: any) => o.name)).toContain("Org B");
    });

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

    test("getOrganization throws for nonexistent ID (does not leak existence)", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // Membership check runs before data fetch — a nonexistent org returns
      // the same error as a real org the user doesn't belong to, preventing
      // existence-leaking via error messages.
      await expect(
        asAlice.query(api.testHelpers.strictGetOrganization, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not a member of this organization");
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

      const org = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
        slug: "slug-test-org",
      });

      expect(org).not.toBeNull();
      expect(org?.name).toBe("Slug Test Org");
    });

    test("getOrganizationBySlug returns null for nonexistent slug", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const org = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
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

      const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
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

      // After deletion, Alice is no longer a member — membership check fails.
      // Verify the org is gone by checking that membership throws.
      await expect(
        asAlice.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");

      await expect(
        asAlice.query(api.testHelpers.strictListTeams, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
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
    test("getCurrentMember returns current user membership", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Current Member Org",
      });

      const member = await asAlice.query(api.testHelpers.strictGetCurrentMember, {
        organizationId: orgId,
      });
      expect(member).not.toBeNull();
      expect(member?.userId).toBe("alice");
      expect(member?.role).toBe("owner");
    });

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

      const teams = await asAlice.query(api.testHelpers.strictListTeams, {
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

      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });

      expect(team).not.toBeNull();
      expect(team?.name).toBe("Engineering");
      expect(team?.description).toBe("The eng team");
    });

    test("getTeam returns null for nonexistent ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // Authenticated but team doesn't exist — underlying component returns null.
      const team = await asAlice.query(api.testHelpers.strictGetTeam, {
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

      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
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

      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
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

      const invitations = await asAlice.query(api.testHelpers.strictListInvitations, {
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
      const asTarget = t.withIdentity({
        subject: "target",
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

      // Must be authenticated to query pending invitations
      const pending = await asTarget.query(
        api.testHelpers.strictGetPendingInvitations,
        { email: "target@example.com" }
      );

      expect(pending).toHaveLength(2);

      // Unauthenticated callers are rejected
      await expect(
        t.query(api.testHelpers.strictGetPendingInvitations, {
          email: "target@example.com",
        })
      ).rejects.toThrow("Not authenticated");
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
      const member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member).not.toBeNull();
      expect(member?.role).toBe("admin");

      // Verify invitation status changed
      const invitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
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

  // --------------------------------------------------------------------------
  // Leave organization — happy path + last-owner protection
  // --------------------------------------------------------------------------

  describe("leaveOrganization", () => {
    test("member can leave organization", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Leave Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // Bob leaves
      await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
        organizationId: orgId,
      });

      // Verify via Alice that bob is gone
      const members = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
      });
      const bobMember = members.find((m: any) => m.userId === "bob");
      expect(bobMember).toBeUndefined();
    });

    test("last owner cannot leave organization", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Last Owner Org",
      });

      // Alice is the only owner — cannot leave
      await expect(
        asAlice.mutation(api.testHelpers.strictLeaveOrganization, {
          organizationId: orgId,
        })
      ).rejects.toThrow();
    });

    test("non-creator owner can leave if another owner exists", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Multi Owner Org",
      });

      // Add bob as owner
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "owner",
      });

      // Bob (non-creator owner) can leave — Alice (creator) remains
      await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
        organizationId: orgId,
      });

      const members = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
      });
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe("alice");
    });

    test("leaving cleans up team memberships", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Team Cleanup Org",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Verify bob is a team member
      const isTeamMemberBefore = await asBob.query(api.testHelpers.strictIsTeamMember, {
        teamId,
      });
      expect(isTeamMemberBefore).toBe(true);

      // Bob leaves the org
      await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
        organizationId: orgId,
      });

      // Verify bob is no longer a team member
      const teamMembers = await asAlice.query(api.testHelpers.strictListTeamMembers, {
        teamId,
      });
      const bobInTeam = teamMembers.find((m: any) => m.userId === "bob");
      expect(bobInTeam).toBeUndefined();
    });

    test("leaveOrganization throws for non-member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Non Member Leave Org",
      });

      // Bob is not a member — should throw
      await expect(
        asBob.mutation(api.testHelpers.strictLeaveOrganization, {
          organizationId: orgId,
        })
      ).rejects.toThrow("Not a member of this organization");
    });

    test("onMemberLeft callback fires", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Leave Callback Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
        organizationId: orgId,
      });

      const logs = await t.query(api.testHelpers.getCallbackLogs, {});
      const leftLogs = logs.filter((l: any) => l.type === "memberLeft");
      expect(leftLogs).toHaveLength(1);
      expect(leftLogs[0].data.organizationId).toBe(orgId);
      expect(leftLogs[0].data.userId).toBe("bob");
    });
  });

  // --------------------------------------------------------------------------
  // Error paths — team not found, invitation not found
  // --------------------------------------------------------------------------

  describe("error paths", () => {
    test("updateTeam throws for nonexistent team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictUpdateTeam, {
          teamId: "nonexistent",
          name: "New Name",
        })
      ).rejects.toThrow("Team not found");
    });

    test("deleteTeam throws for nonexistent team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictDeleteTeam, {
          teamId: "nonexistent",
        })
      ).rejects.toThrow("Team not found");
    });

    test("addTeamMember throws for nonexistent team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictAddTeamMember, {
          teamId: "nonexistent",
          memberUserId: "bob",
        })
      ).rejects.toThrow("Team not found");
    });

    test("removeTeamMember throws for nonexistent team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
          teamId: "nonexistent",
          memberUserId: "bob",
        })
      ).rejects.toThrow("Team not found");
    });

    test("resendInvitation throws for nonexistent invitation", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictResendInvitation, {
          invitationId: "nonexistent",
        })
      ).rejects.toThrow("Invitation not found");
    });

    test("cancelInvitation throws for nonexistent invitation", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      await expect(
        asAlice.mutation(api.testHelpers.strictCancelInvitation, {
          invitationId: "nonexistent",
        })
      ).rejects.toThrow("Invitation not found");
    });

    test("updateOrganization with slug updates the slug", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Slug Update Org",
      });

      await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
        organizationId: orgId,
        slug: "custom-slug",
      });

      const org = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
        slug: "custom-slug",
      });
      expect(org).not.toBeNull();
      expect(org?.name).toBe("Slug Update Org");
    });

    test("removeMember cleans up team memberships", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Remove Member Cleanup Org",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Remove bob from org — should also clean up team membership
      await asAlice.mutation(api.testHelpers.strictRemoveMember, {
        organizationId: orgId,
        memberUserId: "bob",
      });

      const teamMembers = await asAlice.query(api.testHelpers.strictListTeamMembers, {
        teamId,
      });
      const bobInTeam = teamMembers.find((m: any) => m.userId === "bob");
      expect(bobInTeam).toBeUndefined();
    });

    test("deleteOrganization cleans up team members", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Delete Cleanup Org",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Delete org — should cascade cleanup
      await asAlice.mutation(api.testHelpers.strictDeleteOrganization, {
        organizationId: orgId,
      });

      // Org is gone, membership check should fail
      await expect(
        asAlice.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
      ).rejects.toThrow("Not a member of this organization");
    });
  });

  // --------------------------------------------------------------------------
  // Cascading operations — team relation cleanup, invitation with teamId
  // --------------------------------------------------------------------------

  describe("cascading operations", () => {
    test("deleteTeam cleans up team member relations", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Delete Team Cleanup Org",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Delete the team
      await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId });

      // Team is gone
      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team).toBeNull();
    });

    test("removeTeamMember removes team relation", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Remove Team Member Org",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Verify bob is a team member
      const isMemberBefore = await asBob.query(api.testHelpers.strictIsTeamMember, {
        teamId,
      });
      expect(isMemberBefore).toBe(true);

      // Remove bob from team
      await asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      // Verify bob is no longer a team member
      const isMemberAfter = await asBob.query(api.testHelpers.strictIsTeamMember, {
        teamId,
      });
      expect(isMemberAfter).toBe(false);
    });

    test("acceptInvitation with teamId adds user to team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Invite With Team Org",
      });

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      // Invite bob with teamId
      const { invitationId } = await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        email: "bob@example.com",
        role: "member",
        teamId,
      });

      // Bob accepts
      await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
        invitationId,
      });

      // Verify bob is a member of the org
      const member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member).not.toBeNull();

      // Verify bob is also a member of the team
      const isMember = await asBob.query(api.testHelpers.strictIsTeamMember, {
        teamId,
      });
      expect(isMember).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Authorization API endpoints
  // --------------------------------------------------------------------------

  describe("authorization API", () => {
    test("checkPermission returns allowed for owner", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Check Permission Org",
      });

      const result = await asAlice.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "organizations:update",
      });

      expect(result.allowed).toBe(true);
    });

    test("checkPermission returns denied for non-owner permission", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Deny Permission Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // Member should not have organizations:delete
      const result = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "organizations:delete",
      });

      expect(result.allowed).toBe(false);
    });

    test("checkPermission throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictCheckPermission, {
          organizationId: "nonexistent",
          permission: "organizations:read",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("getUserPermissions returns permissions for user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Get Permissions Org",
      });

      const perms = await asAlice.query(api.testHelpers.strictGetUserPermissions, {
        organizationId: orgId,
      });

      expect(perms).toBeDefined();
      // Owner should have permissions
      expect(perms.permissions.length).toBeGreaterThan(0);
    });

    test("getUserPermissions throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetUserPermissions, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("getUserRoles returns roles for user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Get Roles Org",
      });

      const roles = await asAlice.query(api.testHelpers.strictGetUserRoles, {
        organizationId: orgId,
      });

      expect(roles).toBeDefined();
      expect(Array.isArray(roles)).toBe(true);
      // Owner should have the owner role
      expect(roles.length).toBeGreaterThan(0);
    });

    test("getUserRoles throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetUserRoles, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("getAuditLog returns audit entries", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // Create an org to generate audit entries
      await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Audit Org",
      });

      const logs = await asAlice.query(api.testHelpers.strictGetAuditLog, {});

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    });

    test("getAuditLog throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetAuditLog, {})
      ).rejects.toThrow("Not authenticated");
    });

    test("grantPermission grants permission to user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Grant Perm Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // Owner grants a direct permission to bob
      const permId = await asAlice.mutation(api.testHelpers.strictGrantPermission, {
        organizationId: orgId,
        targetUserId: "bob",
        permission: "organizations:delete",
      });

      expect(permId).toBeDefined();
      expect(typeof permId).toBe("string");
    });

    test("grantPermission throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictGrantPermission, {
          organizationId: "nonexistent",
          targetUserId: "bob",
          permission: "organizations:delete",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("denyPermission denies permission for user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Deny Perm Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // Owner denies a permission for bob
      const denyId = await asAlice.mutation(api.testHelpers.strictDenyPermission, {
        organizationId: orgId,
        targetUserId: "bob",
        permission: "members:read",
      });

      expect(denyId).toBeDefined();
      expect(typeof denyId).toBe("string");
    });

    test("denyPermission throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictDenyPermission, {
          organizationId: "nonexistent",
          targetUserId: "bob",
          permission: "members:read",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });
});
