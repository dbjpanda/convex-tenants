import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - invitations", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

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

    test("countInvitations returns invitation count", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Count Invitations Org" }
      );
      expect(await asAlice.query(api.testHelpers.strictCountInvitations, { organizationId: orgId })).toBe(0);

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        email: "a@example.com",
        role: "member",
      });
      expect(await asAlice.query(api.testHelpers.strictCountInvitations, { organizationId: orgId })).toBe(1);

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        email: "b@example.com",
        role: "admin",
      });
      expect(await asAlice.query(api.testHelpers.strictCountInvitations, { organizationId: orgId })).toBe(2);
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
        email: "target@test.com",
        role: "member",
      });

      await asBob.mutation(api.testHelpers.strictInviteMember, {
        organizationId: org2Id,
        email: "target@test.com",
        role: "admin",
      });

      // Must be authenticated to query pending invitations
      const pending = await asTarget.query(
        api.testHelpers.strictGetPendingInvitations,
        { email: "target@test.com" }
      );

      expect(pending).toHaveLength(2);

      // Unauthenticated callers are rejected
      await expect(
        t.query(api.testHelpers.strictGetPendingInvitations, {
          email: "target@test.com",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("getPendingInvitations blocks querying another user's email", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asTarget = t.withIdentity({
        subject: "target",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Pending Strict Org" }
      );

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        email: "alice@test.com",
        role: "member",
      });

      await expect(
        asTarget.query(api.testHelpers.strictGetPendingInvitations, {
          email: "alice@test.com",
        })
      ).rejects.toThrow("Cannot query invitations for another email");
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
          email: "bob@test.com",
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

    test("acceptInvitation rejects when authenticated email does not match invitation email", async () => {
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
        { name: "Accept Strict Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          email: "alice@test.com",
          role: "member",
        }
      );

      await expect(
        asBob.mutation(api.testHelpers.strictAcceptInvitation, {
          invitationId,
        })
      ).rejects.toThrow("Invitation email does not match authenticated user");
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
});
