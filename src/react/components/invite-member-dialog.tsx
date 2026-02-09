"use client";

import { useState, type ReactNode } from "react";
import { Mail, Copy, Check, Link as LinkIcon } from "lucide-react";
import { cn, getInvitationLink as getLink } from "../utils.js";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
import type { Team } from "../hooks/use-teams.js";

export interface InviteMemberDialogProps {
  /**
   * Organization name to display in the dialog
   */
  organizationName: string;

  /**
   * List of teams in the organization (optional)
   */
  teams?: Team[];

  /**
   * Whether to show team selection (defaults to true if teams provided)
   */
  showTeamSelection?: boolean;

  /**
   * Whether to show the invitation link after creating (defaults to true)
   */
  showInvitationLink?: boolean;

  /**
   * Custom invitation path pattern (defaults to "/accept-invitation/:id")
   * Use ":id" as placeholder for invitation ID
   */
  invitationPath?: string;

  /**
   * Callback when inviting a member
   */
  onInvite: (data: {
    email: string;
    role: string;
    teamId?: string;
  }) => Promise<{ invitationId: string; email: string; expiresAt: number } | null | undefined>;

  /**
   * Base URL for invitation links (defaults to window.location.origin)
   */
  baseUrl?: string;

  /**
   * Trigger element to open the dialog
   */
  trigger?: ReactNode;

  /**
   * Custom class name
   */
  className?: string;

  /**
   * Custom icon for mail
   */
  mailIcon?: ReactNode;

  /**
   * Custom icon for copy
   */
  copyIcon?: ReactNode;

  /**
   * Custom icon for check (for copied state)
   */
  checkIcon?: ReactNode;

  /**
   * Custom icon for link
   */
  linkIcon?: ReactNode;

  /**
   * Toast notification callback
   */
  onToast?: (message: string, type: "success" | "error") => void;

  /**
   * Invitation expiration text (defaults to "48 hours")
   */
  expirationText?: string;
}

/**
 * A dialog component for inviting new members to an organization.
 *
 * @example
 * ```tsx
 * import { InviteMemberDialog } from "@djpanda/convex-tenants/react";
 *
 * function MyApp() {
 *   const { inviteMember } = useInvitations(...);
 *
 *   return (
 *     <InviteMemberDialog
 *       organizationName="Acme Inc"
 *       onInvite={inviteMember}
 *     />
 *   );
 * }
 * ```
 */
export function InviteMemberDialog({
  organizationName,
  teams,
  showTeamSelection = true,
  showInvitationLink = true,
  invitationPath = "/accept-invitation/:id",
  onInvite,
  baseUrl,
  trigger,
  className,
  mailIcon,
  copyIcon,
  checkIcon,
  linkIcon,
  onToast,
  expirationText = "48 hours",
}: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [isInviting, setIsInviting] = useState(false);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const MailIcon = mailIcon ?? <Mail className="size-4" />;
  const CopyIcon = copyIcon ?? <Copy className="size-5" />;
  const CheckIcon = checkIcon ?? <Check className="size-5" />;
  const LinkLinkIcon = linkIcon ?? <LinkIcon className="size-4" />;

  const shouldShowTeams = showTeamSelection && teams && teams.length > 0;

  const handleInvite = async () => {
    if (!email) return;

    setIsInviting(true);
    setError(null);
    try {
      const result = await onInvite({
        email,
        role,
        teamId: shouldShowTeams && teamId && teamId !== "none" ? teamId : undefined,
      });

      if (result && result.invitationId) {
        setInvitationId(result.invitationId);
        onToast?.("Invitation created successfully!", "success");
      } else if (!showInvitationLink) {
        handleClose();
        onToast?.("Invitation sent successfully!", "success");
      }
    } catch (err: any) {
      setError(err.message || "Failed to invite member");
      onToast?.(err.message || "Failed to invite member", "error");
    } finally {
      setIsInviting(false);
    }
  };

  const invitationLink = invitationId
    ? getLink(invitationId, baseUrl, invitationPath)
    : null;

  const handleCopyLink = async () => {
    if (invitationLink) {
      try {
        await navigator.clipboard.writeText(invitationLink);
        setCopied(true);
        onToast?.("Invitation link copied to clipboard!", "success");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        prompt("Copy this invitation link:", invitationLink);
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEmail("");
    setRole("member");
    setTeamId(undefined);
    setInvitationId(null);
    setError(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <div className={className}>
          {trigger || (
            <Button>
              {MailIcon}
              <span>Invite Member</span>
            </Button>
          )}
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Invite a new member to {organizationName}. They'll receive an invitation link to join.
          </DialogDescription>
        </DialogHeader>

        {!invitationLink ? (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isInviting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v)}
                  disabled={isInviting}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {role === "admin"
                    ? "Admins can invite members and manage teams"
                    : "Members have basic access to the organization"}
                </p>
              </div>

              {shouldShowTeams && (
                <div className="space-y-2">
                  <Label htmlFor="team">Team (Optional)</Label>
                  <Select
                    value={teamId ?? "none"}
                    onValueChange={(v) => setTeamId(v === "none" ? undefined : v)}
                    disabled={isInviting}
                  >
                    <SelectTrigger id="team">
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No team</SelectItem>
                      {teams!.map((team) => (
                        <SelectItem key={team._id} value={team._id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Assign the new member to a team immediately
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isInviting}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={isInviting || !email}>
                {isInviting ? "Creating..." : "Create Invitation"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-2">
              {/* Success message */}
              <div className="py-2 text-center">
                <div className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Check className="size-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="font-medium">Invitation Created!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  An invitation has been created for <strong>{email}</strong>
                </p>
              </div>

              {/* Invitation link */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <Label className="mb-2 block text-xs">Invitation Link</Label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-md border bg-background p-2">
                    <span className="flex-shrink-0 text-muted-foreground">{LinkLinkIcon}</span>
                    <code className="truncate text-sm">{invitationLink}</code>
                  </div>
                  <Button
                    variant={copied ? "secondary" : "default"}
                    size="icon"
                    onClick={handleCopyLink}
                    aria-label={copied ? "Copied!" : "Copy link"}
                    className={cn(
                      copied && "bg-green-100 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                    )}
                  >
                    {copied ? CheckIcon : CopyIcon}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Share this link with the invitee. It expires in {expirationText}.
                </p>
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setInvitationId(null);
                  setEmail("");
                  setCopied(false);
                }}
              >
                Invite Another
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
