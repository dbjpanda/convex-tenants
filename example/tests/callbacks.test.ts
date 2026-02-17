import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - event hook callbacks", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  async function getLogsOfType(testRunner: ReturnType<typeof initConvexTest>, type: string) {
    const logs = await testRunner.query(api.testHelpers.getCallbackLogs, {});
    return logs.filter((l: any) => l.type === type);
  }

  describe("event hook callbacks", () => {
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
          inviteeIdentifier: "bob@test.com",
          identifierType: "email",
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
      expect(logs[0].data.inviteeIdentifier).toBe("bob@test.com");
    });
  });
});
