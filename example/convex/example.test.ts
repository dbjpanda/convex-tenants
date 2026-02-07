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

    const orgId = await asUser.mutation(api.example.directCreateOrganization, {
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

    const orgs = await asUser.query(api.example.directListOrganizations, {});

    expect(orgs).toEqual([]);
  });

  test("create and list organizations", async () => {
    const t = initConvexTest();

    const asUser = t.withIdentity({
      subject: "user789",
      issuer: "https://example.com",
    });

    const orgId = await asUser.mutation(api.example.directCreateOrganization, {
      name: "My Org",
      slug: "my-org",
    });

    expect(orgId).toBeDefined();

    const orgs = await asUser.query(api.example.directListOrganizations, {});

    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe("My Org");
    expect(orgs[0].slug).toBe("my-org");
    expect(orgs[0].role).toBe("owner");
  });
});

// ============================================================================
// makeTenantsAPI tests — auth enforcement, enrichment, callbacks
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

      const orgs = await t.query(api.example.strictListOrganizations, {});

      expect(orgs).toEqual([]);
    });

    test("getCurrentMember returns null when unauthenticated", async () => {
      const t = initConvexTest();

      const member = await t.query(api.example.strictGetCurrentMember, {
        organizationId: "nonexistent",
      });

      expect(member).toBeNull();
    });

    test("checkPermission returns no permission when unauthenticated", async () => {
      const t = initConvexTest();

      const result = await t.query(api.example.strictCheckPermission, {
        organizationId: "nonexistent",
        minRole: "member",
      });

      expect(result).toEqual({ hasPermission: false, currentRole: null });
    });

    test("isTeamMember returns false when unauthenticated", async () => {
      const t = initConvexTest();

      const result = await t.query(api.example.strictIsTeamMember, {
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
        t.mutation(api.example.strictCreateOrganization, { name: "Test Org" })
      ).rejects.toThrow("Not authenticated");
    });

    test("inviteMember throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.example.strictInviteMember, {
          organizationId: "nonexistent",
          email: "test@example.com",
          role: "member",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("leaveOrganization throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.example.strictLeaveOrganization, {
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
        api.example.strictCreateOrganization,
        { name: "Enrichment Org" }
      );

      await asAlice.mutation(api.example.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // List members — each should have a `user` field from getUser.
      // The `user` field is added dynamically by getUser enrichment,
      // so we cast to `any` for the assertion.
      const members: any[] = await asAlice.query(
        api.example.strictListMembers,
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
        api.example.strictCreateOrganization,
        { name: "Get Member Org" }
      );

      const member: any = await asAlice.query(api.example.strictGetMember, {
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
        api.example.strictCreateOrganization,
        { name: "Team Enrichment Org" }
      );

      await asAlice.mutation(api.example.strictAddMember, {
        organizationId: orgId,
        memberUserId: "charlie",
        role: "member",
      });

      const teamId = await asAlice.mutation(api.example.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.example.strictAddTeamMember, {
        teamId,
        memberUserId: "charlie",
      });

      // List team members — should have user data
      const teamMembers: any[] = await asAlice.query(
        api.example.strictListTeamMembers,
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
        api.example.strictCreateOrganization,
        { name: "Callback Test Org" }
      );

      const result = await asAlice.mutation(api.example.strictInviteMember, {
        organizationId: orgId,
        email: "invited@example.com",
        role: "admin",
      });

      // Verify the callback wrote to the callbackLog table
      const logs = await t.query(api.example.getCallbackLogs, {});

      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe("invitationCreated");
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
        api.example.strictCreateOrganization,
        { name: "Inviter Name Org" }
      );

      await asBob.mutation(api.example.strictInviteMember, {
        organizationId: orgId,
        email: "someone@example.com",
        role: "member",
      });

      const logs = await t.query(api.example.getCallbackLogs, {});

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
        api.example.strictCreateOrganization,
        { name: "Resend Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.example.strictInviteMember,
        {
          organizationId: orgId,
          email: "resend@example.com",
          role: "member",
        }
      );

      // Resend the invitation
      await asAlice.mutation(api.example.strictResendInvitation, {
        invitationId,
      });

      // Should have 2 logs: invitationCreated + invitationResent
      const logs = await t.query(api.example.getCallbackLogs, {});

      expect(logs).toHaveLength(2);

      const createdLog = logs.find((l: any) => l.type === "invitationCreated");
      const resentLog = logs.find((l: any) => l.type === "invitationResent");

      expect(createdLog).toBeDefined();
      expect(resentLog).toBeDefined();

      expect(resentLog!.data.email).toBe("resend@example.com");
      expect(resentLog!.data.organizationName).toBe("Resend Org");
      expect(resentLog!.data.role).toBe("member");
      expect(resentLog!.data.inviterName).toBe("User alice");
      expect(resentLog!.data.organizationId).toBe(orgId);
    });
  });
});
