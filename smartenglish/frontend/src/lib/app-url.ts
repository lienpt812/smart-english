export function getPublicAppUrl(requestUrl?: string | URL) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;

  if (requestUrl) {
    const url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
    if (url.hostname === "0.0.0.0") {
      url.hostname = "localhost";
    }
    return url.origin;
  }

  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.hostname === "0.0.0.0") {
      url.hostname = "localhost";
    }
    return url.origin;
  }

  return "http://localhost:3000";
}
