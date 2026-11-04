"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { isReportCategory, isReportStatus, STATUS_LABELS } from "@/lib/labels";
import { adminRequest } from "@/lib/session";
import type { AdminReportDetail, ReportCategory, ReportStatus } from "@/types/api";

export type ReportUpdateField = "status" | "category" | "admin_note";

export type ReportUpdateState = {
  result: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Partial<Record<ReportUpdateField, string>>;
};

type UpdateBody = { status?: ReportStatus; category?: ReportCategory; admin_note?: string };

function failure(message: string, fieldErrors: ReportUpdateState["fieldErrors"] = {}): ReportUpdateState {
  return { result: "error", message, fieldErrors };
}

// Refreshes every page that shows this report's data.
function revalidateReportPages(reportId: string) {
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

// Saves the admin's changes to a report. Only fields that changed are sent: the form also posts the
// values it started with (original_*), and those are compared with what the admin chose.
export async function updateReport(_previous: ReportUpdateState, formData: FormData): Promise<ReportUpdateState> {
  const reportId = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const category = String(formData.get("category") ?? "");
  const note = String(formData.get("admin_note") ?? "").trim();
  const originalCategory = String(formData.get("original_category") ?? "");
  const originalNote = String(formData.get("original_admin_note") ?? "").trim();

  const body: UpdateBody = {};
  if (isReportStatus(status)) {
    body.status = status;
  }
  if (isReportCategory(category) && category !== originalCategory) {
    body.category = category;
  }
  if (note !== originalNote) {
    if (note === "") {
      return failure("Please fix the fields below.", { admin_note: "A note can be changed, but not removed" });
    }
    body.admin_note = note;
  }
  // Rejecting always needs a note (the backend checks the request body), even when it is unchanged.
  if (body.status === "rejected") {
    if (note === "") {
      return failure("Please fix the fields below.", { admin_note: "A note is required when rejecting a report" });
    }
    body.admin_note = note;
  }

  if (Object.keys(body).length === 0) {
    return failure("Nothing to save: change the status, category or note first.");
  }

  try {
    await adminRequest<{ report: AdminReportDetail }>(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
      method: "PATCH",
      body,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error; // includes the redirect to /login when the session ended
    }
    if (error.status === 409) {
      // Someone else changed the report first: reload the page data so the form shows the current state.
      revalidateReportPages(reportId);
      return failure(
        `${error.message}. Someone else has changed this report in the meantime; the page now shows the latest data.`
      );
    }
    if (error.status === 404) {
      return failure("This report no longer exists.");
    }
    const fieldErrors: ReportUpdateState["fieldErrors"] = {};
    for (const detail of error.details) {
      if (detail.field === "status" || detail.field === "category" || detail.field === "admin_note") {
        fieldErrors[detail.field] ??= detail.message;
      }
    }
    const generalDetail = error.details.find((detail) => detail.field === "")?.message;
    return failure(generalDetail ?? (Object.keys(fieldErrors).length > 0 ? "Please fix the fields below." : error.message), fieldErrors);
  }

  revalidateReportPages(reportId);
  return {
    result: "success",
    message: body.status ? `Report updated: status is now ${STATUS_LABELS[body.status]}.` : "Report updated.",
    fieldErrors: {},
  };
}
