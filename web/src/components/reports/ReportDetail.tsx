import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusMarker } from "@/components/ui/StatusMarker";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { AdminReportDetail } from "@/types/api";
import { AiClassification } from "./AiClassification";
import { ReportPhoto } from "./ReportPhoto";
import { StatusTimeline } from "./StatusTimeline";

// "a39df709-6787-…" -> "#a39df709": the first block of the UUID, lowercase, in mono (the full ID is in the
// tooltip). The old kicker showed it through an uppercase label style, and the screenshot fixtures all
// started with "r0000000", which is why every report looked like "R0000000".
function shortId(id: string) {
  return `#${id.split("-")[0].toLowerCase()}`;
}

function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-gray-200 py-2 last:border-b-0">
      <dt className="label-micro pt-0.5 text-gray-600">{label}</dt>
      <dd className="min-w-0 text-small break-words text-ink">{children}</dd>
    </div>
  );
}

// Reading order: what and where (title) -> the photo -> the action (children = update form) -> the AI
// result -> details -> the timeline. The form sits at the top of the right column, next to the photo.
export function ReportDetail({ report, children }: { report: AdminReportDetail; children?: React.ReactNode }) {
  const place = report.address || `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;

  return (
    <div className="space-y-10">
      <PageHeader
        kicker={
          <>
            Report{" "}
            <span title={report.id} className="text-ink">
              {shortId(report.id)}
            </span>{" "}
            · reported {formatDateTime(report.created_at)} WIB
          </>
        }
        title={`${CATEGORY_LABELS[report.category]} waste, ${place}`}
        actions={<StatusMarker status={report.status} size="lg" />}
      />

      {/* Desktop: photo + description, then the timeline, on the left; the dispatch form and details on the
          right. Mobile: photo, form, details, timeline (the form comes before the history). */}
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7 lg:row-start-1">
          <ReportPhoto imageUrl={report.image_url} />
          {report.description && (
            <section>
              <p className="label-micro text-gray-600">Reporter&apos;s description</p>
              <p className="mt-2 text-body whitespace-pre-wrap text-ink">{report.description}</p>
            </section>
          )}
        </div>

        <div className="space-y-8 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          {children}
          <AiClassification
            category={report.category}
            ai_predicted_category={report.ai_predicted_category}
            ai_confidence={report.ai_confidence}
            ai_model_version={report.ai_model_version}
          />
          <section className="border-t border-ink pt-4">
            <p className="label-micro text-gray-600">Details</p>
            <dl className="mt-2">
              <Field label="Reporter">
                <span className="font-semibold">{report.reporter_name}</span>
                <a href={`mailto:${report.reporter_email}`} className="block font-mono text-micro text-ink underline underline-offset-2">
                  {report.reporter_email}
                </a>
              </Field>
              <Field label="Address">{report.address || <span className="text-gray-600">Not provided</span>}</Field>
              <Field label="Coordinates">
                <span className="font-mono">
                  {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                </span>
                <a
                  href={googleMapsUrl(report.latitude, report.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex w-fit items-center gap-1 font-semibold text-ink underline underline-offset-2"
                >
                  Open in Google Maps <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </Field>
              <Field label="Created">
                <span className="font-mono">{formatDateTime(report.created_at)} WIB</span>
              </Field>
              <Field label="Updated">
                <span className="font-mono">{formatDateTime(report.updated_at)} WIB</span>
              </Field>
              <Field label="Admin note">
                {report.admin_note ? (
                  <span className="whitespace-pre-wrap">{report.admin_note}</span>
                ) : (
                  <span className="text-gray-600">No note yet.</span>
                )}
              </Field>
            </dl>
          </section>
        </div>
        <div className="lg:col-span-7 lg:row-start-2">
          <StatusTimeline history={report.status_history} />
        </div>
      </div>
    </div>
  );
}
