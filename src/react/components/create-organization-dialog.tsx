"use client";

import { useState, type ReactNode, useCallback, useContext } from "react";
import { Plus, Building2 } from "lucide-react";
import { TenantsContext } from "../providers/tenants-context.js";
import { Button } from "../ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";

export interface CreateOrganizationDialogProps {
  /**
   * Trigger element to open the dialog.
   * If not provided, a default button will be rendered.
   */
  trigger?: ReactNode;

  /**
   * Custom class name for the trigger wrapper
   */
  className?: string;

  /**
   * Custom icon for the plus/add button
   */
  plusIcon?: ReactNode;

  /**
   * Custom icon for building/org
   */
  buildingIcon?: ReactNode;

  /**
   * Callback when organization is successfully created
   */
  onSuccess?: (organizationId: string) => void;

  /**
   * Optional: Override the createOrganization function (for use without TenantsProvider)
   */
  createOrganization?: (data: {
    name: string;
    slug: string;
    logo?: string;
    metadata?: any;
  }) => Promise<string | null>;

  /**
   * Optional: Toast notification callback (for use without TenantsProvider)
   */
  onToast?: (message: string, type: "success" | "error") => void;
}

/**
 * A dialog component for creating a new organization.
 *
 * When used inside a TenantsProvider, it automatically uses the context.
 * Can also be used standalone by passing createOrganization prop.
 *
 * @example
 * ```tsx
 * // With TenantsProvider (recommended)
 * <TenantsProvider api={api.example}>
 *   <CreateOrganizationDialog />
 * </TenantsProvider>
 *
 * // Standalone
 * <CreateOrganizationDialog
 *   createOrganization={myCreateOrgFunction}
 *   onToast={(msg, type) => toast[type](msg)}
 * />
 * ```
 */
export function CreateOrganizationDialog({
  trigger,
  className,
  plusIcon,
  buildingIcon,
  onSuccess,
  createOrganization: createOrganizationProp,
  onToast: onToastProp,
}: CreateOrganizationDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Try to use context, fall back to props (useContext returns null if no provider)
  const contextValue = useContext(TenantsContext);

  const createOrganization = createOrganizationProp ?? contextValue?.createOrganization;
  const onToast = onToastProp ?? contextValue?.onToast;

  if (!createOrganization) {
    console.warn(
      "CreateOrganizationDialog: No createOrganization function available. " +
        "Either wrap with TenantsProvider or pass createOrganization prop."
    );
  }

  const PlusIcon = plusIcon ?? <Plus className="size-4" />;
  const OrgIcon = buildingIcon ?? (
    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
      <Building2 className="size-5 text-primary" />
    </div>
  );

  // Auto-generate slug from name
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    const generatedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(generatedSlug);
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim() || !createOrganization) return;

    setIsCreating(true);
    setError(null);

    try {
      const orgId = await createOrganization({ name, slug });
      if (orgId) {
        onSuccess?.(orgId);
        handleClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to create organization");
      onToast?.(err.message || "Failed to create organization", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setName("");
    setSlug("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <div className={className}>
          {trigger || (
            <Button>
              {PlusIcon}
              <span>Create Organization</span>
            </Button>
          )}
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {OrgIcon}
            <div>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>Set up a new organization</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Inc"
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-slug">URL Slug</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">yourapp.com/</span>
              <Input
                id="org-slug"
                type="text"
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="acme-inc"
                disabled={isCreating}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will be your organization's unique identifier in URLs
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3" role="alert">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !name.trim() || !slug.trim()}
          >
            {isCreating ? "Creating..." : "Create Organization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
