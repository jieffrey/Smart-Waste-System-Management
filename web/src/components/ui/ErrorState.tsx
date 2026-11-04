import { AlertTriangle } from "lucide-react";

// Shown instead of a section when the backend request fails. Errors are ink text + an icon, never red.
export function ErrorState({ title = "Couldn't load this data", message }: { title?: string; message: string }) {
  return (
    <div role="alert" className="flex gap-3 border-t border-ink py-6 text-small text-ink">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-heading font-semibold">{title}</p>
        <p>{message}</p>
        <p className="text-gray-600">Reload the page to try again.</p>
      </div>
    </div>
  );
}
