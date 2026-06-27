import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getAccessToken, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";
import { APP_USAGE_EVENT, appUsageMinutesForDate, AppUsageDay, loadAppUsage } from "../lib/appUsage";

const HEAT_COLORS = ["#E8F5EE", "#B7E4C7", "#74C69D", "#52B788", "#2D6A4F"];

export function AnalyticsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [appUsage, setAppUsage] = useState<AppUsageDay[]>(() => loadAppUsage());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) return;
    const userId = getCurrentUserId();
    Promise.all([
      supabaseSelect<any>("decks", { select: "id", owner_id: `eq.${userId}`, limit: 1000 }),
      supabaseSelect<any>("scores", { select: "total,max_total,graded_at", user_id: `eq.${userId}`, order: "graded_at.desc", limit: 100 }),
      supabaseSelect<any>("learning_errors", { select: "skill,error_type,occurrences,last_seen_at", user_id: `eq.${userId}`, order: "occurrences.desc", limit: 50 }),
    ]).then(async ([decks, sc, e]) => {
      const deckIds = decks.map((deck: any) => deck.id);
      const c = deckIds.length
        ? await supabaseSelect<any>("cards", { select: "id,repetitions,next_review_at,created_at", deck_id: `in.(${deckIds.join(",")})`, order: "created_at.desc", limit: 500 })
        : [];
      setCards(c);
      setScores(sc);
      setErrors(e);
    }).catch(err => setError(getFriendlyErrorMessage(err, "Không thể tải dữ liệu analytics. Vui lòng thử lại.")));
  }, []);

  useEffect(() => {
    const syncUsage = () => setAppUsage(loadAppUsage());
    window.addEventListener(APP_USAGE_EVENT, syncUsage);
    window.addEventListener("storage", syncUsage);
    return () => {
      window.removeEventListener(APP_USAGE_EVENT, syncUsage);
      window.removeEventListener("storage", syncUsage);
    };
  }, []);

  const totalMinutes = appUsage.reduce((sum, item) => sum + Math.round(Number(item.seconds || 0) / 60), 0);
  const averageScore = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + Number(score.total) / Number(score.max_total || 100) * 100, 0) / scores.length)
    : 0;
  const dueCards = cards.filter(card => new Date(card.next_review_at).getTime() <= Date.now()).length;

  const studyTime = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - offset));
      return {
        day: date.toLocaleDateString([], { weekday: "short" }),
        minutes: appUsageMinutesForDate(date, appUsage),
      };
    });
  }, [appUsage]);

  const skillRadar = ["listening", "speaking", "reading", "writing"].map(skill => {
    const penalty = errors.filter(item => item.skill === skill).reduce((sum, item) => sum + Number(item.occurrences || 0), 0);
    return { skill, score: Math.max(0, averageScore - penalty) };
  });

  const heatData = Array.from({ length: 28 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (27 - i));
    const minutes = appUsageMinutesForDate(date, appUsage);
    return { date, value: Math.min(4, Math.floor(minutes / 15)) };
  });

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Progress Analytics</h1>
        <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Real app study time, progress, and learning signals</p>
      </div>

      {!getAccessToken() && <div className="bg-white rounded-xl border border-border p-4 text-muted-foreground">Sign in to see private analytics.</div>}
      {error && <div className="bg-white rounded-xl border border-border p-4 text-muted-foreground">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Web Study Time", value: `${(totalMinutes / 60).toFixed(1)}h`, sub: "real app usage", color: "#2D6A4F" },
          { label: "Cards", value: cards.length, sub: `${dueCards} due`, color: "#52B788" },
          { label: "Average Score", value: `${averageScore}%`, sub: `${scores.length} graded`, color: "#2D6A4F" },
          { label: "Error Patterns", value: errors.length, sub: "tracked", color: "#52B788" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-border p-4">
            <p className="text-muted-foreground mb-2" style={{ fontSize: "0.75rem" }}>{kpi.label}</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 800, color: kpi.color }}>{kpi.value}</p>
            <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="text-foreground font-semibold mb-4" style={{ fontSize: "0.875rem" }}>Weekly Web Study Time</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={studyTime} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F9F4" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} unit="m" />
              <Tooltip />
              <Bar dataKey="minutes" fill="#2D6A4F" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="text-foreground font-semibold mb-4" style={{ fontSize: "0.875rem" }}>Skill Balance</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={skillRadar}>
              <PolarGrid stroke="#E8F5EE" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "#6B7280" }} />
              <Radar name="Score" dataKey="score" stroke="#2D6A4F" fill="#B7E4C7" fillOpacity={0.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-foreground font-semibold mb-4" style={{ fontSize: "0.875rem" }}>Last 28 Days - Real Web Study Time</h3>
        <div className="grid grid-cols-14 gap-1">
          {heatData.map(item => (
            <div key={item.date.toISOString()} className="w-4 h-4 rounded-sm" title={item.date.toDateString()} style={{ background: HEAT_COLORS[item.value] }} />
          ))}
        </div>
      </div>
    </div>
  );
}
