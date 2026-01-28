import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a URL-safe slug from a name
 */
export function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return d.toLocaleDateString();
}

/**
 * Format a relative time from now
 */
export function formatRelativeTime(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (diff < 0) {
    return "Expired";
  }
  
  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} left`;
  }
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} left`;
  }
  
  return "Less than an hour left";
}

/**
 * Generate an invitation link from an invitation ID
 * 
 * @param invitationId - The invitation ID
 * @param baseUrl - Base URL (defaults to window.location.origin)
 * @param pathPattern - URL path pattern, use ":id" for the invitation ID (defaults to "/accept-invitation/:id")
 * @returns Full invitation URL
 * 
 * @example
 * ```ts
 * getInvitationLink("abc123");
 * // => "https://example.com/accept-invitation/abc123"
 * 
 * getInvitationLink("abc123", undefined, "/invite/:id");
 * // => "https://example.com/invite/abc123"
 * ```
 */
export function getInvitationLink(
  invitationId: string,
  baseUrl?: string,
  pathPattern: string = "/accept-invitation/:id"
): string {
  const base = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const path = pathPattern.replace(":id", invitationId);
  return `${base}${path}`;
}

/**
 * Copy text to clipboard with fallback
 * 
 * @param text - Text to copy
 * @returns Promise that resolves to true if successful
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers that don't support clipboard API
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      textArea.remove();
    }
  }
}
