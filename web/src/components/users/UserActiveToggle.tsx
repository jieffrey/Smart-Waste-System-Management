"use client";

import { useActionState, useState } from "react";
import { setUserActive, type UserActiveState } from "@/actions/users";

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
    <div className="space-y-1">
      {confirming ? (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="is_active" value={String(!isActive)} />
          <span className="text-micro text-zinc-600">
            {action} {userName}?{isActive && " They will be signed out."}
          </span>
          <button
            type="submit"
            disabled={pending}
            className={`rounded px-2 py-1 text-micro font-medium text-white disabled:opacity-60 ${
              isActive ? "bg-red-700" : "bg-green-700"
            }`}
          >
            {pending ? "Saving…" : `Yes, ${action.toLowerCase()}`}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-micro hover:bg-zinc-100"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-micro hover:bg-zinc-100"
        >
          {action}
        </button>
      )}
      {state.result === "error" && state.message && (
        <p role="alert" className="text-micro text-red-700">
          {state.message}
        </p>
      )}
    </div>
  );
}
