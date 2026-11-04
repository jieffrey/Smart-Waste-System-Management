// Shapes returned by the backend API (see backend/README.md).

export type Role = "admin" | "user";
export type ReportStatus = "pending" | "in_progress" | "completed" | "rejected";
export type ReportCategory = "organic" | "paper" | "plastic";

export type User = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminUser = User & { report_count: number };

export type StatusHistoryEntry = {
  old_status: ReportStatus | null;
  new_status: ReportStatus;
  note: string | null;
  created_at: string;
  changed_by: string;
  changed_by_name: string;
};

export type AdminReport = {
  id: string;
  user_id: string;
  description: string;
  category: ReportCategory;
  status: ReportStatus;
  image_url: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  ai_predicted_category: ReportCategory | null;
  ai_confidence: number | null;
  ai_model_version: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  reporter_name: string;
  reporter_email: string;
};

export type AdminReportDetail = AdminReport & { status_history: StatusHistoryEntry[] };

export type Pagination = { page: number; limit: number; total: number };

export type Stats = {
  totals: {
    reports: number;
    by_status: Record<ReportStatus, number>;
    by_category: Record<ReportCategory, number>;
  };
  reports_per_day: { date: string; count: number }[];
  ai_accuracy: { reviewed: number; matching: number; accuracy: number | null };
};

export type LoginResponse = { user: User; token: string };

// Every backend error looks like this.
export type ApiErrorDetail = { field: string; message: string };
export type ApiErrorBody = { error: { message: string; details: ApiErrorDetail[] | null } };
