"use client";

import { useState, useContext, type ReactNode } from "react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn, generateSlugFromName } from "../utils.js";
import {
  TenantsContext,
  type Organization as ContextOrganization,
} from "../providers/tenants-context.js";
import type { Organization } from "../hooks/use-organization.js";
import { Button } from "../ui/button.js";
import { Skeleton } from "../ui/skeleton.js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { Separator } from "../ui/separator.js";

export interface OrganizationSwitcherProps {
  /**
   * List of organizations the user belongs to.
   * Optional when used inside TenantsProvider.
   */
  organizations?: Organization[] | ContextOrganization[];

  /**
   * Currently active organization.
   * Optional when used inside TenantsProvider.
   */
  currentOrganization?: Organization | ContextOrganization | null;

  /**
   * Loading state
   */
  isLoading?: boolean;

  /**
   * Callback when switching organization.
   * Optional when used inside TenantsProvider.
   */
  onSwitchOrganization?: (organizationId: string) => void;

  /**
   * Callback when creating a new organization.
   * Optional when used inside TenantsProvider.
   */
  onCreateOrganization?: (data: { name: string; slug: string }) => Promise<void>;

  /**
   * Custom class name for the root element
   */
  className?: string;

  /**
   * Custom icon for buildings/organizations
   */
  buildingIcon?: ReactNode;

  /**
   * Custom icon for check mark
   */
  checkIcon?: ReactNode;

  /**
   * Custom icon for chevrons
   */
  chevronsIcon?: ReactNode;

  /**
   * Custom icon for plus
   */
  plusIcon?: ReactNode;
}

/**
 * An organization switcher component that handles organization selection and creation.
 *
 * When used inside TenantsProvider, it automatically uses the context for data and actions.
 * When used standalone, you need to provide organizations, currentOrganization, and callbacks.
 *
 * @example
 * ```tsx
 * // With TenantsProvider (recommended) - no props needed
 * <TenantsProvider api={api.example}>
 *   <OrganizationSwitcher />
 * </TenantsProvider>
 *
 * // Standalone usage - props required
 * <OrganizationSwitcher
 *   organizations={organizations}
 *   currentOrganization={currentOrganization}
 *   onSwitchOrganization={switchOrganization}
 *   onCreateOrganization={createOrganization}
 * />
 * ```
 */
export function OrganizationSwitcher({
  organizations: organizationsProp,
  currentOrganization: currentOrganizationProp,
  isLoading: isLoadingProp,
  onSwitchOrganization: onSwitchOrganizationProp,
  onCreateOrganization: onCreateOrganizationProp,
  className,
  buildingIcon,
  checkIcon,
  chevronsIcon,
  plusIcon,
}: OrganizationSwitcherProps) {
  // Try to get context (may be null if not inside TenantsProvider)
  const context = useContext(TenantsContext);

  // Use context or props
  const organizations = organizationsProp ?? context?.organizations ?? [];
  const currentOrganization =
    currentOrganizationProp ?? context?.currentOrganization ?? null;
  const isLoading = isLoadingProp ?? context?.isOrganizationsLoading ?? false;
  const switchOrganization =
    onSwitchOrganizationProp ?? context?.switchOrganization;
  const createOrganization =
    onCreateOrganizationProp ??
    (context?.createOrganization
      ? async (data: { name: string; slug: string }) => {
          await context.createOrganization(data);
        }
      : undefined);

  const [open, setOpen] = useState(false);
  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const BuildingIcon = buildingIcon ?? <Building2 className="size-5" />;
  const CheckIconEl = checkIcon ?? <Check className="size-4" />;
  const ChevronsIcon = chevronsIcon ?? <ChevronsUpDown className="size-4" />;
  const PlusIcon = plusIcon ?? <Plus className="size-4" />;

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setNewOrgName(name);
    setNewOrgSlug(generateSlugFromName(name));
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim() || !createOrganization) return;

    setIsCreating(true);
    setError(null);
    try {
      await createOrganization({
        name: newOrgName.trim(),
        slug: newOrgSlug.trim(),
      });
      setShowNewOrgDialog(false);
      setNewOrgName("");
      setNewOrgSlug("");
    } catch (err: any) {
      setError(err.message || "Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchOrganization = (organizationId: string) => {
    switchOrganization?.(organizationId);
    setOpen(false);
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex h-10 items-center gap-2 rounded-md border border-input px-3",
          className
        )}
      >
        <Skeleton className="size-6 shrink-0 rounded-md" />
        <Skeleton className="h-4 w-28 flex-1" />
        <Skeleton className="size-4 shrink-0" />
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select organization"
            className={cn("h-10 w-full justify-between gap-2 px-3", className)}
          >
            <div className="flex items-center gap-2 truncate">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                {currentOrganization?.logo ? (
                  <img
                    src={currentOrganization.logo}
                    alt={currentOrganization.name}
                    className="size-6 rounded-md object-cover"
                  />
                ) : (
                  <span className="text-primary [&_svg]:size-3.5">{BuildingIcon}</span>
                )}
              </div>
              <span className="truncate font-medium">
                {currentOrganization?.name || "Select organization"}
              </span>
            </div>
            <span className="ml-auto shrink-0 opacity-50">{ChevronsIcon}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[280px] p-0" align="end">
          <div className="border-b p-2">
            <Input
              type="text"
              placeholder="Search organization..."
              className="h-8"
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Organizations
            </div>
            {organizations.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No organization found.
              </div>
            ) : (
              organizations.map((org) => (
                <button
                  key={org._id}
                  onClick={() => handleSwitchOrganization(org._id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent",
                    org._id === currentOrganization?._id && "bg-accent"
                  )}
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    {org.logo ? (
                      <img
                        src={org.logo}
                        alt={org.name}
                        className="size-6 rounded-md object-cover"
                      />
                    ) : (
                      <span className="text-primary [&_svg]:size-3.5">{BuildingIcon}</span>
                    )}
                  </div>
                  <span className="flex-1 truncate text-left">{org.name}</span>
                  {org._id === currentOrganization?._id && (
                    <span className="text-primary">{CheckIconEl}</span>
                  )}
                </button>
              ))
            )}
          </div>

          {createOrganization && (
            <>
              <Separator />
              <div className="p-1">
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowNewOrgDialog(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                >
                  {PlusIcon}
                  <span>Create Organization</span>
                </button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* Create Organization Dialog */}
      <Dialog
        open={showNewOrgDialog && !!createOrganization}
        onOpenChange={(v) => {
          if (!v) {
            setShowNewOrgDialog(false);
            setNewOrgName("");
            setNewOrgSlug("");
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to collaborate with your team.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOrganization}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  type="text"
                  placeholder="Acme Inc."
                  value={newOrgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={isCreating}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">
                  Slug{" "}
                  <span className="text-xs text-muted-foreground">(used in URLs)</span>
                </Label>
                <Input
                  id="org-slug"
                  type="text"
                  placeholder="acme-inc"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  disabled={isCreating}
                  required
                  pattern="[a-z0-9-]+"
                  title="Only lowercase letters, numbers, and hyphens"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewOrgDialog(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
