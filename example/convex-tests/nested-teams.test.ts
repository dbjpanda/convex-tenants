import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - nested teams", () => {
  test("createTeam with parentTeamId creates child team", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Nested Org",
      slug: "nested",
    });
    const parentId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Parent Team",
    });

    const childId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Child Team",
      parentTeamId: parentId,
    });

    const parent = await asAlice.query(api.testHelpers.strictGetTeam, { teamId: parentId });
    const child = await asAlice.query(api.testHelpers.strictGetTeam, { teamId: childId });
    expect(parent?.parentTeamId).toBeUndefined();
    expect(child?.parentTeamId).toBe(parentId);
  });

  test("listTeams with parentTeamId null returns only root teams", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Root Filter Org",
      slug: "root-filter",
    });
    const parentId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Parent",
    });
    await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Child",
      parentTeamId: parentId,
    });

    const roots = await asAlice.query(api.testHelpers.strictListTeams, {
      organizationId: orgId,
      parentTeamId: null,
    });
    expect(roots).toHaveLength(1);
    expect(roots[0].name).toBe("Parent");
  });

  test("listTeams with parentTeamId returns only children of that team", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Children Filter Org",
      slug: "children-filter",
    });
    const parentId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Parent",
    });
    await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Child A",
      parentTeamId: parentId,
    });
    await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Child B",
      parentTeamId: parentId,
    });

    const children = await asAlice.query(api.testHelpers.strictListTeams, {
      organizationId: orgId,
      parentTeamId: parentId,
    });
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.name).sort()).toEqual(["Child A", "Child B"]);
  });

  test("listTeamsAsTree returns hierarchy with team and children", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Tree Org",
      slug: "tree",
    });
    const parentId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Parent",
    });
    await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Child",
      parentTeamId: parentId,
    });

    const tree = await asAlice.query(api.testHelpers.strictListTeamsAsTree, {
      organizationId: orgId,
    });
    expect(tree).toHaveLength(1);
    expect(tree[0].team.name).toBe("Parent");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].team.name).toBe("Child");
    expect(tree[0].children[0].children).toHaveLength(0);
  });

  test("updateTeam parentTeamId can set and clear parent", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Update Parent Org",
      slug: "update-parent",
    });
    const parentId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Parent",
    });
    const childId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Child",
      parentTeamId: parentId,
    });

    await asAlice.mutation(api.testHelpers.strictUpdateTeam, {
      teamId: childId,
      parentTeamId: null,
    });
    let child = await asAlice.query(api.testHelpers.strictGetTeam, { teamId: childId });
    expect(child?.parentTeamId).toBeUndefined();

    await asAlice.mutation(api.testHelpers.strictUpdateTeam, {
      teamId: childId,
      parentTeamId: parentId,
    });
    child = await asAlice.query(api.testHelpers.strictGetTeam, { teamId: childId });
    expect(child?.parentTeamId).toBe(parentId);
  });

  test("updateTeam parentTeamId rejects cycle", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Cycle Org",
      slug: "cycle",
    });
    const parentId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Parent",
    });
    const childId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Child",
      parentTeamId: parentId,
    });

    await expect(
      asAlice.mutation(api.testHelpers.strictUpdateTeam, {
        teamId: parentId,
        parentTeamId: childId,
      })
    ).rejects.toThrow(/cycle|invalid/i);
  });

  test("deleteTeam reparents children to grandparent", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Reparent Org",
      slug: "reparent",
    });
    const parentId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Parent",
    });
    const childId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Child",
      parentTeamId: parentId,
    });

    await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId: parentId });

    const child = await asAlice.query(api.testHelpers.strictGetTeam, { teamId: childId });
    expect(child).not.toBeNull();
    expect(child?.parentTeamId).toBeUndefined();
  });
});
