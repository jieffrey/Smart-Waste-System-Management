import { formatDateTime } from "@/lib/format";
import type { AdminReportDetail } from "@/types/api";
import { AiClassification } from "./AiClassification";
import { ReportPhoto } from "./ReportPhoto";
import { StatusBadge } from "./StatusBadge";
import { StatusTimeline } from "./StatusTimeline";

function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

export function ReportDetail({ report, children }: { report: AdminReportDetail; children?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={report.status} />
        <p className="text-sm text-zinc-500">
          Reported {formatDateTime(report.created_at)} WIB · Updated {formatDateTime(report.updated_at)} WIB
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <ReportPhoto imageUrl={report.image_url} />
          {report.description && (
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="font-medium">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{report.description}</p>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="font-medium">Details</h2>
            <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              <Field label="Reporter">{report.reporter_name}</Field>
              <Field label="Email">
                <a href={`mailto:${report.reporter_email}`} className="text-blue-700 hover:underline">
                  {report.reporter_email}
                </a>
              </Field>
              <Field label="Address">{report.address || <span className="text-zinc-400">Not provided</span>}</Field>
              <Field label="Coordinates">
                {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}{" "}
                <a
                  href={googleMapsUrl(report.latitude, report.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap text-blue-700 hover:underline"
                >
                  Open in Google Maps ↗
                </a>
              </Field>
              <Field label="Created">{formatDateTime(report.created_at)} WIB</Field>
              <Field label="Updated">{formatDateTime(report.updated_at)} WIB</Field>
            </dl>
          </section>

          <AiClassification
            category={report.category}
            ai_predicted_category={report.ai_predicted_category}
            ai_confidence={report.ai_confidence}
            ai_model_version={report.ai_model_version}
          />

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="font-medium">Admin note</h2>
            {report.admin_note ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{report.admin_note}</p>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">No note yet.</p>
            )}
          </section>

          {children}
        </div>
      </div>

      <StatusTimeline history={report.status_history} />
    </div>
  );
}
