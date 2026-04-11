import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - generateLogoUploadUrl", () => {
  test("generateLogoUploadUrl returns URL when option is provided", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Logo Org",
    });

    const url = await asAlice.mutation(api.testHelpers.strictGenerateLogoUploadUrl, {
      organizationId: orgId,
    });

    expect(url).toBe("https://fake-upload-url.test/convex-upload");
  });

  test("generateLogoUploadUrl throws when unauthenticated", async () => {
    const t = initConvexTest();

    await expect(
      t.mutation(api.testHelpers.strictGenerateLogoUploadUrl, {
        organizationId: "nonexistent",
      })
    ).rejects.toThrow("Not authenticated");
  });

  test("generateLogoUploadUrl throws when caller is not a member of the org", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Alice Org",
    });

    await expect(
      asBob.mutation(api.testHelpers.strictGenerateLogoUploadUrl, {
        organizationId: orgId,
      })
    ).rejects.toThrow();
  });
});
