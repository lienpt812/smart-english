import { useEffect, useState } from "react";
import { Search, Volume2, BookOpen, Brain, CreditCard, Star } from "lucide-react";
import { supabaseSelect } from "../lib/api";

export function VocabularyPage() {
  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    supabaseSelect<any>("cards", {
      select: "id,front,back,example,pronunciation,tags,repetitions,next_review_at,created_at",
      order: "created_at.desc",
      limit: 200,
    }).then(setCards).catch(err => setError(err instanceof Error ? err.message : "Could not load vocabulary cards."));
  }, []);

  const filtered = cards.filter(card => String(card.front || "").toLowerCase().includes(search.toLowerCase()));
  const due = cards.filter(card => new Date(card.next_review_at).getTime() <= Date.now()).length;

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Vocabulary</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Vocabulary is loaded from real flashcard data</p>
        </div>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: BookOpen, label: "Words", value: cards.length, color: "#2D6A4F", bg: "#D8F3DC" },
          { icon: Brain, label: "Reviewed", value: cards.filter(c => Number(c.repetitions || 0) > 0).length, color: "#52B788", bg: "#F0FAF4" },
          { icon: Star, label: "Review Due", value: due, color: "#FFD166", bg: "#FFF9E6" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-border">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: s.bg }}>
              <s.icon size={15} style={{ color: s.color }} />
            </div>
            <div className="text-foreground font-bold" style={{ fontSize: "1.25rem" }}>{s.value}</div>
            <div className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards..." className="w-full bg-white border border-border rounded-xl pl-9 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-foreground" style={{ fontSize: "0.875rem" }} />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground">No vocabulary cards found.</div>
        ) : filtered.map(card => (
          <div key={card.id} className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2.5 mb-0.5">
                  <h3 className="text-foreground" style={{ fontSize: "1.0625rem", fontWeight: 700 }}>{card.front}</h3>
                  <span className="px-2 py-0.5 rounded-full" style={{ background: "#D8F3DC", color: "#2D6A4F", fontSize: "0.6875rem", fontWeight: 600 }}>{Number(card.repetitions || 0)} reps</span>
                </div>
                {card.pronunciation && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span style={{ fontSize: "0.8125rem" }}>{card.pronunciation}</span>
                    <Volume2 size={13} />
                  </div>
                )}
              </div>
              <CreditCard size={18} className="text-muted-foreground" />
            </div>
            <p className="text-foreground mb-2" style={{ fontSize: "0.875rem" }}>{card.back}</p>
            {card.example && <p className="text-muted-foreground italic mb-4" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>"{card.example}"</p>}
            <div className="flex flex-wrap gap-2">
              {(card.tags || []).map((tag: string) => (
                <span key={tag} className="px-2 py-0.5 rounded-full" style={{ background: "#F0FAF4", color: "#52B788", fontSize: "0.75rem" }}>{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
