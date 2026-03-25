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

describe("members", () => {
  it("should add a member to organization", async () => {
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

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member).not.toBeNull();
    expect(member?.role).toBe("member");
  });

  it("should list organization members", async () => {
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
      role: "admin",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_789",
      role: "member",
    });

    const members = await t.query(api.members.listOrganizationMembers, {
      organizationId: orgId,
    });

    expect(members).toHaveLength(3); // owner + 2 members
  });

  it("should prevent duplicate member additions", async () => {
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

    await expect(
      t.mutation(api.members.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "admin",
      })
    ).rejects.toThrow();
  });

  it("should update member role", async () => {
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

    await t.mutation(api.members.updateMemberRole, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "admin",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member?.role).toBe("admin");
  });

  it("should remove member from organization", async () => {
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

    await t.mutation(api.members.removeMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member).toBeNull();
  });

  it("should prevent removing an owner", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.removeMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_123",
      })
    ).rejects.toThrow();
  });

  it("should return member role for role checking", async () => {
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

    const owner = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_123",
    });
    expect(owner).not.toBeNull();
    expect(owner!.role).toBe("owner");

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });
    expect(member).not.toBeNull();
    expect(member!.role).toBe("member");

    const stranger = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "unknown_user",
    });
    expect(stranger).toBeNull();
  });

  it("should allow member to leave organization", async () => {
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

    await t.mutation(api.members.leaveOrganization, {
      userId: "user_456",
      organizationId: orgId,
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member).toBeNull();
  });

  it("should prevent sole owner from leaving", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.leaveOrganization, {
        userId: "user_123",
        organizationId: orgId,
      })
    ).rejects.toThrow();
  });

  it("non-members return null from getMember", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "stranger_user",
    });

    expect(member).toBeNull();
  });

  it("removeMember throws for nonexistent member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.removeMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "nonexistent_user",
      })
    ).rejects.toThrow("Member not found");
  });

  it("updateMemberRole throws for nonexistent member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.updateMemberRole, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "nonexistent_user",
        role: "admin",
      })
    ).rejects.toThrow("Member not found");
  });

  it("leaveOrganization throws for non-member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.leaveOrganization, {
        userId: "non_member",
        organizationId: orgId,
      })
    ).rejects.toThrow("You are not a member of this organization");
  });

  it("should suspend a member", async () => {
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

    await t.mutation(api.members.suspendMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member?.status).toBe("suspended");
    expect(member?.suspendedAt).toBeDefined();
  });

  it("suspendMember throws for nonexistent member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.suspendMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "nonexistent_user",
      })
    ).rejects.toThrow("Member not found");
  });

  it("suspendMember throws when suspending the owner", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.suspendMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_123",
      })
    ).rejects.toThrow("Cannot suspend the organization owner");
  });

  it("should unsuspend a suspended member", async () => {
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

    await t.mutation(api.members.suspendMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
    });

    await t.mutation(api.members.unsuspendMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member?.status).toBe("active");
  });

  it("unsuspendMember throws for nonexistent member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.unsuspendMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "nonexistent_user",
      })
    ).rejects.toThrow("Member not found");
  });

  it("should bulk add members", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const result = await t.mutation(api.members.bulkAddMembers, {
      userId: "user_123",
      organizationId: orgId,
      members: [
        { memberUserId: "user_a", role: "member" },
        { memberUserId: "user_b", role: "admin" },
      ],
    });

    expect(result.success).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.success).toContain("user_a");
    expect(result.success).toContain("user_b");

    const memberA = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_a",
    });
    expect(memberA?.role).toBe("member");

    const memberB = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_b",
    });
    expect(memberB?.role).toBe("admin");
  });

  it("bulkAddMembers reports errors for duplicate members", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_existing",
      role: "member",
    });

    const result = await t.mutation(api.members.bulkAddMembers, {
      userId: "user_123",
      organizationId: orgId,
      members: [
        { memberUserId: "user_existing", role: "admin" },
        { memberUserId: "user_new", role: "member" },
      ],
    });

    expect(result.success).toHaveLength(1);
    expect(result.success).toContain("user_new");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].userId).toBe("user_existing");
    expect(result.errors[0].code).toBe("ALREADY_EXISTS");
  });

  it("should bulk remove members", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_a",
      role: "member",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_b",
      role: "member",
    });

    const result = await t.mutation(api.members.bulkRemoveMembers, {
      userId: "user_123",
      organizationId: orgId,
      memberUserIds: ["user_a", "user_b"],
    });

    expect(result.success).toHaveLength(2);
    expect(result.errors).toHaveLength(0);

    const memberA = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_a",
    });
    expect(memberA).toBeNull();
  });

  it("bulkRemoveMembers reports errors for owner and nonexistent members", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_a",
      role: "member",
    });

    const result = await t.mutation(api.members.bulkRemoveMembers, {
      userId: "user_123",
      organizationId: orgId,
      memberUserIds: ["user_123", "nonexistent", "user_a"],
    });

    expect(result.success).toHaveLength(1);
    expect(result.success).toContain("user_a");
    expect(result.errors).toHaveLength(2);

    const ownerError = result.errors.find((e: any) => e.userId === "user_123");
    expect(ownerError?.code).toBe("FORBIDDEN");

    const notFoundError = result.errors.find((e: any) => e.userId === "nonexistent");
    expect(notFoundError?.code).toBe("NOT_FOUND");
  });

  it("should count organization members", async () => {
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

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_789",
      role: "admin",
    });

    const count = await t.query(api.members.countOrganizationMembers, {
      organizationId: orgId,
    });

    expect(count).toBe(3); // owner + 2 members
  });

  it("countOrganizationMembers filters by status", async () => {
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

    await t.mutation(api.members.suspendMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
    });

    const activeCount = await t.query(api.members.countOrganizationMembers, {
      organizationId: orgId,
      status: "active",
    });
    expect(activeCount).toBe(1); // only owner

    const suspendedCount = await t.query(api.members.countOrganizationMembers, {
      organizationId: orgId,
      status: "suspended",
    });
    expect(suspendedCount).toBe(1);

    const allCount = await t.query(api.members.countOrganizationMembers, {
      organizationId: orgId,
      status: "all",
    });
    expect(allCount).toBe(2);
  });

  it("leaveOrganization cleans up team memberships", async () => {
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

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    await t.mutation(api.teams.addTeamMember, {
      userId: "user_123",
      teamId,
      memberUserId: "bob",
    });

    const isMemberBefore = await t.query(api.teams.isTeamMember, {
      teamId,
      userId: "bob",
    });
    expect(isMemberBefore).toBe(true);

    await t.mutation(api.members.leaveOrganization, {
      userId: "bob",
      organizationId: orgId,
    });

    const isMemberAfter = await t.query(api.teams.isTeamMember, {
      teamId,
      userId: "bob",
    });
    expect(isMemberAfter).toBe(false);
  });
});
