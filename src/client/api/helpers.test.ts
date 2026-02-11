import { describe, expect, it } from "vitest";
import { generateSlug, normalizeEmail, orgScope } from "./helpers.js";

describe("helpers", () => {
  describe("generateSlug", () => {
    it("should convert name to lowercase slug", () => {
      expect(generateSlug("Hello World")).toBe("hello-world");
    });

    it("should remove special characters", () => {
      expect(generateSlug("Hello! World@")).toBe("hello-world");
    });

    it("should replace multiple spaces with single hyphen", () => {
      expect(generateSlug("Hello    World")).toBe("hello-world");
    });

    it("should trim leading and trailing spaces", () => {
      expect(generateSlug("  Hello World  ")).toBe("hello-world");
    });

    it("should handle underscores", () => {
      expect(generateSlug("hello_world")).toBe("hello-world");
    });

    it("should handle multiple hyphens", () => {
      expect(generateSlug("hello---world")).toBe("hello-world");
    });

    it("should handle mixed case", () => {
      expect(generateSlug("HeLLo WoRLD")).toBe("hello-world");
    });

    it("should handle numbers", () => {
      expect(generateSlug("Team 123")).toBe("team-123");
    });

    it("should handle empty string", () => {
      expect(generateSlug("")).toBe("");
    });
  });

  describe("normalizeEmail", () => {
    it("should lowercase email", () => {
      expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
    });

    it("should trim whitespace", () => {
      expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
    });
  });

  describe("orgScope", () => {
    it("should return organization scope", () => {
      expect(orgScope("org_123")).toEqual({ type: "organization", id: "org_123" });
    });
  });
});
