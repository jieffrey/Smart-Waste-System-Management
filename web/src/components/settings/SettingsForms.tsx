"use client";

import { useActionState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { changePassword, updateProfile, type FormResult, type PasswordField, type ProfileField } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Notice({ state }: { state: FormResult<string> }) {
  if (!state.message) return null;
  const Icon = state.result === "success" ? Check : AlertTriangle;
  return (
    <p
      role={state.result === "success" ? "status" : "alert"}
      className={`flex gap-2 border-l-4 border-ink py-1 pl-3 text-small font-medium text-ink ${state.result === "success" ? "bg-highlight/60" : ""}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {state.message}
    </p>
  );
}

function Field({
  name,
  label,
  error,
  ...props
}: { name: string; label: string; error?: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} {...props} />
      {error && (
        <p id={`${name}-error`} className="flex items-center gap-1.5 text-small text-ink">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

const idle = { result: "idle" as const, message: null, fieldErrors: {} };

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action, pending] = useActionState<FormResult<ProfileField>, FormData>(updateProfile, idle);
  return (
    <form action={action} className="space-y-5" noValidate>
      <Notice state={state} />
      <Field name="full_name" label="Full name" autoComplete="name" defaultValue={fullName} required error={state.fieldErrors.full_name} />
      <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={email} required error={state.fieldErrors.email} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormResult<PasswordField>, FormData>(changePassword, idle);
  return (
    // key: a successful change clears the three fields
    <form key={state.result === "success" ? state.message : "form"} action={action} className="space-y-5" noValidate>
      <Notice state={state} />
      <Field name="current_password" label="Current password" type="password" autoComplete="current-password" required error={state.fieldErrors.current_password} />
      <Field name="new_password" label="New password (8–72 characters)" type="password" autoComplete="new-password" required error={state.fieldErrors.new_password} />
      <Field name="confirm_password" label="Repeat new password" type="password" autoComplete="new-password" required error={state.fieldErrors.confirm_password} />
      <Button type="submit" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
