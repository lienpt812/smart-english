"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { applySm2 } from "./srs";

type GeneratedCard = {
  front: string;
  back: string;
  hint?: string;
};

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function parseCsv(text: string): GeneratedCard[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [front = "", back = "", hint = ""] = line.split(",").map((part) => part.trim());
      return { front, back, hint };
    })
    .filter((card) => card.front && card.back);
}

function fallbackCardsFromText(text: string): GeneratedCard[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12)
    .slice(0, 8)
    .map((sentence, index) => ({
      front: `Explain sentence ${index + 1}`,
      back: sentence,
      hint: "Generated locally because AI service was unavailable.",
    }));
}

async function generateCardsViaAi(text: string): Promise<GeneratedCard[]> {
  const aiServiceUrl = process.env.AI_SERVICE_URL ?? "http://localhost:4200";
  try {
    const response = await fetch(`${aiServiceUrl.replace(/\/$/, "")}/ai/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "frontend-server",
        feature: "flashcards",
        response_format: "json",
        prompt: text,
        instruction:
          "Create 5 to 10 English learning flashcards from the text. Return JSON array only. Each item must have front, back, and optional hint.",
      }),
      cache: "no-store",
    });
    if (!response.ok) return fallbackCardsFromText(text);
    const payload = await response.json();
    const raw = String(payload.output ?? "").trim();
    const parsed = JSON.parse(raw) as GeneratedCard[];
    return parsed
      .filter((card) => card.front && card.back)
      .slice(0, 20)
      .map((card) => ({
        front: String(card.front).slice(0, 4000),
        back: String(card.back).slice(0, 4000),
        hint: card.hint ? String(card.hint).slice(0, 1000) : undefined,
      }));
  } catch {
    return fallbackCardsFromText(text);
  }
}

export async function createDeck(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = value(formData, "name");
  const description = value(formData, "description");
  if (!name) redirect("/flashcards?error=deck_name");

  await supabase.from("decks").insert({
    owner_id: user.id,
    name,
    description: description || null,
  });

  revalidatePath("/flashcards");
  redirect("/flashcards");
}

export async function deleteDeck(formData: FormData) {
  const { supabase } = await requireUser();
  const deckId = value(formData, "deckId");
  if (deckId) await supabase.from("decks").delete().eq("id", deckId);

  revalidatePath("/flashcards");
  redirect("/flashcards");
}

export async function createCard(formData: FormData) {
  const { supabase } = await requireUser();
  const deckId = value(formData, "deckId");
  const front = value(formData, "front");
  const back = value(formData, "back");
  const hint = value(formData, "hint");
  if (!deckId || !front || !back) redirect(`/flashcards/${deckId}?error=card_required`);

  await supabase.from("cards").insert({
    deck_id: deckId,
    front,
    back,
    hint: hint || null,
  });

  revalidatePath(`/flashcards/${deckId}`);
  redirect(`/flashcards/${deckId}`);
}

export async function deleteCard(formData: FormData) {
  const { supabase } = await requireUser();
  const deckId = value(formData, "deckId");
  const cardId = value(formData, "cardId");
  if (cardId) await supabase.from("cards").delete().eq("id", cardId);

  revalidatePath(`/flashcards/${deckId}`);
  redirect(`/flashcards/${deckId}`);
}

export async function importCardsCsv(formData: FormData) {
  const { supabase } = await requireUser();
  const deckId = value(formData, "deckId");
  const csv = value(formData, "csv");
  const cards = parseCsv(csv);
  if (!deckId || cards.length === 0) redirect(`/flashcards/${deckId}?error=csv_empty`);

  await supabase.from("cards").insert(
    cards.map((card) => ({
      deck_id: deckId,
      front: card.front,
      back: card.back,
      hint: card.hint || null,
    })),
  );

  revalidatePath(`/flashcards/${deckId}`);
  redirect(`/flashcards/${deckId}`);
}

export async function generateCardsFromText(formData: FormData) {
  const { supabase } = await requireUser();
  const deckId = value(formData, "deckId");
  const sourceText = value(formData, "sourceText");
  if (!deckId || sourceText.length < 20) redirect(`/flashcards/${deckId}?error=source_text`);

  const cards = await generateCardsViaAi(sourceText);
  if (cards.length === 0) redirect(`/flashcards/${deckId}?error=ai_empty`);

  await supabase.from("cards").insert(
    cards.map((card) => ({
      deck_id: deckId,
      front: card.front,
      back: card.back,
      hint: card.hint || null,
    })),
  );

  revalidatePath(`/flashcards/${deckId}`);
  redirect(`/flashcards/${deckId}`);
}

export async function reviewCard(formData: FormData) {
  const { supabase, user } = await requireUser();
  const deckId = value(formData, "deckId");
  const cardId = value(formData, "cardId");
  const quality = Number(value(formData, "quality"));
  if (!deckId || !cardId || !Number.isFinite(quality)) redirect(`/flashcards/${deckId}`);

  const { data: card } = await supabase
    .from("cards")
    .select("id, ease_factor, interval_days, repetitions, decks!inner(owner_id)")
    .eq("id", cardId)
    .eq("decks.owner_id", user.id)
    .maybeSingle();

  if (!card) redirect(`/flashcards/${deckId}?error=card_not_found`);

  const reviewedAt = new Date();
  const before = {
    ease_factor: Number(card.ease_factor),
    interval_days: Number(card.interval_days),
    repetitions: Number(card.repetitions),
  };
  const after = applySm2(before, quality, reviewedAt);

  await supabase
    .from("cards")
    .update({
      ease_factor: after.ease_factor,
      interval_days: after.interval_days,
      repetitions: after.repetitions,
      last_review_at: reviewedAt.toISOString(),
      next_review_at: after.next_review_at,
    })
    .eq("id", cardId);

  await supabase.from("srs_reviews").insert({
    card_id: cardId,
    user_id: user.id,
    quality,
    ease_before: before.ease_factor,
    interval_before: before.interval_days,
    repetitions_before: before.repetitions,
    ease_after: after.ease_factor,
    interval_after: after.interval_days,
    repetitions_after: after.repetitions,
    next_review_after: after.next_review_at,
  });

  revalidatePath(`/flashcards/${deckId}`);
  redirect(`/flashcards/${deckId}`);
}
