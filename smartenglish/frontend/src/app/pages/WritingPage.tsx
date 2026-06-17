import { useEffect, useState } from "react";
import { Bot, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";

export function WritingPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskId, setTaskId] = useState("");
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabaseSelect<any>("writing_tasks", { select: "*", published: "eq.true", order: "created_at.desc" })
      .then(rows => {
        setTasks(rows);
        setTaskId(rows[0]?.id || "");
      })
      .catch(err => setError(getFriendlyErrorMessage(err, "Không thể tải đề writing. Vui lòng thử lại.")));
  }, []);

  const task = tasks.find(item => item.id === taskId);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const data = feedback?.data || {};
  const overall = data.overall_band || data.score || data.total_score || "";

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await backendPost<any>("/api/writing/grade", {
        user_id: getCurrentUserId(),
        prompt: task?.prompt || task?.title || "Writing task",
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
          <div className="w-80 border-l border-border overflow-y-auto bg-white">
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
                <pre className="whitespace-pre-wrap text-muted-foreground" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>{feedback.output}</pre>
              </div>

              {Array.isArray(data.suggestions) && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb size={13} style={{ color: "#52B788" }} />
                    <h4 className="text-foreground font-semibold" style={{ fontSize: "0.8125rem" }}>Improvement Tips</h4>
                  </div>
                  <div className="space-y-2">
                    {data.suggestions.map((s: string, i: number) => (
                      <div key={i} className="flex gap-2 p-2.5 rounded-lg" style={{ background: "#F0FAF4" }}>
                        <CheckCircle size={13} style={{ color: "#52B788", flexShrink: 0, marginTop: "1px" }} />
                        <p style={{ fontSize: "0.75rem", color: "#1F2937", lineHeight: 1.5 }}>{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
