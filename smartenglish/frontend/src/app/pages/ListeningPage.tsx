import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Play, Pause, Volume2, Headphones, Bot, BookOpen } from "lucide-react";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";

const MODES = ["Active Listening", "Dictation", "Shadowing", "Multiple Choice"];

export function ListeningPage() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [lesson, setLesson] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [playing, setPlaying] = useState(false);
  const [activeMode, setActiveMode] = useState("Active Listening");
  const [selectedVocab, setSelectedVocab] = useState<string | null>(null);
  const [aiQuiz, setAiQuiz] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabaseSelect<any>("listening_lessons", { select: "*", published: "eq.true", order: "created_at.desc" })
      .then(rows => {
        setLessons(rows);
        setLesson(rows[0] || null);
      })
      .catch(err => setError(getFriendlyErrorMessage(err, "Không thể tải bài listening. Vui lòng thử lại.")));
  }, []);

  useEffect(() => {
    if (!lesson?.id) return;
    supabaseSelect<any>("listening_questions", { select: "*", lesson_id: `eq.${lesson.id}`, published: "eq.true", order: "position.asc" })
      .then(setQuestions)
      .catch(err => setError(getFriendlyErrorMessage(err, "Không thể tải câu hỏi listening. Vui lòng thử lại.")));
  }, [lesson?.id]);

  const transcript = lesson?.transcript_text || "";
  const turns = useMemo(() => {
    if (Array.isArray(lesson?.dialogue) && lesson.dialogue.length) return lesson.dialogue;
    return transcript.split(/(?<=[.!?])\s+/).filter(Boolean).map((text: string) => ({ speaker: "Audio", text }));
  }, [lesson, transcript]);

  const vocab = useMemo(() => {
    const words = Array.from(new Set(transcript.toLowerCase().match(/[a-z]{6,}/g) || []));
    return words.slice(0, 6).map(word => ({ word, meaning: "Ask AI Tutor or add this word to flashcards for a full explanation.", level: lesson?.level || "B1" }));
  }, [transcript, lesson?.level]);

  const playWebSpeech = () => {
    if (playing) {
      window.speechSynthesis?.cancel();
      setPlaying(false);
      return;
    }
    if (!("speechSynthesis" in window)) {
      setError("Web Speech API is not available in this browser.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(transcript);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.onend = () => setPlaying(false);
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const generateQuiz = async () => {
    if (!lesson) return;
    try {
      const response = await backendPost<any>("/api/listening/quiz", {
        user_id: getCurrentUserId(),
        title: lesson.title,
        transcript,
        learner_level: lesson.level,
        question_count: 5,
      });
      setAiQuiz(response.output);
    } catch (err) {
      setAiQuiz(getFriendlyErrorMessage(err, "Không thể tạo quiz listening lúc này. Vui lòng thử lại sau."));
    }
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Listening Practice</h1>
        <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>M12 lessons, quiz and audio metadata</p>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <select value={lesson?.id || ""} onChange={e => setLesson(lessons.find(item => item.id === e.target.value) || null)} className="w-full bg-white border border-border rounded-xl px-3 py-2 mb-5">
        {lessons.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>

      {!lesson ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground">No published listening lessons found.</div>
      ) : (
        <>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {MODES.map(mode => (
              <button key={mode} onClick={() => setActiveMode(mode)} className={`px-4 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 transition-all ${activeMode === mode ? "text-white border-primary" : "text-muted-foreground border-border bg-white"}`} style={{ fontSize: "0.8125rem", background: activeMode === mode ? "#2D6A4F" : "white" }}>
                {mode}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="p-5 border-b border-border" style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                      <Headphones size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold" style={{ fontSize: "0.9375rem" }}>{lesson.title}</p>
                      <p className="text-green-300" style={{ fontSize: "0.8125rem" }}>{lesson.topic} · {lesson.level || "level"} · {lesson.content_kind}</p>
                    </div>
                  </div>

                  {lesson.audio_url ? (
                    <audio controls src={lesson.audio_url} className="w-full" />
                  ) : (
                    <div className="flex items-center justify-center gap-4">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={playWebSpeech} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#B7E4C7" }}>
                        {playing ? <Pause size={20} style={{ color: "#1B4332" }} /> : <Play size={20} style={{ color: "#1B4332", marginLeft: "2px" }} />}
                      </motion.button>
                      <button className="text-green-300 hover:text-white transition-colors"><Volume2 size={18} /></button>
                      <span className="text-green-300" style={{ fontSize: "0.8125rem" }}>Web Speech playback</span>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-foreground font-semibold mb-3" style={{ fontSize: "0.875rem" }}>Transcript</h3>
                  <div className="space-y-3">
                    {turns.map((seg: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl hover:bg-muted transition-all">
                        <span className="text-primary font-semibold mr-2" style={{ fontSize: "0.75rem" }}>{seg.speaker || "Audio"}</span>
                        <span className="text-foreground" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{seg.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={15} style={{ color: "#2D6A4F" }} />
                  <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Key Vocabulary</h3>
                </div>
                <div className="space-y-2.5">
                  {vocab.map(v => (
                    <div key={v.word} onClick={() => setSelectedVocab(selectedVocab === v.word ? null : v.word)} className="p-2.5 rounded-xl cursor-pointer border transition-all" style={{ background: selectedVocab === v.word ? "#D8F3DC" : "#F8F9FA", borderColor: selectedVocab === v.word ? "#B7E4C7" : "transparent" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-foreground font-medium" style={{ fontSize: "0.875rem" }}>{v.word}</span>
                        <span className="px-2 py-0.5 rounded-full" style={{ background: "#F0FAF4", color: "#52B788", fontSize: "0.6875rem" }}>{v.level}</span>
                      </div>
                      {selectedVocab === v.word && <p className="text-muted-foreground mt-1.5" style={{ fontSize: "0.8125rem" }}>{v.meaning}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={15} style={{ color: "#2D6A4F" }} />
                  <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>AI Quiz</h3>
                </div>
                <button onClick={generateQuiz} className="w-full rounded-xl py-2 text-white mb-3" style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}>Generate new quiz</button>
                {aiQuiz && <pre className="rounded-xl p-3 whitespace-pre-wrap overflow-auto" style={{ background: "#F0FAF4", fontSize: "0.75rem" }}>{aiQuiz}</pre>}
              </div>

              <div className="bg-white rounded-2xl border border-border p-4">
                <h3 className="text-foreground font-semibold mb-3" style={{ fontSize: "0.875rem" }}>Comprehension Questions</h3>
                <div className="space-y-2">
                  {questions.length === 0 ? <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>No saved questions yet.</p> : questions.map((q, i) => (
                    <div key={q.id} className="p-2.5 rounded-lg bg-muted">
                      <span className="text-muted-foreground mr-2" style={{ fontSize: "0.75rem" }}>{i + 1}.</span>
                      <span className="text-foreground" style={{ fontSize: "0.8125rem" }}>{q.prompt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
