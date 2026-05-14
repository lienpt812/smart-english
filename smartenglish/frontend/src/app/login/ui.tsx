"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { getPublicAppUrl } from "@/lib/app-url";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const errorMessages: Record<string, string> = {
  no_code: "OAuth callback khong co code. Kiem tra Redirect URL trong Supabase.",
  oauth: "OAuth loi khi doi code lay session. Xem log frontend de biet chi tiet.",
  pkce: "OAuth thieu PKCE code verifier. Mo lai tu http://localhost:3000/login roi thu dang nhap lai.",
  provider: "Google/Supabase provider tu choi OAuth. Kiem tra Google Provider va Redirect URL trong Supabase.",
  session: "OAuth da doi code nhung khong lay duoc user session.",
};

export default function LoginClient() {
  const qp = useSearchParams();
  const err = qp?.get("error") ?? null;

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loginGoogle() {
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const origin = getPublicAppUrl();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: { prompt: "consent select_account" },
        },
      });
    } catch {
      setMessage(
        "Kiem tra NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Dang nhap</h1>
      <p>Google OAuth qua Supabase Auth (module M1).</p>
      {err && <p>{errorMessages[err] ?? `OAuth loi (${err}).`}</p>}
      {message && <p>{message}</p>}
      <button disabled={loading} type="button" onClick={() => void loginGoogle()}>
        {loading ? "Dang mo Google..." : "Tiep tuc voi Google"}
      </button>
    </>
  );
}
