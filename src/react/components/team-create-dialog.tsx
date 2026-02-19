"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
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
import { Textarea } from "../ui/textarea.js";

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
 *
 * function MyApp() {
 *   const { createTeam } = useTeams(...);
 *
 *   return (
 *     <CreateTeamDialog
 *       organizationName="Acme Inc"
 *       onCreateTeam={createTeam}
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

  const PlusIcon = plusIcon ?? <Plus className="size-4" />;

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className={className}>
          {trigger || (
            <Button variant="outline">
              {PlusIcon}
              <span>New Team</span>
            </Button>
          )}
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Create a new team in {organizationName} to organize your members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              type="text"
              placeholder="Engineering, Sales, Marketing..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-description">Description (Optional)</Label>
            <Textarea
              id="team-description"
              placeholder="What does this team do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name}>
            {isCreating ? "Creating..." : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
