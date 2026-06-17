import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Send, Sparkles, BookOpen, PenLine, Mic, Target, RotateCcw } from "lucide-react";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage } from "../lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
}

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
  const [messages, setMessages] = useState<Message[]>(initialMessages());
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const nextMessages = [...messages, { role: "user" as const, content: text, time: now }];
    setMessages(nextMessages);
    setInput("");
    setIsTyping(true);
    try {
      const response = await backendPost<any>("/api/ai/chat", {
        user_id: getCurrentUserId(),
        feature: "frontend_v2_tutor",
        system_prompt: "You are SmartEnglish AI Tutor. Be concise, practical, friendly, and bilingual Vietnamese/English when useful.",
        messages: nextMessages.map(item => ({ role: item.role, content: item.content })),
        temperature: 0.4,
        use_cache: false,
      });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: response.output || "No response from AI service.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: getFriendlyErrorMessage(err, "AI chưa thể trả lời lúc này. Vui lòng thử lại sau."),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
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
              <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Backend AI service</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setMessages(initialMessages())}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          style={{ fontSize: "0.8125rem" }}
        >
          <RotateCcw size={13} />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ background: "#F8F9FA" }}>
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
