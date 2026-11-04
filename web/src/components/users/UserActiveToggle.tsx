"use client";

import { useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { setUserActive, type UserActiveState } from "@/actions/users";
import { Button } from "@/components/ui/button";

const initialState: UserActiveState = { result: "idle", message: null };

// Activate/deactivate button with a confirm step. Deactivating signs the user out of the app.
export function UserActiveToggle({ userId, userName, isActive }: { userId: string; userName: string; isActive: boolean }) {
  const [state, formAction, pending] = useActionState(setUserActive, initialState);
  const [confirming, setConfirming] = useState(false);
  const action = isActive ? "Deactivate" : "Activate";

  // After a successful change the row re-renders with the new isActive: close the confirmation.
  const [shownActive, setShownActive] = useState(isActive);
  if (isActive !== shownActive) {
    setShownActive(isActive);
    setConfirming(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="is_active" value={String(!isActive)} />
          <span className="text-small text-ink">
            {action} {userName}?{isActive && " They will be signed out."}
          </span>
          <Button type="submit" size="sm" disabled={pending} className="bg-ink text-snow hover:bg-gray-800">
            {pending ? "Saving…" : `Yes, ${action.toLowerCase()}`}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button type="button" size="sm" onClick={() => setConfirming(true)}>
          {action}
        </Button>
      )}
      {state.result === "error" && state.message && (
        <p role="alert" className="flex items-center gap-1.5 text-small text-ink">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
    </div>
  );
}
