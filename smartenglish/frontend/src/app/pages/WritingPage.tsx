import { useEffect, useState } from "react";
import { Bot, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";
import { readLocalWritingTasks } from "../lib/writingTasks";

let writingSnapshot: any = null;

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseFeedbackOutput(value: unknown): any {
  if (!value) return null;
  if (typeof value === "object") return value;
  const text = stripCodeFence(String(value));
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function scoreText(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number * 100) / 100) : "";
}

function WritingFeedbackView({ feedback }: { feedback: any }) {
  const parsed = parseFeedbackOutput(feedback?.output);
  const ai = typeof parsed === "object" && parsed ? parsed : {};
  const local = feedback?.data || {};
  const rubric = ai.rubric_breakdown || local.rubric_breakdown || {};
  const strengths = asArray(ai.strengths || local.strengths);
  const issues = asArray(ai.issues || ai.improvements || ai.weaknesses || local.issues);
  const suggestions = asArray(ai.suggestions || ai.next_steps || local.suggestions);
  const comments = asArray(ai.inline_comments || local.inline_comments);
  const revised = firstText(ai.revised_sample, ai.model_answer, ai.sample_revision, local.revised_sample);
  const summary = firstText(ai.overall_feedback, ai.feedback, ai.summary, typeof parsed === "string" ? parsed : "");

  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-xl bg-muted p-3">
          <p className="text-primary font-semibold mb-1" style={{ fontSize: "0.75rem" }}>Summary</p>
          <p className="text-muted-foreground whitespace-pre-line" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>{summary}</p>
        </div>
      )}

      {Object.keys(rubric).length > 0 && (
        <div>
          <h4 className="text-foreground font-semibold mb-2" style={{ fontSize: "0.8125rem" }}>Rubric Breakdown</h4>
          <div className="space-y-2">
            {Object.entries(rubric).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-foreground" style={{ fontSize: "0.75rem", fontWeight: 700 }}>{key.replace(/_/g, " ")}</span>
                  <span className="text-primary font-semibold" style={{ fontSize: "0.8125rem" }}>{scoreText(value)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%`, background: "#2D6A4F" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {strengths.length > 0 && (
        <div>
          <h4 className="text-foreground font-semibold mb-2" style={{ fontSize: "0.8125rem" }}>Strengths</h4>
          <div className="space-y-2">
            {strengths.map((item, index) => (
              <div key={index} className="flex gap-2 rounded-xl p-3" style={{ background: "#F0FAF4" }}>
                <CheckCircle size={14} style={{ color: "#2D6A4F", flexShrink: 0, marginTop: 2 }} />
                <p className="text-foreground" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>{String(item)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div>
          <h4 className="text-foreground font-semibold mb-2" style={{ fontSize: "0.8125rem" }}>Needs Work</h4>
          <div className="space-y-2">
            {issues.map((item, index) => (
              <div key={index} className="flex gap-2 rounded-xl p-3" style={{ background: "#FFF7ED" }}>
                <AlertCircle size={14} style={{ color: "#FF8C42", flexShrink: 0, marginTop: 2 }} />
                <p className="text-foreground" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>{String(item)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <h4 className="text-foreground font-semibold mb-2" style={{ fontSize: "0.8125rem" }}>Improvement Tips</h4>
          <div className="space-y-2">
            {suggestions.map((item, index) => (
              <div key={index} className="flex gap-2 p-3 rounded-xl" style={{ background: "#F0FAF4" }}>
                <Lightbulb size={14} style={{ color: "#52B788", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: "0.75rem", color: "#1F2937", lineHeight: 1.5 }}>{String(item)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {comments.length > 0 && (
        <div>
          <h4 className="text-foreground font-semibold mb-2" style={{ fontSize: "0.8125rem" }}>Inline Comments</h4>
          <div className="space-y-2">
            {comments.slice(0, 6).map((item, index) => (
              <div key={index} className="rounded-xl border border-border p-3">
                <p className="text-primary font-semibold" style={{ fontSize: "0.75rem" }}>{firstText(item.label, item.issue, `Comment ${index + 1}`)}</p>
                <p className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>{firstText(item.message, item.suggestion, JSON.stringify(item))}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {revised && (
        <div className="rounded-xl border border-border p-3">
          <h4 className="text-foreground font-semibold mb-2" style={{ fontSize: "0.8125rem" }}>Revised Sample</h4>
          <p className="text-muted-foreground whitespace-pre-line" style={{ fontSize: "0.75rem", lineHeight: 1.6 }}>{revised}</p>
        </div>
      )}
    </div>
  );
}

export function WritingPage() {
  const localTasks = readLocalWritingTasks();
  const snapshotTasks = writingSnapshot?.tasks || [];
  const initialTasks = [
    ...localTasks,
    ...snapshotTasks.filter((item: any) => !localTasks.some(local => local.id === item.id)),
  ];
  const [tasks, setTasks] = useState<any[]>(initialTasks);
  const [taskId, setTaskId] = useState(writingSnapshot?.taskId && initialTasks.some(item => item.id === writingSnapshot.taskId) ? writingSnapshot.taskId : initialTasks[0]?.id || "");
  const [text, setText] = useState(writingSnapshot?.text || "");
  const [feedback, setFeedback] = useState<any | null>(writingSnapshot?.feedback || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(writingSnapshot?.error || "");

  useEffect(() => {
    supabaseSelect<any>("writing_tasks", { select: "*", published: "eq.true", order: "created_at.desc" })
      .then(rows => {
        const localRows = readLocalWritingTasks();
        const merged = [
          ...localRows,
          ...rows.filter(row => !localRows.some(item => item.id === row.id)),
        ];
        setTasks(merged);
        setTaskId(prev => prev || merged[0]?.id || "");
      })
      .catch(err => {
        const localRows = readLocalWritingTasks();
        setTasks(prev => prev.length ? prev : localRows);
        setTaskId(prev => prev || localRows[0]?.id || "");
        setError(getFriendlyErrorMessage(err, "Không thể tải đề writing. Vui lòng thử lại."));
      });
  }, []);

  useEffect(() => {
    writingSnapshot = { tasks, taskId, text, feedback, error };
  }, [error, feedback, taskId, tasks, text]);

  const task = tasks.find(item => item.id === taskId);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const parsedFeedback = parseFeedbackOutput(feedback?.output);
  const aiData = typeof parsedFeedback === "object" && parsedFeedback ? parsedFeedback : {};
  const data = { ...(feedback?.data || {}), ...aiData };
  const overall = data.overall_band || data.score || data.total_score || data.total || "";

  const analyze = async () => {
    if (!text.trim()) return;
    if (wordCount < 20) {
      setError("Please write at least 20 words before asking AI to analyze your essay.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await backendPost<any>("/api/writing/grade", {
        user_id: getCurrentUserId(),
        prompt: task?.prompt || task?.title || "Writing task",
        content: text,
        essay: text,
        task_type: task?.task_type || "ielts_task_2",
        learner_level: task?.level,
        use_ai_feedback: true,
      });
      setFeedback(response);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể chấm bài writing lúc này. Vui lòng thử lại sau."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full pb-16 lg:pb-0 flex flex-col">
      <div className="px-6 py-4 bg-white border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>Writing</h1>
          <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>Published tasks and AI feedback</p>
        </div>
        <button onClick={analyze} disabled={loading || !text.trim()} className="px-4 py-2 rounded-lg text-white transition-all hover:shadow-md disabled:opacity-50" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)", fontSize: "0.8125rem" }}>
          <Bot size={14} className="inline mr-1.5" />
          {loading ? "Analyzing..." : "Analyze Essay"}
        </button>
      </div>

      <div className="px-6 py-3 border-b border-border" style={{ background: "#F0FAF4" }}>
        {error && <p className="text-muted-foreground mb-2" style={{ fontSize: "0.8125rem" }}>{error}</p>}
        <select value={taskId} onChange={e => setTaskId(e.target.value)} className="w-full border border-border rounded-xl px-3 py-2 bg-white mb-2">
          {tasks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <p className="text-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
          <strong>Task:</strong> {task?.prompt || "No published writing tasks found."}
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="flex-1 resize-none px-6 py-5 outline-none text-foreground"
            style={{ fontSize: "0.9375rem", lineHeight: 1.85, background: "white", fontFamily: "inherit" }}
            placeholder="Start writing your essay here..."
          />
          <div className="px-6 py-2 border-t border-border flex gap-4 text-muted-foreground bg-white" style={{ fontSize: "0.75rem" }}>
            <span>{wordCount} words</span>
            <span>{text.length} characters</span>
            {wordCount >= 250 && <span style={{ color: "#52B788" }}>Word count met</span>}
          </div>
        </div>

        {feedback && (
          <div className="w-96 max-w-[42vw] border-l border-border overflow-y-auto bg-white">
            <div className="p-4">
              <div className="rounded-xl p-4 mb-4 text-center" style={{ background: "linear-gradient(135deg, #D8F3DC, #B7E4C7)" }}>
                <div className="text-muted-foreground mb-0.5" style={{ fontSize: "0.75rem" }}>AI Score</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#2D6A4F" }}>{overall || "AI"}</div>
                <div className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{feedback.provider} · {feedback.model}</div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertCircle size={13} style={{ color: "#FF8C42" }} />
                  <h4 className="text-foreground font-semibold" style={{ fontSize: "0.8125rem" }}>Feedback</h4>
                </div>
                <WritingFeedbackView feedback={feedback} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
