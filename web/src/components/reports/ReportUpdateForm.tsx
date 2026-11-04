"use client";

import { useActionState, useState } from "react";
import { updateReport, type ReportUpdateState } from "@/actions/reports";
import { CATEGORY_LABELS, REPORT_CATEGORIES, STATUS_LABELS } from "@/lib/labels";
import { isClosed, isFinalStatus, NEXT_STATUSES } from "@/lib/report-transitions";
import type { AdminReportDetail, ReportStatus } from "@/types/api";

const initialState: ReportUpdateState = { result: "idle", message: null, fieldErrors: {} };
const inputClass = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-small";

type Props = { report: Pick<AdminReportDetail, "id" | "status" | "category" | "admin_note" | "updated_at"> };

export function ReportUpdateForm({ report }: Props) {
  if (isClosed(report.status)) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-medium">Update report</h2>
        <p className="mt-2 text-small text-zinc-600">
          This report is closed ({STATUS_LABELS[report.status].toLowerCase()}), so it can no longer be changed.
        </p>
      </section>
    );
  }
  return <OpenReportForm report={report} />;
}

function OpenReportForm({ report }: Props) {
  const [state, formAction, pending] = useActionState(updateReport, initialState);
  const originalNote = report.admin_note ?? "";
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [note, setNote] = useState(originalNote);
  const [confirming, setConfirming] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // After a save (or a 409 refresh) the page re-renders with newer data: start again from it.
  const [shownVersion, setShownVersion] = useState(report.updated_at);
  if (report.updated_at !== shownVersion) {
    setShownVersion(report.updated_at);
    setStatus("");
    setNote(originalNote);
    setConfirming(false);
    setNoteError(null);
  }

  function chooseStatus(value: ReportStatus | "") {
    setStatus(value);
    setConfirming(false);
    setNoteError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (status === "rejected" && note.trim() === "") {
      event.preventDefault();
      setNoteError("A note is required when rejecting a report");
      return;
    }
    // Completed and rejected are final: the first submit only opens the confirmation.
    if (status !== "" && isFinalStatus(status) && !confirming) {
      event.preventDefault();
      setConfirming(true);
    }
  }

  const noteMessage = noteError ?? state.fieldErrors.admin_note;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="font-medium">Update report</h2>

      {/* Remounted after each save (key), so the inputs start from the latest data. */}
      <form key={report.updated_at} action={formAction} onSubmit={handleSubmit} className="mt-3 space-y-4" noValidate>
        <input type="hidden" name="report_id" value={report.id} />
        <input type="hidden" name="original_category" value={report.category} />
        <input type="hidden" name="original_admin_note" value={originalNote} />

        {state.message && (
          <p
            role={state.result === "success" ? "status" : "alert"}
            className={`rounded border px-3 py-2 text-small ${
              state.result === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {state.message}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="status" className="block text-small font-medium">
            Status <span className="font-normal text-zinc-500">(now {STATUS_LABELS[report.status]})</span>
          </label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(event) => chooseStatus(event.target.value as ReportStatus | "")}
            className={inputClass}
          >
            <option value="">Keep {STATUS_LABELS[report.status]}</option>
            {NEXT_STATUSES[report.status].map((next) => (
              <option key={next} value={next}>
                {STATUS_LABELS[next]}
              </option>
            ))}
          </select>
          {state.fieldErrors.status && <p className="text-small text-red-600">{state.fieldErrors.status}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="category" className="block text-small font-medium">
            Category
          </label>
          <select id="category" name="category" defaultValue={report.category} className={inputClass}>
            {REPORT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          {state.fieldErrors.category && <p className="text-small text-red-600">{state.fieldErrors.category}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="admin_note" className="block text-small font-medium">
            Admin note{" "}
            {status === "rejected" ? (
              <span className="font-normal text-red-700">(required when rejecting)</span>
            ) : (
              <span className="font-normal text-zinc-500">(the reporter sees it in the app)</span>
            )}
          </label>
          <textarea
            id="admin_note"
            name="admin_note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteError(null);
            }}
            rows={3}
            maxLength={1000}
            aria-invalid={Boolean(noteMessage)}
            className={inputClass}
          />
          {noteMessage && <p className="text-small text-red-600">{noteMessage}</p>}
        </div>

        {confirming && status !== "" ? (
          <div role="alertdialog" aria-label="Confirm final status" className="space-y-3 rounded border border-amber-300 bg-amber-50 p-3 text-small">
            <p className="text-amber-900">
              Mark this report as <strong>{STATUS_LABELS[status]}</strong>? This is final: the report can&apos;t be
              changed afterwards.
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-zinc-900 px-3 py-2 font-medium text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : `Yes, mark as ${STATUS_LABELS[status]}`}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded border border-zinc-300 bg-white px-3 py-2 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-zinc-900 px-4 py-2 text-small font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        )}
      </form>
    </section>
  );
}
