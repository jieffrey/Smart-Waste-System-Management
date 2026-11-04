// "Nothing here" message: a rule above, a short headline and an optional hint. No box, no illustration.
export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="border-t border-ink py-12">
      <p className="text-heading font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 text-small text-gray-600">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
