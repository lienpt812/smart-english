import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RotateCcw, CheckCheck, X, Minus, Check, Plus } from "lucide-react";
import { getAccessToken, getCurrentUserId, getFriendlyErrorMessage, supabaseInsert, supabasePatch, supabaseSelect } from "../lib/api";

const SRS_BUTTONS = [
  { label: "Again", quality: 1, color: "#EF476F", bg: "#FFEEF0", icon: X },
  { label: "Hard", quality: 3, color: "#FF8C42", bg: "#FFF3EC", icon: Minus },
  { label: "Good", quality: 4, color: "#2D6A4F", bg: "#D8F3DC", icon: Check },
  { label: "Easy", quality: 5, color: "#52B788", bg: "#F0FAF4", icon: CheckCheck },
];

function schedule(card: any, quality: number) {
  const easeBefore = Number(card.ease_factor || 2.5);
  const intervalBefore = Number(card.interval_days || 0);
  const repetitionsBefore = Number(card.repetitions || 0);
  const easeAfter = Math.max(1.3, easeBefore + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const repetitionsAfter = quality < 3 ? 0 : repetitionsBefore + 1;
  const intervalAfter = quality < 3 ? 0 : repetitionsAfter === 1 ? 1 : repetitionsAfter === 2 ? 6 : Math.round(intervalBefore * easeAfter);
  const nextReview = new Date(Date.now() + Math.max(1, intervalAfter) * 86400000).toISOString();
  return { easeBefore, intervalBefore, repetitionsBefore, easeAfter, intervalAfter, repetitionsAfter, nextReview };
}

export function FlashcardsPage() {
  const [decks, setDecks] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [deckId, setDeckId] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [session, setSession] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [error, setError] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [newCard, setNewCard] = useState({ front: "", back: "" });

  async function load() {
    setError("");
    try {
      const deckRows = await supabaseSelect<any>("decks", { select: "id,name,is_public,created_at", order: "created_at.desc" });
      setDecks(deckRows);
      const selected = deckId || deckRows[0]?.id || "";
      setDeckId(selected);
      if (selected) {
        const cardRows = await supabaseSelect<any>("cards", {
          select: "id,deck_id,front,back,example,pronunciation,ease_factor,interval_days,repetitions,next_review_at,last_review_at,created_at",
          deck_id: `eq.${selected}`,
          suspended: "eq.false",
          order: "next_review_at.asc",
        });
        setCards(cardRows);
      } else {
        setCards([]);
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể tải flashcards. Vui lòng thử lại."));
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (deckId) load();
  }, [deckId]);

  const dueCards = useMemo(
    () => cards.filter(card => new Date(card.next_review_at).getTime() <= Date.now()),
    [cards],
  );
  const queue = dueCards.length ? dueCards : cards;
  const card = queue[currentIdx % Math.max(queue.length, 1)];
  const isSessionDone = queue.length > 0 && completed.length >= queue.length;

  const handleRate = async (label: string, quality: number) => {
    if (!card) return;
    const next = schedule(card, quality);
    try {
      await supabasePatch("cards", { id: `eq.${card.id}` }, {
        ease_factor: next.easeAfter,
        interval_days: next.intervalAfter,
        repetitions: next.repetitionsAfter,
        next_review_at: next.nextReview,
        last_review_at: new Date().toISOString(),
      });
      if (getAccessToken()) {
        await supabaseInsert("srs_reviews", {
          card_id: card.id,
          user_id: getCurrentUserId(),
          quality,
          ease_before: next.easeBefore,
          interval_before: next.intervalBefore,
          repetitions_before: next.repetitionsBefore,
          ease_after: next.easeAfter,
          interval_after: next.intervalAfter,
          repetitions_after: next.repetitionsAfter,
          next_review_after: next.nextReview,
        });
      }
      setSession(prev => ({ ...prev, [label.toLowerCase()]: prev[label.toLowerCase() as keyof typeof prev] + 1 }));
      setCompleted(prev => [...prev, card.id]);
      setFlipped(false);
      setTimeout(() => setCurrentIdx(prev => prev + 1), 200);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể lưu lượt ôn tập. Vui lòng thử lại."));
    }
  };

  const createDeck = async () => {
    if (!newDeckName.trim() || !getAccessToken()) return;
    try {
      await supabaseInsert("decks", { owner_id: getCurrentUserId(), name: newDeckName.trim() });
      setNewDeckName("");
      await load();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể tạo deck. Vui lòng thử lại."));
    }
  };

  const createCard = async () => {
    if (!deckId || !newCard.front.trim() || !newCard.back.trim()) return;
    try {
      await supabaseInsert("cards", { deck_id: deckId, front: newCard.front.trim(), back: newCard.back.trim() });
      setNewCard({ front: "", back: "" });
      await load();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể tạo card. Vui lòng thử lại."));
    }
  };

  const reset = () => {
    setCurrentIdx(0);
    setFlipped(false);
    setCompleted([]);
    setSession({ again: 0, hard: 0, good: 0, easy: 0 });
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Flashcards</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Supabase decks and SM-2 reviews</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground" style={{ fontSize: "0.8125rem" }}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <div className="bg-white rounded-2xl border border-border p-4 mb-6 grid gap-3">
        <select value={deckId} onChange={event => { setDeckId(event.target.value); reset(); }} className="border border-border rounded-xl px-3 py-2 bg-white">
          <option value="">Select deck</option>
          {decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
        </select>
        {getAccessToken() && (
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <input value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="New deck name" className="border border-border rounded-xl px-3 py-2" />
            <button onClick={createDeck} className="px-4 py-2 rounded-xl text-white" style={{ background: "#2D6A4F" }}>Create Deck</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Review Queue", value: queue.length - completed.length, color: "#2D6A4F" },
          { label: "Due", value: dueCards.length, color: "#52B788" },
          { label: "New", value: cards.filter(c => Number(c.repetitions || 0) === 0).length, color: "#FFD166" },
          { label: "Total", value: cards.length, color: "#6C4DDB" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3 border border-border text-center">
            <div className="font-bold" style={{ fontSize: "1.25rem", color: s.color }}>{s.value}</div>
            <div className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {deckId && getAccessToken() && (
        <div className="bg-white rounded-2xl border border-border p-4 mb-6 grid gap-2">
          <input value={newCard.front} onChange={e => setNewCard(prev => ({ ...prev, front: e.target.value }))} placeholder="Front" className="border border-border rounded-xl px-3 py-2" />
          <input value={newCard.back} onChange={e => setNewCard(prev => ({ ...prev, back: e.target.value }))} placeholder="Back" className="border border-border rounded-xl px-3 py-2" />
          <button onClick={createCard} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white" style={{ background: "#2D6A4F" }}><Plus size={14} /> Add Card</button>
        </div>
      )}

      {queue.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-border text-center text-muted-foreground">
          No cards available in this deck.
        </div>
      ) : isSessionDone ? (
        <div className="bg-white rounded-2xl p-10 border border-border text-center">
          <h2 className="text-foreground mb-2" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Session Complete</h2>
          <p className="text-muted-foreground mb-6" style={{ fontSize: "0.875rem" }}>You reviewed {queue.length} cards</p>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {Object.entries(session).map(([k, v]) => (
              <div key={k}><div className="font-bold text-foreground" style={{ fontSize: "1.25rem" }}>{v}</div><div className="text-muted-foreground capitalize" style={{ fontSize: "0.75rem" }}>{k}</div></div>
            ))}
          </div>
          <button onClick={reset} className="px-6 py-3 rounded-xl text-white font-medium" style={{ background: "#2D6A4F" }}>Start Again</button>
        </div>
      ) : (
        <>
          <div className="relative mb-6" style={{ perspective: "1200px", height: "280px" }}>
            <motion.div animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.5 }} style={{ transformStyle: "preserve-3d", position: "relative", width: "100%", height: "100%" }} onClick={() => setFlipped(!flipped)} className="cursor-pointer">
              <div className="absolute inset-0 bg-white rounded-2xl border border-border flex flex-col items-center justify-center p-8 shadow-lg" style={{ backfaceVisibility: "hidden" }}>
                <div className="text-muted-foreground mb-4" style={{ fontSize: "0.75rem", letterSpacing: "0.08em" }}>FRONT - tap to reveal</div>
                <h2 className="text-foreground text-center" style={{ fontSize: "2rem", fontWeight: 800 }}>{card.front}</h2>
              </div>
              <div className="absolute inset-0 rounded-2xl border border-border flex flex-col items-center justify-center p-8 shadow-lg" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#D8F3DC" }}>
                <div className="text-primary mb-4" style={{ fontSize: "0.75rem", letterSpacing: "0.08em" }}>BACK</div>
                <p className="text-foreground text-center" style={{ fontSize: "0.9375rem", lineHeight: 1.8, whiteSpace: "pre-line" }}>{card.back}</p>
                {card.example && <p className="text-muted-foreground text-center mt-3" style={{ fontSize: "0.8125rem" }}>{card.example}</p>}
              </div>
            </motion.div>
          </div>

          <p className="text-center text-muted-foreground mb-4" style={{ fontSize: "0.75rem" }}>{flipped ? "How well did you remember?" : "Click card to reveal answer"}</p>
          <AnimatePresence>
            {flipped && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-2">
                {SRS_BUTTONS.map(btn => (
                  <button key={btn.label} onClick={() => handleRate(btn.label, btn.quality)} className="flex flex-col items-center py-3 rounded-xl border border-border transition-all hover:scale-105 active:scale-95" style={{ background: btn.bg }}>
                    <btn.icon size={16} style={{ color: btn.color, marginBottom: "4px" }} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: btn.color }}>{btn.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
