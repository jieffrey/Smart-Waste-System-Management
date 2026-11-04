import { cn } from "@/lib/utils";

// A full flat field of color (poster style). Text colors per block come from docs/design-system.md (v2):
// red orange -> ink text, yellow -> ink text, cobalt -> white text. No border, shadow or gradient.
const BLOCK_CLASSES = {
  signal: "bg-signal text-ink",
  highlight: "bg-highlight text-ink",
  cobalt: "bg-cobalt text-white",
} as const;

export function ColorBlock({
  color,
  className,
  children,
  ...props
}: { color: keyof typeof BLOCK_CLASSES } & React.ComponentProps<"section">) {
  return (
    <section className={cn("min-w-0 p-6 sm:p-8", BLOCK_CLASSES[color], className)} {...props}>
      {children}
    </section>
  );
}
