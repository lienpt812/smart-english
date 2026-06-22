import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Award, CreditCard, Flame, Globe, Plus, Star, Trophy, Users, Zap } from "lucide-react";
import { getAccessToken, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";

export function CommunityPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"global" | "achievements" | "decks">("decks");
  const [decks, setDecks] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabaseSelect<any>("decks", { select: "id,name,description,owner_id,created_at", is_public: "eq.true", order: "created_at.desc" }),
      supabaseSelect<any>("deck_ratings", { select: "deck_id,rating,review,created_at", order: "created_at.desc" }),
      supabaseSelect<any>("user_gamification", { select: "user_id,public_name,total_xp,level,current_streak,longest_streak", leaderboard_opt_in: "eq.true", order: "total_xp.desc", limit: 20 }),
      supabaseSelect<any>("badges", { select: "id,code,name,description,icon,xp_reward", published: "eq.true", order: "code.asc" }),
      getAccessToken()
        ? supabaseSelect<any>("user_badges", { select: "badge_id,earned_at", user_id: `eq.${getCurrentUserId()}`, order: "earned_at.desc" })
        : Promise.resolve([]),
    ]).then(([deckRows, ratingRows, leaderboardRows, badgeRows, userBadgeRows]) => {
      setDecks(deckRows);
      setRatings(ratingRows);
      setLeaderboard(leaderboardRows);
      setBadges(badgeRows);
      setUserBadges(userBadgeRows);
    }).catch(err => setError(getFriendlyErrorMessage(err, "Could not load community data. Please try again.")));
  }, []);

  const ratingFor = (deckId: string) => {
    const rows = ratings.filter(item => item.deck_id === deckId);
    if (!rows.length) return "No ratings";
    const avg = rows.reduce((sum, item) => sum + Number(item.rating || 0), 0) / rows.length;
    return `${avg.toFixed(1)} (${rows.length})`;
  };

  const earnedBadgeIds = new Set(userBadges.map(item => item.badge_id));

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Community</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Shared decks, XP leaderboard, and achievements</p>
        </div>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <div className="flex gap-1 p-1 rounded-xl bg-muted mb-6 overflow-x-auto">
        {[
          { id: "decks", icon: CreditCard, label: "Shared Decks" },
          { id: "global", icon: Globe, label: "Leaderboard" },
          { id: "achievements", icon: Award, label: "Achievements" },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg flex-shrink-0 transition-all ${activeTab === t.id ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`} style={{ fontSize: "0.8125rem", fontWeight: activeTab === t.id ? 600 : 400 }}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "decks" && (
        <div className="space-y-3">
          {decks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground">No public decks found.</div>
          ) : decks.map(deck => (
            <div key={deck.id} className="bg-white rounded-xl border border-border p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#D8F3DC" }}>
                <CreditCard size={18} style={{ color: "#2D6A4F" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-semibold truncate" style={{ fontSize: "0.875rem" }}>{deck.name}</p>
                <p className="text-muted-foreground truncate" style={{ fontSize: "0.75rem" }}>{deck.description || "Community deck"}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
                  <Star size={13} style={{ color: "#FFD166" }} />
                  {ratingFor(deck.id)}
                </div>
                <button onClick={() => navigate(getAccessToken() ? "/flashcards" : "/auth")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-white transition-all hover:shadow-md" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)", fontSize: "0.8125rem" }}>
                  <Plus size={12} /> Use
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "global" && (
        <div className="space-y-3">
          {leaderboard.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground">
              <Users size={28} className="mx-auto mb-3" />
              No leaderboard activity yet.
            </div>
          ) : leaderboard.map((row, index) => (
            <div key={row.user_id} className="bg-white rounded-xl border border-border p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: index < 3 ? "#FFF3EC" : "#D8F3DC" }}>
                {index < 3 ? <Trophy size={18} style={{ color: "#FF6B35" }} /> : <Users size={18} style={{ color: "#2D6A4F" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-semibold truncate" style={{ fontSize: "0.875rem" }}>
                  #{index + 1} {row.public_name || "Learner"}
                </p>
                <p className="text-muted-foreground truncate" style={{ fontSize: "0.75rem" }}>
                  Level {row.level} · {row.current_streak || 0} day streak · best {row.longest_streak || 0}
                </p>
              </div>
              <div className="flex items-center gap-1 text-primary font-semibold" style={{ fontSize: "0.875rem" }}>
                <Zap size={14} />
                {row.total_xp || 0} XP
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "achievements" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {badges.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground sm:col-span-2">
              No badges configured yet.
            </div>
          ) : badges.map(badge => {
            const earned = earnedBadgeIds.has(badge.id);
            return (
              <div key={badge.id} className="bg-white rounded-xl border border-border p-4 flex gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: earned ? "#D8F3DC" : "#F3F4F6" }}>
                  {badge.icon === "flame" ? <Flame size={18} style={{ color: earned ? "#2D6A4F" : "#9CA3AF" }} /> : <Award size={18} style={{ color: earned ? "#2D6A4F" : "#9CA3AF" }} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>{badge.name}</p>
                    {earned && <span className="text-primary" style={{ fontSize: "0.7rem", fontWeight: 700 }}>Earned</span>}
                  </div>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>{badge.description}</p>
                  <p className="text-primary mt-2" style={{ fontSize: "0.75rem", fontWeight: 700 }}>+{badge.xp_reward || 0} XP</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
