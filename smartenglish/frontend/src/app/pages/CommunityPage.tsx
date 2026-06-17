import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Users, Globe, Star, Award, CreditCard, Plus } from "lucide-react";
import { getAccessToken, supabaseSelect } from "../lib/api";

export function CommunityPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"global" | "achievements" | "decks">("decks");
  const [decks, setDecks] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabaseSelect<any>("decks", { select: "id,name,description,owner_id,created_at", is_public: "eq.true", order: "created_at.desc" }),
      supabaseSelect<any>("deck_ratings", { select: "deck_id,rating,review,created_at", order: "created_at.desc" }),
    ]).then(([deckRows, ratingRows]) => {
      setDecks(deckRows);
      setRatings(ratingRows);
    }).catch(err => setError(err instanceof Error ? err.message : "Could not load community data."));
  }, []);

  const ratingFor = (deckId: string) => {
    const rows = ratings.filter(item => item.deck_id === deckId);
    if (!rows.length) return "No ratings";
    const avg = rows.reduce((sum, item) => sum + Number(item.rating || 0), 0) / rows.length;
    return `${avg.toFixed(1)} (${rows.length})`;
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Community</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Real public decks and ratings</p>
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
        <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground">
          <Users size={28} className="mx-auto mb-3" />
          Leaderboard data is not available in modules M1-M12 yet.
        </div>
      )}

      {activeTab === "achievements" && (
        <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground">
          Achievement data is not available in modules M1-M12 yet.
        </div>
      )}
    </div>
  );
}
