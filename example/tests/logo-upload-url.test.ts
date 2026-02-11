import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - generateLogoUploadUrl", () => {
  test("generateLogoUploadUrl returns URL when option is provided", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const url = await asAlice.mutation(api.testHelpers.strictGenerateLogoUploadUrl, {});

    expect(url).toBe("https://fake-upload-url.test/convex-upload");
  });

  test("generateLogoUploadUrl throws when unauthenticated", async () => {
    const t = initConvexTest();

    await expect(t.mutation(api.testHelpers.strictGenerateLogoUploadUrl, {})).rejects.toThrow(
      "Not authenticated"
    );
  });
});
