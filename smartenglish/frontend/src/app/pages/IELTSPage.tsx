import { useMemo, useState } from "react";
import { CheckCircle2, GraduationCap, Loader2, Mic, PenLine, RotateCcw, Sparkles } from "lucide-react";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage, supabaseInsert } from "../lib/api";

type IeltsSkill = "listening" | "reading" | "writing" | "speaking";

type IeltsTask = {
  id: string;
  skill: IeltsSkill;
  task_type: string;
  title: string;
  prompt: string;
  passage?: string;
  transcript?: string;
  choices?: string[];
  answer?: { correctIndex?: number };
  rubric?: string[];
  time_limit_minutes?: number;
  min_words?: number;
};

type GenerateResponse = {
  data?: {
    title?: string;
    tasks?: IeltsTask[];
  };
};

type ScoreResponse = {
  data?: {
    overall_band: number;
    skill_bands: Record<string, number>;
    results: Array<{
      task_id: string;
      skill: IeltsSkill;
      correct?: boolean | null;
      band: number;
      word_count?: number;
      feedback?: string;
    }>;
    recommendation?: string;
  };
};

const SKILL_OPTIONS: Array<{ value: IeltsSkill; label: string }> = [
  { value: "listening", label: "Listening" },
  { value: "reading", label: "Reading" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" },
];

function skillIcon(skill: IeltsSkill) {
  if (skill === "writing") return PenLine;
  if (skill === "speaking") return Mic;
  return GraduationCap;
}

export function IELTSPage() {
  const [skills, setSkills] = useState<IeltsSkill[]>(["reading", "writing"]);
  const [topic, setTopic] = useState("daily learning habits");
  const [targetBand, setTargetBand] = useState(6.5);
  const [title, setTitle] = useState("IELTS Mini Mock");
  const [tasks, setTasks] = useState<IeltsTask[]>([]);
  const [responses, setResponses] = useState<Record<string, string | number>>({});
  const [score, setScore] = useState<ScoreResponse["data"] | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const answeredCount = useMemo(() => {
    return tasks.filter(task => String(responses[task.id] ?? "").trim()).length;
  }, [responses, tasks]);

  const resultByTask = useMemo(() => {
    const map = new Map<string, NonNullable<ScoreResponse["data"]>["results"][number]>();
    score?.results?.forEach(item => map.set(item.task_id, item));
    return map;
  }, [score]);

  const toggleSkill = (skill: IeltsSkill) => {
    setSkills(prev => {
      if (prev.includes(skill)) {
        return prev.length === 1 ? prev : prev.filter(item => item !== skill);
      }
      return [...prev, skill];
    });
  };

  const generateMock = async () => {
    setLoading(true);
    setError("");
    setScore(null);
    setResponses({});
    try {
      const response = await backendPost<GenerateResponse>("/api/ielts/generate", {
        user_id: getCurrentUserId(),
        mode: skills.length === 4 ? "full" : "mini",
        skills,
        question_count: Math.max(skills.length, 2),
        topic,
        target_band: targetBand,
        use_ai_generation: true,
      });
      setTitle(response.data?.title || "IELTS Mini Mock");
      setTasks(response.data?.tasks || []);
      setStartedAt(Date.now());
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể tạo IELTS mock lúc này. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  const submitMock = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await backendPost<ScoreResponse>("/api/ielts/score", {
        user_id: getCurrentUserId(),
        tasks,
        responses,
        elapsed_seconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined,
        use_ai_feedback: true,
      });
      setScore(response.data || null);
      try {
        await supabaseInsert("xp_events", {
          user_id: getCurrentUserId(),
          event_type: "mock_test_submitted",
          xp: 75,
          metadata: {
            module: "ielts",
            overall_band: response.data?.overall_band,
            skill_bands: response.data?.skill_bands,
          },
        });
      } catch {
        // XP logging should not block band feedback.
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể chấm IELTS mock lúc này. Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>IELTS</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>
            Generate IELTS mini/full mock tasks, submit answers, and estimate band by skill.
          </p>
        </div>
        <button
          onClick={generateMock}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-70"
          style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Generate mock
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
              <GraduationCap size={21} style={{ color: "#2D6A4F" }} />
            </div>
            <h2 className="text-foreground font-semibold mb-4" style={{ fontSize: "1rem" }}>Mock Setup</h2>
            <label className="block mb-3">
              <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Topic</span>
              <input
                value={topic}
                onChange={event => setTopic(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none"
              />
            </label>
            <label className="block mb-4">
              <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Target band</span>
              <input
                type="number"
                min={4}
                max={9}
                step={0.5}
                value={targetBand}
                onChange={event => setTargetBand(Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SKILL_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleSkill(option.value)}
                  className="rounded-xl border px-3 py-2 text-left"
                  style={{
                    borderColor: skills.includes(option.value) ? "#2D6A4F" : undefined,
                    background: skills.includes(option.value) ? "#E8F5EE" : "white",
                    fontSize: "0.8125rem",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {score && (
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 text-primary mb-2">
                <CheckCircle2 size={17} />
                <span className="font-semibold" style={{ fontSize: "0.875rem" }}>Band Estimate</span>
              </div>
              <div className="text-foreground" style={{ fontSize: "2rem", fontWeight: 850 }}>{score.overall_band}</div>
              <div className="mt-3 space-y-2">
                {Object.entries(score.skill_bands || {}).map(([skill, band]) => (
                  <div key={skill} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                    <span className="capitalize text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{skill}</span>
                    <span className="text-primary font-semibold" style={{ fontSize: "0.8125rem" }}>{band}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="bg-white rounded-2xl border border-border p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h2 className="text-foreground font-semibold" style={{ fontSize: "1rem" }}>{title}</h2>
              <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
                {tasks.length ? `${answeredCount}/${tasks.length} tasks answered` : "Generate an IELTS mock to begin."}
              </p>
            </div>
            {tasks.length > 0 && (
              <button
                onClick={submitMock}
                disabled={submitting || answeredCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-60"
                style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Submit mock
              </button>
            )}
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-2xl bg-muted p-8 text-center">
              <GraduationCap size={26} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground" style={{ fontSize: "0.875rem" }}>
                No fake IELTS data here. Generate a real mock through the M15 backend API.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task, index) => {
                const Icon = skillIcon(task.skill);
                const result = resultByTask.get(task.id);
                const isObjective = Array.isArray(task.choices) && task.choices.length > 0;
                return (
                  <section key={task.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Icon size={16} style={{ color: "#2D6A4F" }} />
                        <span className="text-primary font-semibold capitalize" style={{ fontSize: "0.8125rem" }}>
                          {task.skill} · Task {index + 1}
                        </span>
                      </div>
                      {result && (
                        <span className="rounded-full px-2 py-1" style={{ background: "#D8F3DC", color: "#2D6A4F", fontSize: "0.7rem", fontWeight: 700 }}>
                          Band {result.band}
                        </span>
                      )}
                    </div>
                    {task.passage && (
                      <p className="rounded-xl bg-muted p-3 mb-3 text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
                        {task.passage}
                      </p>
                    )}
                    {task.transcript && (
                      <p className="rounded-xl bg-muted p-3 mb-3 text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
                        Transcript: {task.transcript}
                      </p>
                    )}
                    <p className="text-foreground mb-3" style={{ fontSize: "0.9375rem", fontWeight: 650 }}>{task.prompt}</p>

                    {isObjective ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {task.choices?.map((choice, choiceIndex) => (
                          <button
                            key={choice}
                            onClick={() => setResponses(prev => ({ ...prev, [task.id]: choiceIndex }))}
                            className="rounded-xl border px-3 py-2 text-left"
                            style={{
                              borderColor: responses[task.id] === choiceIndex ? "#2D6A4F" : undefined,
                              background: responses[task.id] === choiceIndex ? "#E8F5EE" : "white",
                              fontSize: "0.8125rem",
                            }}
                          >
                            {String.fromCharCode(65 + choiceIndex)}. {choice}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={String(responses[task.id] || "")}
                        onChange={event => setResponses(prev => ({ ...prev, [task.id]: event.target.value }))}
                        rows={task.skill === "speaking" ? 5 : 9}
                        placeholder={task.skill === "speaking" ? "Type or paste your speaking transcript..." : "Write your answer..."}
                        className="w-full rounded-xl border border-border px-3 py-3 outline-none"
                        style={{ fontSize: "0.875rem", lineHeight: 1.65 }}
                      />
                    )}

                    {result?.feedback && (
                      <p className="mt-3 text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
                        {result.feedback}
                      </p>
                    )}
                  </section>
                );
              })}
              {score?.recommendation && (
                <div className="rounded-2xl bg-muted p-4 text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
                  {score.recommendation}
                </div>
              )}
              <button
                onClick={() => {
                  setTasks([]);
                  setResponses({});
                  setScore(null);
                  setError("");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-muted-foreground hover:text-foreground"
                style={{ fontSize: "0.8125rem" }}
              >
                <RotateCcw size={15} />
                Reset mock
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
