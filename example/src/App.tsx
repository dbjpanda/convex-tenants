"use client";

import React, { Component, useState, useEffect } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import {
  TenantsProvider,
  useTenants,
  useInvitation,
  OrganizationSwitcher,
  CreateOrganizationDialog,
  MembersSection,
  TeamsSection,
  AcceptInvitation,
  MemberModerationSection,
  BulkInviteSection,
  JoinByDomainSection,
  NestedTeamsSection,
  OrgSettingsPanel,
} from "@djpanda/convex-tenants/react";
import {
  Building2,
  Users,
  UsersRound,
  LogOut,
  Loader2,
  Settings,
  Shield,
  ScrollText,
  Moon,
  Sun,
  DoorOpen,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronRight,
  CheckCircle,
  Crown,
  UserX,
  UserCheck,
} from "lucide-react";
import { SignIn } from "./SignIn.jsx";

// ============================================================================
// Error Boundary — catches query/mutation errors to avoid white screen
// ============================================================================

type Props = { children: React.ReactNode; fallback?: React.ReactNode };

class QueryErrorBoundary extends Component<Props, { hasError: boolean; error?: Error }> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <section className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-destructive">
              <Shield className="size-5" />
              Something went wrong
            </h3>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ?? "An error occurred. You may not have permission to view this."}
            </p>
          </section>
        )
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// Theme Toggle
// ============================================================================

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

// ============================================================================
// Invitation Acceptance Page (standalone route simulation)
// ============================================================================

