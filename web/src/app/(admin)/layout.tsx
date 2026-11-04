import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-6">
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
