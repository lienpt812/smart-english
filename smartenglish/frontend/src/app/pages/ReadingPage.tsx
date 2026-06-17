import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Plus, BookOpen, ChevronDown } from "lucide-react";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";

export function ReadingPage() {
  const [passages, setPassages] = useState<any[]>([]);
  const [passage, setPassage] = useState<any | null>(null);
  const [vocab, setVocab] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedWord, setSelectedWord] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showAISummary, setShowAISummary] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const rows = await supabaseSelect<any>("reading_passages", { select: "*", published: "eq.true", order: "created_at.desc" });
        setPassages(rows);
        setPassage(rows[0] || null);
      } catch (err) {
        setError(getFriendlyErrorMessage(err, "Không thể tải bài reading. Vui lòng thử lại."));
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!passage?.id) return;
    Promise.all([
      supabaseSelect<any>("reading_vocabulary", { select: "*", passage_id: `eq.${passage.id}`, order: "position.asc" }),
      supabaseSelect<any>("reading_questions", { select: "*", passage_id: `eq.${passage.id}`, published: "eq.true", order: "position.asc" }),
    ]).then(([v, q]) => {
      setVocab(v);
      setQuestions(q);
      setAnswers({});
      setSelectedWord(null);
      setSummary("");
    }).catch(err => setError(getFriendlyErrorMessage(err, "Không thể tải chi tiết bài reading. Vui lòng thử lại.")));
  }, [passage?.id]);

  const body = passage?.body || passage?.content || "";
  const paragraphs = body.split(/\n+/).filter(Boolean);
  const vocabByTerm = Object.fromEntries(vocab.map(item => [String(item.term || "").toLowerCase(), item]));

  const handleWordClick = async (word: string) => {
    const clean = word.toLowerCase().replace(/[^a-z']/g, "");
    const local = vocabByTerm[clean];
    if (local) {
      setSelectedWord(local);
      return;
    }
    try {
      const response = await backendPost<any>("/api/reading/explain", {
        user_id: getCurrentUserId(),
        term: clean,
        sentence: word,
        passage_context: body.slice(0, 4000),
        learner_level: passage?.level,
      });
      setSelectedWord({ term: clean, definition: response.output, ai: true });
    } catch {
      setSelectedWord(null);
    }
  };

  const summarize = async () => {
    setShowAISummary(!showAISummary);
    if (summary || !passage) return;
    try {
      const response = await backendPost<any>("/api/reading/summarize", {
        user_id: getCurrentUserId(),
        passage_title: passage.title,
        passage_body: body,
        learner_level: passage.level,
      });
      setSummary(response.output);
    } catch (err) {
      setSummary(getFriendlyErrorMessage(err, "Không thể tóm tắt bài reading lúc này. Vui lòng thử lại sau."));
    }
  };

  return (
    <div className="min-h-screen p-6 pb-24 lg:pb-6" style={{ background: "#F8F9FA" }}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Reading</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Published passages from Supabase</p>
        </div>

        {error && <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

        <select value={passage?.id || ""} onChange={e => setPassage(passages.find(p => p.id === e.target.value) || null)} className="w-full bg-white border border-border rounded-xl px-3 py-2 mb-5">
          {passages.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>

        {!passage ? (
          <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground">No published reading passages found.</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-border overflow-hidden mb-6">
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full" style={{ background: "#D8F3DC", color: "#2D6A4F", fontSize: "0.75rem", fontWeight: 500 }}>{passage.level || "CEFR"}</span>
                  <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{passage.topic || passage.slug || "Reading passage"}</span>
                </div>
                <h2 className="text-foreground" style={{ fontSize: "1.375rem", fontWeight: 700, lineHeight: 1.4 }}>{passage.title}</h2>
              </div>

              <div className="p-6 space-y-5">
                {paragraphs.map((text, pi) => (
                  <p key={pi} className="text-foreground" style={{ fontSize: "1rem", lineHeight: 1.85 }}>
                    {text.split(" ").map((word, wi) => {
                      const clean = word.toLowerCase().replace(/[^a-z']/g, "");
                      const hasDefinition = !!vocabByTerm[clean];
                      return (
                        <span key={wi} onClick={() => handleWordClick(word)} className="cursor-pointer underline-offset-4" style={{ textDecorationLine: hasDefinition ? "underline" : undefined, textDecorationStyle: "dotted", textDecorationColor: "#52B788", color: selectedWord?.term?.toLowerCase() === clean ? "#2D6A4F" : undefined }}>
                          {word}{" "}
                        </span>
                      );
                    })}
                  </p>
                ))}
              </div>

              <AnimatePresence>
                {selectedWord && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mx-6 mb-4 p-4 rounded-xl border" style={{ background: "#F0FAF4", borderColor: "#B7E4C7" }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-primary font-semibold" style={{ fontSize: "1rem" }}>{selectedWord.term}</span>
                        <p className="text-foreground mt-1" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{selectedWord.definition || selectedWord.simple_definition || selectedWord.meaning}</p>
                        {selectedWord.example && <p className="text-muted-foreground mt-1" style={{ fontSize: "0.8125rem" }}>{selectedWord.example}</p>}
                      </div>
                      <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-primary border border-primary" style={{ fontSize: "0.75rem" }}>
                        <Plus size={12} /> Flashcard
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-6">
              <button onClick={summarize} className="bg-white rounded-xl border border-border p-4 flex items-center justify-between hover:bg-muted transition-colors w-full">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#D8F3DC" }}>
                    <Bot size={15} style={{ color: "#2D6A4F" }} />
                  </div>
                  <span className="text-foreground font-medium" style={{ fontSize: "0.875rem" }}>AI Summary & Analysis</span>
                </div>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform ${showAISummary ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {showAISummary && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-white rounded-xl border border-border p-5 overflow-hidden">
                    <p className="text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>{summary || "Loading AI summary..."}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={16} style={{ color: "#2D6A4F" }} />
                <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Comprehension Check</h3>
              </div>
              {questions.length === 0 ? <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>No questions for this passage yet.</p> : (
                <div className="space-y-5">
                  {questions.map((q, qi) => {
                    const choices = Array.isArray(q.choices) ? q.choices : [];
                    const answer = Number(q.answer?.correctIndex ?? q.answer?.correct_index);
                    return (
                      <div key={q.id}>
                        <p className="text-foreground mb-3" style={{ fontSize: "0.875rem", fontWeight: 500 }}>{qi + 1}. {q.prompt}</p>
                        <div className="space-y-2">
                          {choices.map((opt: string, oi: number) => {
                            const selected = answers[qi] === oi;
                            const showResult = answers[qi] !== undefined;
                            const isAnswer = oi === answer;
                            return (
                              <button key={oi} onClick={() => !showResult && setAnswers(a => ({ ...a, [qi]: oi }))} className="w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all" style={{ borderColor: showResult && isAnswer ? "#52B788" : showResult && selected && !isAnswer ? "#EF476F" : selected ? "#2D6A4F" : "#E8F5EE", background: showResult && isAnswer ? "#F0FAF4" : showResult && selected && !isAnswer ? "#FFEEF0" : selected ? "#D8F3DC" : "transparent", fontSize: "0.8125rem", color: "#1F2937" }}>
                                {String.fromCharCode(65 + oi)}. {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
