// Shown instead of a section when the backend request fails.
export function ErrorState({ title = "Couldn't load this data", message }: { title?: string; message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-medium">{title}</p>
      <p>{message}</p>
      <p className="mt-1 text-red-700">Reload the page to try again.</p>
    </div>
  );
}
