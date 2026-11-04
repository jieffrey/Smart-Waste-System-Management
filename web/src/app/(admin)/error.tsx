"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Last-resort error screen for the admin pages (the sidebar stays visible). Ink + icon, never red.
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex gap-3 border-t border-ink py-6 text-ink">
      <AlertTriangle className="mt-1 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-4">
        <p className="text-heading font-semibold">Something went wrong while loading this page.</p>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
