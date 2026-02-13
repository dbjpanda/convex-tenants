"use client";

import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { OrganizationSwitcher, useTenants } from "@djpanda/convex-tenants/react";
import {
  Building2,
  Users,
  UsersRound,
  LogOut,
  Settings,
  Shield,
  ScrollText,
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";

// ============================================================================
// Theme Toggle Hook
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
// Root Layout with Sidebar
// ============================================================================

export function RootLayout() {
  const { signOut } = useAuthActions();
  const { dark, toggle: toggleTheme } = useTheme();
  const { currentRole } = useTenants();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isOwnerOrAdmin = currentRole === "owner" || currentRole === "admin";

  const navItems = [
    { path: "/teams", label: "Teams", icon: UsersRound },
    { path: "/", label: "Members", icon: Users },
    { path: "/permissions", label: "Permissions", icon: Shield, adminOnly: true },
    { path: "/audit", label: "Audit Log", icon: ScrollText, adminOnly: true },
    { path: "/settings", label: "Settings", icon: Settings, adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 border-b bg-background shadow-sm lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <h1 className="text-lg font-semibold">Tenants Demo</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-sidebar transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="border-b border-sidebar-border p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary">
                <Building2 className="size-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-sidebar-foreground">
                  Tenants Demo
                </h1>
                <p className="text-xs text-sidebar-foreground/60">
                  Multi-tenant SaaS
                </p>
              </div>
            </div>
          </div>

          {/* Organization Switcher */}
          <div className="border-b border-sidebar-border p-4">
            <OrganizationSwitcher className="w-full" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navItems.map((item) => {
              if (item.adminOnly && !isOwnerOrAdmin) return null;
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex gap-2">
              <button
                onClick={toggleTheme}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title={dark ? "Light mode" : "Dark mode"}
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <button
                onClick={() => void signOut()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>

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
      </main>
    </div>
  );
}
