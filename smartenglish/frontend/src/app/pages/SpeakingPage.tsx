import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, RotateCcw, ChevronRight, Bot, Loader2, MessageCircle, Square, Play, Wand2 } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";

const TABS = ["Practice", "Roleplay"];

let speakingSnapshot: any = null;

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseAiText(value: unknown): any {
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

function scoreValue(...values: unknown[]) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function FeedbackBlocks({ feedback }: { feedback: any }) {
  const parsed = parseAiText(feedback?.output);
  const data = typeof parsed === "object" && parsed ? parsed : {};
  const text = typeof parsed === "string" ? parsed : "";
  const corrections = asArray(data.corrections || data.sentence_corrections || data.errors);
  const nextDrill = data.next_drill || data.nextDrill || data.practice_plan;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted p-3">
        <p className="text-primary font-semibold mb-1" style={{ fontSize: "0.75rem" }}>Summary</p>
        <p className="text-muted-foreground whitespace-pre-line" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
          {firstText(data.feedback, data.summary, data.overall_feedback, text) || "Feedback received. Review the scores and generate a drill for focused practice."}
        </p>
      </div>
      {corrections.length > 0 && (
        <div className="rounded-xl bg-white border border-border p-3">
          <p className="text-primary font-semibold mb-2" style={{ fontSize: "0.75rem" }}>Corrections</p>
          <div className="space-y-2">
            {corrections.slice(0, 4).map((item: any, index: number) => (
              <div key={index} className="rounded-lg bg-muted p-2 text-muted-foreground" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
                {typeof item === "string" ? item : firstText(item.issue, item.original, item.correction, item.suggestion, JSON.stringify(item))}
              </div>
            ))}
          </div>
        </div>
      )}
      {nextDrill && (
        <div className="rounded-xl p-3" style={{ background: "#F0FAF4" }}>
          <p className="text-primary font-semibold mb-1" style={{ fontSize: "0.75rem" }}>Next drill</p>
          <p className="text-foreground whitespace-pre-line" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
            {typeof nextDrill === "string" ? nextDrill : JSON.stringify(nextDrill, null, 2)}
          </p>
        </div>
      )}
    </div>
  );
}

