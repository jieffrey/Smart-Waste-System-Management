"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";

const initialState: LoginState = { message: null, fieldErrors: {}, email: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-small text-red-700">
          {state.message}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="email" className="block text-small font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors.email)}
          aria-describedby={state.fieldErrors.email ? "email-error" : undefined}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-small"
        />
        {state.fieldErrors.email && (
          <p id="email-error" className="text-small text-red-600">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-small font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors.password)}
          aria-describedby={state.fieldErrors.password ? "password-error" : undefined}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-small"
        />
        {state.fieldErrors.password && (
          <p id="password-error" className="text-small text-red-600">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-zinc-900 px-3 py-2 text-small font-medium text-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
