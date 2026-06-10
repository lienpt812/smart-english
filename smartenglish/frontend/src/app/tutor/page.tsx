import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { sendTutorMessage, startTutorSession } from "./actions";

export const dynamic = "force-dynamic";

type TutorMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type TutorSession = {
  id: string;
  title: string | null;
  started_at: string;
  payload: { messages?: TutorMessage[] } | null;
};

type TutorPageProps = {
  searchParams: Promise<{ sessionId?: string }>;
};

export default async function TutorPage({ searchParams }: TutorPageProps) {
  const { sessionId } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, title, started_at, payload")
    .eq("user_id", user.id)
    .eq("kind", "tutor_chat")
    .order("started_at", { ascending: false })
    .limit(12);

  const sessionRows = (sessions ?? []) as TutorSession[];
  const selectedSessionId = sessionId ?? sessionRows[0]?.id ?? null;
  const currentSession = sessionRows.find((session) => session.id === selectedSessionId) ?? null;
  const messages = currentSession?.payload?.messages ?? [];

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">M6 AI Tutor Chat</p>
          <h1>Tutor chat</h1>
          <p className="muted">Hoi dap voi AI qua M3, luu lich su theo session.</p>
        </div>
        <nav className="dashboard-nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/flashcards">Flashcards</Link>
        </nav>
      </header>

      <section className="tutor-layout">
        <aside className="panel tutor-sidebar">
          <div className="panel-heading">
            <h2>Sessions</h2>
            <span>{sessionRows.length}</span>
          </div>
          <form className="form-grid" action={startTutorSession}>
            <label>
              Ten session
              <input name="title" maxLength={120} placeholder="Grammar help" />
            </label>
            <button type="submit">New chat</button>
          </form>
          <div className="session-list">
            {sessionRows.map((session) => (
              <Link
                className={session.id === selectedSessionId ? "session-link active" : "session-link"}
                href={`/tutor?sessionId=${session.id}`}
                key={session.id}
              >
                <strong>{session.title || "Tutor chat"}</strong>
                <span>{new Date(session.started_at).toLocaleDateString("vi-VN")}</span>
              </Link>
            ))}
          </div>
        </aside>

        <section className="panel tutor-panel">
          <div className="panel-heading">
            <h2>{currentSession?.title || "Tutor chat"}</h2>
            <span>{messages.length} messages</span>
          </div>

          {!currentSession ? (
            <p className="muted compact">Tao chat moi de bat dau hoi AI tutor.</p>
          ) : (
            <>
              <div className="message-list">
                {messages.length === 0 ? (
                  <p className="muted compact">Chua co tin nhan. Hoi ve grammar, vocab, reading, writing...</p>
                ) : (
                  messages.map((message, index) => (
                    <article className={`message ${message.role}`} key={`${message.createdAt}-${index}`}>
                      <span>{message.role === "user" ? "You" : "Tutor"}</span>
                      <p>{message.content}</p>
                    </article>
                  ))
                )}
              </div>
              <form className="chat-form" action={sendTutorMessage}>
                <input type="hidden" name="sessionId" value={currentSession.id} />
                <textarea
                  name="content"
                  required
                  rows={4}
                  maxLength={4000}
                  placeholder="Ask: Explain present perfect with examples..."
                />
                <button type="submit">Send</button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
