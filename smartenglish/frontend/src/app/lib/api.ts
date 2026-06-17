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

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_KEY);
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
  if (!response.ok) throw new Error(await response.text());
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
  if (!response.ok) throw new Error(await response.text());
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
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function backendPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function backendGet<T>(path: string): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : undefined,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export function emptyWhenMissingConfig<T>(fallback: T) {
  return !supabaseUrl || !supabaseAnonKey ? fallback : null;
}

export function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
