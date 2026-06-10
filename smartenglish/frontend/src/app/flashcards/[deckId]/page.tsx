import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  createCard,
  deleteCard,
  generateCardsFromText,
  importCardsCsv,
  reviewCard,
} from "../actions";

export const dynamic = "force-dynamic";

type DeckRow = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
};

type CardRow = {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_review_at: string | null;
  suspended: boolean;
  created_at: string;
};

type DeckPageProps = {
  params: Promise<{ deckId: string }>;
};

export default async function DeckPage({ params }: DeckPageProps) {
  const { deckId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: deck } = await supabase
    .from("decks")
    .select("id, name, description, owner_id")
    .eq("id", deckId)
    .eq("owner_id", user.id)
    .maybeSingle<DeckRow>();

  if (!deck) notFound();

  const { data: cards } = await supabase
    .from("cards")
    .select(
      "id, front, back, hint, ease_factor, interval_days, repetitions, next_review_at, last_review_at, suspended, created_at",
    )
    .eq("deck_id", deckId)
    .order("next_review_at", { ascending: true });

  const cardRows = ((cards ?? []) as CardRow[]).filter((card) => !card.suspended);
  const now = new Date();
  const dueCards = cardRows.filter((card) => new Date(card.next_review_at) <= now);
  const reviewCardData = dueCards[0] ?? null;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">M5 Flashcard + SRS</p>
          <h1>{deck.name}</h1>
          <p className="muted">{deck.description || "Deck rieng cua ban"}</p>
        </div>
        <nav className="dashboard-nav">
          <Link href="/flashcards">Decks</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Due now</span>
          <strong>{dueCards.length}</strong>
          <small>cards can on</small>
        </article>
        <article className="metric-card">
          <span>Total cards</span>
          <strong>{cardRows.length}</strong>
          <small>dang active</small>
        </article>
        <article className="metric-card">
          <span>New cards</span>
          <strong>{cardRows.filter((card) => card.repetitions === 0).length}</strong>
          <small>chua review</small>
        </article>
        <article className="metric-card">
          <span>Mature cards</span>
          <strong>{cardRows.filter((card) => card.interval_days >= 21).length}</strong>
          <small>interval 21+ ngay</small>
        </article>
      </section>

      {reviewCardData ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>On tap tiep theo</h2>
            <span>SM-2 quality 0-5</span>
          </div>
          <div className="review-card">
            <div>
              <strong>{reviewCardData.front}</strong>
              <p>{reviewCardData.back}</p>
              {reviewCardData.hint ? <small>{reviewCardData.hint}</small> : null}
            </div>
            <form className="quality-grid" action={reviewCard}>
              <input type="hidden" name="deckId" value={deck.id} />
              <input type="hidden" name="cardId" value={reviewCardData.id} />
              {[0, 1, 2, 3, 4, 5].map((quality) => (
                <button name="quality" value={quality} key={quality} type="submit">
                  {quality}
                </button>
              ))}
            </form>
          </div>
        </section>
      ) : (
        <section className="panel">
          <p className="muted compact">Khong co card due. Ban co the them card moi hoac import CSV.</p>
        </section>
      )}

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Them card thu cong</h2>
            <span>front / back / hint</span>
          </div>
          <form className="form-grid" action={createCard}>
            <input type="hidden" name="deckId" value={deck.id} />
            <label>
              Front
              <textarea name="front" required rows={3} maxLength={4000} />
            </label>
            <label>
              Back
              <textarea name="back" required rows={3} maxLength={4000} />
            </label>
            <label>
              Hint
              <input name="hint" maxLength={1000} />
            </label>
            <button type="submit">Them card</button>
          </form>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Import / AI generate</h2>
            <span>CSV hoac text paste</span>
          </div>
          <form className="form-grid" action={importCardsCsv}>
            <input type="hidden" name="deckId" value={deck.id} />
            <label>
              CSV: front,back,hint
              <textarea name="csv" rows={5} placeholder="hello,xin chao,greeting" />
            </label>
            <button type="submit">Import CSV</button>
          </form>
          <form className="form-grid spaced-form" action={generateCardsFromText}>
            <input type="hidden" name="deckId" value={deck.id} />
            <label>
              Text de AI sinh card
              <textarea name="sourceText" rows={5} minLength={20} />
            </label>
            <button type="submit">Generate cards</button>
          </form>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Card list</h2>
          <span>{cardRows.length} active</span>
        </div>
        {cardRows.length === 0 ? (
          <p className="muted compact">Deck nay chua co card.</p>
        ) : (
          <div className="card-list">
            {cardRows.map((card) => (
              <article className="card-row" key={card.id}>
                <div>
                  <strong>{card.front}</strong>
                  <p>{card.back}</p>
                  <small>
                    EF {card.ease_factor} - interval {card.interval_days}d - reps {card.repetitions}
                  </small>
                </div>
                <form action={deleteCard}>
                  <input type="hidden" name="deckId" value={deck.id} />
                  <input type="hidden" name="cardId" value={card.id} />
                  <button className="ghost-button" type="submit">
                    Xoa
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
