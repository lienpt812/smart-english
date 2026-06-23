import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Send, Sparkles, BookOpen, PenLine, Mic, Target, RotateCcw, History } from "lucide-react";
import {
  backendPost,
  getAccessToken,
  getCurrentUserId,
  getFriendlyErrorMessage,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "../lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
}

interface ChatSession {
  id: string;
  title?: string;
  payload?: any;
  updated_at?: string;
}

const CHAT_HISTORY_KEY_PREFIX = "smartenglish.ai-tutor.chat";
const MAX_STORED_MESSAGES = 100;

const SUGGESTIONS = [
  { icon: BookOpen, label: "Explain Present Perfect", prompt: "Can you explain the Present Perfect tense with examples?" },
  { icon: Target, label: "Create TOEIC Practice", prompt: "Create a TOEIC Part 5 practice question for me." },
  { icon: PenLine, label: "Check My Essay", prompt: "Please check my IELTS essay and give feedback on band score." },
  { icon: Sparkles, label: "Generate Flashcards", prompt: "Generate 5 flashcards for advanced business English vocabulary." },
];

function initialMessages(): Message[] {
  return [
    {
      role: "assistant",
      content: "Hi! I'm your SmartEnglish AI Tutor. Ask me about grammar, vocabulary, reading, writing, speaking, listening, TOEIC, or IELTS.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ];
}

function chatHistoryKey() {
  return `${CHAT_HISTORY_KEY_PREFIX}.${getCurrentUserId()}`;
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    typeof message.time === "string"
  );
}

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(chatHistoryKey());
    if (!raw) return initialMessages();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isMessage) && parsed.length > 0
      ? parsed.slice(-MAX_STORED_MESSAGES)
      : initialMessages();
  } catch {
    return initialMessages();
  }
}

