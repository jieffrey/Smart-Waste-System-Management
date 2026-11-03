import { apiRequest } from '@/lib/api';
import type { Report, ReportDetail, ReportListResponse, ReportStatus } from '@/types/api';

export interface NewReport {
  photoUri: string; // a JPEG file on the device (see lib/prepare-image.ts)
  description: string;
  latitude: number;
  longitude: number;
  address?: string;
}

// The backend sets the category from the AI prediction. Responds 503 when the ML service is unavailable.
export function createReport({ photoUri, description, latitude, longitude, address }: NewReport) {
  const formData = new FormData();
  // React Native uploads a local file from { uri, name, type }.
  formData.append('image', { uri: photoUri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  formData.append('description', description);
  formData.append('latitude', String(latitude));
  formData.append('longitude', String(longitude));
  if (address) {
    formData.append('address', address);
  }
  return apiRequest<{ report: Report }>('/api/reports', { method: 'POST', formData });
}

export function listMyReports({ page, limit, status }: { page: number; limit: number; status?: ReportStatus }) {
  return apiRequest<ReportListResponse>('/api/reports/me', { query: { page, limit, status } });
}

export function getReport(id: string) {
  return apiRequest<{ report: ReportDetail }>(`/api/reports/${encodeURIComponent(id)}`);
}
