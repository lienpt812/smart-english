"use client";

import { useEffect } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LogoutPage() {
  useEffect(() => {
    async function leave() {
      try {
        const sb = createBrowserSupabaseClient();
        await sb.auth.signOut();
      } catch {
        /* thiếu env — vẫn quay Home */
      } finally {
        window.location.replace("/");
      }
    }
    void leave();
  }, []);

  return <main>Đang đăng xuất…</main>;
}
