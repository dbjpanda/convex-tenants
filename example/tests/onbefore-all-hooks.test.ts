/**
 * Integration tests for ALL onBefore* hooks.
 * Verifies each hook fires before its respective operation.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

async function getLogsOfType(t: ReturnType<typeof initConvexTest>, type: string) {
  const logs = await t.query(api.testHelpers.getCallbackLogs, {});
  return logs.filter((l: any) => l.type === type);
}

describe("onBefore hooks", () => {
  test("onBeforeUpdateOrganization fires before updateOrganization", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore Update Org",
    });
    await asAlice.mutation(api.testHelpers.onBeforeUpdateOrg, {
      organizationId: orgId, name: "Updated Name",
    });

    const logs = await getLogsOfType(t, "onBeforeUpdateOrganization");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.organizationId).toBe(orgId);
    expect(logs[0].data.name).toBe("Updated Name");
  });

  test("onBeforeDeleteOrganization fires before deleteOrganization", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore Delete Org",
    });
    await asAlice.mutation(api.testHelpers.onBeforeDeleteOrg, {
      organizationId: orgId,
    });

    const logs = await getLogsOfType(t, "onBeforeDeleteOrganization");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.organizationId).toBe(orgId);
  });

  test("onBeforeAddMember fires before addMember", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore AddMember Org",
    });
    await asAlice.mutation(api.testHelpers.onBeforeAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });

    const logs = await getLogsOfType(t, "onBeforeAddMember");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.memberUserId).toBe("bob");
    expect(logs[0].data.role).toBe("member");
  });

  test("onBeforeRemoveMember fires before removeMember", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore RemoveMember Org",
    });
    await asAlice.mutation(api.testHelpers.onBeforeAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    await asAlice.mutation(api.testHelpers.onBeforeRemoveMember, {
      organizationId: orgId, memberUserId: "bob",
    });

    const logs = await getLogsOfType(t, "onBeforeRemoveMember");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.memberUserId).toBe("bob");
  });

  test("onBeforeUpdateMemberRole fires before updateMemberRole", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore UpdateRole Org",
    });
    await asAlice.mutation(api.testHelpers.onBeforeAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    await asAlice.mutation(api.testHelpers.onBeforeUpdateMemberRole, {
      organizationId: orgId, memberUserId: "bob", role: "admin",
    });

    const logs = await getLogsOfType(t, "onBeforeUpdateMemberRole");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.memberUserId).toBe("bob");
    expect(logs[0].data.role).toBe("admin");
  });

  test("onBeforeLeaveOrganization fires before leaveOrganization", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore Leave Org",
    });
    await asAlice.mutation(api.testHelpers.onBeforeAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    await asBob.mutation(api.testHelpers.onBeforeLeaveOrg, {
      organizationId: orgId,
    });

    const logs = await getLogsOfType(t, "onBeforeLeaveOrganization");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.organizationId).toBe(orgId);
  });

  test("onBeforeCreateTeam fires before createTeam", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore CreateTeam Org",
    });
    await asAlice.mutation(api.testHelpers.onBeforeCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });

    const logs = await getLogsOfType(t, "onBeforeCreateTeam");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.name).toBe("Engineering");
  });

  test("onBeforeUpdateTeam fires before updateTeam", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore UpdateTeam Org",
    });
    const teamId = await asAlice.mutation(api.testHelpers.onBeforeCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });
    await asAlice.mutation(api.testHelpers.onBeforeUpdateTeam, {
      teamId, name: "Platform",
    });

    const logs = await getLogsOfType(t, "onBeforeUpdateTeam");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.teamId).toBe(teamId);
    expect(logs[0].data.name).toBe("Platform");
  });

  test("onBeforeDeleteTeam fires before deleteTeam", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore DeleteTeam Org",
    });
    const teamId = await asAlice.mutation(api.testHelpers.onBeforeCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });
    await asAlice.mutation(api.testHelpers.onBeforeDeleteTeam, {
      teamId,
    });

    const logs = await getLogsOfType(t, "onBeforeDeleteTeam");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.teamId).toBe(teamId);
  });

  test("onBeforeInviteMember fires before inviteMember", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "OnBefore Invite Org",
    });
    await asAlice.mutation(api.testHelpers.onBeforeInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "bob@test.com",
      identifierType: "email",
      role: "member",
    });

    const logs = await getLogsOfType(t, "onBeforeInviteMember");
    expect(logs).toHaveLength(1);
    expect(logs[0].data.inviteeIdentifier).toBe("bob@test.com");
    expect(logs[0].data.role).toBe("member");
  });
});
