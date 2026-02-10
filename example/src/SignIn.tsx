"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Building2, LogIn, UserPlus, Mail, Lock, Loader2 } from "lucide-react";

export function SignIn({ subtitle }: { subtitle?: string } = {}) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      await signIn("password", formData);
    } catch {
      setError(
        flow === "signIn"
          ? "Invalid email or password. Please try again."
          : "Could not create account. Email may already be in use."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <Building2 className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Tenants Example
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subtitle
              ? subtitle
              : flow === "signIn"
                ? "Sign in to manage your organizations"
                : "Create an account to get started"}
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium leading-none"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={
                    flow === "signUp"
                      ? "At least 8 characters"
                      : "Enter your password"
                  }
                  required
                  minLength={flow === "signUp" ? 8 : undefined}
                  autoComplete={
                    flow === "signUp" ? "new-password" : "current-password"
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            {/* Hidden flow field */}
            <input name="flow" type="hidden" value={flow} />

            {/* Error message */}
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : flow === "signIn" ? (
                <LogIn className="size-4" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {isLoading
                ? flow === "signIn"
                  ? "Signing in..."
                  : "Creating account..."
                : flow === "signIn"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          {/* Toggle flow */}
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {flow === "signIn" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFlow("signUp");
                    setError(null);
                  }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFlow("signIn");
                    setError(null);
                  }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Built with{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
            @djpanda/convex-tenants
          </code>{" "}
          + Convex Auth
        </p>
      </div>
    </div>
  );
}
