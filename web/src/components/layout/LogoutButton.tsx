"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Every "Log out" goes through this: the button only opens the confirmation; the session ends on "Log out".
export function LogoutButton(props: Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">) {
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" {...props}>
          Log out
        </Button>
      }
      title="Log out?"
      description="You'll need to sign in again to manage reports."
    >
      <form action={logout}>
        <ConfirmLogout />
      </form>
    </ConfirmDialog>
  );
}

function ConfirmLogout() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ink" disabled={pending}>
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
