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
} from "lucide-react";
import { useTenantsData, useTenantsActions } from "../providers/tenants-context.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";

/**
 * Organization settings: logo, details (name, slug, status), transfer ownership, leave, danger zone.
 * Optional api: getCurrentMember, transferOwnership, generateLogoUploadUrl.
 */
export function OrgSettingsPanel() {
  const { currentOrganization, currentRole, members, api } = useTenantsData();
  const {
    updateOrganization,
    deleteOrganization,
    leaveOrganization,
    onToast,
  } = useTenantsActions();

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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    setName(currentOrganization?.name ?? "");
    setSlug(currentOrganization?.slug ?? "");
    setStatus(currentOrganization?.status ?? "active");
    setDeleteOpen(false);
    setDeleteConfirmValue("");
    setLeaveOpen(false);
    setTransferOpen(false);
    setTransferTargetUserId("");
  }, [currentOrganization?._id, currentOrganization?.name, currentOrganization?.slug, currentOrganization?.status]);

  const handleSave = async () => {
    if (!currentOrganization) return;
    setSaving(true);
    try {
      await updateOrganization({ name, slug, status });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrganization || !a.generateLogoUploadUrl) return;
    setLogoUploading(true);
    try {
      const uploadUrl = await generateLogoUploadUrlMut();
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) {
        throw new Error("Logo upload failed");
      }
      const { storageId } = (await res.json()) as { storageId: string };
      await updateOrganization({ logo: storageId });
    } catch {
      onToast?.("Failed to upload logo", "error");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  };

  const handleConfirmDelete = async () => {
    if (!currentOrganization) return;
    if (deleteConfirmValue !== currentOrganization.name) return;
    await deleteOrganization();
    setDeleteOpen(false);
    setDeleteConfirmValue("");
  };

  const handleConfirmLeave = async () => {
    await leaveOrganization();
    setLeaveOpen(false);
  };

  const handleConfirmTransfer = async () => {
    if (!currentOrganization || !transferTargetUserId) return;
    setTransferring(true);
    try {
      await transferOwnershipMut({
        organizationId: currentOrganization._id,
        newOwnerUserId: transferTargetUserId,
      });
      setTransferTargetUserId("");
      setTransferOpen(false);
    } finally {
      setTransferring(false);
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
            <label
              htmlFor="org-settings-logo-upload"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
            >
              {logoUploading ? <Loader2 className="size-4 animate-spin" /> : null}
              <input
                id="org-settings-logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={logoUploading}
                onChange={handleLogoUpload}
              />
              {logoUploading ? "Uploading…" : "Upload logo"}
            </label>
            {currentOrganization.logo && (
              <Button
                type="button"
                variant="outline"
                onClick={() => updateOrganization({ logo: null })}
              >
                Clear logo
              </Button>
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
            <label htmlFor="org-settings-name" className="mb-1 block text-sm font-medium">Name</label>
            <Input
              id="org-settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div>
            <label htmlFor="org-settings-slug" className="mb-1 block text-sm font-medium">Slug</label>
            <Input
              id="org-settings-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
              className="max-w-md"
            />
          </div>
          <div>
            <label htmlFor="org-settings-status" className="mb-1 block text-sm font-medium">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "suspended" | "archived")}>
              <SelectTrigger id="org-settings-status" className="max-w-md w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">Suspended/archived orgs block member mutations until set back to active.</p>
          </div>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <CheckCircle className="size-4" /> : <Check className="size-4" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </section>

      {isOwner && a.transferOwnership && otherMembers.length > 0 && (
        <section className="rounded-xl border bg-background p-6 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <Crown className="size-5 text-amber-500" />
            Transfer Ownership
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">Make another member the owner. You will become an admin.</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setTransferOpen(true)}
            className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
          >
            <Crown className="size-4" /> Transfer ownership to another member
          </Button>

          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer ownership</DialogTitle>
                <DialogDescription>
                  Choose a member to become the new owner. You will be demoted to admin.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <label htmlFor="org-transfer-target" className="mb-1 block text-sm font-medium">New owner</label>
                <Select value={transferTargetUserId} onValueChange={setTransferTargetUserId}>
                  <SelectTrigger id="org-transfer-target" className="w-full">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherMembers.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.user?.name ?? m.user?.email ?? m.userId} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transferring}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmTransfer}
                  disabled={!transferTargetUserId || transferring}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  {transferring ? <Loader2 className="size-4 animate-spin" /> : null}
                  Confirm transfer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
        <Button
          type="button"
          variant="outline"
          onClick={() => setLeaveOpen(true)}
          className="border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-orange-400"
        >
          <DoorOpen className="size-4" /> Leave Organization
        </Button>

        <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave organization?</DialogTitle>
              <DialogDescription>
                You will lose access to all resources in {currentOrganization.name}. This action can
                only be undone by being re-invited.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLeaveOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmLeave}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                Yes, leave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {isOwner && (
        <section className="rounded-xl border border-red-200 bg-background p-6 shadow-sm dark:border-red-900">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-red-600 dark:text-red-400">
            <Trash2 className="size-5" /> Danger Zone
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">Permanently delete this organization, all members, teams, and invitations. This action cannot be undone.</p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" /> Delete Organization
          </Button>

          <Dialog
            open={deleteOpen}
            onOpenChange={(v) => {
              setDeleteOpen(v);
              if (!v) setDeleteConfirmValue("");
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-red-600 dark:text-red-400">Delete organization</DialogTitle>
                <DialogDescription>
                  This will permanently delete <strong>{currentOrganization.name}</strong>, all its
                  members, teams, and invitations. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <label htmlFor="org-delete-confirm" className="mb-1 block text-sm font-medium">
                  Type &quot;{currentOrganization.name}&quot; to confirm
                </label>
                <Input
                  id="org-delete-confirm"
                  value={deleteConfirmValue}
                  onChange={(e) => setDeleteConfirmValue(e.target.value)}
                  placeholder={currentOrganization.name}
                  className="border-red-300 dark:border-red-800"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirmValue(""); }}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirmValue !== currentOrganization.name}
                >
                  <Trash2 className="size-4" /> Delete Organization
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      )}
    </div>
  );
}
