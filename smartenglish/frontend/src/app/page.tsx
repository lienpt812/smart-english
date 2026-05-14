import Link from "next/link";

type Health = {
  ok: boolean;
  services: { postgres: boolean; redis: boolean };
};

async function fetchHealth(): Promise<Health | null> {
  const base =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://localhost:4000";
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export default async function Page() {
  const health = await fetchHealth();

  return (
    <main>
      <h1>Smart English — Frontend</h1>
      <p>
        Next.js kết nối <strong>Supabase</strong> cho M1 (Auth + profiles) &amp; M2
        (REST + RLS). API Node tách riêng (tùy chọn / legacy).
      </p>
      <section className="card">
        <p>
          <Link href="/login">Đăng nhập Google (Supabase)</Link> ·{" "}
          <Link href="/onboarding">Onboarding</Link> ·{" "}
          <Link href="/dashboard">Dashboard</Link>
        </p>
      </section>
      <section className="card">
        <p>
          <strong>Backend health</strong>{" "}
          <code>({process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"})</code>
        </p>
        {health == null ? (
          <p>Không gọi được API — chạy backend và chỉnh NEXT_PUBLIC_API_URL.</p>
        ) : (
          <ul style={{ paddingLeft: "1.1rem", marginBottom: 0 }}>
            <li>tổng thể ok: {String(health.ok)}</li>
            <li>PostgreSQL: {String(health.services.postgres)}</li>
            <li>Redis (SRS/cache): {String(health.services.redis)}</li>
          </ul>
        )}
      </section>
    </main>
  );
}
