/**
 * Helper functions for the tenants API.
 */

export function orgScope(organizationId: string): { type: string; id: string } {
  return { type: "organization", id: organizationId };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "org"; // fallback to "org" if all characters were stripped
}
