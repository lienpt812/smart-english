import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const { count: exercisesCount } = await supabase
    .from("exercises")
    .select("*", { count: "exact", head: true })
    .eq("published", true);

  return (
    <main>
      <h1>Dashboard</h1>
      <p>
        Bạn đã đăng nhập Supabase Auth:{" "}
        <strong>{user.email ?? user.id}</strong>
      </p>
      <p>
        <strong>mục tiêu:</strong> {profile.target_cert ?? "—"},{" "}
        <strong>level:</strong> {profile.level ?? "—"},{" "}
        <strong>onboarding_completed:</strong>{" "}
        {String(profile.onboarding_completed)}
      </p>
      <section className="card">
        <h2>profiles (JSON)</h2>
        <pre style={{ overflow: "auto" }}>
          {JSON.stringify(profile, null, 2)}
        </pre>
      </section>
      <p>
        REST demo: có <strong>{exercisesCount ?? 0}</strong> bài exercises published{" "}
        (được PostgREST trả JSON khi Bearer hợp lệ hoặc public select theo policy).
      </p>
      <nav>
        <Link href="/">Home</Link> ·{" "}
        <Link href="/logout">Đăng xuất</Link>
      </nav>
    </main>
  );
}
