type QueryValue = string | number | boolean | null | undefined;

export type ApiState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

export const backendUrl =
  import.meta.env.VITE_BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "") ||
  import.meta.env.VITE_NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ||
  "";

export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const TOKEN_KEY = "smartenglish.supabase.access_token";
const REFRESH_KEY = "smartenglish.supabase.refresh_token";
const EXPIRES_KEY = "smartenglish.supabase.expires_at";
const EXPIRY_SKEW_MS = 30_000;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function readNestedMessage(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return "";
  const object = value as Record<string, unknown>;
  return (
    readNestedMessage(object.message) ||
    readNestedMessage(object.error_description) ||
    readNestedMessage(object.error) ||
    readNestedMessage(object.detail) ||
    readNestedMessage(object.raw)
  );
}

function readNestedCode(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const object = value as Record<string, unknown>;
  const code = object.code || object.error_code;
  if (typeof code === "string") return code;
  return readNestedCode(object.detail) || readNestedCode(object.upstream);
}

function friendlyHttpMessage(status: number, rawBody: unknown, fallback: string) {
  const code = readNestedCode(rawBody);
  const rawMessage = readNestedMessage(rawBody);
  const combined = `${code} ${rawMessage}`.toLowerCase();

  if (status === 401 || status === 403) {
    return "Phiên đăng nhập của bạn không còn hợp lệ. Vui lòng đăng nhập lại.";
  }
  if (status === 404) {
    return "Không tìm thấy dữ liệu cần tải. Vui lòng thử lại sau.";
  }
  if (
    status === 429 ||
    combined.includes("rate") ||
    combined.includes("quota") ||
    combined.includes("resource_exhausted") ||
    combined.includes("too many")
  ) {
    return "AI đang bị giới hạn lượt gọi tạm thời. Vui lòng đợi một chút rồi thử lại.";
  }
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    combined.includes("ai_service_unavailable") ||
    combined.includes("upstream") ||
    combined.includes("timeout")
  ) {
    return "Dịch vụ AI đang bận hoặc tạm thời không phản hồi. Vui lòng thử lại sau.";
  }
  if (status >= 500) {
    return "Hệ thống đang gặp lỗi tạm thời. Vui lòng thử lại sau.";
  }
  if (status >= 400) {
    return rawMessage && !rawMessage.trim().startsWith("{") ? rawMessage : fallback;
  }
  return fallback;
}

async function throwFriendlyResponseError(response: Response, fallback: string): Promise<never> {
  const contentType = response.headers.get("content-type") || "";
  let body: unknown = "";
  try {
    body = contentType.includes("application/json") ? await response.json() : await response.text();
  } catch {
    body = "";
  }
  const code = readNestedCode(body) || undefined;
  if (response.status === 401 || response.status === 403) {
    clearStoredAuth();
  }
  throw new ApiError(friendlyHttpMessage(response.status, body, fallback), response.status, code);
}

export function getFriendlyErrorMessage(error: unknown, fallback = "Không thể hoàn tất yêu cầu. Vui lòng thử lại."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "Không thể kết nối tới máy chủ. Vui lòng kiểm tra service đang chạy và thử lại.";
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    if (!message || message.startsWith("{") || message.startsWith("[") || message.includes('"detail"')) {
      return fallback;
    }
    return message;
  }
  return fallback;
}

export function saveAuthFromHash() {
  if (!window.location.hash.includes("access_token=")) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresIn = Number(params.get("expires_in") || "3600");
  if (!accessToken) return false;
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresIn * 1000));
  window.history.replaceState(null, "", window.location.pathname);
  return true;
}

function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function getAccessToken() {
  const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || "0");
  if (expiresAt && expiresAt <= Date.now() + EXPIRY_SKEW_MS) {
    clearStoredAuth();
    return "";
  }
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function clearAuth() {
  clearStoredAuth();
}

export function getCurrentUserId() {
  const token = getAccessToken();
  if (!token) return "anonymous";
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload.sub || "anonymous";
  } catch {
    return "anonymous";
  }
}

export function signInWithGoogle() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }
  const redirectTo = `${window.location.origin}/auth`;
  const url = new URL(`${supabaseUrl}/auth/v1/authorize`);
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", redirectTo);
  url.searchParams.set("prompt", "select_account consent");
  window.location.href = url.toString();
}

function headers(json = true): HeadersInit {
  const token = getAccessToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
    Authorization: `Bearer ${token || supabaseAnonKey}`,
  };
}

function queryString(query: Record<string, QueryValue> = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const built = params.toString();
  return built ? `?${built}` : "";
}

export async function supabaseSelect<T>(
  table: string,
  query: Record<string, QueryValue> = {},
): Promise<T[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Vite Supabase env values.");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${queryString(query)}`, {
    headers: headers(false),
  });
  if (!response.ok) await throwFriendlyResponseError(response, "Không thể tải dữ liệu. Vui lòng thử lại.");
  return response.json();
}

export async function supabaseInsert<T>(
  table: string,
  body: Record<string, unknown>,
): Promise<T[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Vite Supabase env values.");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwFriendlyResponseError(response, "Không thể lưu dữ liệu. Vui lòng thử lại.");
  return response.json();
}

export async function supabasePatch<T>(
  table: string,
  query: Record<string, QueryValue>,
  body: Record<string, unknown>,
): Promise<T[]> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${queryString(query)}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwFriendlyResponseError(response, "Không thể cập nhật dữ liệu. Vui lòng thử lại.");
  return response.json();
}

export async function backendPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwFriendlyResponseError(response, "Không thể gọi API. Vui lòng thử lại.");
  return response.json();
}

export async function backendGet<T>(path: string): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : undefined,
  });
  if (!response.ok) await throwFriendlyResponseError(response, "Không thể tải dữ liệu từ API. Vui lòng thử lại.");
  return response.json();
}

export function emptyWhenMissingConfig<T>(fallback: T) {
  return !supabaseUrl || !supabaseAnonKey ? fallback : null;
}

export function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