function AcceptInvitationPage({
  invitationId,
  onClose,
}: {
  invitationId: string;
  onClose: () => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const {
    invitation,
    organization,
    isLoading,
    isAccepting,
    accepted,
    error,
    acceptInvitation,
  } = useInvitation({
    invitationId,
    getInvitationQuery: api.tenants.getInvitation as any,
    getOrganizationQuery: api.tenants.getOrganization as any,
    acceptInvitationMutation: api.tenants.acceptInvitation as any,
  });

  useEffect(() => {
    if (accepted) {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [accepted, onClose]);

  return (
    <AcceptInvitation
      invitation={invitation ?? null}
      organizationName={organization?.name}
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      isAccepting={isAccepting}
      accepted={accepted}
      error={error}
      onAccept={acceptInvitation}
      onDecline={onClose}
      onNavigateToLogin={onClose}
      onNavigateHome={onClose}
    />
  );
}

// ============================================================================
// Main App
// ============================================================================

function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  // Check URL for invitation path (lazy initializer — no effect needed)
  const [invitationId, setInvitationId] = useState<string | null>(() => {
    const path = window.location.pathname;
    const match = path.match(/\/accept-invitation\/(.+)/);
    return match ? match[1] : null;
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show invitation acceptance page if URL matches
  if (invitationId) {
    if (!isAuthenticated) {
      return <SignIn subtitle="Sign in to accept your invitation" />;
    }
    return (
      <TenantsProvider
        api={api.tenants as any}
        onToast={(msg, type) => {
          if (type === "error") alert(`Error: ${msg}`);
        }}
      >
        <AcceptInvitationPage
          invitationId={invitationId}
          onClose={() => {
            setInvitationId(null);
            window.history.replaceState(null, "", "/");
          }}
        />
      </TenantsProvider>
    );
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  return (
    <TenantsProvider
      api={api.tenants as any}
      onToast={(message, type) => {
        if (type === "error") {
          alert(`Error: ${message}`);
        } else {
          console.log(`✓ ${message}`);
        }
      }}
    >
      <AppContent />
    </TenantsProvider>
  );
}

// ============================================================================
// App Content — full feature showcase
// ============================================================================

type TabId = "members" | "teams" | "permissions" | "audit" | "settings";

function AppContent() {
  const {
    currentOrganization,
    organizations,
    isOrganizationsLoading,
    currentRole,
  } = useTenants();
  const { signOut } = useAuthActions();
  const { dark, toggle: toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("members");

  const showEmptyState =
    !isOrganizationsLoading &&
    !currentOrganization &&
    organizations.length === 0;

  const isOwnerOrAdmin =
    currentRole === "owner" || currentRole === "admin";

  const tabs: Array<{ id: TabId; label: string; icon: typeof Users; adminOnly?: boolean }> = [
    { id: "members", label: "Members", icon: Users },
    { id: "teams", label: "Teams", icon: UsersRound },
    { id: "permissions", label: "Permissions", icon: Shield, adminOnly: true },
    { id: "audit", label: "Audit Log", icon: ScrollText, adminOnly: true },
    { id: "settings", label: "Settings", icon: Settings, adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Tenants Demo
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Multi-tenant SaaS showcase
            </p>
          </div>

          <div className="flex items-center gap-2">
            <OrganizationSwitcher className="w-64" />

            <button
              onClick={toggleTheme}
              className="inline-flex size-10 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            <button
              onClick={() => void signOut()}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Sign out"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {showEmptyState ? (
          <EmptyState />
        ) : (
          <>
            {/* Org info bar */}
            {currentOrganization && (
              <OrgInfoBar
                org={currentOrganization}
                role={currentRole}
              />
            )}

            {/* Tabs */}
            <div className="mb-6">
              <div className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/50 p-1">
                {tabs.map((tab) => {
                  if (tab.adminOnly && !isOwnerOrAdmin) return null;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === "members" && (
              <>
                <MembersSection
                  showTeamSelection
                  showInvitationLink
                  invitationPath="/accept-invitation/:id"
                  expirationText="48 hours"
                />
                {isOwnerOrAdmin && (
                  <>
                    <BulkInviteSection />
                    <MemberModerationSection />
                  </>
                )}
              </>
            )}

            {activeTab === "teams" && (
              <>
                <TeamsSection />
                <NestedTeamsSection />
              </>
            )}

            {activeTab === "permissions" && isOwnerOrAdmin && (
              <PermissionsPanel />
            )}

            {activeTab === "audit" && isOwnerOrAdmin && (
              <QueryErrorBoundary>
                <AuditLogPanel />
              </QueryErrorBoundary>
            )}

            {activeTab === "settings" && isOwnerOrAdmin && <OrgSettingsPanel />}

            {/* Join by domain — listOrganizationsJoinableByDomain + joinByDomain */}
            <JoinByDomainSection />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Built with{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            @djpanda/convex-tenants
          </code>{" "}
          +{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            @djpanda/convex-authz
          </code>{" "}
          &middot; shadcn/ui + Convex Auth
        </p>
      </footer>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="rounded-xl border bg-background p-16 text-center shadow-sm">
      <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
        <Building2 className="size-10 text-muted-foreground" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">No Organization Yet</h2>
      <p className="mb-8 text-muted-foreground">
        Create your first organization to get started
      </p>
      <CreateOrganizationDialog />
    </div>
  );
}

// ============================================================================
// Organization Info Bar
// ============================================================================

function OrgInfoBar({
  org,
  role,
}: {
  org: { _id: string; name: string; slug: string; ownerId: string; _creationTime: number };
  role: string | null;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
        <Building2 className="size-5 text-primary" />
      </div>
      <div className="flex-1">
        <h2 className="font-semibold">{org.name}</h2>
        <p className="text-sm text-muted-foreground">
          /{org.slug} &middot; Your role:{" "}
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
            {role}
          </span>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Created {new Date(org._creationTime).toLocaleDateString()}
      </p>
    </div>
  );
}

// ============================================================================
// Permissions Panel — checkPermission, getUserPermissions, grantPermission, denyPermission
// ============================================================================

function PermissionsPanel() {
  const { currentOrganization, members } = useTenants();
  const orgId = currentOrganization?._id;

  // Own permissions
  const myPerms = useQuery(
    api.tenants.getUserPermissions,
    orgId ? { organizationId: orgId } : "skip"
  );
  const myRoles = useQuery(
    api.tenants.getUserRoles,
    orgId ? { organizationId: orgId } : "skip"
  );

  // Permission check demo
  const [checkPerm, setCheckPerm] = useState("organizations:update");
  const checkResult = useQuery(
    api.tenants.checkPermission,
    orgId ? { organizationId: orgId, permission: checkPerm } : "skip"
  );

  // Grant/deny
  const grantPerm = useMutation(api.tenants.grantPermission);
  const denyPerm = useMutation(api.tenants.denyPermission);
  const [targetUser, setTargetUser] = useState("");
  const [permToGrant, setPermToGrant] = useState("organizations:read");
  const [grantStatus, setGrantStatus] = useState<string | null>(null);

  const handleGrant = async (mode: "grant" | "deny") => {
    if (!orgId || !targetUser || !permToGrant) return;
    try {
      if (mode === "grant") {
        await grantPerm({
          organizationId: orgId,
          targetUserId: targetUser,
          permission: permToGrant,
        });
      } else {
        await denyPerm({
          organizationId: orgId,
          targetUserId: targetUser,
          permission: permToGrant,
        });
      }
      setGrantStatus(`${mode === "grant" ? "Granted" : "Denied"} "${permToGrant}" for user`);
      setTimeout(() => setGrantStatus(null), 3000);
    } catch (e: any) {
      setGrantStatus(`Error: ${e.message}`);
    }
  };

  const permissionOptions = [
    "organizations:read", "organizations:update", "organizations:delete",
    "members:add", "members:remove", "members:updateRole", "members:list",
    "teams:create", "teams:update", "teams:delete", "teams:addMember", "teams:removeMember", "teams:list",
    "invitations:create", "invitations:cancel", "invitations:resend", "invitations:list",
    "permissions:grant", "permissions:deny",
  ];

  return (
    <div className="space-y-6">
      {/* My Permissions */}
      <section className="rounded-xl border bg-background p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Shield className="size-5 text-primary" />
          Your Permissions
        </h3>

        {/* Roles */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Assigned Roles</p>
          <div className="flex flex-wrap gap-2">
            {myRoles && Array.isArray(myRoles) && myRoles.length > 0 ? (
              myRoles.map((r: any, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary capitalize"
                >
                  {r.role}
                  {r.scope && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      @ {r.scope.type}
                    </span>
                  )}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Loading...</span>
            )}
          </div>
        </div>

        {/* Effective permissions */}
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Effective Permissions</p>
          <div className="flex flex-wrap gap-1.5">
            {myPerms?.permissions && myPerms.permissions.length > 0 ? (
              myPerms.permissions.map((p: string) => (
                <span
                  key={p}
                  className="inline-flex items-center rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
                >
                  <Check className="mr-1 size-3" />
                  {p}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Loading...</span>
            )}
          </div>
        </div>
      </section>

      {/* Permission Checker */}
      <section className="rounded-xl border bg-background p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Permission Checker</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Test any permission string against your current role in real time.
        </p>
        <div className="flex items-center gap-3">
          <select
            value={checkPerm}
            onChange={(e) => setCheckPerm(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {permissionOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronRight className="size-4 text-muted-foreground" />
          {checkResult ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                checkResult.allowed
                  ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {checkResult.allowed ? (
                <Check className="size-3.5" />
              ) : (
                <X className="size-3.5" />
              )}
              {checkResult.allowed ? "Allowed" : "Denied"}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Checking...</span>
          )}
        </div>
      </section>

      {/* Grant / Deny */}
      <section className="rounded-xl border bg-background p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Grant / Deny Permission Override</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Directly grant or deny a specific permission to a member, bypassing role-based assignments.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Target Member</label>
            <select
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select member...</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name || m.user?.email || m.userId} ({m.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Permission</label>
            <select
              value={permToGrant}
              onChange={(e) => setPermToGrant(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {permissionOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleGrant("grant")}
            disabled={!targetUser}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Check className="size-4" />
            Grant
          </button>
          <button
            onClick={() => handleGrant("deny")}
            disabled={!targetUser}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <X className="size-4" />
            Deny
          </button>
        </div>
        {grantStatus && (
          <p className="mt-3 text-sm text-muted-foreground">{grantStatus}</p>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// Audit Log Panel — getAuditLog
// ============================================================================

function AuditLogPanel() {
  const { currentOrganization } = useTenants();
  const orgId = currentOrganization?._id;

  const auditLog = useQuery(
    api.tenants.getAuditLog,
    orgId ? { organizationId: orgId, limit: 50 } : "skip"
  );

  return (
    <section className="rounded-xl border bg-background p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <ScrollText className="size-5 text-primary" />
        Audit Log
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        All authorization changes — role assignments, permission grants/denials — are logged automatically by authz.
      </p>

      {!auditLog ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : Array.isArray(auditLog) && auditLog.length > 0 ? (
        <div className="max-h-96 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-2 font-medium text-muted-foreground">User</th>
                <th className="px-4 py-2 font-medium text-muted-foreground">Details</th>
                <th className="px-4 py-2 font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {auditLog.map((entry: any, i: number) => (
                <tr key={entry._id ?? i} className="hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {entry.userId || entry.actorId || "system"}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {entry.details ? (
                      <code className="rounded bg-muted px-1 py-0.5">
                        {JSON.stringify(entry.details).slice(0, 80)}
                        {JSON.stringify(entry.details).length > 80 && "..."}
                      </code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {entry.timestamp
                      ? new Date(entry.timestamp).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No audit entries yet. Create organizations, add members, or change roles to generate entries.
        </div>
      )}
    </section>
  );
}

export default App;
