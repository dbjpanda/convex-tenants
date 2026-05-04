"use client";

import { useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export type ToastType = "success" | "error";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let nextId = 1;

/**
 * Lightweight in-app toast queue. No external deps.
 *
 * Returns the `notify` callback to wire into the TenantsProvider's
 * `onToast` prop, plus the `<Toaster />` element to render once near the
 * root of the app.
 */
export function useToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, type: ToastType) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const Toaster = useCallback(
    () => <ToasterUI toasts={toasts} onDismiss={dismiss} />,
    [toasts, dismiss]
  );

  return { notify, Toaster };
}

function ToasterUI({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  // Auto-dismiss errors after 6s, success after 3s — errors deserve a longer
  // read because they often contain technical detail the user may want to copy.
  useEffect(() => {
    const timeout = toast.type === "error" ? 6000 : 3000;
    const id = setTimeout(onDismiss, timeout);
    return () => clearTimeout(id);
  }, [toast.id, toast.type, onDismiss]);

  const isError = toast.type === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 rounded-md border bg-background p-3 shadow-lg ${
        isError
          ? "border-red-200 dark:border-red-900/50"
          : "border-green-200 dark:border-green-900/50"
      }`}
    >
      <Icon
        className={`mt-0.5 size-5 shrink-0 ${
          isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
        }`}
      />
      <div className="flex-1 text-sm leading-snug break-words">
        {toast.message}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
