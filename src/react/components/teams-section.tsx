"use client";

import { useState, type ReactNode } from "react";
import { cn } from "../utils.js";
import { useTenants } from "../providers/tenants-context.js";
import { TeamsGrid } from "./teams-grid.js";
import type { Team } from "../hooks/use-teams.js";

export interface TeamsSectionProps {
  /**
   * Custom class name for the section
   */
  className?: string;

  /**
   * Section title (default: "Teams")
   */
  title?: string;

  /**
   * Whether to show the create button (default: true for owner/admin)
   */
  showCreateButton?: boolean;

  /**
   * Callback when clicking a team
   */
  onTeamClick?: (team: Team) => void;

  // Icons
  usersIcon?: ReactNode;
  plusIcon?: ReactNode;
  trashIcon?: ReactNode;
  closeIcon?: ReactNode;
}

/**
 * A complete section component for managing organization teams.
 *
 * Includes:
 * - Header with team count
 * - "Create Team" button (for owners/admins)
 * - TeamsGrid with delete actions
 * - Create Team Dialog
 *
 * Must be used within a TenantsProvider.
 *
 * @example
 * ```tsx
 * <TenantsProvider api={api.example}>
 *   <TeamsSection />
 * </TenantsProvider>
 * ```
 */
export function TeamsSection({
  className,
  title = "Teams",
  showCreateButton,
  onTeamClick,
  usersIcon,
  plusIcon,
  trashIcon,
  closeIcon,
}: TeamsSectionProps) {
  const {
    currentOrganization,
    teams,
    isOwnerOrAdmin,
    isTeamsLoading,
    createTeam,
    deleteTeam,
    onToast,
  } = useTenants();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const shouldShowCreateButton = showCreateButton ?? isOwnerOrAdmin;

  // Transform teams for the grid
  const transformedTeams: Team[] = teams.map((t) => ({
    _id: t._id,
    _creationTime: t._creationTime,
    name: t.name,
    organizationId: t.organizationId,
    description: t.description ?? null,
    slug: t.slug,
    metadata: undefined,
  }));

  if (!currentOrganization) {
    return (
      <div className={cn("bg-white border rounded-lg p-8 text-center", className)}>
        <p className="text-gray-500">Select an organization to view teams</p>
      </div>
    );
  }

  const defaultUsersIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  const defaultPlusIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

  const defaultTrashIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  return (
    <div className={cn("bg-white border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            {usersIcon || defaultUsersIcon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">
              {teams.length} team{teams.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {shouldShowCreateButton && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {plusIcon || defaultPlusIcon}
            <span>Create Team</span>
          </button>
        )}
      </div>

      {/* Teams Grid */}
      <div className="p-6">
        <TeamsGrid
          teams={transformedTeams}
          isLoading={isTeamsLoading}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onTeamClick={onTeamClick}
          onDeleteTeam={deleteTeam}
          onToast={onToast}
          usersIcon={usersIcon || defaultUsersIcon}
          trashIcon={trashIcon || defaultTrashIcon}
          emptyAction={
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mx-auto"
            >
              {plusIcon || defaultPlusIcon}
              <span>Create your first team</span>
            </button>
          }
        />
      </div>

      {/* Create Team Dialog */}
      {showCreateDialog && (
        <CreateTeamDialogContent
          onCreateTeam={createTeam}
          onClose={() => setShowCreateDialog(false)}
          onToast={onToast}
          closeIcon={closeIcon}
        />
      )}
    </div>
  );
}

// Internal component for the create team dialog
function CreateTeamDialogContent({
  onCreateTeam,
  onClose,
  onToast,
  closeIcon,
}: {
  onCreateTeam: (data: { name: string; description?: string }) => Promise<string | null>;
  onClose: () => void;
  onToast?: (message: string, type: "success" | "error") => void;
  closeIcon?: ReactNode;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      await onCreateTeam({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create team");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Create Team</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            {closeIcon || (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Engineering"
              disabled={isCreating}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The engineering team responsible for product development"
              rows={3}
              disabled={isCreating}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 border rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>

      {/* Backdrop */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
