import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { createDeck, deleteDeck } from "./actions";

export const dynamic = "force-dynamic";

type DeckRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  cards: { count: number }[] | null;
};

export default async function FlashcardsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  const { data: decks } = await supabase
    .from("decks")
    .select("id, name, description, created_at, cards(count)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">M5 Flashcard + SRS</p>
          <h1>Decks</h1>
          <p className="muted">Tao deck, them card, import CSV, va on tap bang SM-2.</p>
        </div>
        <nav className="dashboard-nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/logout">Dang xuat</Link>
        </nav>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <h2>Tao deck moi</h2>
          <span>Private by default</span>
        </div>
        <form className="form-grid" action={createDeck}>
          <label>
            Ten deck
            <input name="name" required maxLength={160} placeholder="Business vocabulary" />
          </label>
          <label>
            Mo ta
            <input name="description" maxLength={500} placeholder="Tu vung cho meeting va email" />
          </label>
          <button type="submit">Tao deck</button>
        </form>
      </section>

      <section className="deck-grid">
        {((decks ?? []) as DeckRow[]).length === 0 ? (
          <article className="panel">
            <p className="muted compact">Chua co deck nao. Tao deck dau tien de bat dau SRS.</p>
          </article>
        ) : (
          ((decks ?? []) as DeckRow[]).map((deck) => (
            <article className="deck-card" key={deck.id}>
              <div>
                <h2>{deck.name}</h2>
                <p>{deck.description || "Khong co mo ta"}</p>
                <span>{deck.cards?.[0]?.count ?? 0} cards</span>
              </div>
              <div className="deck-actions">
                <Link href={`/flashcards/${deck.id}`}>Mo deck</Link>
                <form action={deleteDeck}>
                  <input type="hidden" name="deckId" value={deck.id} />
                  <button className="ghost-button" type="submit">
                    Xoa
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
