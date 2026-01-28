"use client";

import { useState, useContext, type ReactNode } from "react";
import { cn, generateSlugFromName } from "../utils.js";
import { TenantsContext, type Organization as ContextOrganization } from "../providers/tenants-context.js";
import type { Organization } from "../hooks/use-organization.js";

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
  const currentOrganization = currentOrganizationProp ?? context?.currentOrganization ?? null;
  const isLoading = isLoadingProp ?? context?.isOrganizationsLoading ?? false;
  const switchOrganization = onSwitchOrganizationProp ?? context?.switchOrganization;
  const createOrganization = onCreateOrganizationProp ?? (context?.createOrganization
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

  // Default icons
  const defaultBuildingIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );

  const defaultCheckIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  const defaultChevronsIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
    </svg>
  );

  const defaultPlusIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

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
      <div className={cn("flex items-center gap-2 px-2 py-1.5", className)}>
        <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Trigger Button */}
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2 border rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-expanded={open}
          aria-label="Select organization"
        >
          <div className="flex items-center gap-2 truncate">
            {currentOrganization?.logo ? (
              <img
                src={currentOrganization.logo}
                alt={currentOrganization.name}
                className="h-5 w-5 rounded object-cover"
              />
            ) : (
              <span className="text-gray-500">{buildingIcon || defaultBuildingIcon}</span>
            )}
            <span className="truncate">
              {currentOrganization?.name || "Select organization"}
            </span>
          </div>
          <span className="ml-auto opacity-50">{chevronsIcon || defaultChevronsIcon}</span>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 w-[300px] mt-1 border rounded-md bg-white shadow-lg">
            <div className="p-2">
              <input
                type="text"
                placeholder="Search organization..."
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                Organizations
              </div>
              {organizations.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No organization found.
                </div>
              ) : (
                organizations.map((org) => (
                  <button
                    key={org._id}
                    onClick={() => handleSwitchOrganization(org._id)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-md"
                  >
                    {org.logo ? (
                      <img
                        src={org.logo}
                        alt={org.name}
                        className="h-5 w-5 rounded object-cover"
                      />
                    ) : (
                      <span className="text-gray-500">{buildingIcon || defaultBuildingIcon}</span>
                    )}
                    <span className="flex-1 truncate text-left">{org.name}</span>
                    <span
                      className={cn(
                        org._id === currentOrganization?._id ? "opacity-100" : "opacity-0"
                      )}
                    >
                      {checkIcon || defaultCheckIcon}
                    </span>
                  </button>
                ))
              )}
            </div>
            
            {createOrganization && (
              <div className="border-t">
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowNewOrgDialog(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100"
                >
                  {plusIcon || defaultPlusIcon}
                  <span>Create Organization</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Organization Dialog */}
      {showNewOrgDialog && createOrganization && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-[425px] p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Create Organization</h2>
              <p className="text-sm text-gray-500">
                Create a new organization to collaborate with your team.
              </p>
            </div>
            
            <form onSubmit={handleCreateOrganization}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="org-name" className="block text-sm font-medium mb-1">
                    Organization Name
                  </label>
                  <input
                    id="org-name"
                    type="text"
                    placeholder="Acme Inc."
                    value={newOrgName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    disabled={isCreating}
                    required
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                
                <div>
                  <label htmlFor="org-slug" className="block text-sm font-medium mb-1">
                    Slug
                    <span className="text-xs text-gray-500 ml-2">(used in URLs)</span>
                  </label>
                  <input
                    id="org-slug"
                    type="text"
                    placeholder="acme-inc"
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value)}
                    disabled={isCreating}
                    required
                    pattern="[a-z0-9-]+"
                    title="Only lowercase letters, numbers, and hyphens"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewOrgDialog(false)}
                  disabled={isCreating}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
