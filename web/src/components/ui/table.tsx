import * as React from "react";
import { cn } from "@/lib/utils";

// No outer box: a 2px ink rule on top, 1px gray-200 rules between rows, mono micro headers.
// Put numbers in cells with `numeric` so they align right in Plex Mono.

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto border-t-2 border-ink">
      <table data-slot="table" className={cn("w-full caption-bottom text-small", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b [&_tr]:border-ink", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b border-gray-200 transition-colors hover:bg-gray-50", className)}
      {...props}
    />
  );
}

function TableHead({ className, numeric, ...props }: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "label-micro h-10 px-3 text-left align-middle whitespace-nowrap text-gray-600",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, numeric, ...props }: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3 py-3 align-middle", numeric && "text-right font-mono", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("mt-4 text-small text-gray-600", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption };
