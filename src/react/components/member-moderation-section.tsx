"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { Shield, UserX, UserCheck, Loader2 } from "lucide-react";
import { useTenants } from "../providers/tenants-context.js";

/**
 * Member moderation: suspend/unsuspend and bulk remove.
 * Renders only when api exposes suspendMember / unsuspendMember / bulkRemoveMembers.
 */
export function MemberModerationSection() {
  const { currentOrganization, api } = useTenants();
  const a = api as Record<string, FunctionReference<"query"> | FunctionReference<"mutation"> | undefined>;

  const currentMember = useQuery(
    (a.getCurrentMember ?? a.listOrganizations) as FunctionReference<"query">,
    a.getCurrentMember && currentOrganization?._id
      ? { organizationId: currentOrganization._id }
      : "skip"
  ) as { userId: string } | null | undefined;

  const membersWithStatus = useQuery(
    a.listMembers as FunctionReference<"query">,
    currentOrganization?._id ? { organizationId: currentOrganization._id, status: "all" } : "skip"
  ) as Array<{ userId: string; role: string; status?: string; user?: { name?: string; email?: string } }> | undefined;

  const suspendMember = useMutation((a.suspendMember ?? a.updateMemberRole) as FunctionReference<"mutation">);
  const unsuspendMember = useMutation((a.unsuspendMember ?? a.updateMemberRole) as FunctionReference<"mutation">);
  const bulkRemoveMembersMut = useMutation((a.bulkRemoveMembers ?? a.updateMemberRole) as FunctionReference<"mutation">);

  const [actingId, setActingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRemoving, setBulkRemoving] = useState(false);

  if (!currentOrganization || !a.suspendMember || !a.unsuspendMember || !membersWithStatus?.length) return null;

  const list = membersWithStatus;
  const currentUserId = currentMember?.userId;
  const canModerate = (m: { role: string; userId: string }) =>
    m.role !== "owner" && m.userId !== currentUserId;
  const removableList = list.filter(canModerate);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSuspend = async (memberUserId: string) => {
    setActingId(memberUserId);
    try {
      await suspendMember({ organizationId: currentOrganization._id, memberUserId });
    } finally {
      setActingId(null);
    }
  };

  const handleUnsuspend = async (memberUserId: string) => {
    setActingId(memberUserId);
    try {
      await unsuspendMember({ organizationId: currentOrganization._id, memberUserId });
    } finally {
      setActingId(null);
    }
  };

  const handleBulkRemove = async () => {
    if (selectedIds.size === 0 || !a.bulkRemoveMembers) return;
    setBulkRemoving(true);
    try {
      await bulkRemoveMembersMut({
        organizationId: currentOrganization._id,
        memberUserIds: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
    } finally {
      setBulkRemoving(false);
    }
  };

  return (
    <section className="mt-6 rounded-xl border bg-background p-6 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <Shield className="size-5 text-primary" />
        Member moderation
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Suspend or unsuspend members. Suspended members cannot perform actions in this organization.
        {removableList.length > 0 && a.bulkRemoveMembers && " You can also remove multiple members at once."}
      </p>
      {removableList.length > 0 && selectedIds.size > 0 && a.bulkRemoveMembers && (
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleBulkRemove}
            disabled={bulkRemoving}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {bulkRemoving ? <Loader2 className="size-4 animate-spin" /> : null}
            Remove {selectedIds.size} selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex h-9 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Clear selection
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="w-8 px-2 py-2 font-medium text-muted-foreground">
                {removableList.length > 0 && a.bulkRemoveMembers ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.size === removableList.length && removableList.length > 0}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? new Set(removableList.map((m) => m.userId)) : new Set())
                    }
                    aria-label="Select all"
                  />
                ) : null}
              </th>
              <th className="px-4 py-2 font-medium text-muted-foreground">Member</th>
              <th className="px-4 py-2 font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((m) => {
              const isActive = (m.status ?? "active") === "active";
              const canAct = canModerate(m);
              return (
                <tr key={m.userId} className="hover:bg-muted/30">
                  <td className="w-8 px-2 py-2">
                    {canAct && a.bulkRemoveMembers ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.userId)}
                        onChange={() => toggleSelect(m.userId)}
                        aria-label={`Select ${m.user?.name ?? m.userId}`}
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-2">{m.user?.name ?? m.user?.email ?? m.userId}</td>
                  <td className="px-4 py-2 text-muted-foreground">{m.role}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        isActive ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                      }
                    >
                      {isActive ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {canAct ? (
                      isActive ? (
                        <button
                          type="button"
                          onClick={() => handleSuspend(m.userId)}
                          disabled={actingId === m.userId}
                          className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                        >
                          {actingId === m.userId ? <Loader2 className="size-3 animate-spin" /> : <UserX className="size-3" />}
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUnsuspend(m.userId)}
                          disabled={actingId === m.userId}
                          className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200"
                        >
                          {actingId === m.userId ? <Loader2 className="size-3 animate-spin" /> : <UserCheck className="size-3" />}
                          Unsuspend
                        </button>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
