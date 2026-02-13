import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTenants } from "@djpanda/convex-tenants/react";
import { Shield, Check, X, ChevronRight } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { OrgInfoBar } from "../components/OrgInfoBar";

export function PermissionsPage() {
  const { currentOrganization, organizations, isOrganizationsLoading, currentRole, members } =
    useTenants();

  const showEmptyState =
    !isOrganizationsLoading && !currentOrganization && organizations.length === 0;

  if (showEmptyState) {
    return <EmptyState />;
  }

  const isOwnerOrAdmin = currentRole === "owner" || currentRole === "admin";

  if (!isOwnerOrAdmin) {
    return (
      <>
        {currentOrganization && (
          <OrgInfoBar org={currentOrganization} role={currentRole} />
        )}
        <div className="rounded-xl border bg-background p-16 text-center shadow-sm">
          <Shield className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">Access Restricted</h2>
          <p className="text-muted-foreground">
            You need to be an owner or admin to view permissions.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {currentOrganization && (
        <OrgInfoBar org={currentOrganization} role={currentRole} />
      )}
      <PermissionsPanel orgId={currentOrganization?._id} members={members} />
    </>
  );
}

function PermissionsPanel({ orgId, members }: { orgId?: string; members: any[] }) {
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
      setGrantStatus(
        `${mode === "grant" ? "Granted" : "Denied"} "${permToGrant}" for user`
      );
      setTimeout(() => setGrantStatus(null), 3000);
    } catch (e: any) {
      setGrantStatus(`Error: ${e.message}`);
    }
  };

  const permissionOptions = [
    "organizations:read",
    "organizations:update",
    "organizations:delete",
    "members:add",
    "members:remove",
    "members:updateRole",
    "members:list",
    "teams:create",
    "teams:update",
    "teams:delete",
    "teams:addMember",
    "teams:removeMember",
    "teams:list",
    "invitations:create",
    "invitations:cancel",
    "invitations:resend",
    "invitations:list",
    "permissions:grant",
    "permissions:deny",
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
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Assigned Roles
          </p>
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
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Effective Permissions
          </p>
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
              <option key={p} value={p}>
                {p}
              </option>
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
        <h3 className="mb-4 text-lg font-semibold">
          Grant / Deny Permission Override
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Directly grant or deny a specific permission to a member, bypassing
          role-based assignments.
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
                <option key={p} value={p}>
                  {p}
                </option>
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
