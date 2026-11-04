"use client";

import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { login, type LoginState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { message: null, fieldErrors: {}, email: "" };

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-small text-ink">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.message && (
        <p role="alert" className="flex gap-2 border-l-4 border-ink py-1 pl-3 text-small font-medium text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors.email)}
          aria-describedby={state.fieldErrors.email ? "email-error" : undefined}
        />
        {state.fieldErrors.email && <FieldError id="email-error">{state.fieldErrors.email}</FieldError>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors.password)}
          aria-describedby={state.fieldErrors.password ? "password-error" : undefined}
        />
        {state.fieldErrors.password && <FieldError id="password-error">{state.fieldErrors.password}</FieldError>}
      </div>

      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
