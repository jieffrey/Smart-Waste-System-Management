"use client";

import type { ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  description: string;
  // The confirming control (e.g. a submit button inside a form with a Server Action).
  children: ReactNode;
};

// Radix AlertDialog, restyled like the app's dialogs: square, 2px ink frame, no shadow. Focus is trapped inside,
// Esc cancels (a click on the overlay does nothing), and Cancel gets focus first, so the safe choice is the
// default.
export function ConfirmDialog({ trigger, title, description, children }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-snow p-6 outline-none">
          <AlertDialog.Title className="text-heading font-extrabold tracking-heading text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-small text-gray-700">{description}</AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button">Cancel</Button>
            </AlertDialog.Cancel>
            {children}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