function saveMessages(messages: Message[]) {
  try {
    localStorage.setItem(chatHistoryKey(), JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // Chat should remain usable even if browser storage is unavailable or full.
  }
}

function readMessagesFromPayload(payload: any): Message[] {
  const rows = Array.isArray(payload?.messages) ? payload.messages : [];
  return rows.filter(isMessage).slice(-MAX_STORED_MESSAGES);
}

function chatTitle(messages: Message[]) {
  const firstUser = messages.find(item => item.role === "user")?.content.trim();
  return firstUser ? firstUser.slice(0, 80) : "AI Tutor Chat";
}

function chatPreview(session: ChatSession) {
  const messages = readMessagesFromPayload(session.payload);
  const last = [...messages].reverse().find(item => item.role === "user") || messages[messages.length - 1];
  return last?.content?.slice(0, 90) || session.title || "AI Tutor Chat";
}

function formatSessionTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isFlashcardRequest(text: string) {
  const normalized = text.toLowerCase();
  return normalized.includes("flashcard") || normalized.includes("flash card") || normalized.includes("thẻ từ") || normalized.includes("the tu");
}

function flashcardCount(text: string) {
  const found = text.match(/\b([1-9]|[1-3][0-9]|40)\b/);
  return found ? Math.min(40, Math.max(1, Number(found[1]))) : 10;
}

function flashcardTopic(text: string) {
  const cleaned = text
    .replace(/flash\s*cards?/gi, "")
    .replace(/thẻ từ|the tu/gi, "")
    .replace(/generate|create|make|tạo|tao|cho tôi|cho minh|giúp tôi/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const topic = cleaned || "AI Tutor vocabulary";
  return topic.slice(0, 80);
}

function parseFlashcardRows(response: any) {
  const raw = Array.isArray(response?.data?.cards)
    ? response.data.cards
    : (() => {
        try {
          const parsed = JSON.parse(String(response?.output || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
          return Array.isArray(parsed?.cards) ? parsed.cards : [];
        } catch {
          return [];
        }
      })();
  return raw
    .map((item: any) => ({
      front: String(item.front || item.term || item.word || "").trim(),
      back: String(item.back || item.definition || item.meaning || "").trim(),
      example: String(item.example_sentence || item.example || item.note || "").trim(),
      pronunciation: String(item.pronunciation || "").trim(),
      tags: Array.isArray(item.tags) ? item.tags.map((tag: unknown) => String(tag)) : [],
    }))
    .filter((item: any) => item.front && item.back);
}

function clearMessages() {
  try {
    localStorage.removeItem(chatHistoryKey());
  } catch {
    // Ignore storage failures; the in-memory chat will still reset.
  }
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p style={{ fontSize: "0.875rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part
      )}
    </p>
  );
}

export function AITutorPage() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [sessionId, setSessionId] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    let mounted = true;

    async function loadRemoteHistory() {
      if (!getAccessToken()) {
        setHistoryLoaded(true);
        return;
      }

      try {
        const rows = await supabaseSelect<ChatSession>("sessions", {
          select: "id,title,payload,updated_at",
          user_id: `eq.${getCurrentUserId()}`,
          kind: "eq.tutor_chat",
          order: "updated_at.desc",
          limit: 12,
        });
        if (!mounted) return;

        setChatSessions(rows);
        const latest = rows[0];
        const remoteMessages = readMessagesFromPayload(latest?.payload);
        if (latest?.id && remoteMessages.length > 0) {
          setSessionId(latest.id);
          setMessages(remoteMessages);
          saveMessages(remoteMessages);
        }
      } catch {
        // Keep local history if remote session loading fails.
      } finally {
        if (mounted) setHistoryLoaded(true);
      }
    }

    loadRemoteHistory();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const startNewChat = () => {
    clearMessages();
    setSessionId("");
    setShowHistory(false);
    setMessages(initialMessages());
  };

  const openChatSession = (session: ChatSession) => {
    const persistedMessages = readMessagesFromPayload(session.payload);
    if (!persistedMessages.length) return;
    setSessionId(session.id);
    setMessages(persistedMessages);
    saveMessages(persistedMessages);
    setShowHistory(false);
  };

  const refreshChatSessions = async () => {
    if (!getAccessToken()) return;
    const rows = await supabaseSelect<ChatSession>("sessions", {
      select: "id,title,payload,updated_at",
      user_id: `eq.${getCurrentUserId()}`,
      kind: "eq.tutor_chat",
      order: "updated_at.desc",
      limit: 12,
    });
    setChatSessions(rows);
  };

  const persistConversation = async (nextMessages: Message[], currentSessionId = sessionId) => {
    saveMessages(nextMessages);
    if (!getAccessToken()) return currentSessionId;

    const userId = getCurrentUserId();
    const payload = {
      messages: nextMessages.slice(-MAX_STORED_MESSAGES),
      source: "frontend_v2_tutor",
      message_count: nextMessages.length,
      last_message_at: new Date().toISOString(),
    };

    if (currentSessionId) {
      await supabasePatch<any>("sessions", { id: `eq.${currentSessionId}`, user_id: `eq.${userId}` }, {
        title: chatTitle(nextMessages),
        payload,
      });
      refreshChatSessions().catch(() => {});
      return currentSessionId;
    }

    const rows = await supabaseInsert<any>("sessions", {
      user_id: userId,
      kind: "tutor_chat",
      title: chatTitle(nextMessages),
      payload,
    });
    const createdId = rows[0]?.id || "";
    if (createdId) setSessionId(createdId);
    refreshChatSessions().catch(() => {});
    return createdId;
  };

  const createGeneratedFlashcardDeck = async (requestText: string, aiOutput: string) => {
    if (!isFlashcardRequest(requestText)) return "";
    if (!getAccessToken()) return "\n\nSign in to save these flashcards as a Vocabulary deck.";

    const topic = flashcardTopic(requestText);
    const generated = await backendPost<any>("/api/flashcards/generate", {
      user_id: getCurrentUserId(),
      source_text: `${requestText}\n\nTutor answer:\n${aiOutput}`,
      learner_level: "B1",
      count: flashcardCount(requestText),
      language_hint: "mixed",
      include_image_prompts: false,
    });
    const rows = parseFlashcardRows(generated);
    if (!rows.length) return "";

    const deckRows = await supabaseInsert<any>("decks", {
      owner_id: getCurrentUserId(),
      name: `${topic} - generative`,
      description: "Generated from AI Tutor",
    });
    const deckId = deckRows[0]?.id;
    if (!deckId) return "";

    await Promise.all(rows.map((card: any) => supabaseInsert("cards", {
      deck_id: deckId,
      front: card.front,
      back: card.back,
      example: card.example || null,
      pronunciation: card.pronunciation || null,
      tags: card.tags,
      source_type: "ai_tutor",
      source_ref: { feature: "ai_tutor_generative", prompt: requestText },
    })));

    return `\n\nSaved ${rows.length} cards to Vocabulary deck: ${topic} - generative.`;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const nextMessages = [...messages, { role: "user" as const, content: text, time: now }];
    setMessages(nextMessages);
    setInput("");
    setIsTyping(true);
    let activeSessionId = sessionId;
    try {
      activeSessionId = await persistConversation(nextMessages);
      const response = await backendPost<any>("/api/ai/chat", {
        user_id: getCurrentUserId(),
        feature: "frontend_v2_tutor",
        system_prompt: "You are SmartEnglish AI Tutor. Be concise, practical, friendly, and bilingual Vietnamese/English when useful.",
        messages: nextMessages.map(item => ({ role: item.role, content: item.content })),
        temperature: 0.4,
        use_cache: false,
      });
      const assistantOutput = response.output || "No response from AI service.";
      let saveNote = "";
      try {
        saveNote = await createGeneratedFlashcardDeck(text, assistantOutput);
      } catch {
        saveNote = "\n\nI could not save the generated deck automatically. Please try again after checking your login or connection.";
      }
      const finalMessages = [...nextMessages, {
        role: "assistant",
        content: `${assistantOutput}${saveNote}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      } as Message];
      setMessages(finalMessages);
      await persistConversation(finalMessages, activeSessionId);
    } catch (err) {
      const finalMessages = [...nextMessages, {
        role: "assistant",
        content: getFriendlyErrorMessage(err, "AI chưa thể trả lời lúc này. Vui lòng thử lại sau."),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      } as Message];
      setMessages(finalMessages);
      await persistConversation(finalMessages, activeSessionId).catch(() => {});
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full pb-16 lg:pb-0" style={{ height: "calc(100vh - 0px)" }}>
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>AI English Tutor</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
                {historyLoaded ? "Backend AI service" : "Loading history..."}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getAccessToken() && (
            <button
              onClick={() => setShowHistory(value => !value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              style={{ fontSize: "0.8125rem" }}
            >
              <History size={13} />
              History
            </button>
          )}
          <button
            onClick={startNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            style={{ fontSize: "0.8125rem" }}
          >
            <RotateCcw size={13} />
            New Chat
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ background: "#F8F9FA" }}>
        {showHistory && (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Chat history</p>
              <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{chatSessions.length} saved</span>
            </div>
            {chatSessions.length === 0 ? (
              <p className="text-muted-foreground p-2" style={{ fontSize: "0.8125rem" }}>No saved chats yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {chatSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => openChatSession(session)}
                    className={`text-left rounded-xl border px-3 py-2 transition-all hover:bg-muted ${session.id === sessionId ? "border-primary bg-primary/5" : "border-border bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-foreground truncate" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                        {session.title || "AI Tutor Chat"}
                      </p>
                      <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: "0.6875rem" }}>{formatSessionTime(session.updated_at)}</span>
                    </div>
                    <p className="text-muted-foreground truncate mt-1" style={{ fontSize: "0.75rem" }}>{chatPreview(session)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.length === 1 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2 max-w-xl mx-auto mb-4">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s.prompt)} className="bg-white rounded-xl p-3.5 border border-border text-left flex items-start gap-3 transition-all">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#D8F3DC" }}>
                  <s.icon size={14} style={{ color: "#2D6A4F" }} />
                </div>
                <span className="text-foreground" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{s.label}</span>
              </button>
            ))}
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ background: msg.role === "assistant" ? "linear-gradient(135deg, #2D6A4F, #52B788)" : "#52B788" }}>
                {msg.role === "assistant" ? <Bot size={14} /> : "U"}
              </div>
              <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div className="rounded-2xl px-4 py-3" style={{ background: msg.role === "user" ? "linear-gradient(135deg, #2D6A4F, #52B788)" : "white", color: msg.role === "user" ? "white" : "#1F2937", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <MessageContent content={msg.content} />
                </div>
                <span className="text-muted-foreground px-1" style={{ fontSize: "0.6875rem" }}>{msg.time}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
              {[0, 0.15, 0.3].map((delay, i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full" style={{ background: "#52B788" }} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 bg-white border-t border-border">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <div className="flex-1 bg-muted rounded-xl overflow-hidden flex items-center">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask anything about English..."
              className="flex-1 bg-transparent px-4 py-3 outline-none text-foreground"
              style={{ fontSize: "0.875rem" }}
            />
            <button className="p-2 mr-1 rounded-lg hover:bg-white/50 transition-colors text-muted-foreground">
              <Mic size={17} />
            </button>
          </div>
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping} className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
