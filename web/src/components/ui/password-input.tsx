"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A password Input with a show/hide toggle inside it on the right. The toggle is type="button" (never submits),
// keeps focus in the field when clicked (mousedown is cancelled), and is still reachable with Tab. Each field
// has its own state and always starts hidden.
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  const label = visible ? "Hide password" : "Show password";
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        aria-label={label}
        aria-pressed={visible}
        aria-controls={props.id}
        title={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((current) => !current)}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-700 transition-colors hover:text-ink focus-visible:-outline-offset-4 disabled:pointer-events-none disabled:text-gray-400"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export { PasswordInput };
