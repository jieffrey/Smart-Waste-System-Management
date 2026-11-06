import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { PasswordForm, ProfileForm } from "@/components/settings/SettingsForms";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/format";
import { getCurrentAdmin, getSessionExpiry } from "@/lib/session";

export default function SettingsPage() {
  return (
    <section className="space-y-10">
      <PageHeader title="Settings" description="Your admin account: profile, password and this session." />
      <Suspense fallback={<p className="text-small text-gray-600">Loading your account…</p>}>
        <SettingsContent />
      </Suspense>
    </section>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-ink pt-4 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <h2 className="text-heading font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-small text-gray-700">{hint}</p>}
      </div>
      <div className="max-w-md lg:col-span-8">{children}</div>
    </section>
  );
}

async function SettingsContent() {
  const admin = await getCurrentAdmin();
  const expiresAt = await getSessionExpiry();

  return (
    <div className="space-y-12">
      <Section title="Profile" hint="Your name is shown in report histories when you route a report.">
        <ProfileForm fullName={admin.full_name} email={admin.email} />
      </Section>

      <Section title="Password" hint="At least 8 characters, not a common password. You need your current one.">
        <PasswordForm />
      </Section>

      <Section title="This session" hint="Signed in on this browser.">
        <dl className="space-y-3 text-small">
          <div className="flex justify-between gap-6 border-b border-gray-200 pb-3">
            <dt className="label-micro text-gray-600">Signed in as</dt>
            <dd className="text-right">
              <span className="font-semibold text-ink">{admin.full_name}</span>
              <span className="block font-mono text-micro text-gray-700">{admin.email}</span>
            </dd>
          </div>
          <div className="flex justify-between gap-6 border-b border-gray-200 pb-3">
            <dt className="label-micro text-gray-600">Role</dt>
            <dd>
              <span className="label-micro bg-ink px-1.5 py-0.5 text-snow">Admin</span>
            </dd>
          </div>
          <div className="flex justify-between gap-6 border-b border-gray-200 pb-3">
            <dt className="label-micro text-gray-600">Session ends</dt>
            <dd className="font-mono text-ink">{expiresAt ? `${formatDateTime(expiresAt.toISOString())} WIB` : "Unknown"}</dd>
          </div>
        </dl>
        <form action={logout} className="mt-6">
          <Button type="submit">Log out</Button>
        </form>
      </Section>
    </div>
  );
}
