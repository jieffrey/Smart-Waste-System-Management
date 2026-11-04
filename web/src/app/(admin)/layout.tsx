import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MotionProvider } from "@/components/motion/MotionProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <div className="flex min-h-screen flex-col bg-snow md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-8 md:px-12 md:py-12">
          <div className="mx-auto max-w-[1200px]">
            <Suspense fallback={<p className="text-small text-gray-600">Loading…</p>}>{children}</Suspense>
          </div>
        </main>
      </div>
    </MotionProvider>
  );
}
