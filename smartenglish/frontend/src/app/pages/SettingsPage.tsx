import { useEffect, useState } from "react";
import { Bell, Globe, Moon, Shield, ChevronRight, Zap } from "lucide-react";
import { clearAuth, getAccessToken, supabasePatch, supabaseSelect } from "../lib/api";
import { useNavigate } from "react-router";

export function SettingsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any | null>(null);
  const [stats, setStats] = useState({ words: 0, due: 0, sessions: 0 });
  const [notifications, setNotifications] = useState({ daily: true, streak: true });
  const [darkMode, setDarkMode] = useState(false);
  const [locale, setLocale] = useState("vi-VN");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) return;
    Promise.all([
      supabaseSelect<any>("profiles", { select: "*", limit: 1 }),
      supabaseSelect<any>("cards", { select: "id,next_review_at", limit: 1000 }),
      supabaseSelect<any>("sessions", { select: "id", limit: 1000 }),
    ]).then(([profiles, cards, sessions]) => {
      setProfile(profiles[0] || null);
      setLocale(profiles[0]?.locale || "vi-VN");
      setStats({
        words: cards.length,
        due: cards.filter((card: any) => new Date(card.next_review_at).getTime() <= Date.now()).length,
        sessions: sessions.length,
      });
    }).catch(err => setError(err instanceof Error ? err.message : "Could not load settings."));
  }, []);

  const saveLocale = async (nextLocale: string) => {
    setLocale(nextLocale);
    if (!getAccessToken()) return;
    try {
      await supabasePatch("profiles", { id: `eq.${profile?.id}` }, { locale: nextLocale });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update locale.");
    }
  };

  const name = profile?.display_name || profile?.email || (getAccessToken() ? "Learner" : "Guest");

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Settings</h1>
        <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Manage real account data and local preferences</p>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-foreground font-semibold mb-4" style={{ fontSize: "0.875rem" }}>Profile</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>{name.slice(0, 1).toUpperCase()}</div>
          <div>
            <p className="text-foreground font-semibold" style={{ fontSize: "1rem" }}>{name}</p>
            <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{profile?.email || "Guest mode"}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="px-2.5 py-0.5 rounded-full" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>
                <span className="text-white flex items-center gap-1" style={{ fontSize: "0.7rem", fontWeight: 600 }}>
                  <Zap size={10} /> {profile?.target_cert || "English"}
                </span>
              </div>
            </div>
          </div>
          {!getAccessToken() && (
            <button onClick={() => navigate("/auth")} className="ml-auto px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" style={{ fontSize: "0.8125rem" }}>
              Sign In
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-muted">
          {[[stats.words, "Cards"], [stats.due, "Due"], [stats.sessions, "Sessions"]].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-foreground font-bold" style={{ fontSize: "1.125rem", color: "#2D6A4F" }}>{v}</div>
              <div className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-foreground font-semibold mb-4" style={{ fontSize: "0.875rem" }}>Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0FAF4" }}>
                <Moon size={15} style={{ color: "#2D6A4F" }} />
              </div>
              <div>
                <p className="text-foreground" style={{ fontSize: "0.875rem" }}>Dark Mode</p>
                <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Local UI preference</p>
              </div>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className="w-11 h-6 rounded-full transition-colors relative" style={{ background: darkMode ? "#2D6A4F" : "#E8F5EE" }}>
              <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: darkMode ? "translateX(20px)" : "none" }} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0FAF4" }}>
                <Globe size={15} style={{ color: "#2D6A4F" }} />
              </div>
              <div>
                <p className="text-foreground" style={{ fontSize: "0.875rem" }}>Locale</p>
                <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Saved to profile when signed in</p>
              </div>
            </div>
            <select value={locale} onChange={e => saveLocale(e.target.value)} className="border border-border rounded-lg px-3 py-1.5 outline-none bg-white text-foreground" style={{ fontSize: "0.8125rem" }}>
              <option value="vi-VN">Vietnamese</option>
              <option value="en-US">English</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} style={{ color: "#2D6A4F" }} />
          <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Notifications</h3>
        </div>
        {[
          { key: "daily" as const, label: "Daily Reminder", desc: "Local preference only" },
          { key: "streak" as const, label: "Streak Alert", desc: "Local preference only" },
        ].map(n => (
          <div key={n.key} className="flex items-center justify-between py-2">
            <div>
              <p className="text-foreground" style={{ fontSize: "0.875rem" }}>{n.label}</p>
              <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{n.desc}</p>
            </div>
            <button onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key] }))} className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0" style={{ background: notifications[n.key] ? "#2D6A4F" : "#E8F5EE" }}>
              <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: notifications[n.key] ? "translateX(20px)" : "none" }} />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {[{ icon: Shield, label: "Privacy & Security", sub: "Uses Supabase Auth token in this browser" }, { icon: Globe, label: "Connected Accounts", sub: getAccessToken() ? "Supabase session active" : "Not signed in" }].map((item, i) => (
          <button key={i} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors border-b border-border last:border-0 text-left">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0FAF4" }}>
              <item.icon size={15} style={{ color: "#2D6A4F" }} />
            </div>
            <div className="flex-1">
              <p className="text-foreground" style={{ fontSize: "0.875rem" }}>{item.label}</p>
              <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{item.sub}</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      {getAccessToken() && (
        <button onClick={() => { clearAuth(); navigate("/auth"); }} className="w-full py-3 rounded-xl border border-destructive text-destructive hover:bg-red-50 transition-colors" style={{ fontSize: "0.875rem" }}>
          Sign Out
        </button>
      )}
    </div>
  );
}
