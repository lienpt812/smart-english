"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type TutorMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function formValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function callTutorAi(input: {
  userId: string;
  sessionId: string;
  messages: TutorMessage[];
  context: string;
}) {
  const aiServiceUrl = process.env.AI_SERVICE_URL ?? "http://localhost:4200";
  const response = await fetch(`${aiServiceUrl.replace(/\/$/, "")}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: input.userId,
      feature: "tutor_chat",
      session_id: input.sessionId,
      system_prompt:
        "You are SmartEnglish Tutor. Give concise, practical English guidance. Use the learner context when available.",
      messages: [
        {
          role: "system",
          content: input.context,
        },
        ...input.messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return "AI service is not available right now. I saved your question, so you can try again soon.";
  }

  const payload = await response.json();
  return String(payload.output ?? "").trim() || "I do not have an answer yet.";
}

export async function startTutorSession(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = formValue(formData, "title") || "Tutor chat";

  const { data } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      kind: "tutor_chat",
      title,
      payload: { messages: [] },
    })
    .select("id")
    .single();

  revalidatePath("/tutor");
  redirect(data?.id ? `/tutor?sessionId=${data.id}` : "/tutor");
}

export async function sendTutorMessage(formData: FormData) {
  const { supabase, user } = await requireUser();
  const sessionId = formValue(formData, "sessionId");
  const content = formValue(formData, "content");
  if (!sessionId || !content) redirect("/tutor");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, payload")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("kind", "tutor_chat")
    .maybeSingle();

  if (!session) redirect("/tutor?error=session_not_found");

  const existingMessages = Array.isArray(session.payload?.messages)
    ? (session.payload.messages as TutorMessage[])
    : [];
  const userMessage: TutorMessage = {
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
  const messagesWithUser = [...existingMessages, userMessage];

  const { data: profile } = await supabase
    .from("profiles")
    .select("level, target_cert")
    .eq("id", user.id)
    .maybeSingle();

  const { count: dueCards } = await supabase
    .from("cards")
    .select("id, decks!inner(owner_id)", { count: "exact", head: true })
    .eq("decks.owner_id", user.id)
    .eq("suspended", false)
    .lte("next_review_at", new Date().toISOString());

  const context = [
    `Learner target: ${profile?.target_cert ?? "unknown"}`,
    `Learner level: ${profile?.level ?? "unknown"}`,
    `Due flashcards today: ${dueCards ?? 0}`,
  ].join("\n");

  const assistantContent = await callTutorAi({
    userId: user.id,
    sessionId,
    messages: messagesWithUser,
    context,
  });

  const assistantMessage: TutorMessage = {
    role: "assistant",
    content: assistantContent,
    createdAt: new Date().toISOString(),
  };

  await supabase
    .from("sessions")
    .update({
      payload: { messages: [...messagesWithUser, assistantMessage] },
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  revalidatePath("/tutor");
  redirect(`/tutor?sessionId=${sessionId}`);
}
