"use client";

// Last-resort error screen for the admin pages (the sidebar stays visible).
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-small text-red-800">
      <p className="font-medium">Something went wrong while loading this page.</p>
      <button type="button" onClick={reset} className="rounded border border-red-300 bg-white px-3 py-1.5 hover:bg-red-100">
        Try again
      </button>
    </div>
  );
}
