"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { updateReport, type ReportUpdateState } from "@/actions/reports";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, REPORT_CATEGORIES, STATUS_LABELS } from "@/lib/labels";
import { isClosed, isFinalStatus, NEXT_STATUSES } from "@/lib/report-transitions";
import type { AdminReportDetail, ReportStatus } from "@/types/api";

const initialState: ReportUpdateState = { result: "idle", message: null, fieldErrors: {} };

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-small text-ink">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

type Props = { report: Pick<AdminReportDetail, "id" | "status" | "category" | "admin_note" | "updated_at"> };

export function ReportUpdateForm({ report }: Props) {
  if (isClosed(report.status)) {
    return (
      <section className="border-t-2 border-ink pt-4">
        <p className="label-micro text-gray-600">Dispatch</p>
        <p className="mt-2 flex items-center gap-2 text-heading font-semibold text-ink">
          <Lock className="size-4" aria-hidden="true" /> This report is closed
        </p>
        <p className="mt-1 text-small text-gray-700">
          It was {STATUS_LABELS[report.status].toLowerCase()}, so nothing about it can change any more.
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
    <section className="border-2 border-ink">
      {/* Yellow header strip: the one action on this page (ink on yellow, 15.34:1). */}
      <div className="border-b-2 border-ink bg-highlight px-4 py-3">
        <h2 className="tracking-display text-heading font-extrabold text-ink">Route this report</h2>
      </div>

      {/* Remounted after each save (key), so the inputs start from the latest data. */}
      <form key={report.updated_at} action={formAction} onSubmit={handleSubmit} className="space-y-5 p-4" noValidate>
        <input type="hidden" name="report_id" value={report.id} />
        <input type="hidden" name="original_category" value={report.category} />
        <input type="hidden" name="original_admin_note" value={originalNote} />

        {state.message && (
          <p
            role={state.result === "success" ? "status" : "alert"}
            className={`flex gap-2 border-l-4 py-1 pl-3 text-small font-medium text-ink ${
              state.result === "success" ? "border-ink bg-highlight" : "border-ink"
            }`}
          >
            {state.result === "success" ? (
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            {state.message}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="status">Next status · now {STATUS_LABELS[report.status]}</Label>
          <NativeSelect id="status" name="status" value={status} onChange={(event) => chooseStatus(event.target.value as ReportStatus | "")}>
            <NativeSelectOption value="">Keep {STATUS_LABELS[report.status]}</NativeSelectOption>
            {NEXT_STATUSES[report.status].map((next) => (
              <NativeSelectOption key={next} value={next}>
                {STATUS_LABELS[next]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {state.fieldErrors.status && <FieldError>{state.fieldErrors.status}</FieldError>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category · correct the AI if needed</Label>
          <NativeSelect id="category" name="category" defaultValue={report.category}>
            {REPORT_CATEGORIES.map((category) => (
              <NativeSelectOption key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {state.fieldErrors.category && <FieldError>{state.fieldErrors.category}</FieldError>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin_note">
            Note to the reporter {status === "rejected" ? "· required when rejecting" : "· shown in the app"}
          </Label>
          <Textarea
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
          />
          {noteMessage && <FieldError>{noteMessage}</FieldError>}
        </div>

        {confirming && status !== "" ? (
          <div role="alertdialog" aria-label="Confirm final status" className="space-y-3 border-2 border-ink p-4">
            <p className="text-small text-ink">
              <span className="highlight font-semibold">This is final.</span> Mark this report as{" "}
              <strong>{STATUS_LABELS[status]}</strong>? It can&apos;t be changed afterwards.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : `Yes, mark as ${STATUS_LABELS[status]}`}
              </Button>
              <Button type="button" onClick={() => setConfirming(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </form>
    </section>
  );
}
