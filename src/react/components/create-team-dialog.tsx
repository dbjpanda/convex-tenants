"use client";

import { useState, type ReactNode } from "react";

export interface CreateTeamDialogProps {
  /**
   * Organization name to display in the dialog
   */
  organizationName: string;
  
  /**
   * Callback when creating a team
   */
  onCreateTeam: (name: string, description?: string) => Promise<string>;
  
  /**
   * Callback after successful creation
   */
  onSuccess?: () => void;
  
  /**
   * Trigger element to open the dialog
   */
  trigger?: ReactNode;
  
  /**
   * Custom class name
   */
  className?: string;
  
  /**
   * Custom icon for plus
   */
  plusIcon?: ReactNode;
  
  /**
   * Toast notification callback
   */
  onToast?: (message: string, type: "success" | "error") => void;
}

/**
 * A dialog component for creating a new team in an organization.
 * 
 * @example
 * ```tsx
 * import { CreateTeamDialog } from "@djpanda/convex-tenants/react";
 * import { Plus } from "lucide-react";
 * 
 * function MyApp() {
 *   const { createTeam } = useTeams(...);
 *   
 *   return (
 *     <CreateTeamDialog
 *       organizationName="Acme Inc"
 *       onCreateTeam={createTeam}
 *       plusIcon={<Plus className="h-4 w-4" />}
 *     />
 *   );
 * }
 * ```
 */
export function CreateTeamDialog({
  organizationName,
  onCreateTeam,
  onSuccess,
  trigger,
  className,
  plusIcon,
  onToast,
}: CreateTeamDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name) return;

    setIsCreating(true);
    setError(null);
    try {
      await onCreateTeam(name, description || undefined);
      onToast?.("Team created successfully!", "success");
      setName("");
      setDescription("");
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Failed to create team");
      onToast?.(err.message || "Failed to create team", "error");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setOpen(true)} className={className}>
        {trigger || (
          <button className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50">
            {plusIcon}
            <span>New Team</span>
          </button>
        )}
      </div>

      {/* Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-[425px] p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Create Team</h2>
              <p className="text-sm text-gray-500">
                Create a new team in {organizationName} to organize your members.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="team-name" className="block text-sm font-medium mb-1">
                  Team Name
                </label>
                <input
                  id="team-name"
                  type="text"
                  placeholder="Engineering, Sales, Marketing..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isCreating}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              
              <div>
                <label htmlFor="team-description" className="block text-sm font-medium mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="team-description"
                  placeholder="What does this team do?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isCreating}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
                />
              </div>
              
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isCreating}
                className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating || !name}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create Team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
