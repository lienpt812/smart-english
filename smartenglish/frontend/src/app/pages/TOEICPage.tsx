import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Clock, FileText, History, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { backendPost, getAccessToken, getCurrentUserId, getFriendlyErrorMessage, supabaseInsert, supabasePatch, supabaseSelect } from "../lib/api";

type ToeicQuestion = {
  id: string;
  section: "listening" | "reading";
  part: number;
  part_name?: string;
  question_number: number;
  prompt: string;
  choices: string[];
  answer?: { correctIndex?: number };
  explanation?: string;
  passage?: string | null;
  audio_script?: string | null;
};

type ToeicGenerateResponse = {
  data?: {
    title?: string;
    questions?: ToeicQuestion[];
  };
};

type ToeicScoreResponse = {
  data?: {
    score: number;
    percent: number;
    correct_count: number;
    question_count: number;
    listening_percent: number;
    reading_percent: number;
    part_breakdown: Record<string, { correct: number; total: number }>;
    results: Array<{
      question_id: string;
      part: number;
      correct: boolean;
      response: unknown;
      expected: unknown;
      explanation?: string;
    }>;
  };
};

type ToeicHistorySession = {
  id: string;
  title?: string;
  payload?: {
    title?: string;
    questions?: ToeicQuestion[];
    responses?: Record<string, number>;
    score?: ToeicScoreResponse["data"] | null;
    setup?: {
      partSet?: string;
      questionCount?: number;
    };
  };
  created_at?: string;
  updated_at?: string;
};

const PART_OPTIONS = [
  { value: "5", label: "Part 5" },
  { value: "6", label: "Part 6" },
  { value: "7", label: "Part 7" },
  { value: "1,2", label: "LC Part 1-2" },
  { value: "3,4", label: "LC Part 3-4" },
  { value: "5,6,7", label: "RC Part 5-7" },
  { value: "1,2,3,4,5,6,7", label: "Mixed" },
];

const TOEIC_HISTORY_KEY = "smartenglish.toeic.history";
let toeicSnapshot: any = null;

function toeicHistoryKey() {
  return `${TOEIC_HISTORY_KEY}.${getCurrentUserId()}`;
}

function readLocalToeicHistory(): ToeicHistorySession[] {
  try {
    return JSON.parse(localStorage.getItem(toeicHistoryKey()) || "[]");
  } catch {
    return [];
  }
}

function writeLocalToeicHistory(items: ToeicHistorySession[]) {
  localStorage.setItem(toeicHistoryKey(), JSON.stringify(items.slice(0, 24)));
}

