"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { Users, Loader2 } from "lucide-react";
import { useTenantsData } from "../providers/tenants-context.js";
import { Button } from "../ui/button.js";
import { Textarea } from "../ui/textarea.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";

/**
 * Bulk invite members by email (one per line or comma-separated).
 * Renders only when api exposes bulkInviteMembers.
 */
export function BulkInviteSection() {
  const { currentOrganization, api } = useTenantsData();
  const a = api as Record<string, FunctionReference<"mutation"> | undefined>;

  const bulkInvite = useMutation((a.bulkInviteMembers ?? a.inviteMember) as FunctionReference<"mutation">);
  const [emailsText, setEmailsText] = useState("");
  const [role, setRole] = useState("member");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  if (!currentOrganization || !a.bulkInviteMembers) return null;

  const handleBulkInvite = async () => {
    const emails = emailsText
      .split(/[\n,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await bulkInvite({
        organizationId: currentOrganization._id,
        invitations: emails.map((email) => ({ inviteeIdentifier: email, role })),
      }) as { success?: unknown[]; errors?: unknown[] };
      setResult({
        success: res.success?.length ?? 0,
        errors: res.errors?.length ?? 0,
      });
      if ((res.success?.length ?? 0) > 0) setEmailsText("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-6 rounded-xl border bg-background p-6 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <Users className="size-5 text-primary" />
        Bulk invite
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Invite multiple people by email (one per line or comma-separated). Same role for all.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="bulk-invite-emails" className="mb-1 block text-sm font-medium">Emails</label>
          <Textarea
            id="bulk-invite-emails"
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            placeholder="alice@example.com, bob@example.com"
            rows={3}
          />
        </div>
        <div>
          <label htmlFor="bulk-invite-role" className="mb-1 block text-sm font-medium">Role</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="bulk-invite-role" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={handleBulkInvite}
          disabled={submitting || !emailsText.trim()}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Bulk invite
        </Button>
      </div>
      {result && (
        <p className="mt-3 text-sm text-muted-foreground">
          Sent: {result.success}. Failed: {result.errors}.
        </p>
      )}
    </section>
  );
}
