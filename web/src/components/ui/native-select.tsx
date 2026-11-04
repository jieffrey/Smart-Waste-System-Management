import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
};

// A real <select> (works in forms and with the keyboard/screen readers as is), styled like our inputs.
function NativeSelect({ className, size = "default", ...props }: NativeSelectProps) {
  return (
    <div
      className={cn("relative w-full has-[select:disabled]:opacity-40", className)}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        className={cn(fieldClass, "appearance-none pr-9", size === "sm" ? "h-8 text-small" : "h-10")}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink"
        aria-hidden="true"
      />
    </div>
  );
}

function NativeSelectOption(props: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

function NativeSelectOptGroup(props: React.ComponentProps<"optgroup">) {
  return <optgroup data-slot="native-select-optgroup" {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
