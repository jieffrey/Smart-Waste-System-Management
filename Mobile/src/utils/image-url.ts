import { API_URL } from '@/constants/api';

// The backend returns a relative image_url (e.g. /uploads/<uuid>.jpg). An absolute URL (e.g. from
// cloud storage later) is used as is; a relative one gets the API base URL in front.
export function resolveImageUrl(imageUrl: string) {
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  return `${API_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}
