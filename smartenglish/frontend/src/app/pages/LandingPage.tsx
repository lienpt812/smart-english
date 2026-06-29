import { useNavigate } from "react-router";
import { Bot, BookOpen, Headphones, Mic, PenLine, Zap } from "lucide-react";

const CONNECTED_MODULES = [
  { icon: Bot, label: "AI Tutor", path: "/ai-tutor" },
  { icon: BookOpen, label: "Flashcards & Reading", path: "/flashcards" },
  { icon: Headphones, label: "Listening", path: "/listening" },
  { icon: Mic, label: "Speaking", path: "/speaking" },
  { icon: PenLine, label: "Writing", path: "/writing" },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: "#F8F9FA" }}>
      <header className="px-6 py-5 flex items-center justify-between bg-white border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>
            <Zap size={17} className="text-white" />
          </div>
          <span className="font-bold text-foreground" style={{ fontSize: "1.05rem" }}>SmartEnglish</span>
        </div>
        <button onClick={() => navigate("/auth")} className="px-4 py-2 rounded-xl text-white" style={{ background: "#2D6A4F", fontSize: "0.875rem" }}>
          Sign in
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="max-w-2xl">
          <h1 className="text-foreground" style={{ fontSize: "3rem", lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.04em" }}>
            SmartEnglish
          </h1>
          <p className="text-muted-foreground mt-5" style={{ fontSize: "1.05rem", lineHeight: 1.8 }}>
            Personalized English practice for vocabulary, listening, speaking, reading, writing, TOEIC, and IELTS.
          </p>
          <div className="flex gap-3 mt-8">
            <button onClick={() => navigate("/dashboard")} className="px-5 py-3 rounded-xl text-white" style={{ background: "#2D6A4F", fontSize: "0.9375rem", fontWeight: 600 }}>
              Open Dashboard
            </button>
            <button onClick={() => navigate("/auth")} className="px-5 py-3 rounded-xl border border-border bg-white" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
              Connect Account
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-12">
          {CONNECTED_MODULES.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)} className="bg-white rounded-2xl border border-border p-4 text-left hover:bg-muted transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "#D8F3DC" }}>
                <item.icon size={17} style={{ color: "#2D6A4F" }} />
              </div>
              <p className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>{item.label}</p>
              <p className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem" }}>Start practice</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
