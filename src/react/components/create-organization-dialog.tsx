"use client";

import { useState, type ReactNode, useCallback } from "react";
import { cn } from "../utils.js";
import { useTenants } from "../providers/tenants-context.js";

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
   * Custom icon for close/X button
   */
  closeIcon?: ReactNode;

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
  closeIcon,
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

  // Try to use context, fall back to props
  let contextValue: ReturnType<typeof useTenants> | null = null;
  try {
    contextValue = useTenants();
  } catch {
    // Not inside TenantsProvider, will use props
  }

  const createOrganization = createOrganizationProp ?? contextValue?.createOrganization;
  const onToast = onToastProp ?? contextValue?.onToast;

  if (!createOrganization) {
    console.warn(
      "CreateOrganizationDialog: No createOrganization function available. " +
        "Either wrap with TenantsProvider or pass createOrganization prop."
    );
  }

  // Auto-generate slug from name
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    // Generate slug: lowercase, replace non-alphanumeric with dashes, trim dashes
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
    <>
      {/* Trigger */}
      <div onClick={() => setOpen(true)} className={className}>
        {trigger || (
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            {plusIcon || (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            <span>Create Organization</span>
          </button>
        )}
      </div>

      {/* Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                {buildingIcon || (
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Create Organization</h2>
                  <p className="text-sm text-gray-500">Set up a new organization</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                {closeIcon || (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  id="org-name"
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Inc"
                  disabled={isCreating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label htmlFor="org-slug" className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug
                </label>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-1">yourapp.com/</span>
                  <input
                    id="org-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="acme-inc"
                    disabled={isCreating}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This will be your organization's unique identifier in URLs
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={handleClose}
                disabled={isCreating}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !name.trim() || !slug.trim()}
                className={cn(
                  "px-4 py-2 rounded-md transition-colors disabled:opacity-50",
                  "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {isCreating ? "Creating..." : "Create Organization"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={handleClose} />
      )}
    </>
  );
}
