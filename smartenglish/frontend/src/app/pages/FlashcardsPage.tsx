import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RotateCcw, CheckCheck, X, Minus, Check, Plus, Search, Volume2, BookOpen, Brain, Star } from "lucide-react";
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
  const [allCards, setAllCards] = useState<any[]>([]);
  const [deckId, setDeckId] = useState("");
  const [studyMode, setStudyMode] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [session, setSession] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [error, setError] = useState("");
  const [deckChoice, setDeckChoice] = useState<"existing" | "new">("existing");
  const [newDeckName, setNewDeckName] = useState("");
  const [newCard, setNewCard] = useState({ front: "", back: "", note: "" });
  const [search, setSearch] = useState("");

  async function load(selectedDeckId = deckId) {
    setError("");
    try {
      const userId = getCurrentUserId();
      const deckRows = await supabaseSelect<any>("decks", {
        select: "id,name,is_public,owner_id,created_at",
        ...(getAccessToken() ? { or: `(owner_id.eq.${userId},is_public.eq.true)` } : { is_public: "eq.true" }),
        order: "created_at.desc",
      });
      setDecks(deckRows);
      const selected = selectedDeckId || deckRows[0]?.id || "";
      setDeckId(selected);
      const deckIds = deckRows.map(deck => deck.id);
      if (!deckIds.length) {
        setAllCards([]);
        setCards([]);
        return;
      }
      const cardRows = await supabaseSelect<any>("cards", {
        select: "id,deck_id,front,back,example,pronunciation,ease_factor,interval_days,repetitions,next_review_at,last_review_at,created_at,tags",
        deck_id: `in.(${deckIds.join(",")})`,
        suspended: "eq.false",
        order: "next_review_at.asc",
      });
      setAllCards(cardRows);
      setCards(selected ? cardRows.filter(card => card.deck_id === selected) : []);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not load flashcards. Please try again."));
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!deckId) return;
    setCards(allCards.filter(card => card.deck_id === deckId));
  }, [allCards, deckId]);

  const dueCards = useMemo(
    () => cards.filter(card => new Date(card.next_review_at).getTime() <= Date.now()),
    [cards],
  );
  const allDueCards = useMemo(
    () => allCards.filter(card => new Date(card.next_review_at).getTime() <= Date.now()),
    [allCards],
  );
  const deckCounts = useMemo(
    () => Object.fromEntries(decks.map(deck => [deck.id, allCards.filter(card => card.deck_id === deck.id).length])),
    [allCards, decks],
  );
  const filteredCards = useMemo(
    () => cards.filter(card => {
      const term = `${card.front || ""} ${card.back || ""} ${(card.tags || []).join(" ")}`.toLowerCase();
      return term.includes(search.toLowerCase());
    }),
    [cards, search],
  );
  const queue = dueCards.length ? dueCards : cards;
  const card = queue[currentIdx % Math.max(queue.length, 1)];
  const isSessionDone = queue.length > 0 && completed.length >= queue.length;

  const reset = () => {
    setCurrentIdx(0);
    setFlipped(false);
    setCompleted([]);
    setSession({ again: 0, hard: 0, good: 0, easy: 0 });
  };

  const startDeckStudy = (id: string) => {
    setDeckId(id);
    setStudyMode(true);
    reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRate = async (label: string, quality: number) => {
    if (!card) return;
    const next = schedule(card, quality);
    try {
      const deck = decks.find(item => item.id === card.deck_id);
      const ownsDeck = deck?.owner_id === getCurrentUserId();
      if (ownsDeck) {
        await supabasePatch("cards", { id: `eq.${card.id}` }, {
          ease_factor: next.easeAfter,
          interval_days: next.intervalAfter,
          repetitions: next.repetitionsAfter,
          next_review_at: next.nextReview,
          last_review_at: new Date().toISOString(),
        });
      }
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
      setError(getFriendlyErrorMessage(err, "Could not save this review. Please try again."));
    }
  };

  const createCard = async () => {
    if (!newCard.front.trim() || !newCard.back.trim()) return;
    try {
      let targetDeckId = deckChoice === "existing" ? deckId : "";
      if (deckChoice === "new") {
        if (!newDeckName.trim() || !getAccessToken()) return;
        const rows = await supabaseInsert<any>("decks", { owner_id: getCurrentUserId(), name: newDeckName.trim() });
        targetDeckId = rows[0]?.id || "";
      }
      if (!targetDeckId) return;
      const targetDeck = decks.find(deck => deck.id === targetDeckId);
      if (targetDeck && targetDeck.owner_id !== getCurrentUserId()) {
        setError("Public sample decks are read-only. Create your own deck before adding cards.");
        return;
      }
      await supabaseInsert("cards", {
        deck_id: targetDeckId,
        front: newCard.front.trim(),
        back: newCard.back.trim(),
        example: newCard.note.trim() || null,
      });
      setDeckId(targetDeckId);
      setDeckChoice("existing");
      setNewDeckName("");
      setNewCard({ front: "", back: "", note: "" });
      await load(targetDeckId);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not add vocabulary. Please try again."));
    }
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Vocabulary & Flashcards</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Browse decks, add vocabulary, and learn with SM-2 review.</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground" style={{ fontSize: "0.8125rem" }}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "All Words", value: allCards.length, color: "#2D6A4F" },
          { label: "Decks", value: decks.length, color: "#52B788" },
          { label: "New", value: allCards.filter(c => Number(c.repetitions || 0) === 0).length, color: "#FFD166" },
          { label: "Due", value: allDueCards.length, color: "#6C4DDB" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3 border border-border text-center">
            <div className="font-bold" style={{ fontSize: "1.25rem", color: s.color }}>{s.value}</div>
            <div className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>Decks</h2>
            <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>Click a deck to enter study mode.</p>
          </div>
          <select value={deckId} onChange={event => { setDeckId(event.target.value); reset(); }} className="border border-border rounded-xl px-3 py-2 bg-white">
            <option value="">Select deck</option>
            {decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.length === 0 ? (
            <div className="rounded-xl border border-border p-6 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>No decks yet.</div>
          ) : decks.map(deck => (
            <button key={deck.id} type="button" onClick={() => startDeckStudy(deck.id)} className={`rounded-xl border p-4 text-left transition-all hover:bg-muted ${deck.id === deckId ? "border-primary bg-primary/5" : "border-border bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>{deck.name}</h3>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem" }}>{deckCounts[deck.id] || 0} words</p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-primary" style={{ fontSize: "0.7rem", fontWeight: 700 }}>Study</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {getAccessToken() && (
        <div className="bg-white rounded-2xl border border-border p-4 grid gap-2">
          <h2 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>Add vocabulary</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => setDeckChoice("existing")} className={`rounded-xl border px-3 py-2 text-left ${deckChoice === "existing" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`} style={{ fontSize: "0.8125rem" }}>Add to existing deck</button>
            <button type="button" onClick={() => setDeckChoice("new")} className={`rounded-xl border px-3 py-2 text-left ${deckChoice === "new" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`} style={{ fontSize: "0.8125rem" }}>Create new deck</button>
          </div>
          {deckChoice === "existing" ? (
            <label className="grid gap-1.5">
              <span className="text-foreground font-semibold" style={{ fontSize: "0.8125rem" }}>Deck</span>
              <select value={deckId} onChange={event => setDeckId(event.target.value)} className="border border-border rounded-xl px-3 py-2 bg-white">
                <option value="">Select deck</option>
                {decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="grid gap-1.5">
              <span className="text-foreground font-semibold" style={{ fontSize: "0.8125rem" }}>Deck name</span>
              <input value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="Example: IELTS Reading Vocabulary" className="border border-border rounded-xl px-3 py-2" />
            </label>
          )}
          <label className="grid gap-1.5">
            <span className="text-foreground font-semibold" style={{ fontSize: "0.8125rem" }}>Front</span>
            <input value={newCard.front} onChange={e => setNewCard(prev => ({ ...prev, front: e.target.value }))} placeholder="Word / phrase to recall" className="border border-border rounded-xl px-3 py-2" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-foreground font-semibold" style={{ fontSize: "0.8125rem" }}>Back</span>
            <input value={newCard.back} onChange={e => setNewCard(prev => ({ ...prev, back: e.target.value }))} placeholder="Meaning / translation / answer" className="border border-border rounded-xl px-3 py-2" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-foreground font-semibold" style={{ fontSize: "0.8125rem" }}>Note</span>
            <textarea value={newCard.note} onChange={e => setNewCard(prev => ({ ...prev, note: e.target.value }))} placeholder="Example sentence or personal note shown with the back" className="border border-border rounded-xl px-3 py-2 min-h-20" />
          </label>
          <button onClick={createCard} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white" style={{ background: "#2D6A4F" }}><Plus size={14} /> Add Vocabulary</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: "#2D6A4F" }} />
            <h2 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>Vocabulary List</h2>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground" style={{ fontSize: "0.75rem" }}>
            <span className="inline-flex items-center gap-1"><Brain size={13} /> {cards.filter(c => Number(c.repetitions || 0) > 0).length} reviewed</span>
            <span className="inline-flex items-center gap-1"><Star size={13} /> {dueCards.length} due</span>
          </div>
        </div>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vocabulary in this deck..." className="w-full bg-white border border-border rounded-xl pl-9 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-foreground" style={{ fontSize: "0.875rem" }} />
        </div>
        <div className="grid gap-3 max-h-96 overflow-y-auto pr-1">
          {filteredCards.length === 0 ? (
            <div className="rounded-xl border border-border p-6 text-center text-muted-foreground" style={{ fontSize: "0.8125rem" }}>No vocabulary cards found in this deck.</div>
          ) : filteredCards.map(item => (
            <div key={item.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-foreground font-bold" style={{ fontSize: "1rem" }}>{item.front}</h3>
                    <span className="px-2 py-0.5 rounded-full" style={{ background: "#D8F3DC", color: "#2D6A4F", fontSize: "0.6875rem", fontWeight: 600 }}>{Number(item.repetitions || 0)} reps</span>
                  </div>
                  {item.pronunciation && (
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <span style={{ fontSize: "0.8125rem" }}>{item.pronunciation}</span>
                      <Volume2 size={13} />
                    </div>
                  )}
                  <p className="text-foreground" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{item.back}</p>
                  {item.example && <p className="text-muted-foreground italic mt-2" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>"{item.example}"</p>}
                </div>
                <button type="button" onClick={() => startDeckStudy(item.deck_id)} className="flex-shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" style={{ fontSize: "0.75rem" }}>Study</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!studyMode ? (
        <div className="bg-white rounded-2xl p-8 border border-border text-center text-muted-foreground">Select a deck above to enter study mode.</div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-border text-center text-muted-foreground">No cards available in this deck.</div>
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
          <div className="relative" style={{ perspective: "1200px", height: "280px" }}>
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

          <p className="text-center text-muted-foreground" style={{ fontSize: "0.75rem" }}>{flipped ? "How well did you remember?" : "Click card to reveal answer"}</p>
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
