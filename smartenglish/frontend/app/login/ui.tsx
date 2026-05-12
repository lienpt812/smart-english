"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginClient() {
  const qp = useSearchParams();
  const err = qp.get("error");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loginGoogle() {
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: { prompt: "consent select_account" },
        },
      });
    } catch {
      setMessage(
        "Kiểm tra NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — xem docs/MODULE_M1_M2_SUPABASE.md."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Đăng nhập</h1>
      <p>Google OAuth qua Supabase Auth (module M1).</p>
      {(err === "oauth" || err === "no_code") && (
        <p>
          OAuth lỗi ({err}). Xác minh Redirect URL & Google Provider trong Dashboard
          Supabase.
        </p>
      )}
      {message && <p>{message}</p>}
      <button disabled={loading} type="button" onClick={() => void loginGoogle()}>
        {loading ? "Đang mở Google…" : "Tiếp tục với Google"}
      </button>
    </>
  );
}
