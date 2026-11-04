export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-small text-zinc-500">{label}</p>
      <p className="mt-1 text-title font-semibold">{value}</p>
      {hint && <p className="mt-1 text-micro text-zinc-500">{hint}</p>}
    </div>
  );
}
