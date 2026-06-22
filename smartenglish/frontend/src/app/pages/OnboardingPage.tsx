import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles, Target } from "lucide-react";
import { backendPost, getAccessToken, getCurrentUserId, getFriendlyErrorMessage, supabasePatch, supabaseSelect } from "../lib/api";

type PlacementQuestion = {
  id: string;
  skill: "grammar" | "vocabulary" | "reading";
  prompt: string;
  choices: string[];
  correct_index: number;
  explanation?: string;
};

type PlacementTest = {
  title: string;
  estimatedMinutes: number;
  instructions: string;
  questions: PlacementQuestion[];
  provider?: string;
  model?: string;
};

type PlacementResult = {
  level: string;
  score: number;
  total: number;
  percent: number;
  breakdown: Record<string, { correct: number; total: number }>;
  review: {
    id: string;
    skill: "grammar" | "vocabulary" | "reading";
    correct: boolean;
    selectedIndex?: number;
    correctIndex: number;
    explanation?: string;
  }[];
  recommendation: string;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const GOALS = ["TOEIC", "IELTS", "COMMUNICATION"];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any | null>(null);
  const [form, setForm] = useState({ display_name: "", level: "B1", target_cert: "TOEIC" });
  const [mode, setMode] = useState<"profile" | "test" | "result">("profile");
  const [test, setTest] = useState<PlacementTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!getAccessToken()) {
      navigate("/auth");
      return;
    }
    supabaseSelect<any>("profiles", { select: "*", limit: 1 })
      .then(rows => {
        if (!mounted) return;
        const next = rows[0] || null;
        setProfile(next);
        setForm({
          display_name: next?.display_name || "",
          level: next?.level || "B1",
          target_cert: next?.target_cert || "TOEIC",
        });
      })
      .catch(err => {
        if (!getAccessToken()) {
          navigate("/auth", { replace: true });
          return;
        }
        setError(getFriendlyErrorMessage(err, "Không thể tải hồ sơ của bạn. Vui lòng thử lại."));
      });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const saveProfile = async (extra: Record<string, unknown> = {}) => {
    if (!profile?.id) throw new Error("Profile is not ready yet.");
    await supabasePatch("profiles", { id: `eq.${profile.id}` }, {
      display_name: form.display_name,
      level: form.level,
      target_cert: form.target_cert,
      onboarding_completed: true,
      ...extra,
    });
  };

  const finishWithoutTest = async () => {
    setLoading(true);
    setError("");
    try {
      await saveProfile();
      navigate("/dashboard");
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể lưu mục tiêu học tập. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  const startPlacement = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setAnswers({});
    try {
      const generated = await backendPost<PlacementTest>("/api/placement/generate", {
        user_id: getCurrentUserId(),
        target_cert: form.target_cert,
        preferred_level: form.level,
        question_count: 10,
      });
      setTest(generated);
      setMode("test");
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể tạo bài kiểm tra trình độ lúc này. Vui lòng thử lại sau."));
    } finally {
      setLoading(false);
    }
  };

  const submitPlacement = async () => {
    if (!test) return;
    setLoading(true);
    setError("");
    try {
      const next = await backendPost<PlacementResult>("/api/placement/submit", {
        user_id: getCurrentUserId(),
        target_cert: form.target_cert,
        questions: test.questions,
        answers,
      });
      setResult(next);
      setForm(prev => ({ ...prev, level: next.level }));
      await saveProfile({ level: next.level });
      setMode("result");
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể chấm bài kiểm tra lúc này. Vui lòng thử lại sau."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "#F8F9FA" }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: "#D8F3DC", color: "#2D6A4F", fontSize: "0.75rem", fontWeight: 700 }}>
            <Sparkles size={14} />
            First login setup
          </div>
          <h1 className="text-foreground mt-3" style={{ fontSize: "1.875rem", fontWeight: 800 }}>Set your learning goal</h1>
          <p className="text-muted-foreground mt-1" style={{ fontSize: "0.9375rem" }}>
            Choose your target first. Then you can take an AI-generated placement test to estimate your current CEFR level.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-border bg-white p-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
            {error}
          </div>
        )}

        {mode === "profile" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="text-foreground mb-4" style={{ fontSize: "1.125rem", fontWeight: 700 }}>Profile basics</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-foreground" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Display name</span>
                  <input value={form.display_name} onChange={e => setForm(prev => ({ ...prev, display_name: e.target.value }))} className="mt-1 w-full border border-border rounded-xl px-3 py-2" />
                </label>
                <label className="block">
                  <span className="text-foreground" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Your estimated level</span>
                  <select value={form.level} onChange={e => setForm(prev => ({ ...prev, level: e.target.value }))} className="mt-1 w-full border border-border rounded-xl px-3 py-2 bg-white">
                    {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-foreground" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Learning goal</span>
                  <select value={form.target_cert} onChange={e => setForm(prev => ({ ...prev, target_cert: e.target.value }))} className="mt-1 w-full border border-border rounded-xl px-3 py-2 bg-white">
                    {GOALS.map(goal => <option key={goal} value={goal}>{goal}</option>)}
                  </select>
                </label>
              </div>
              <button disabled={loading || !profile} onClick={finishWithoutTest} className="mt-6 w-full rounded-xl py-3 text-white disabled:opacity-60" style={{ background: "#2D6A4F" }}>
                {loading ? "Saving..." : "Save goal and enter dashboard"}
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "#F0FAF4", color: "#2D6A4F" }}>
                <Target size={20} />
              </div>
              <h2 className="text-foreground" style={{ fontSize: "1.125rem", fontWeight: 700 }}>AI placement test</h2>
              <p className="text-muted-foreground mt-2" style={{ fontSize: "0.875rem", lineHeight: 1.7 }}>
                SmartEnglish will ask AI to generate a short test for your selected goal, then estimate your current CEFR level from your answers.
              </p>
              <button disabled={loading || !profile} onClick={startPlacement} className="mt-6 w-full rounded-xl py-3 text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>
                {loading ? <Loader2 size={16} className="inline mr-2 animate-spin" /> : <Sparkles size={16} className="inline mr-2" />}
                Generate placement test
              </button>
            </div>
          </div>
        )}

        {mode === "test" && test && (
          <div className="rounded-2xl border border-border bg-white p-6">
            <button onClick={() => setMode("profile")} className="mb-4 inline-flex items-center gap-2 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
              <ArrowLeft size={14} /> Back to goal setup
            </button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-foreground" style={{ fontSize: "1.25rem", fontWeight: 800 }}>{test.title}</h2>
                <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>{test.instructions}</p>
              </div>
              <div className="rounded-xl px-3 py-2" style={{ background: "#F0FAF4", color: "#2D6A4F", fontSize: "0.8125rem", fontWeight: 700 }}>
                {answeredCount}/{test.questions.length} answered
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {test.questions.map((question, index) => (
                <div key={question.id} className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-lg px-2 py-1" style={{ background: "#D8F3DC", color: "#2D6A4F", fontSize: "0.7rem", fontWeight: 700 }}>
                      {question.skill}
                    </span>
                    <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Question {index + 1}</span>
                  </div>
                  <p className="text-foreground mb-3" style={{ fontSize: "0.9375rem", fontWeight: 650, lineHeight: 1.6 }}>{question.prompt}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {question.choices.map((choice, choiceIndex) => {
                      const active = answers[question.id] === choiceIndex;
                      return (
                        <button
                          key={choice}
                          onClick={() => setAnswers(prev => ({ ...prev, [question.id]: choiceIndex }))}
                          className="rounded-xl border px-3 py-2 text-left transition-colors"
                          style={{
                            borderColor: active ? "#2D6A4F" : "#E5E7EB",
                            background: active ? "#F0FAF4" : "white",
                            color: "#1F2937",
                            fontSize: "0.875rem",
                          }}
                        >
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button disabled={loading || answeredCount < test.questions.length} onClick={submitPlacement} className="mt-6 w-full rounded-xl py-3 text-white disabled:opacity-60" style={{ background: "#2D6A4F" }}>
              {loading ? "Scoring..." : "Submit test and save level"}
            </button>
          </div>
        )}

        {mode === "result" && result && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-white p-8 text-center">
              <CheckCircle2 size={42} className="mx-auto mb-4" style={{ color: "#2D6A4F" }} />
              <h2 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 800 }}>Your current level is {result.level}</h2>
              <p className="text-muted-foreground mt-2" style={{ fontSize: "0.9375rem" }}>
                Score: {result.score}/{result.total} ({result.percent}%)
              </p>
              <p className="text-muted-foreground mx-auto mt-4 max-w-xl" style={{ fontSize: "0.875rem", lineHeight: 1.7 }}>
                {result.recommendation}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button onClick={() => { setMode("profile"); setTest(null); setResult(null); setAnswers({}); }} className="rounded-xl border border-border px-6 py-3 text-foreground bg-white">
                  Change goal or retake
                </button>
                <button onClick={() => navigate("/dashboard")} className="rounded-xl px-6 py-3 text-white" style={{ background: "#2D6A4F" }}>
                  Continue to dashboard
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-foreground" style={{ fontSize: "1.125rem", fontWeight: 800 }}>Answer review</h3>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>
                    Review each question, your answer, the correct answer, and the explanation.
                  </p>
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
                  {test?.provider}{test?.model ? ` · ${test.model}` : ""}
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {test?.questions.map((question, index) => {
                  const item = result.review.find(review => review.id === question.id);
                  const selectedIndex = item?.selectedIndex;
                  const correctIndex = item?.correctIndex ?? question.correct_index;
                  const isCorrect = Boolean(item?.correct);
                  const selectedText = selectedIndex === undefined ? "No answer" : question.choices[selectedIndex] || "Invalid answer";
                  const correctText = question.choices[correctIndex] || "Unknown";
                  return (
                    <div key={question.id} className="rounded-xl border border-border p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg px-2 py-1" style={{ background: isCorrect ? "#D8F3DC" : "#FFF3EC", color: isCorrect ? "#2D6A4F" : "#C2410C", fontSize: "0.7rem", fontWeight: 800 }}>
                          {isCorrect ? "Correct" : "Review"}
                        </span>
                        <span className="rounded-lg px-2 py-1" style={{ background: "#F0FAF4", color: "#2D6A4F", fontSize: "0.7rem", fontWeight: 700 }}>
                          {question.skill}
                        </span>
                        <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Question {index + 1}</span>
                      </div>
                      <p className="text-foreground" style={{ fontSize: "0.9375rem", fontWeight: 650, lineHeight: 1.6 }}>{question.prompt}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl p-3" style={{ background: isCorrect ? "#F0FAF4" : "#FFF7ED" }}>
                          <div className="text-muted-foreground mb-1" style={{ fontSize: "0.75rem" }}>Your answer</div>
                          <div className="text-foreground" style={{ fontSize: "0.875rem", fontWeight: 650 }}>{selectedText}</div>
                        </div>
                        <div className="rounded-xl p-3" style={{ background: "#F0FAF4" }}>
                          <div className="text-muted-foreground mb-1" style={{ fontSize: "0.75rem" }}>Correct answer</div>
                          <div className="text-foreground" style={{ fontSize: "0.875rem", fontWeight: 650 }}>{correctText}</div>
                        </div>
                      </div>
                      {(item?.explanation || question.explanation) && (
                        <p className="text-muted-foreground mt-3" style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}>
                          {item?.explanation || question.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
