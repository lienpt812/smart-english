import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Flame, Zap, Clock, Target, TrendingUp, ArrowRight, Bot, Mic, BookOpen, SlidersHorizontal, Map } from "lucide-react";
import { getAccessToken, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";
import { APP_USAGE_EVENT, appUsageMinutesForDate, loadAppUsage } from "../lib/appUsage";

type Profile = {
  email?: string;
  display_name?: string;
  level?: string;
  target_cert?: string;
  onboarding_completed?: boolean;
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [gamification, setGamification] = useState<any | null>(null);
  const [appUsageRows, setAppUsageRows] = useState(() => loadAppUsage());

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const userId = getCurrentUserId();
        const [profileRows, decks, sessionRows, submissionRows, errorRows, gamificationRows] = await Promise.all([
          getAccessToken()
            ? supabaseSelect<Profile>("profiles", { select: "email,display_name,level,target_cert,onboarding_completed", id: `eq.${userId}`, limit: 1 })
            : Promise.resolve([]),
          getAccessToken()
            ? supabaseSelect<any>("decks", { select: "id,name,is_public,created_at", owner_id: `eq.${userId}`, order: "created_at.desc" })
            : Promise.resolve([]),
          getAccessToken()
            ? supabaseSelect<any>("sessions", { select: "id,kind,title,started_at,ended_at,created_at", user_id: `eq.${userId}`, order: "started_at.desc", limit: 30 })
            : Promise.resolve([]),
          getAccessToken()
            ? supabaseSelect<any>("submissions", { select: "id,exercise_id,submitted_at,status", user_id: `eq.${userId}`, order: "submitted_at.desc", limit: 20 })
            : Promise.resolve([]),
          getAccessToken()
            ? supabaseSelect<any>("learning_errors", { select: "skill,error_type,message,occurrences,last_seen_at", user_id: `eq.${userId}`, order: "occurrences.desc", limit: 5 })
            : Promise.resolve([]),
          getAccessToken()
            ? supabaseSelect<any>("user_gamification", { select: "total_xp,level,current_streak,longest_streak,freeze_count", user_id: `eq.${userId}`, limit: 1 })
            : Promise.resolve([]),
        ]);
        const deckIds = decks.map(deck => deck.id);
        const cardRows = deckIds.length
          ? await supabaseSelect<any>("cards", {
              select: "id,deck_id,next_review_at,repetitions,created_at",
              deck_id: `in.(${deckIds.join(",")})`,
              order: "next_review_at.asc",
            })
          : [];
        const submissionIds = submissionRows.map(submission => submission.id);
        const scoreRows = submissionIds.length
          ? await supabaseSelect<any>("scores", {
              select: "submission_id,total,max_total,graded_at",
              submission_id: `in.(${submissionIds.join(",")})`,
              order: "graded_at.desc",
              limit: 20,
            })
          : [];
        if (!mounted) return;
        if (getAccessToken() && profileRows[0] && !profileRows[0].onboarding_completed) {
          navigate("/onboarding");
          return;
        }
        setProfile(profileRows[0] || null);
        setCards(cardRows);
        setSessions(sessionRows);
        setSubmissions(submissionRows);
        setScores(scoreRows);
        setErrors(errorRows);
        setGamification(gamificationRows[0] || null);
      } catch (err) {
        if (mounted) setError(getFriendlyErrorMessage(err, "Không thể tải dữ liệu dashboard. Vui lòng thử lại."));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const refreshUsage = () => setAppUsageRows(loadAppUsage());
    window.addEventListener(APP_USAGE_EVENT, refreshUsage);
    return () => {
      window.removeEventListener(APP_USAGE_EVENT, refreshUsage);
    };
  }, []);

  const dueCards = cards.filter(card => new Date(card.next_review_at).getTime() <= Date.now()).length;
  const newCards = cards.filter(card => Number(card.repetitions || 0) === 0).length;
  const totalMinutes = sessions.reduce((sum, session) => {
    if (!session.ended_at || !session.started_at) return sum;
    return sum + Math.max(0, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000));
  }, 0);

  const weeklyData = useMemo(() => {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return labels.map((day, dayIndex) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + dayIndex);
      return { day, minutes: appUsageMinutesForDate(date, appUsageRows) };
    });
  }, [appUsageRows]);
  const weeklyWebMinutes = weeklyData.reduce((sum, item) => sum + item.minutes, 0);

  const latestScore = scores[0]
    ? Math.round((Number(scores[0].total) / Number(scores[0].max_total || 100)) * 100)
    : 0;
  const name = profile?.display_name || profile?.email || (getAccessToken() ? "Learner" : "Guest");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const todayWebMinutes = appUsageMinutesForDate(new Date(), appUsageRows);

  const quickActions = [
    { path: "/ai-tutor", icon: Bot, label: "AI Tutor", desc: "Ask Gemini-powered tutor", color: "#2D6A4F", bg: "#D8F3DC" },
    { path: "/speaking", icon: Mic, label: "Speaking", desc: "Record & score", color: "#52B788", bg: "#F0FAF4" },
    { path: "/flashcards", icon: BookOpen, label: "Flashcards", desc: `${dueCards} due today`, color: "#2D6A4F", bg: "#D8F3DC" },
    { path: "/roadmap", icon: Map, label: "Roadmap", desc: "AI weekly plan", color: "#52B788", bg: "#F0FAF4" },
  ];

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            {greeting}, {name}
          </h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>
            {loading ? "Loading live learning data..." : error ? "Some data could not be loaded." : `${profile?.target_cert || "English"} · ${profile?.level || "level not set"}`}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {getAccessToken() && (
            <button onClick={() => navigate("/onboarding")} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white">
              <SlidersHorizontal size={16} style={{ color: "#2D6A4F" }} />
              <span style={{ fontSize: "0.8125rem" }}>Goal & level test</span>
            </button>
          )}
          <button onClick={() => navigate("/auth")} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white">
            <Flame size={16} style={{ color: "#FF6B35" }} />
            <span style={{ fontSize: "0.8125rem" }}>{getAccessToken() ? "Signed in" : "Sign in"}</span>
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="bg-white rounded-xl p-4 border border-border text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      {getAccessToken() && (
        <button onClick={() => navigate("/onboarding")} className="sm:hidden w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-foreground">
          <SlidersHorizontal size={16} style={{ color: "#2D6A4F" }} />
          <span style={{ fontSize: "0.875rem", fontWeight: 650 }}>Change goal or test level</span>
        </button>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Target, label: "Latest Score", value: `${latestScore}%`, sub: `${scores.length} graded items`, color: "#2D6A4F", bg: "#D8F3DC" },
          { icon: Zap, label: "Due Cards", value: dueCards, sub: `${newCards} new cards`, color: "#52B788", bg: "#F0FAF4" },
          { icon: Flame, label: "Level", value: gamification?.level || 1, sub: `${gamification?.total_xp || 0} XP`, color: "#FF6B35", bg: "#FFF3EC" },
          { icon: Clock, label: "Web Time Today", value: `${todayWebMinutes}m`, sub: `${(totalMinutes / 60).toFixed(1)}h tracked study`, color: "#2D6A4F", bg: "#D8F3DC" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-white rounded-2xl p-4 border border-border">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: card.bg }}>
              <card.icon size={17} style={{ color: card.color }} />
            </div>
            <div className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{card.value}</div>
            <div className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{card.sub}</div>
            <div className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem" }}>{card.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>Weekly Activity</h3>
              <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>Real web time while using SmartEnglish</p>
            </div>
            <div className="flex items-center gap-1.5 text-primary">
              <TrendingUp size={15} />
              <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{weeklyWebMinutes} min</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F9F4" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: "white", border: "1px solid #E8F5EE", borderRadius: "10px", fontSize: "12px" }} />
              <Bar dataKey="minutes" fill="#2D6A4F" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-border">
          <h3 className="text-foreground font-semibold mb-4" style={{ fontSize: "0.9375rem" }}>Top Errors</h3>
          {errors.length === 0 ? (
            <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>No saved learning errors yet.</p>
          ) : (
            <div className="space-y-3">
              {errors.map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-muted">
                  <div className="flex justify-between gap-2">
                    <span className="text-foreground" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{item.error_type}</span>
                    <span className="text-primary" style={{ fontSize: "0.75rem" }}>{item.occurrences}x</span>
                  </div>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem" }}>{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-foreground font-semibold mb-3" style={{ fontSize: "0.9375rem" }}>Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map(action => (
            <button key={action.path} onClick={() => navigate(action.path)} className="bg-white rounded-xl p-4 border border-border text-left transition-all flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: action.bg }}>
                <action.icon size={17} style={{ color: action.color }} />
              </div>
              <div>
                <p className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>{action.label}</p>
                <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{action.desc}</p>
              </div>
              <ArrowRight size={14} style={{ color: action.color }} />
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-border">
        <h3 className="text-foreground font-semibold mb-4" style={{ fontSize: "0.9375rem" }}>Recent Submissions</h3>
        {submissions.length === 0 ? (
          <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>No real submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {submissions.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-foreground font-medium" style={{ fontSize: "0.875rem" }}>{item.status}</p>
                  <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{new Date(item.submitted_at).toLocaleString()}</p>
                </div>
                <span className="text-primary" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  {scores.find(score => score.submission_id === item.id)?.total ?? "pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
