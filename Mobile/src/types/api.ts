// Types for the SWMS backend API (see backend/README.md).

export type Role = 'admin' | 'user';
export type ReportStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';
export type WasteCategory = 'organic' | 'paper' | 'plastic';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  user_id: string;
  description: string;
  category: WasteCategory;
  status: ReportStatus;
  image_url: string;
  latitude: number;
  longitude: number;
  address: string | null;
  ai_predicted_category: WasteCategory | null;
  ai_confidence: number | null;
  ai_model_version: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryEntry {
  old_status: ReportStatus | null;
  new_status: ReportStatus;
  note: string | null;
  created_at: string;
}

export interface ReportDetail extends Report {
  status_history: StatusHistoryEntry[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface FieldError {
  field: string;
  message: string;
}

// Every backend error has this shape.
export interface ApiErrorBody {
  error: {
    message: string;
    details: FieldError[] | null;
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ReportListResponse {
  reports: Report[];
  pagination: Pagination;
}
