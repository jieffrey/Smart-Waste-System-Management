import { API_URL } from "./env";

// The backend returns image_url either absolute ("https://...") or relative to the API ("/uploads/x.jpg").
export function buildImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  return `${API_URL}/${imageUrl.replace(/^\/+/, "")}`;
}
