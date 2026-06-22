import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Award, Copy, CreditCard, Download, Flame, Globe, Loader2, Star, Trophy, Users, Zap } from "lucide-react";
import {
  getAccessToken,
  getCurrentUserId,
  getFriendlyErrorMessage,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "../lib/api";

export function CommunityPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"global" | "achievements" | "decks">("decks");
  const [decks, setDecks] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyDeckId, setBusyDeckId] = useState("");
  const [busyRatingId, setBusyRatingId] = useState("");

  const loadCommunity = () => {
    setError("");
    Promise.all([
      supabaseSelect<any>("decks", { select: "id,name,description,owner_id,created_at", is_public: "eq.true", order: "created_at.desc" }),
      supabaseSelect<any>("deck_ratings", { select: "deck_id,user_id,rating,review,created_at", order: "created_at.desc" }),
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
  };

  useEffect(() => {
    loadCommunity();
  }, []);

  const ratingFor = (deckId: string) => {
    const rows = ratings.filter(item => item.deck_id === deckId);
    if (!rows.length) return "No ratings";
    const avg = rows.reduce((sum, item) => sum + Number(item.rating || 0), 0) / rows.length;
    return `${avg.toFixed(1)} (${rows.length})`;
  };

  const userRatingFor = (deckId: string) => {
    const userId = getCurrentUserId();
    return Number(ratings.find(item => item.deck_id === deckId && item.user_id === userId)?.rating || 0);
  };

  const cloneDeck = async (deck: any) => {
    const userId = getCurrentUserId();
    if (!getAccessToken() || userId === "anonymous") {
      navigate("/auth");
      return;
    }

    setBusyDeckId(deck.id);
    setError("");
    setMessage("");
    try {
      const clonedDeckRows = await supabaseInsert<any>("decks", {
        owner_id: userId,
        name: `${deck.name} (Community copy)`,
        description: deck.description || "Cloned from a public SmartEnglish deck.",
        is_public: false,
      });
      const clonedDeck = clonedDeckRows[0];
      if (!clonedDeck?.id) throw new Error("Could not create cloned deck.");

      const sourceCards = await supabaseSelect<any>("cards", {
        select: "front,back,hint,example,pronunciation,image_url,source_type,source_ref,tags",
        deck_id: `eq.${deck.id}`,
        suspended: "eq.false",
        order: "created_at.asc",
      });

      for (const card of sourceCards) {
        const sourceRef =
          card.source_ref && typeof card.source_ref === "object" && !Array.isArray(card.source_ref)
            ? card.source_ref
            : {};
        await supabaseInsert<any>("cards", {
          deck_id: clonedDeck.id,
          front: card.front,
          back: card.back,
          hint: card.hint || null,
          example: card.example || null,
          pronunciation: card.pronunciation || null,
          image_url: card.image_url || null,
          source_type: card.source_type || "community_clone",
          source_ref: { ...sourceRef, cloned_from_deck_id: deck.id },
          tags: Array.isArray(card.tags) ? card.tags : [],
        });
      }

      await supabaseInsert<any>("deck_clones", {
        source_deck_id: deck.id,
        cloned_deck_id: clonedDeck.id,
        user_id: userId,
      });
      await supabaseInsert<any>("xp_events", {
        user_id: userId,
        event_type: "community_deck_cloned",
        xp: 25,
        metadata: { source_deck_id: deck.id, cloned_deck_id: clonedDeck.id },
      }).catch(() => {});

      setMessage(`Deck "${deck.name}" has been copied to your Flashcards.`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not clone this deck. Please try again."));
    } finally {
      setBusyDeckId("");
    }
  };

  const rateDeck = async (deckId: string, rating: number) => {
    const userId = getCurrentUserId();
    if (!getAccessToken() || userId === "anonymous") {
      navigate("/auth");
      return;
    }

    setBusyRatingId(deckId);
    setError("");
    setMessage("");
    try {
      const existing = ratings.find(item => item.deck_id === deckId && item.user_id === userId);
      if (existing) {
        await supabasePatch<any>("deck_ratings", { deck_id: `eq.${deckId}`, user_id: `eq.${userId}` }, { rating });
      } else {
        await supabaseInsert<any>("deck_ratings", { deck_id: deckId, user_id: userId, rating });
      }
      setRatings(current => {
        const withoutCurrent = current.filter(item => !(item.deck_id === deckId && item.user_id === userId));
        return [{ deck_id: deckId, user_id: userId, rating, created_at: new Date().toISOString() }, ...withoutCurrent];
      });
      setMessage("Thanks, your rating was saved.");
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not save this rating. Please try again."));
    } finally {
      setBusyRatingId("");
    }
  };

  const downloadAchievementCard = (badge: any) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) return;

    const gradient = context.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, "#F7FFF9");
    gradient.addColorStop(1, "#D8F3DC");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1200, 630);

    context.fillStyle = "#2D6A4F";
    context.beginPath();
    context.roundRect(72, 72, 160, 160, 34);
    context.fill();

    context.fillStyle = "#FFFFFF";
    context.font = "700 82px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(badge.icon === "flame" ? "F" : "A", 152, 154);

    context.textAlign = "left";
    context.fillStyle = "#1F2937";
    context.font = "700 42px Arial";
    context.fillText("SmartEnglish Achievement", 280, 112);

    context.fillStyle = "#2D6A4F";
    context.font = "700 72px Arial";
    context.fillText(badge.name || "Achievement unlocked", 280, 225);

    context.fillStyle = "#4B5563";
    context.font = "400 34px Arial";
    const description = String(badge.description || "Learning progress unlocked.");
    const words = description.split(" ");
    let line = "";
    let y = 310;
    words.forEach(word => {
      const test = `${line}${word} `;
      if (context.measureText(test).width > 760 && line) {
        context.fillText(line.trim(), 280, y);
        line = `${word} `;
        y += 46;
      } else {
        line = test;
      }
    });
    context.fillText(line.trim(), 280, y);

    context.fillStyle = "#2D6A4F";
    context.font = "700 34px Arial";
    context.fillText(`+${badge.xp_reward || 0} XP earned`, 280, 500);

    context.fillStyle = "#6B7280";
    context.font = "400 26px Arial";
    context.fillText("smartenglish.app", 280, 548);

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `smartenglish-${badge.code || "achievement"}.png`;
    link.click();
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
      {message && <div className="bg-white rounded-xl border border-primary/30 p-3 mb-4 text-primary" style={{ fontSize: "0.8125rem" }}>{message}</div>}

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
            <div key={deck.id} className="bg-white rounded-xl border border-border p-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#D8F3DC" }}>
                <CreditCard size={18} style={{ color: "#2D6A4F" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-semibold truncate" style={{ fontSize: "0.875rem" }}>{deck.name}</p>
                <p className="text-muted-foreground truncate" style={{ fontSize: "0.75rem" }}>{deck.description || "Community deck"}</p>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0 sm:items-end">
                <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
                  <div className="flex items-center gap-1">
                    <Star size={13} style={{ color: "#FFD166" }} />
                    {ratingFor(deck.id)}
                  </div>
                  {busyRatingId === deck.id && <Loader2 size={13} className="animate-spin" />}
                </div>
                <div className="flex items-center gap-1" aria-label="Rate deck">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => rateDeck(deck.id, value)}
                      className="p-0.5 rounded-md transition-all hover:bg-muted"
                      disabled={busyRatingId === deck.id}
                      title={`Rate ${value} stars`}
                    >
                      <Star
                        size={15}
                        fill={userRatingFor(deck.id) >= value ? "#FFD166" : "transparent"}
                        style={{ color: "#FFD166" }}
                      />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => cloneDeck(deck)}
                  disabled={busyDeckId === deck.id}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-white transition-all hover:shadow-md disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)", fontSize: "0.8125rem" }}
                >
                  {busyDeckId === deck.id ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                  Clone
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>{badge.name}</p>
                    {earned && <span className="text-primary" style={{ fontSize: "0.7rem", fontWeight: 700 }}>Earned</span>}
                  </div>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>{badge.description}</p>
                  <div className="flex items-center justify-between gap-3 mt-2">
                    <p className="text-primary" style={{ fontSize: "0.75rem", fontWeight: 700 }}>+{badge.xp_reward || 0} XP</p>
                    {earned && (
                      <button
                        type="button"
                        onClick={() => downloadAchievementCard(badge)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        style={{ fontSize: "0.75rem", fontWeight: 600 }}
                      >
                        <Download size={12} />
                        Share image
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
