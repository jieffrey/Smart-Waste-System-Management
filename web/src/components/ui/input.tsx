import * as React from "react";
import { cn } from "@/lib/utils";

// 1px ink border, snow fill, hard edges. Invalid fields get a 2px ink border (errors are never red).
export const fieldClass =
  "w-full min-w-0 rounded-none border border-ink bg-snow px-3 text-body text-ink transition-colors outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:border-gray-400 disabled:bg-gray-50 disabled:text-gray-600 aria-invalid:border-2";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, "h-10", className)} {...props} />;
}

export { Input };
