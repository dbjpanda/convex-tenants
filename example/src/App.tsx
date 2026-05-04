"use client";

import { useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { TenantsProvider } from "@djpanda/convex-tenants/react";
import { Loader2 } from "lucide-react";
import { SignIn } from "./components/SignIn";
import { useToaster } from "./components/Toaster";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Create router instance
const router = createRouter({ 
  routeTree,
  defaultPreload: "intent",
});

function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { notify, Toaster } = useToaster();

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
    <TenantsProvider api={api.tenants as any} onToast={notify}>
      <RouterProvider router={router} />
      <Toaster />
    </TenantsProvider>
  );
}

export default App;
