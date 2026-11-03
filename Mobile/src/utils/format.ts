import type { ReportStatus, WasteCategory } from '@/types/api';

export const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
};

export const CATEGORY_LABELS: Record<WasteCategory, string> = {
  organic: 'Organic',
  paper: 'Paper',
  plastic: 'Plastic',
};

// e.g. "3 Nov 2026"
export function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// e.g. "3 Nov 2026, 14:05"
export function formatDateTime(isoDate: string) {
  return new Date(isoDate).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 0.9981 -> "99.8%"
export function formatConfidence(confidence: number | null) {
  return confidence === null ? '—' : `${(confidence * 100).toFixed(1)}%`;
}
