"use client";

import { useState } from "react";
import { api } from "../convex/_generated/api";
import {
  TenantsProvider,
  useTenants,
  OrganizationSwitcher,
  CreateOrganizationDialog,
  MembersSection,
  TeamsSection,
} from "@djpanda/convex-tenants/react";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Plus,
  Users,
  Mail,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Copy,
  X,
  Link,
} from "lucide-react";

/**
 * Example App using the TenantsProvider pattern.
 * 
 * This demonstrates how simple it is to build a multi-tenant app
 * using the @djpanda/convex-tenants/react package.
 * 
 * The TenantsProvider handles:
 * - All data fetching (organizations, members, invitations, teams)
 * - All mutations (create org, invite, create team, etc.)
 * - Active organization state
 * - Role-based access control (isOwner, isOwnerOrAdmin)
 * 
 * Child components can access this via useTenants() hook
 * or rely on context-aware components like OrganizationSwitcher.
 */
function App() {
  return (
    <TenantsProvider 
      api={api.example as any}
      onToast={(message, type) => {
        // Simple toast using alert for demo
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

function AppContent() {
  const {
    currentOrganization,
    organizations,
    isLoading,
  } = useTenants();

  const [activeTab, setActiveTab] = useState<"members" | "teams">("members");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tenants Example</h1>
            <p className="text-sm text-slate-500 mt-1">
              Demo mode • Using the TenantsProvider pattern
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Organization Switcher - uses context automatically */}
            <OrganizationSwitcher
              className="w-64"
              buildingIcon={<Building2 className="w-5 h-5" />}
              checkIcon={<Check className="w-4 h-4" />}
              chevronsIcon={<ChevronsUpDown className="w-4 h-4" />}
              plusIcon={<Plus className="w-4 h-4" />}
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full mx-auto mb-4" />
            <p className="text-slate-500">Loading...</p>
          </div>
        ) : currentOrganization ? (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("members")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeTab === "members"
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Members
                </button>
                <button
                  onClick={() => setActiveTab("teams")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeTab === "teams"
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Teams
                </button>
              </div>
            </div>

            {/* Content - Using context-aware section components */}
            {activeTab === "members" && (
              <MembersSection
                showTeamSelection={true}
                showInvitationLink={true}
                invitationPath="/accept-invitation/:id"
                expirationText="48 hours"
                usersIcon={
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                }
                plusIcon={<Plus className="w-4 h-4" />}
                moreIcon={<MoreHorizontal className="w-4 h-4" />}
                userMinusIcon={<Trash2 className="w-4 h-4" />}
                copyIcon={<Copy className="w-4 h-4" />}
                checkIcon={<Check className="w-4 h-4" />}
                refreshIcon={<RefreshCw className="w-4 h-4" />}
                cancelIcon={<X className="w-4 h-4" />}
                mailIcon={<Mail className="w-4 h-4" />}
                linkIcon={<Link className="w-4 h-4" />}
              />
            )}

            {activeTab === "teams" && (
              <TeamsSection
                usersIcon={<Users className="w-5 h-5" />}
                plusIcon={<Plus className="w-4 h-4" />}
                trashIcon={<Trash2 className="w-4 h-4" />}
                closeIcon={<X className="w-5 h-5" />}
              />
            )}
          </>
        ) : organizations.length === 0 ? (
          /* No Organization - Show Create Prompt */
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              No Organization Yet
            </h2>
            <p className="text-slate-500 mb-6">
              Create your first organization to get started
            </p>
            {/* CreateOrganizationDialog uses context automatically */}
            <CreateOrganizationDialog
              plusIcon={<Plus className="w-4 h-4" />}
              buildingIcon={
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
              }
              closeIcon={<X className="w-5 h-5" />}
            />
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 text-center">
        <p className="text-sm text-slate-500">
          This example uses{" "}
          <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">
            TenantsProvider
          </code>{" "}
          to reduce ~680 lines to ~200 lines
        </p>
      </footer>
    </div>
  );
}

export default App;
