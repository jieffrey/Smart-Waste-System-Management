import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

// primary   = red orange fill + ink label (5.57:1). Use it ONCE per view, for the main action.
// secondary = 1px ink outline (the default, so a primary is always a deliberate choice).
// ghost     = text only, underlined on hover.
// ink       = ink fill + snow label (18:1). The CTA inside a red-orange block, where a red button would vanish.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-none font-sans font-semibold whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 outline-none select-none active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "border border-signal bg-signal text-ink hover:border-ink hover:bg-ink hover:text-signal",
        secondary: "border border-ink bg-snow text-ink hover:bg-ink hover:text-snow",
        ghost: "border border-transparent text-ink underline-offset-4 hover:underline",
        ink: "border border-ink bg-ink text-snow hover:bg-snow hover:text-ink",
      },
      size: {
        default: "h-10 px-4 text-small",
        sm: "h-8 px-3 text-small",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "secondary"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
