import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  email: string | null;
  avatar_url: string | null;
  display_name: string | null;
  level: string | null;
  target_cert: string | null;
  onboarding_completed: boolean;
};

type SessionRow = {
  started_at: string;
  ended_at: string | null;
};

type SubmissionRow = {
  id: string;
  submitted_at: string;
  exercises: { skill: SkillName } | { skill: SkillName }[] | null;
  scores: ScoreRow | ScoreRow[] | null;
};

type ScoreRow = {
  total: number | string | null;
  max_total: number | string | null;
};

type SkillName = "listening" | "speaking" | "reading" | "writing";

const skillLabels: Record<SkillName, string> = {
  listening: "Listening",
  speaking: "Speaking",
  reading: "Reading",
  writing: "Writing",
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function scorePercent(score: ScoreRow | null): number | null {
  if (!score || score.total == null || score.max_total == null) return null;
  const total = Number(score.total);
  const max = Number(score.max_total);
  if (!Number.isFinite(total) || !Number.isFinite(max) || max <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((total / max) * 100)));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function minutesBetween(start: string, end: string | null): number {
  if (!end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60000);
}

function buildHeatmap(sessions: SessionRow[]) {
  const today = new Date();
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (27 - index));
    return { date, key: dayKey(date), minutes: 0 };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));

  for (const session of sessions) {
    const key = dayKey(new Date(session.started_at));
    const bucket = byDay.get(key);
    if (bucket) bucket.minutes += minutesBetween(session.started_at, session.ended_at);
  }

  return days;
}

function currentStreak(heatmap: ReturnType<typeof buildHeatmap>): number {
  let streak = 0;
  for (let index = heatmap.length - 1; index >= 0; index -= 1) {
    if (heatmap[index].minutes <= 0) break;
    streak += 1;
  }
  return streak;
}

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
    .maybeSingle<Profile>();

  if (!profile || !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const now = new Date();
  const since28 = new Date(now);
  since28.setDate(now.getDate() - 27);
  const since7 = new Date(now);
  since7.setDate(now.getDate() - 6);

  const [
    exercisesResult,
    dueCardsResult,
    newCardsResult,
    sessionsResult,
    submissionsResult,
  ] = await Promise.all([
    supabase
      .from("exercises")
      .select("*", { count: "exact", head: true })
      .eq("published", true),
    supabase
      .from("cards")
      .select("id, decks!inner(owner_id)", { count: "exact", head: true })
      .eq("decks.owner_id", user.id)
      .eq("suspended", false)
      .lte("next_review_at", now.toISOString()),
    supabase
      .from("cards")
      .select("id, decks!inner(owner_id)", { count: "exact", head: true })
      .eq("decks.owner_id", user.id)
      .eq("repetitions", 0)
      .eq("suspended", false),
    supabase
      .from("sessions")
      .select("started_at, ended_at")
      .eq("user_id", user.id)
      .gte("started_at", since28.toISOString())
      .order("started_at", { ascending: true }),
    supabase
      .from("submissions")
      .select("id, submitted_at, exercises(skill), scores(total, max_total)")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(20),
  ]);

  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const heatmap = buildHeatmap(sessions);
  const studyMinutes7 = sessions
    .filter((session) => new Date(session.started_at) >= since7)
    .reduce((total, session) => total + minutesBetween(session.started_at, session.ended_at), 0);

  const skillScores = submissions.reduce<Record<SkillName, number[]>>(
    (acc, submission) => {
      const exercise = first(submission.exercises);
      const percent = scorePercent(first(submission.scores));
      if (exercise?.skill && percent != null) acc[exercise.skill].push(percent);
      return acc;
    },
    { listening: [], speaking: [], reading: [], writing: [] },
  );

  const skillAverage = Object.fromEntries(
    (Object.keys(skillScores) as SkillName[]).map((skill) => {
      const values = skillScores[skill];
      const average =
        values.length === 0
          ? null
          : Math.round(values.reduce((total, value) => total + value, 0) / values.length);
      return [skill, average];
    }),
  ) as Record<SkillName, number | null>;

  const recentAttempts = submissions.slice(0, 5);
  const totalCompletedSessions = sessions.filter((session) => session.ended_at).length;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">M4 Dashboard</p>
          <h1>Bang dieu khien hoc tap</h1>
          <p className="muted">
            Xin chao {profile.display_name ?? user.email ?? "learner"} - muc tieu{" "}
            {profile.target_cert ?? "chua chon"}, level {profile.level ?? "chua chon"}.
          </p>
        </div>
        <nav className="dashboard-nav">
          <Link href="/">Home</Link>
          <Link href="/flashcards">Flashcards</Link>
          <Link href="/tutor">Tutor</Link>
          <Link href="/logout">Dang xuat</Link>
        </nav>
      </header>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Flashcards due</span>
          <strong>{dueCardsResult.count ?? 0}</strong>
          <small>{newCardsResult.count ?? 0} cards moi</small>
        </article>
        <article className="metric-card">
          <span>Study time 7 ngay</span>
          <strong>{studyMinutes7}</strong>
          <small>phut da log</small>
        </article>
        <article className="metric-card">
          <span>Streak hien tai</span>
          <strong>{currentStreak(heatmap)}</strong>
          <small>ngay lien tiep</small>
        </article>
        <article className="metric-card">
          <span>Exercise library</span>
          <strong>{exercisesResult.count ?? 0}</strong>
          <small>bai published</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Radar 4 ky nang</h2>
            <span>{recentAttempts.length} attempts gan nhat</span>
          </div>
          <div className="skill-list">
            {(Object.keys(skillLabels) as SkillName[]).map((skill) => {
              const value = skillAverage[skill] ?? 0;
              return (
                <div className="skill-row" key={skill}>
                  <div>
                    <strong>{skillLabels[skill]}</strong>
                    <span>{skillAverage[skill] == null ? "Chua co diem" : `${value}/100`}</span>
                  </div>
                  <div className="skill-track" aria-hidden="true">
                    <span style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Heatmap hoc tap</h2>
            <span>28 ngay</span>
          </div>
          <div className="heatmap" aria-label="Study heatmap for the last 28 days">
            {heatmap.map((day) => {
              const level = day.minutes >= 60 ? 3 : day.minutes >= 30 ? 2 : day.minutes > 0 ? 1 : 0;
              return (
                <span
                  className={`heat heat-${level}`}
                  key={day.key}
                  title={`${day.key}: ${day.minutes} minutes`}
                />
              );
            })}
          </div>
          <p className="muted compact">
            {totalCompletedSessions} sessions hoan thanh trong 28 ngay gan nhat.
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Ket qua gan day</h2>
          <span>Submissions + scores</span>
        </div>
        {recentAttempts.length === 0 ? (
          <p className="muted compact">Chua co submission nao. Bat dau tu reading demo hoac flashcard review.</p>
        ) : (
          <div className="attempt-list">
            {recentAttempts.map((attempt) => {
              const exercise = first(attempt.exercises);
              const percent = scorePercent(first(attempt.scores));
              return (
                <div className="attempt-row" key={attempt.id}>
                  <span>{exercise?.skill ? skillLabels[exercise.skill] : "Practice"}</span>
                  <strong>{percent == null ? "Pending" : `${percent}/100`}</strong>
                  <time>{new Date(attempt.submitted_at).toLocaleDateString("vi-VN")}</time>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