export function SpeakingPage() {
  const [prompts, setPrompts] = useState<any[]>(speakingSnapshot?.prompts || []);
  const [promptId, setPromptId] = useState(speakingSnapshot?.promptId || "");
  const [transcript, setTranscript] = useState(speakingSnapshot?.transcript || "");
  const [feedback, setFeedback] = useState<any | null>(speakingSnapshot?.feedback || null);
  const [drill, setDrill] = useState(speakingSnapshot?.drill || "");
  const [activeTab, setActiveTab] = useState(speakingSnapshot?.activeTab || "Practice");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(speakingSnapshot?.audioBlob || null);
  const [audioUrl, setAudioUrl] = useState("");
  const [roleplayInput, setRoleplayInput] = useState(speakingSnapshot?.roleplayInput || "");
  const [roleplayMessages, setRoleplayMessages] = useState<any[]>(speakingSnapshot?.roleplayMessages || []);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    supabaseSelect<any>("speaking_prompts", { select: "*", published: "eq.true", order: "created_at.desc" })
      .then(rows => {
        setPrompts(rows);
        setPromptId(prev => prev || rows[0]?.id || "");
      })
      .catch(err => setError(getFriendlyErrorMessage(err, "Could not load speaking prompts. Please try again.")));
  }, []);

  useEffect(() => {
    speakingSnapshot = {
      prompts,
      promptId,
      transcript,
      feedback,
      drill,
      activeTab,
      audioBlob,
      roleplayInput,
      roleplayMessages,
    };
  }, [activeTab, audioBlob, drill, feedback, promptId, prompts, roleplayInput, roleplayMessages, transcript]);

  useEffect(() => {
    if (!audioBlob || audioUrl) return;
    const nextUrl = URL.createObjectURL(audioBlob);
    setAudioUrl(nextUrl);
  }, [audioBlob, audioUrl]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
    };
  }, [audioUrl]);

  const prompt = prompts.find(item => item.id === promptId);
  const parsedOutput = parseAiText(feedback?.output);
  const aiData = typeof parsedOutput === "object" && parsedOutput ? parsedOutput : {};
  const data = { ...(feedback?.data || {}), ...aiData };
  const radarData = useMemo(() => [
    { subject: "Pronunciation", score: scoreValue(data.pronunciation_score, data.pronunciation, data.pronunciationScore) },
    { subject: "Fluency", score: scoreValue(data.fluency_score, data.fluency, data.fluencyScore) },
    { subject: "Vocabulary", score: scoreValue(data.vocabulary_score, data.vocabulary, data.vocabularyScore) },
    { subject: "Coherence", score: scoreValue(data.coherence_score, data.coherence, data.coherenceScore) },
    { subject: "Overall", score: scoreValue(data.overall_score, data.overall, data.score) },
  ], [data]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording is not available in this browser.");
      return;
    }
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferredMimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    const recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      stream.getTracks().forEach(track => track.stop());
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const evaluate = async () => {
    if (!prompt || (!transcript.trim() && !audioBlob)) return;
    setLoading("evaluate");
    setError("");
    try {
      const audioBase64 = audioBlob ? await blobToBase64(audioBlob) : undefined;
      const response = await backendPost<any>("/api/speaking/evaluate", {
        user_id: getCurrentUserId(),
        prompt: prompt.prompt || prompt.title,
        learner_transcript: transcript || undefined,
        audio_base64: audioBase64,
        audio_mime_type: audioBlob?.type,
        learner_level: prompt.level,
        task_type: prompt.task_type || "short_answer",
        use_ai_feedback: true,
      });
      setFeedback(response);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not transcribe or evaluate this recording. Please try a shorter recording, or type the transcript manually and submit again."));
    } finally {
      setLoading("");
    }
  };

  const generateDrill = async (drillType: "pronunciation" | "fluency" | "intonation" = "pronunciation") => {
    const targetText = transcript.trim() || prompt?.prompt || "";
    if (!targetText) return;
    setLoading("drill");
    try {
      const response = await backendPost<any>("/api/speaking/drill", {
        user_id: getCurrentUserId(),
        target_text: targetText,
        learner_level: prompt?.level,
        issue_summary: feedback?.output || "",
        drill_type: drillType,
      });
      setDrill(response.output);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not create a speaking drill right now. Please try again later."));
    } finally {
      setLoading("");
    }
  };

  const sendRoleplay = async () => {
    const content = roleplayInput.trim();
    if (!content && roleplayMessages.length) return;
    setLoading("roleplay");
    setError("");
    const nextMessages = content ? [...roleplayMessages, { role: "user", content }] : roleplayMessages;
    setRoleplayMessages(nextMessages);
    setRoleplayInput("");
    try {
      const response = await backendPost<any>("/api/speaking/roleplay", {
        user_id: getCurrentUserId(),
        scenario: prompt?.prompt || prompt?.title || "Everyday English conversation practice",
        learner_level: prompt?.level,
        persona: "friendly English conversation partner and concise speaking coach",
        messages: nextMessages.length ? nextMessages : [{ role: "user", content: "Please start the roleplay." }],
        mode: "coach",
      });
      setRoleplayMessages([...nextMessages, { role: "assistant", content: response.output }]);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not continue roleplay right now. Please try again later."));
    } finally {
      setLoading("");
    }
  };

  const resetAttempt = () => {
    setFeedback(null);
    setTranscript("");
    setDrill("");
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Speaking Practice</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Record, evaluate, drill, and roleplay with AI feedback</p>
        </div>
        <button onClick={resetAttempt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground" style={{ fontSize: "0.8125rem" }}>
          <RotateCcw size={13} /> New Attempt
        </button>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-full border whitespace-nowrap transition-all ${activeTab === tab ? "text-white border-primary" : "text-muted-foreground border-border bg-white"}`} style={{ fontSize: "0.8125rem", background: activeTab === tab ? "#2D6A4F" : "white" }}>
            {tab}
          </button>
        ))}
      </div>

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

      {activeTab === "Roleplay" ? (
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={16} style={{ color: "#2D6A4F" }} />
            <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Roleplay Coach</h3>
          </div>
          <div className="space-y-3 mb-4 max-h-[420px] overflow-y-auto">
            {roleplayMessages.length === 0 ? (
              <div className="rounded-xl bg-muted p-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>Start the roleplay or ask the AI to open the scene.</div>
            ) : roleplayMessages.map((message, index) => (
              <div key={index} className={`rounded-xl p-3 ${message.role === "user" ? "bg-primary/5 ml-8" : "bg-muted mr-8"}`}>
                <p className="text-primary font-semibold mb-1" style={{ fontSize: "0.72rem" }}>{message.role === "user" ? "You" : "AI Coach"}</p>
                <p className="text-foreground whitespace-pre-line" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>{message.content}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <textarea value={roleplayInput} onChange={event => setRoleplayInput(event.target.value)} className="min-h-24 rounded-xl border border-border p-3 outline-none" placeholder="Reply in English..." style={{ fontSize: "0.875rem", lineHeight: 1.6 }} />
            <div className="flex sm:flex-col gap-2">
              <button onClick={sendRoleplay} disabled={loading === "roleplay"} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}>
                {loading === "roleplay" ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                Send
              </button>
              <button onClick={() => { setRoleplayMessages([]); setRoleplayInput(""); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-muted-foreground hover:bg-muted" style={{ fontSize: "0.8125rem" }}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Mic size={16} style={{ color: "#2D6A4F" }} />
              <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Attempt</h3>
            </div>
            <div className="rounded-xl border border-border p-3 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={recording ? stopRecording : startRecording} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-white" style={{ background: recording ? "#EF476F" : "#2D6A4F", fontSize: "0.8125rem" }}>
                  {recording ? <Square size={14} /> : <Mic size={14} />}
                  {recording ? "Stop" : "Record"}
                </button>
                {audioUrl && (
                  <audio controls src={audioUrl} className="min-w-0 flex-1" />
                )}
              </div>
            </div>
            <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Type or paste what you said. If you record audio, transcript can be left empty." className="w-full min-h-48 border border-border rounded-xl p-3 outline-none" style={{ fontSize: "0.875rem", lineHeight: 1.6 }} />
            <button disabled={loading === "evaluate" || (!transcript.trim() && !audioBlob)} onClick={evaluate} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}>
              {loading === "evaluate" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {loading === "evaluate" ? "Evaluating..." : "Evaluate Speaking"}
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
                  <FeedbackBlocks feedback={feedback} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["pronunciation", "fluency", "intonation"] as const).map(type => (
                      <button key={type} onClick={() => generateDrill(type)} disabled={loading === "drill"} className="rounded-xl px-3 py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.75rem" }}>
                        {type}
                      </button>
                    ))}
                  </div>
                  {drill && <pre className="mt-3 whitespace-pre-wrap rounded-xl p-3" style={{ background: "#F0FAF4", fontSize: "0.75rem" }}>{drill}</pre>}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-border p-5">
                <h3 className="text-foreground font-semibold mb-3" style={{ fontSize: "0.875rem" }}>Preparation Tips</h3>
                {["Use the prompt as your main idea", "Speak in complete sentences", "Add examples and reasons", "Record once, then submit for AI scoring"].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5 mb-3">
                    <ChevronRight size={15} style={{ color: "#52B788", marginTop: "2px", flexShrink: 0 }} />
                    <p className="text-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}>{tip}</p>
                  </div>
                ))}
                {audioUrl && (
                  <button onClick={() => audioUrl && new Audio(audioUrl).play()} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-muted-foreground hover:bg-muted" style={{ fontSize: "0.8125rem" }}>
                    <Play size={14} /> Preview recording
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
