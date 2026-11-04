// Labels (Indonesian, from src/constants/strings.ts) and date/number formatting for the app.
export { CATEGORY_LABELS, STATUS_LABELS } from '@/constants/strings';

// e.g. "3 Nov 2026"
export function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// e.g. "3 Nov 2026 14.05"
export function formatDateTime(isoDate: string) {
  return new Date(isoDate).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 0.9981 -> "99,8%"
export function formatConfidence(confidence: number | null) {
  return confidence === null ? '—' : `${(confidence * 100).toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}
