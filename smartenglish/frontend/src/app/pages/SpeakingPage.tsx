import { useEffect, useMemo, useState } from "react";
import { Mic, RotateCcw, ChevronRight } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";

export function SpeakingPage() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [promptId, setPromptId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<any | null>(null);
  const [drill, setDrill] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabaseSelect<any>("speaking_prompts", { select: "*", published: "eq.true", order: "created_at.desc" })
      .then(rows => {
        setPrompts(rows);
        setPromptId(rows[0]?.id || "");
      })
      .catch(err => setError(getFriendlyErrorMessage(err, "Không thể tải đề speaking. Vui lòng thử lại.")));
  }, []);

  const prompt = prompts.find(item => item.id === promptId);
  const data = feedback?.data || {};
  const radarData = useMemo(() => [
    { subject: "Pronunciation", score: Number(data.pronunciation_score || 0) },
    { subject: "Fluency", score: Number(data.fluency_score || 0) },
    { subject: "Vocabulary", score: Number(data.vocabulary_score || 0) },
    { subject: "Coherence", score: Number(data.coherence_score || 0) },
    { subject: "Overall", score: Number(data.overall_score || 0) },
  ], [data]);

  const evaluate = async () => {
    if (!prompt || !transcript.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await backendPost<any>("/api/speaking/evaluate", {
        user_id: getCurrentUserId(),
        prompt: prompt.prompt || prompt.title,
        learner_transcript: transcript,
        learner_level: prompt.level,
        task_type: prompt.task_type || "short_answer",
        use_ai_feedback: true,
      });
      setFeedback(response);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể chấm speaking lúc này. Vui lòng thử lại sau."));
    } finally {
      setLoading(false);
    }
  };

  const generateDrill = async () => {
    if (!transcript.trim()) return;
    try {
      const response = await backendPost<any>("/api/speaking/drill", {
        user_id: getCurrentUserId(),
        target_text: transcript,
        learner_level: prompt?.level,
        issue_summary: feedback?.output || "",
        drill_type: "pronunciation",
      });
      setDrill(response.output);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể tạo bài luyện speaking lúc này. Vui lòng thử lại sau."));
    }
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Speaking Practice</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>AI-powered transcript/audio assessment</p>
        </div>
        <button onClick={() => { setFeedback(null); setTranscript(""); setDrill(""); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground" style={{ fontSize: "0.8125rem" }}>
          <RotateCcw size={13} /> New Attempt
        </button>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <div className="bg-white rounded-2xl border border-border p-5 mb-6">
        <select value={promptId} onChange={e => setPromptId(e.target.value)} className="w-full border border-border rounded-xl px-3 py-2 mb-4 bg-white">
          {prompts.map(item => <option key={item.id} value={item.id}>{item.title || item.prompt}</option>)}
        </select>
        <div className="flex items-center gap-2 mb-3">
          <div className="px-2.5 py-0.5 rounded-full" style={{ background: "#D8F3DC" }}>
            <span style={{ fontSize: "0.75rem", color: "#2D6A4F", fontWeight: 500 }}>{prompt?.task_type || "Speaking Topic"}</span>
          </div>
          <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{prompt?.level || "Level not set"}</span>
        </div>
        <p className="text-foreground" style={{ fontSize: "1rem", fontWeight: 500, lineHeight: 1.6 }}>{prompt?.prompt || "No published speaking prompts found."}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Mic size={16} style={{ color: "#2D6A4F" }} />
            <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Learner Transcript</h3>
          </div>
          <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Paste or type what you said. Audio upload can call the same backend later." className="w-full min-h-48 border border-border rounded-xl p-3 outline-none" style={{ fontSize: "0.875rem", lineHeight: 1.6 }} />
          <button disabled={loading || !transcript.trim()} onClick={evaluate} className="mt-3 w-full rounded-xl py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}>
            {loading ? "Evaluating..." : "Evaluate Speaking"}
          </button>
        </div>

        <div className="space-y-4">
          {feedback ? (
            <>
              <div className="bg-white rounded-2xl border border-border p-5">
                <h3 className="text-foreground font-semibold mb-3" style={{ fontSize: "0.875rem" }}>Skill Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E8F5EE" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <Radar name="Score" dataKey="score" stroke="#2D6A4F" fill="#B7E4C7" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl border border-border p-5">
                <h3 className="text-foreground font-semibold mb-3" style={{ fontSize: "0.875rem" }}>AI Feedback</h3>
                <pre className="whitespace-pre-wrap text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>{feedback.output}</pre>
                <button onClick={generateDrill} className="mt-3 rounded-xl px-4 py-2 text-white" style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}>Generate Drill</button>
                {drill && <pre className="mt-3 whitespace-pre-wrap rounded-xl p-3" style={{ background: "#F0FAF4", fontSize: "0.75rem" }}>{drill}</pre>}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-border p-5">
              <h3 className="text-foreground font-semibold mb-3" style={{ fontSize: "0.875rem" }}>Preparation Tips</h3>
              {["Use the prompt as your main idea", "Speak in complete sentences", "Add examples and reasons", "Submit a transcript for AI scoring"].map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5 mb-3">
                  <ChevronRight size={15} style={{ color: "#52B788", marginTop: "2px", flexShrink: 0 }} />
                  <p className="text-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}>{tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
