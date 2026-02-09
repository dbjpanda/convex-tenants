"use client";

import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import {
  TenantsProvider,
  useTenants,
  OrganizationSwitcher,
  CreateOrganizationDialog,
  MembersSection,
  TeamsSection,
} from "@djpanda/convex-tenants/react";
import { Building2, Users, UsersRound, LogOut, Loader2 } from "lucide-react";
import { SignIn } from "./SignIn.jsx";

/**
 * Example App with Convex Auth (email + password).
 *
 * - Unauthenticated users see the sign-in/sign-up form
 * - Authenticated users see the tenant management UI
 * - Every component handles its own skeleton loading automatically
 */
function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
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

function AppContent() {
  const { currentOrganization, organizations, isOrganizationsLoading } =
    useTenants();
  const { signOut } = useAuthActions();
  const [activeTab, setActiveTab] = useState<"members" | "teams">("members");

  const showEmptyState =
    !isOrganizationsLoading &&
    !currentOrganization &&
    organizations.length === 0;

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Tenants Example
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Multi-tenant organization management
            </p>
          </div>

          <div className="flex items-center gap-3">
            <OrganizationSwitcher className="w-64" />

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
        ) : (
          <>
            {/* Tabs */}
            <div className="mb-6">
              <div className="inline-flex gap-1 rounded-lg border bg-muted/50 p-1">
                <button
                  onClick={() => setActiveTab("members")}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "members"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="size-4" />
                  Members
                </button>
                <button
                  onClick={() => setActiveTab("teams")}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "teams"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UsersRound className="size-4" />
                  Teams
                </button>
              </div>
            </div>

            {activeTab === "members" && (
              <MembersSection
                showTeamSelection
                showInvitationLink
                invitationPath="/accept-invitation/:id"
                expirationText="48 hours"
              />
            )}

            {activeTab === "teams" && <TeamsSection />}
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
          &middot; shadcn/ui + Convex Auth
        </p>
      </footer>
    </div>
  );
}

export default App;