export function TOEICPage() {
  const userId = getCurrentUserId();
  const restored = toeicSnapshot?.userId === userId ? toeicSnapshot : null;
  const [partSet, setPartSet] = useState(restored?.partSet || "5,6,7");
  const [questionCount, setQuestionCount] = useState(restored?.questionCount || 10);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(restored?.title || "TOEIC Mini Practice");
  const [questions, setQuestions] = useState<ToeicQuestion[]>(restored?.questions || []);
  const [responses, setResponses] = useState<Record<string, number>>(restored?.responses || {});
  const [score, setScore] = useState<ToeicScoreResponse["data"] | null>(restored?.score || null);
  const [startedAt, setStartedAt] = useState<number | null>(restored?.startedAt || null);
  const [sessionId, setSessionId] = useState(restored?.sessionId || "");
  const [history, setHistory] = useState<ToeicHistorySession[]>(restored?.history || readLocalToeicHistory());

  const answeredCount = useMemo(() => Object.keys(responses).length, [responses]);
  const scoreByQuestion = useMemo(() => {
    const map = new Map<string, ToeicScoreResponse["data"]["results"][number]>();
    score?.results?.forEach(item => map.set(item.question_id, item));
    return map;
  }, [score]);

  const loadHistory = async () => {
    const localRows = readLocalToeicHistory();
    if (!getAccessToken()) return;
    try {
      const rows = await supabaseSelect<ToeicHistorySession>("sessions", {
        select: "id,title,payload,created_at,updated_at",
        user_id: `eq.${getCurrentUserId()}`,
        kind: "eq.toeic_practice",
        order: "created_at.desc",
        limit: 12,
      });
      const merged = [...rows, ...localRows.filter(local => !rows.some(row => row.id === local.id))];
      setHistory(merged);
    } catch {
      setHistory(localRows);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    toeicSnapshot = {
      userId,
      partSet,
      questionCount,
      title,
      questions,
      responses,
      score,
      startedAt,
      sessionId,
      history,
    };
  }, [history, partSet, questionCount, questions, responses, score, sessionId, startedAt, title, userId]);

  const savePracticeHistory = async (
    nextTitle: string,
    nextQuestions: ToeicQuestion[],
    nextResponses: Record<string, number> = {},
    nextScore: ToeicScoreResponse["data"] | null = null,
    targetSessionId = sessionId,
  ) => {
    const now = new Date().toISOString();
    const localId = targetSessionId || `local-toeic-${Date.now()}`;
    const localItem: ToeicHistorySession = {
      id: localId,
      title: nextTitle,
      created_at: history.find(item => item.id === localId)?.created_at || now,
      updated_at: now,
      payload: {
        title: nextTitle,
        questions: nextQuestions,
        responses: nextResponses,
        score: nextScore,
        setup: { partSet, questionCount },
      },
    };
    const localRows = [localItem, ...readLocalToeicHistory().filter(item => item.id !== localId)];
    writeLocalToeicHistory(localRows);
    setHistory(prev => [localItem, ...prev.filter(item => item.id !== localId)]);

    if (!getAccessToken()) return localId;

    const payload = {
      user_id: getCurrentUserId(),
      kind: "toeic_practice",
      title: nextTitle,
      payload: {
        title: nextTitle,
        questions: nextQuestions,
        responses: nextResponses,
        score: nextScore,
        setup: {
          partSet,
          questionCount,
        },
      },
    };

    try {
      const rows = targetSessionId && !targetSessionId.startsWith("local-")
        ? await supabasePatch<any>("sessions", { id: `eq.${targetSessionId}`, user_id: `eq.${userId}` }, payload)
        : await supabaseInsert<any>("sessions", payload);
      const savedId = rows[0]?.id || localId;
      setSessionId(savedId);
      await loadHistory();
      return savedId;
    } catch {
      return localId;
    }
  };

  const openHistoryItem = (item: ToeicHistorySession) => {
    const payload = item.payload || {};
    const savedQuestions = Array.isArray(payload.questions) ? payload.questions : [];
    if (!savedQuestions.length) return;
    setSessionId(item.id);
    setTitle(payload.title || item.title || "TOEIC Mini Practice");
    setQuestions(savedQuestions);
    setResponses(payload.responses || {});
    setScore(payload.score || null);
    if (payload.setup?.partSet) setPartSet(payload.setup.partSet);
    if (payload.setup?.questionCount) setQuestionCount(payload.setup.questionCount);
    setStartedAt(Date.now());
    setError("");
  };

  const formatHistoryTime = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const generatePractice = async () => {
    setLoading(true);
    setError("");
    setScore(null);
    setResponses({});
    try {
      const parts = partSet.split(",").map(Number);
      const response = await backendPost<ToeicGenerateResponse>("/api/toeic/generate", {
        user_id: getCurrentUserId(),
        mode: "mini",
        parts,
        question_count: questionCount,
        difficulty: 2,
        topic: "workplace English",
        variation_seed: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        use_ai_generation: true,
      });
      const nextQuestions = response.data?.questions || [];
      const nextTitle = response.data?.title || "TOEIC Mini Practice";
      setTitle(nextTitle);
      setQuestions(nextQuestions);
      setStartedAt(Date.now());
      setSessionId(await savePracticeHistory(nextTitle, nextQuestions, {}, null, ""));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể tạo đề TOEIC lúc này. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  const submitPractice = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await backendPost<ToeicScoreResponse>("/api/toeic/score", {
        user_id: getCurrentUserId(),
        questions,
        responses,
        elapsed_seconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined,
        use_ai_feedback: true,
      });
      setScore(response.data || null);
      await savePracticeHistory(title, questions, responses, response.data || null);
      try {
        await supabaseInsert("xp_events", {
          user_id: getCurrentUserId(),
          event_type: "mock_test_submitted",
          xp: 75,
          metadata: {
            module: "toeic",
            score: response.data?.score,
            percent: response.data?.percent,
          },
        });
      } catch {
        // XP logging should not block scoring feedback.
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể chấm bài TOEIC lúc này. Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>TOEIC</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>
            Generate timed TOEIC-style practice, submit answers, and review weak parts.
          </p>
        </div>
        <button
          onClick={generatePractice}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-70"
          style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Generate practice
        </button>
      </div>

      {error && (
        <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="w-11 h-11 rounded-xl mb-4 flex items-center justify-center" style={{ background: "#D8F3DC" }}>
              <Award size={21} style={{ color: "#2D6A4F" }} />
            </div>
            <h2 className="text-foreground font-semibold mb-4" style={{ fontSize: "1rem" }}>Practice Setup</h2>
            <label className="block mb-3">
              <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>TOEIC part</span>
              <select
                value={partSet}
                onChange={event => setPartSet(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-white"
              >
                {PART_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Questions</span>
              <input
                type="number"
                min={1}
                max={40}
                value={questionCount}
                onChange={event => setQuestionCount(Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none"
              />
            </label>
          </div>

          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <History size={16} style={{ color: "#2D6A4F" }} />
                <h2 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>Generated History</h2>
              </div>
              <span className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>{history.length} saved</span>
            </div>
            {history.length === 0 ? (
              <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
                Generated TOEIC sets will appear here after you sign in.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {history.map(item => {
                  const count = item.payload?.questions?.length || 0;
                  const savedScore = item.payload?.score;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openHistoryItem(item)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted ${item.id === sessionId ? "border-primary bg-primary/5" : "border-border bg-white"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-foreground truncate" style={{ fontSize: "0.8125rem", fontWeight: 700 }}>
                          {item.title || item.payload?.title || "TOEIC Practice"}
                        </p>
                        <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: "0.6875rem" }}>
                          {formatHistoryTime(item.created_at)}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem" }}>
                        {count} questions{savedScore ? ` · ${savedScore.correct_count}/${savedScore.question_count} correct` : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-border p-4">
              <FileText size={16} style={{ color: "#2D6A4F" }} />
              <div className="text-foreground mt-2" style={{ fontSize: "1.125rem", fontWeight: 800 }}>{questions.length}</div>
              <div className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>Questions</div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <Clock size={16} style={{ color: "#2D6A4F" }} />
              <div className="text-foreground mt-2" style={{ fontSize: "1.125rem", fontWeight: 800 }}>{answeredCount}</div>
              <div className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>Answered</div>
            </div>
          </div>

          {score && (
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 text-primary mb-2">
                <CheckCircle2 size={17} />
                <span className="font-semibold" style={{ fontSize: "0.875rem" }}>Result</span>
              </div>
              <div className="text-foreground" style={{ fontSize: "2rem", fontWeight: 850 }}>{score.score}</div>
              <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
                {score.correct_count}/{score.question_count} correct · {score.percent}%
              </p>
            </div>
          )}
        </aside>

        <main className="bg-white rounded-2xl border border-border p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h2 className="text-foreground font-semibold" style={{ fontSize: "1rem" }}>{title}</h2>
              <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
                {questions.length ? "Choose one answer per question, then submit for scoring." : "Generate a practice set to begin."}
              </p>
            </div>
            {questions.length > 0 && (
              <button
                onClick={submitPractice}
                disabled={submitting || answeredCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-60"
                style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Submit
              </button>
            )}
          </div>

          {questions.length === 0 ? (
            <div className="rounded-2xl bg-muted p-8 text-center">
              <Award size={26} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground" style={{ fontSize: "0.875rem" }}>
                No fake TOEIC data here. Generate a real practice set through the M14 backend API.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => {
                const result = scoreByQuestion.get(question.id);
                return (
                  <section key={question.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-primary font-semibold" style={{ fontSize: "0.8125rem" }}>
                        Part {question.part} · Question {index + 1}
                      </span>
                      {result && (
                        <span
                          className="rounded-full px-2 py-1"
                          style={{
                            background: result.correct ? "#D8F3DC" : "#FEE2E2",
                            color: result.correct ? "#2D6A4F" : "#991B1B",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                          }}
                        >
                          {result.correct ? "Correct" : "Review"}
                        </span>
                      )}
                    </div>
                    {question.passage && (
                      <p className="rounded-xl bg-muted p-3 mb-3 text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
                        {question.passage}
                      </p>
                    )}
                    {question.audio_script && (
                      <p className="rounded-xl bg-muted p-3 mb-3 text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
                        Audio script: {question.audio_script}
                      </p>
                    )}
                    <p className="text-foreground mb-3" style={{ fontSize: "0.9375rem", fontWeight: 650 }}>
                      {question.prompt}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(question.choices || []).map((choice, choiceIndex) => (
                        <button
                          key={`${question.id}-${choiceIndex}`}
                          onClick={() => setResponses(prev => ({ ...prev, [question.id]: choiceIndex }))}
                          className="rounded-xl border px-3 py-2 text-left"
                          style={{
                            borderColor: responses[question.id] === choiceIndex ? "#2D6A4F" : undefined,
                            background: responses[question.id] === choiceIndex ? "#E8F5EE" : "white",
                            fontSize: "0.8125rem",
                          }}
                        >
                          {String.fromCharCode(65 + choiceIndex)}. {choice}
                        </button>
                      ))}
                    </div>
                    {result?.explanation && (
                      <p className="mt-3 text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
                        {result.explanation}
                      </p>
                    )}
                  </section>
                );
              })}
              <button
                onClick={() => {
                  setQuestions([]);
                  setResponses({});
                  setScore(null);
                  setSessionId("");
                  setError("");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-muted-foreground hover:text-foreground"
                style={{ fontSize: "0.8125rem" }}
              >
                <RotateCcw size={15} />
                Reset practice
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
