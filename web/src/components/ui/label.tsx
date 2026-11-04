"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// Field labels use the micro style: mono, uppercase, tracked, gray-600 (6.36:1).
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("label-micro flex items-center gap-2 text-gray-600 select-none", className)}
      {...props}
    />
  );
}

export { Label };
