import "server-only";
import { API_URL } from "./env";
import type { ApiErrorBody, ApiErrorDetail } from "@/types/api";

// One error shape for every failed request. status is 0 when the server could not be reached.
export class ApiError extends Error {
  status: number;
  details: ApiErrorDetail[];

  constructor(status: number, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  token?: string;
  query?: Record<string, string | number | boolean | undefined>;
};

function buildUrl(path: string, query: RequestOptions["query"]) {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function isErrorBody(data: unknown): data is ApiErrorBody {
  return typeof (data as ApiErrorBody | null)?.error?.message === "string";
}

// Calls the backend from the server. Admin data is never cached (cache: "no-store").
export async function apiRequest<T>(path: string, { method = "GET", body, token, query }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check that the backend is running.");
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isErrorBody(data)) {
      throw new ApiError(response.status, data.error.message, data.error.details ?? []);
    }
    throw new ApiError(response.status, `Request failed (${response.status})`);
  }

  return data as T;
}
