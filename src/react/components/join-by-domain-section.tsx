"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { Building2, Loader2 } from "lucide-react";
import { useTenants } from "../providers/tenants-context.js";

export interface JoinByDomainSectionProps {
  /**
   * Current user's email. When omitted, uses context currentUserEmail from TenantsProvider
   * (from api.getCurrentUserEmail). Section is hidden when null/undefined or when no joinable orgs.
   */
  currentUserEmail?: string | null | undefined;
}

/**
 * Lists organizations the user can join by email domain and provides a Join button.
 * Requires api.listOrganizationsJoinableByDomain and api.joinByDomain.
 * Uses api.getCurrentUserEmail (via context) when currentUserEmail prop is not passed.
 */
export function JoinByDomainSection(props: JoinByDomainSectionProps) {
  const { api, currentUserEmail: contextEmail } = useTenants();
  const currentUserEmail = props.currentUserEmail ?? contextEmail;
  const a = api as Record<string, FunctionReference<"query"> | FunctionReference<"mutation"> | undefined>;

  const joinableOrgs = useQuery(
    (a.listOrganizationsJoinableByDomain ?? a.listOrganizations) as FunctionReference<"query">,
    currentUserEmail && a.listOrganizationsJoinableByDomain ? { email: currentUserEmail } : "skip"
  ) as Array<{ _id: string; name: string; slug: string }> | undefined;

  const joinByDomain = useMutation((a.joinByDomain ?? a.inviteMember) as FunctionReference<"mutation">);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  if (
    currentUserEmail === undefined ||
    currentUserEmail === null ||
    !a.listOrganizationsJoinableByDomain ||
    !joinableOrgs?.length
  )
    return null;

  const list = joinableOrgs;

  const handleJoin = async (organizationId: string) => {
    if (!currentUserEmail || !a.joinByDomain) return;
    setJoiningId(organizationId);
    try {
      await joinByDomain({ organizationId, userEmail: currentUserEmail });
    } finally {
      setJoiningId(null);
    }
  };

  const domain = currentUserEmail.split("@")[1] ?? "";

  return (
    <section className="mt-8 rounded-xl border bg-muted/30 p-6">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <Building2 className="size-5 text-primary" />
        Organizations you can join by domain
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Orgs that allow your email domain (<code className="rounded bg-muted px-1">{domain}</code>) can be joined without an invitation.
      </p>
      <ul className="flex flex-wrap gap-2">
        {list.map((org) => (
          <li key={org._id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <span className="font-medium">{org.name}</span>
            <span className="text-muted-foreground">/{org.slug}</span>
            <button
              type="button"
              onClick={() => handleJoin(org._id)}
              disabled={joiningId === org._id || !a.joinByDomain}
              className="ml-2 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {joiningId === org._id ? <Loader2 className="size-3 animate-spin" /> : null}
              Join
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
