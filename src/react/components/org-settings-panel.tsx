"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import {
  Building2,
  Pencil,
  DoorOpen,
  Trash2,
  Check,
  Crown,
  Loader2,
  CheckCircle,
  X,
} from "lucide-react";
import { useTenants } from "../providers/tenants-context.js";

/**
 * Organization settings: logo, details (name, slug, status, allowedDomains), transfer ownership, leave, danger zone.
 * Optional api: getCurrentMember, transferOwnership, generateLogoUploadUrl.
 */
export function OrgSettingsPanel() {
  const {
    currentOrganization,
    currentRole,
    members,
    updateOrganization,
    deleteOrganization,
    leaveOrganization,
    api,
  } = useTenants();

  const a = api as Record<string, FunctionReference<"query"> | FunctionReference<"mutation"> | undefined>;

  const currentMember = useQuery(
    (a.getCurrentMember ?? a.listOrganizations) as FunctionReference<"query">,
    a.getCurrentMember && currentOrganization?._id ? { organizationId: currentOrganization._id } : "skip"
  ) as { userId: string } | null | undefined;

  const transferOwnershipMut = useMutation((a.transferOwnership ?? a.updateOrganization) as FunctionReference<"mutation">);
  const generateLogoUploadUrlMut = useMutation((a.generateLogoUploadUrl ?? a.updateOrganization) as FunctionReference<"mutation">);

  const [name, setName] = useState(currentOrganization?.name ?? "");
  const [slug, setSlug] = useState(currentOrganization?.slug ?? "");
  const [status, setStatus] = useState<"active" | "suspended" | "archived">(currentOrganization?.status ?? "active");
  const [allowedDomains, setAllowedDomains] = useState<string[]>(currentOrganization?.allowedDomains ?? []);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    setName(currentOrganization?.name ?? "");
    setSlug(currentOrganization?.slug ?? "");
    setStatus(currentOrganization?.status ?? "active");
    setAllowedDomains(currentOrganization?.allowedDomains ?? []);
    setConfirmDelete(false);
    setConfirmLeave(false);
  }, [currentOrganization?._id, currentOrganization?.name, currentOrganization?.slug, currentOrganization?.status, currentOrganization?.allowedDomains]);

  const handleSave = async () => {
    if (!currentOrganization) return;
    setSaving(true);
    try {
      await updateOrganization({
        name,
        slug,
        status,
        allowedDomains: allowedDomains.length ? allowedDomains : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase();
    if (d && !allowedDomains.includes(d)) {
      setAllowedDomains([...allowedDomains, d]);
      setNewDomain("");
    }
  };

  const removeDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter((x) => x !== domain));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrganization || !a.generateLogoUploadUrl) return;
    setLogoUploading(true);
    try {
      const uploadUrl = await generateLogoUploadUrlMut();
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = (await res.json()) as { storageId: string };
      await updateOrganization({ logo: storageId });
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  };

  if (!currentOrganization) return null;

  const isOwner = currentRole === "owner";
  const otherMembers = members.filter((m) => m.userId !== currentMember?.userId);

  return (
    <div className="space-y-6">
      {a.generateLogoUploadUrl && (
        <section className="rounded-xl border bg-background p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Building2 className="size-5 text-primary" />
            Logo
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload an image to use as the organization logo. Stored in Convex file storage.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent">
              {logoUploading ? <Loader2 className="size-4 animate-spin" /> : null}
              <input type="file" accept="image/*" className="hidden" disabled={logoUploading} onChange={handleLogoUpload} />
              {logoUploading ? "Uploading…" : "Upload logo"}
            </label>
            {currentOrganization.logo && (
              <button
                type="button"
                onClick={() => updateOrganization({ logo: null })}
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
              >
                Clear logo
              </button>
            )}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-background p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Pencil className="size-5 text-primary" />
          Organization Details
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "suspended" | "archived")} className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Suspended/archived orgs block member mutations until set back to active.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Allowed email domains (for domain join)</label>
            <p className="mb-2 text-xs text-muted-foreground">Users whose email matches one of these domains can join this org via &quot;Join by domain&quot; without an invitation.</p>
            <div className="flex flex-wrap gap-2">
              {allowedDomains.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm">
                  {d}
                  <button type="button" onClick={() => removeDomain(d)} className="rounded hover:bg-background" aria-label={`Remove ${d}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDomain())} placeholder="e.g. company.com" className="flex h-9 flex-1 max-w-xs rounded-md border border-input bg-background px-3 text-sm" />
              <button type="button" onClick={addDomain} className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">Add domain</button>
            </div>
          </div>
          <button type="button" onClick={handleSave} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <CheckCircle className="size-4" /> : <Check className="size-4" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </section>

      {isOwner && a.transferOwnership && otherMembers.length > 0 && (
        <section className="rounded-xl border bg-background p-6 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <Crown className="size-5 text-amber-500" />
            Transfer Ownership
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">Make another member the owner. You will become an admin.</p>
          {confirmTransfer ? (
            <div className="flex flex-wrap items-center gap-3">
              <select value={transferTargetUserId} onChange={(e) => setTransferTargetUserId(e.target.value)} className="flex h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select member</option>
                {otherMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.user?.name ?? m.user?.email ?? m.userId} ({m.role})</option>
                ))}
              </select>
              <button type="button" onClick={async () => { if (transferTargetUserId) { setTransferring(true); try { await transferOwnershipMut({ organizationId: currentOrganization._id, newOwnerUserId: transferTargetUserId }); setTransferTargetUserId(""); setConfirmTransfer(false); } finally { setTransferring(false); } } }} disabled={!transferTargetUserId || transferring} className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {transferring ? <Loader2 className="size-4 animate-spin" /> : null} Confirm transfer
              </button>
              <button type="button" onClick={() => { setConfirmTransfer(false); setTransferTargetUserId(""); }} className="inline-flex h-9 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmTransfer(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40">
              <Crown className="size-4" /> Transfer ownership to another member
            </button>
          )}
        </section>
      )}

      <section className="rounded-xl border bg-background p-6 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <DoorOpen className="size-5 text-orange-500" />
          Leave Organization
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Remove yourself from this organization. You&apos;ll lose access to all resources.
          {isOwner && " As the owner, you can only leave if there's another owner."}
        </p>
        {confirmLeave ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Are you sure?</span>
            <button type="button" onClick={() => leaveOrganization()} className="inline-flex h-9 items-center gap-2 rounded-md bg-orange-600 px-3 text-sm font-medium text-white hover:bg-orange-700">Yes, Leave</button>
            <button type="button" onClick={() => setConfirmLeave(false)} className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmLeave(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-4 text-sm font-medium text-orange-700 hover:bg-orange-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-orange-400">
            <DoorOpen className="size-4" /> Leave Organization
          </button>
        )}
      </section>

      {isOwner && (
        <section className="rounded-xl border border-red-200 bg-background p-6 shadow-sm dark:border-red-900">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-red-600 dark:text-red-400">
            <Trash2 className="size-5" /> Danger Zone
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">Permanently delete this organization, all members, teams, and invitations. This action cannot be undone.</p>
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-red-600 dark:text-red-400">Type &quot;{currentOrganization.name}&quot; to confirm:</span>
              <input className="flex h-9 w-48 rounded-md border border-red-300 bg-background px-3 text-sm dark:border-red-800" placeholder={currentOrganization.name} onChange={(e) => { if (e.target.value === currentOrganization.name) deleteOrganization(); }} />
              <button type="button" onClick={() => setConfirmDelete(false)} className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700">
              <Trash2 className="size-4" /> Delete Organization
            </button>
          )}
        </section>
      )}
    </div>
  );
}
