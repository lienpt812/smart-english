import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Bot, CalendarDays, CheckCircle2, Circle, Loader2, Map, PlayCircle, Sparkles, Target, Zap } from "lucide-react";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage, supabaseInsert, supabasePatch, supabaseSelect } from "../lib/api";

type RoadmapPlan = {
  title?: string;
  target_cert?: string;
  starting_level?: string;
  target_weeks?: number;
  weak_skills?: string[];
  strategy?: string;
  weeks?: Array<{
    week: number;
    title: string;
    focus_skill: string;
    goal: string;
    tasks: Array<{ type?: string; label: string; minutes?: number; status?: "not_started" | "in_progress" | "completed" }>;
    milestone?: string;
  }>;
  success_metrics?: string[];
};

type RoadmapResponse = {
  data?: RoadmapPlan;
};

function normalizePlan(plan: RoadmapPlan | null): RoadmapPlan | null {
  if (!plan) return null;
  return {
    ...plan,
    weeks: (plan.weeks || []).map(week => ({
      ...week,
      tasks: (week.tasks || []).map(task => ({ ...task, status: task.status || "not_started" })),
    })),
  };
}

export function RoadmapPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<any | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [plan, setPlan] = useState<RoadmapPlan | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [gamification, setGamification] = useState<any | null>(null);
  const [targetWeeks, setTargetWeeks] = useState(4);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [profileRows, planRows, sessionRows, errorRows, scoreRows, gamificationRows] = await Promise.all([
          supabaseSelect<any>("profiles", { select: "display_name,email,level,target_cert", limit: 1 }),
          supabaseSelect<any>("learning_plans", { select: "*", status: "eq.active", order: "generated_at.desc", limit: 1 }),
          supabaseSelect<any>("sessions", { select: "kind,title,started_at,ended_at,payload", order: "started_at.desc", limit: 40 }),
          supabaseSelect<any>("learning_errors", { select: "skill,error_type,message,occurrences,last_seen_at", order: "occurrences.desc", limit: 15 }),
          supabaseSelect<any>("scores", { select: "total,max_total,graded_at,breakdown", order: "graded_at.desc", limit: 20 }),
          supabaseSelect<any>("user_gamification", { select: "total_xp,level,current_streak,longest_streak", user_id: `eq.${getCurrentUserId()}`, limit: 1 }),
        ]);
        if (!mounted) return;
        setProfile(profileRows[0] || null);
        setPlans(planRows);
        setPlan(normalizePlan(planRows[0]?.plan || null));
        setActivity(sessionRows);
        setErrors(errorRows);
        setScores(scoreRows);
        setGamification(gamificationRows[0] || null);
      } catch (err) {
        if (mounted) setError(getFriendlyErrorMessage(err, "Could not load roadmap data. Please try again."));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const skillScores = useMemo(() => {
    const latest = scores[0];
    const percent = latest ? Math.round((Number(latest.total) / Number(latest.max_total || 100)) * 100) : 0;
    return {
      listening: percent,
      speaking: percent,
      reading: percent,
      writing: percent,
    };
  }, [scores]);

  const generateRoadmap = async () => {
    setGenerating(true);
    setError("");
    try {
      const response = await backendPost<RoadmapResponse>("/api/roadmap/generate", {
        user_id: getCurrentUserId(),
        profile,
        skill_scores: skillScores,
        recent_activity: activity,
        learning_errors: errors,
        target_weeks: targetWeeks,
        target_cert: profile?.target_cert,
        use_ai_generation: true,
      });
      const nextPlan = normalizePlan(response.data || null);
      setPlan(nextPlan);
      if (nextPlan) {
        await supabaseInsert("learning_plans", {
          user_id: getCurrentUserId(),
          title: nextPlan.title || "Personal learning roadmap",
          target_cert: profile?.target_cert || null,
          starting_level: profile?.level || null,
          target_weeks: nextPlan.target_weeks || targetWeeks,
          plan: nextPlan,
          progress: {
            generated_from: {
              activity_count: activity.length,
              error_count: errors.length,
              score_count: scores.length,
              xp: gamification?.total_xp || 0,
            },
          },
          status: "active",
          version: (plans[0]?.version || 0) + 1,
          generated_by: "ai",
        });
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not generate your roadmap right now. Please try again."));
    } finally {
      setGenerating(false);
    }
  };

  const taskStatusIcon = (status?: string) => {
    if (status === "completed") return <CheckCircle2 size={15} style={{ color: "#2D6A4F" }} />;
    if (status === "in_progress") return <PlayCircle size={15} style={{ color: "#52B788" }} />;
    return <Circle size={15} className="text-muted-foreground" />;
  };

  const nextTaskStatus = (status?: string) => {
    if (status === "not_started" || !status) return "in_progress";
    if (status === "in_progress") return "completed";
    return "not_started";
  };

  const updateTaskStatus = async (weekIndex: number, taskIndex: number) => {
    if (!plan) return;
    const nextPlan: RoadmapPlan = {
      ...plan,
      weeks: (plan.weeks || []).map((week, wi) => ({
        ...week,
        tasks: (week.tasks || []).map((task, ti) =>
          wi === weekIndex && ti === taskIndex
            ? { ...task, status: nextTaskStatus(task.status) }
            : { ...task, status: task.status || "not_started" },
        ),
      })),
    };
    setPlan(nextPlan);
    const activePlanId = plans[0]?.id;
    if (activePlanId) {
      await supabasePatch("learning_plans", { id: `eq.${activePlanId}`, user_id: `eq.${getCurrentUserId()}` }, { plan: nextPlan }).catch(() => {});
    }
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>AI Roadmap</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>
            Personalized weekly plan based on your profile, scores, errors, XP, and study activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={targetWeeks}
            onChange={event => setTargetWeeks(Number(event.target.value))}
            className="rounded-xl border border-border bg-white px-3 py-2"
            style={{ fontSize: "0.8125rem" }}
          >
            {[4, 6, 8, 12].map(weeks => <option key={weeks} value={weeks}>{weeks} weeks</option>)}
          </select>
          <button
            onClick={generateRoadmap}
            disabled={generating || loading}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-70"
            style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Generate
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-white rounded-xl border border-border p-3 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Target, label: "Goal", value: profile?.target_cert || "General", sub: profile?.level || "Level not set" },
          { icon: CalendarDays, label: "Activity", value: activity.length, sub: "recent sessions" },
          { icon: Zap, label: "XP", value: gamification?.total_xp || 0, sub: `level ${gamification?.level || 1}` },
          { icon: Bot, label: "Signals", value: errors.length, sub: "learning errors" },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-2xl border border-border p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "#D8F3DC" }}>
              <item.icon size={17} style={{ color: "#2D6A4F" }} />
            </div>
            <div className="text-foreground" style={{ fontSize: "1.25rem", fontWeight: 800 }}>{item.value}</div>
            <div className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{item.sub}</div>
            <div className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem" }}>{item.label}</div>
          </div>
        ))}
      </div>

      {!plan ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <Map size={30} className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-foreground font-semibold mb-2" style={{ fontSize: "1rem" }}>No active roadmap yet</h2>
          <p className="text-muted-foreground mx-auto max-w-xl" style={{ fontSize: "0.875rem", lineHeight: 1.7 }}>
            Generate a plan after you have a few sessions, scores, or saved errors. The local fallback still creates a useful starter plan if AI is busy.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[0.75fr_1.25fr] gap-6">
          <aside className="bg-white rounded-2xl border border-border p-5 h-fit">
            <div className="w-11 h-11 rounded-xl mb-4 flex items-center justify-center" style={{ background: "#D8F3DC" }}>
              <Map size={21} style={{ color: "#2D6A4F" }} />
            </div>
            <h2 className="text-foreground font-semibold" style={{ fontSize: "1.05rem" }}>{plan.title}</h2>
            <p className="text-muted-foreground mt-2" style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}>
              {plan.strategy}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(plan.weak_skills || []).map(skill => (
                <span key={skill} className="rounded-full bg-muted px-3 py-1 text-primary" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                  {skill}
                </span>
              ))}
            </div>
            <button
              onClick={() => navigate("/analytics")}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-muted-foreground hover:text-foreground"
              style={{ fontSize: "0.8125rem" }}
            >
              View analytics <ArrowRight size={14} />
            </button>
          </aside>

          <main className="space-y-4">
            {(plan.weeks || []).map((week, index) => (
              <section key={week.week || index} className="bg-white rounded-2xl border border-border p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#D8F3DC", color: "#2D6A4F", fontWeight: 800 }}>
                    {week.week || index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>{week.title}</h3>
                      <span className="capitalize text-primary" style={{ fontSize: "0.75rem", fontWeight: 700 }}>{week.focus_skill}</span>
                    </div>
                    <p className="text-muted-foreground mt-2" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>{week.goal}</p>
                    <div className="mt-4 space-y-2">
                      {(week.tasks || []).map((task, taskIndex) => (
                        <button
                          key={`${week.week}-${taskIndex}`}
                          type="button"
                          onClick={() => updateTaskStatus(index, taskIndex)}
                          className="w-full text-left rounded-xl bg-muted px-3 py-2 flex items-center justify-between gap-3 hover:bg-secondary/70 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {taskStatusIcon(task.status)}
                            <span className="text-foreground" style={{ fontSize: "0.8125rem" }}>{task.label}</span>
                          </div>
                          {task.minutes && <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: "0.75rem" }}>{task.minutes}m</span>}
                        </button>
                      ))}
                    </div>
                    {week.milestone && (
                      <p className="mt-3 text-primary" style={{ fontSize: "0.8125rem", fontWeight: 700 }}>
                        Milestone: {week.milestone}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </main>
        </div>
      )}
    </div>
  );
}
