"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const CERTS = [
  { v: "TOEIC", label: "TOEIC" },
  { v: "IELTS", label: "IELTS" },
  { v: "COMMUNICATION", label: "Tiếng Anh giao tiếp" },
] as const;

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [target, setTarget] = useState<(typeof CERTS)[number]["v"]>("TOEIC");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("B1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const sb = createBrowserSupabaseClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }
        const { data: profile, error } = await sb
          .from("profiles")
          .select("onboarding_completed,target_cert,level")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          setError(error.message);
          return;
        }
        if (profile?.onboarding_completed) {
          router.replace("/dashboard");
          return;
        }
        if (profile?.target_cert) setTarget(profile.target_cert as typeof target);
        if (profile?.level) setLevel(profile.level as typeof level);
      } catch {
        setError("Supabase env chưa được cấu hình trong build FE.");
      } finally {
        setLoading(false);
      }
    }
    void bootstrap();
  }, [router]);

  async function complete() {
    setSaving(true);
    setError(null);
    try {
      const sb = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { error } = await sb
        .from("profiles")
        .update({
          target_cert: target,
          level,
          onboarding_completed: true,
        })
        .eq("id", user.id);
      if (error) throw error;
      router.replace("/dashboard");
    } catch {
      setError("Không lưu onboarding — kiểm tra migrations + RLS + enum Postgres.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main>Đang kiểm tra profile…</main>;

  return (
    <main>
      <h1>Hoàn thiện hồ sơ</h1>
      <p>
        Chọn mục tiêu & trình độ tự đánh giá — lưu vào Supabase profiles (REST +
        RLS).
      </p>
      {error && <p>Vấn đề: {error}</p>}
      <label>
        Chứng chỉ / định hướng{" "}
        <select
          style={{ marginLeft: 8 }}
          value={target}
          onChange={(e) =>
            setTarget(e.target.value as (typeof CERTS)[number]["v"])
          }
        >
          {CERTS.map((c) => (
            <option key={c.v} value={c.v}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <div style={{ marginTop: "0.75rem" }}>
        <label>
          Trình độ (CEFR){" "}
          <select
            style={{ marginLeft: 8 }}
            value={level}
            onChange={(e) =>
              setLevel(e.target.value as (typeof LEVELS)[number])
            }
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <button type="button" disabled={saving} onClick={() => void complete()}>
          {saving ? "Đang lưu…" : "Tiếp tục vào học"}
        </button>
      </div>
      <nav style={{ marginTop: "1rem" }}>
        <Link href="/">← Home</Link>
      </nav>
    </main>
  );
}
