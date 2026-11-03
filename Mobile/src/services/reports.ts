import { File } from 'expo-file-system';

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
  // Since SDK 58 the global fetch is expo/fetch, which cannot upload React Native's { uri, name, type }
  // objects (it throws "Unsupported FormDataPart implementation"). It needs a real file object whose
  // bytes it can read: an expo-file-system File (its name and MIME type come from the file itself).
  formData.append('image', new File(photoUri));
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
