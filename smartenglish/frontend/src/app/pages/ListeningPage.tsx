import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Play, Pause, Volume2, Headphones, Bot, BookOpen, CheckCircle2, Loader2, RotateCcw, Upload, Wand2 } from "lucide-react";
import { backendPost, ensureAccessToken, getCurrentUserId, getFriendlyErrorMessage, supabaseAnonKey, supabaseInsert, supabaseSelect, supabaseUrl } from "../lib/api";
import { SAMPLE_LISTENING_LESSONS } from "../data/sampleContent";

const MODES = ["Active Listening", "Dictation", "Shadowing", "Multiple Choice"];
const CREATOR_MODES = ["AI Generate", "Upload Audio"];
const CONTENT_KINDS = ["dialogue", "monologue", "story", "lecture", "interview"];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LISTENING_AUDIO_BUCKET = "listening-audio";

let listeningSnapshot: any = null;

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] || trimmed)
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
    const objectStart = text.indexOf("{");
    const objectEnd = text.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(text.slice(objectStart, objectEnd + 1));
      } catch {
        // Fall through to raw text.
      }
    }
    const arrayStart = text.indexOf("[");
    const arrayEnd = text.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(text.slice(arrayStart, arrayEnd + 1));
      } catch {
        // Fall through to raw text.
      }
    }
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

function normalizeQuestion(question: any, index: number) {
  const choices = asArray(question.choices || question.options).map(item => String(item));
  const answer = question.answer || question.answer_schema || {};
  const rawAnswer = question.correct_index
    ?? question.correctIndex
    ?? question.answer_index
    ?? question.answerIndex
    ?? answer.correctIndex
    ?? answer.correct_index
    ?? answer.value
    ?? answer.text
    ?? answer;
  const rawText = String(rawAnswer ?? "").trim();
  const correctIndex = typeof rawAnswer === "number"
    ? rawAnswer
    : /^\d+$/.test(rawText)
      ? Number(rawText)
      : /^[A-D]$/i.test(rawText)
        ? rawText.toUpperCase().charCodeAt(0) - 65
        : choices.findIndex(choice => choice.trim().toLowerCase() === rawText.toLowerCase());
  return {
    ...question,
    id: String(question.id || `listening-question-${index + 1}`),
    prompt: firstText(question.prompt, question.question, question.text) || `Question ${index + 1}`,
    question_type: question.question_type || question.type || (choices.length ? "mcq" : "short_answer"),
    choices,
    answer: {
      ...((answer && typeof answer === "object") ? answer : {}),
      ...(correctIndex >= 0 && correctIndex < choices.length ? { correctIndex } : {}),
      value: rawAnswer,
    },
    explanation: firstText(question.explanation, answer.explanation, question.reason),
    transcript_evidence: firstText(question.transcript_evidence, question.evidence),
    skill_focus: firstText(question.skill_focus, question.focus),
  };
}

function parseQuestions(response: any) {
  const parsed = parseAiText(response?.data || response?.output || response);
  const questions = Array.isArray(parsed) ? parsed : asArray(parsed?.questions || parsed?.items || parsed?.quiz);
  return questions.map(normalizeQuestion);
}

function plainQuizText(value: unknown) {
  const text = stripCodeFence(String(value || ""));
  return text.startsWith("{") || text.startsWith("[") ? "" : text;
}

function normalizeForCompare(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function answerLabel(question: any) {
  const value = question.answer?.correctIndex ?? question.answer?.correct_index ?? question.answer?.value ?? question.answer?.text ?? question.answer;
  const choices = asArray(question.choices);
  if (typeof value === "number" && choices[value]) return choices[value];
  if (/^\d+$/.test(String(value)) && choices[Number(value)]) return choices[Number(value)];
  return String(value ?? "");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeGeneratedListening(response: any, fallback: any) {
  const parsed = parseAiText(response?.data || response?.output || response) || {};
  const data = typeof parsed === "object" ? parsed : {};
  const transcript = firstText(data.transcript_text, data.transcript, data.body, data.content);
  const dialogue = asArray(data.dialogue_turns || data.dialogue);
  return {
    title: firstText(data.title) || `${fallback.level} ${fallback.topic} listening`,
    topic: firstText(data.topic) || fallback.topic,
    level: firstText(data.level, data.cefr_level) || fallback.level,
    content_kind: data.content_kind || fallback.contentKind,
    transcript_text: transcript,
    dialogue,
    audio_metadata: {
      key_vocabulary: asArray(data.key_vocabulary || data.vocabulary),
      listening_focus: data.listening_focus,
      dictation_segments: asArray(data.dictation_segments),
      shadowing_lines: asArray(data.shadowing_lines),
      tts_hints: data.tts_hints,
      generated: true,
    },
    generated: true,
  };
}

async function uploadListeningAudio(file: File, userId: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase config for audio upload.");
  }
  const token = await ensureAccessToken();
  if (!token) {
    throw new Error("Please sign in before uploading audio.");
  }
  const path = `${userId}/${Date.now()}-${safeFileName(file.name)}`;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${LISTENING_AUDIO_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!response.ok) {
    throw new Error("Could not upload audio. Please make sure the listening-audio storage bucket exists.");
  }
  return {
    path,
    url: `${supabaseUrl}/storage/v1/object/public/${LISTENING_AUDIO_BUCKET}/${path}`,
  };
}

export function ListeningPage() {
  const restoredRef = useRef(!!listeningSnapshot);
  const [lessons, setLessons] = useState<any[]>(listeningSnapshot?.lessons || SAMPLE_LISTENING_LESSONS);
  const [lesson, setLesson] = useState<any | null>(listeningSnapshot?.lesson || SAMPLE_LISTENING_LESSONS[0]);
  const [questions, setQuestions] = useState<any[]>(listeningSnapshot?.questions || []);
  const [playing, setPlaying] = useState(false);
  const [activeMode, setActiveMode] = useState(listeningSnapshot?.activeMode || "Active Listening");
  const [selectedVocab, setSelectedVocab] = useState<string | null>(listeningSnapshot?.selectedVocab || null);
  const [aiQuiz, setAiQuiz] = useState(listeningSnapshot?.aiQuiz || "");
  const [quizQuestions, setQuizQuestions] = useState<any[]>(listeningSnapshot?.quizQuestions || []);
  const [quizResponses, setQuizResponses] = useState<Record<string, any>>(listeningSnapshot?.quizResponses || {});
  const [quizScore, setQuizScore] = useState<any | null>(listeningSnapshot?.quizScore || null);
  const [dictationAnswers, setDictationAnswers] = useState<Record<number, string>>(listeningSnapshot?.dictationAnswers || {});
  const [dictationSubmitted, setDictationSubmitted] = useState(listeningSnapshot?.dictationSubmitted || false);
  const [showTranscript, setShowTranscript] = useState(listeningSnapshot?.showTranscript || false);
  const [creatorOpen, setCreatorOpen] = useState(listeningSnapshot?.creatorOpen || false);
  const [creatorMode, setCreatorMode] = useState(listeningSnapshot?.creatorMode || "AI Generate");
  const [aiForm, setAiForm] = useState(listeningSnapshot?.aiForm || { topic: "daily food conversations", level: "B1", contentKind: "dialogue", durationSeconds: 90, speakerCount: 2 });
  const [uploadForm, setUploadForm] = useState(listeningSnapshot?.uploadForm || { title: "", topic: "Uploaded Audio", level: "B1", contentKind: "monologue", transcript: "" });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listeningSnapshot = {
      lessons,
      lesson,
      questions,
      activeMode,
      selectedVocab,
      aiQuiz,
      quizQuestions,
      quizResponses,
      quizScore,
      dictationAnswers,
      dictationSubmitted,
      showTranscript,
      creatorOpen,
      creatorMode,
      aiForm,
      uploadForm,
    };
  }, [activeMode, aiForm, aiQuiz, creatorMode, creatorOpen, dictationAnswers, dictationSubmitted, lesson, lessons, questions, quizQuestions, quizResponses, quizScore, selectedVocab, showTranscript, uploadForm]);

  useEffect(() => {
    const userId = getCurrentUserId();
    const query = isUuid(userId)
      ? { select: "*", or: `(published.eq.true,owner_id.eq.${userId})`, order: "created_at.desc" }
      : { select: "*", published: "eq.true", order: "created_at.desc" };
    supabaseSelect<any>("listening_lessons", query)
      .then(rows => {
        const merged = [...rows, ...SAMPLE_LISTENING_LESSONS.filter(sample => !rows.some(row => row.id === sample.id))];
        setLessons(merged);
        setLesson(prev => prev ? merged.find(item => item.id === prev.id) || prev : merged[0] || null);
      })
      .catch(err => {
        setLessons(prev => prev.length ? prev : SAMPLE_LISTENING_LESSONS);
        setLesson(prev => prev || SAMPLE_LISTENING_LESSONS[0]);
        setError(getFriendlyErrorMessage(err, "Could not load listening lessons. Sample lessons are still available."));
      });
  }, []);

  useEffect(() => {
    if (!lesson?.id) return;
    if (restoredRef.current && listeningSnapshot?.lesson?.id === lesson.id) {
      restoredRef.current = false;
      return;
    }
    restoredRef.current = false;
    setQuizQuestions([]);
    setQuizResponses({});
    setQuizScore(null);
    setAiQuiz("");
    setDictationAnswers({});
    setDictationSubmitted(false);
    setShowTranscript(false);
    if (String(lesson.id).startsWith("sample-listening-")) {
      setQuestions(asArray(lesson.questions).map(normalizeQuestion));
      return;
    }
    supabaseSelect<any>("listening_questions", { select: "*", lesson_id: `eq.${lesson.id}`, published: "eq.true", order: "position.asc" })
      .then(rows => setQuestions(rows.map(normalizeQuestion)))
      .catch(err => {
        setQuestions(asArray(lesson.questions).map(normalizeQuestion));
        setError(getFriendlyErrorMessage(err, "Could not load listening questions. Please try again."));
      });
  }, [lesson?.id]);

  const transcript = lesson?.transcript_text || "";
  const turns = useMemo(() => {
    if (Array.isArray(lesson?.dialogue) && lesson.dialogue.length) return lesson.dialogue;
    return transcript.split(/(?<=[.!?])\s+/).filter(Boolean).map((text: string) => ({ speaker: "Audio", text }));
  }, [lesson, transcript]);

  const vocab = useMemo(() => {
    const saved = asArray(lesson?.key_vocabulary || lesson?.vocabulary || lesson?.audio_metadata?.key_vocabulary);
    if (saved.length) {
      return saved.slice(0, 8).map((item: any) => ({
        word: firstText(item.word, item.term, item.phrase) || String(item),
        meaning: firstText(item.meaning, item.definition, item.explanation) || "No explanation provided yet.",
        level: firstText(item.level, item.cefr) || lesson?.level || "B1",
      }));
    }
    const words = Array.from(new Set(transcript.toLowerCase().match(/[a-z]{6,}/g) || []));
    return words.slice(0, 6).map(word => ({ word, meaning: "Ask AI Tutor or add this word to flashcards for a full explanation.", level: lesson?.level || "B1" }));
  }, [transcript, lesson?.level, lesson?.key_vocabulary, lesson?.vocabulary, lesson?.audio_metadata]);

  const dictationSegments = useMemo(() => {
    const saved = asArray(lesson?.dictation_segments || lesson?.audio_metadata?.dictation_segments);
    const source = saved.length ? saved : turns.slice(0, 5).map((turn: any) => turn.text);
    return source.map((item: any) => typeof item === "string" ? item : firstText(item.text, item.line, item.sentence)).filter(Boolean).slice(0, 6);
  }, [lesson?.dictation_segments, lesson?.audio_metadata, turns]);

  const shadowingLines = useMemo(() => {
    const saved = asArray(lesson?.shadowing_lines || lesson?.audio_metadata?.shadowing_lines);
    const source = saved.length ? saved : turns.slice(0, 5).map((turn: any) => turn.text);
    return source.map((item: any) => typeof item === "string" ? item : firstText(item.text, item.line, item.sentence)).filter(Boolean).slice(0, 6);
  }, [lesson?.shadowing_lines, lesson?.audio_metadata, turns]);

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

  const playText = (text: string) => {
    if (!("speechSynthesis" in window)) {
      setError("Web Speech API is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };

  const addLessonToState = (nextLesson: any) => {
    setLessons(prev => [nextLesson, ...prev.filter(item => item.id !== nextLesson.id)]);
    setLesson(nextLesson);
    setCreatorOpen(false);
    setActiveMode("Active Listening");
    setShowTranscript(false);
  };

  const persistLesson = async (draft: any) => {
    const userId = getCurrentUserId();
    if (!isUuid(userId)) return null;
    const rows = await supabaseInsert<any>("listening_lessons", {
      owner_id: userId,
      title: draft.title,
      topic: draft.topic,
      level: draft.level,
      content_kind: draft.content_kind,
      transcript_text: draft.transcript_text,
      dialogue: asArray(draft.dialogue),
      audio_url: draft.audio_url || null,
      audio_storage_path: draft.audio_storage_path || null,
      audio_metadata: draft.audio_metadata || {},
      published: false,
    });
    return rows[0] || null;
  };

  const generateListeningLesson = async () => {
    setLoadingAction("generate-lesson");
    setError("");
    try {
      const response = await backendPost<any>("/api/listening/dialogue", {
        user_id: getCurrentUserId(),
        topic: aiForm.topic,
        learner_level: aiForm.level,
        content_kind: aiForm.contentKind,
        duration_seconds: Number(aiForm.durationSeconds) || 90,
        speaker_count: Number(aiForm.speakerCount) || 2,
      });
      const draft = normalizeGeneratedListening(response, aiForm);
      if (!draft.transcript_text) throw new Error("AI did not return a usable transcript. Please try another topic.");
      let saved = null;
      try {
        saved = await persistLesson(draft);
      } catch {
        // Local generated lessons are still useful when saving is unavailable.
      }
      addLessonToState({
        ...draft,
        ...(saved || {}),
        id: saved?.id || `ai-listening-${Date.now()}`,
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not generate a listening lesson right now."));
    } finally {
      setLoadingAction("");
    }
  };

  const saveUploadedLesson = async () => {
    const transcriptText = uploadForm.transcript.trim();
    if (!transcriptText) {
      setError("Please enter a transcript before saving this listening lesson.");
      return;
    }
    setLoadingAction("upload-lesson");
    setError("");
    try {
      const userId = getCurrentUserId();
      let uploaded: { path?: string; url?: string } = {};
      if (audioFile) {
        if (!audioFile.type.startsWith("audio/")) throw new Error("Please choose an audio file.");
        if (audioFile.size > 50 * 1024 * 1024) throw new Error("Audio file is too large. Please keep it under 50MB.");
        uploaded = await uploadListeningAudio(audioFile, userId);
      }
      const draft = {
        title: uploadForm.title.trim() || audioFile?.name?.replace(/\.[^.]+$/, "") || "Uploaded listening lesson",
        topic: uploadForm.topic.trim() || "Uploaded Audio",
        level: uploadForm.level,
        content_kind: uploadForm.contentKind,
        transcript_text: transcriptText,
        dialogue: [],
        audio_url: uploaded.url || "",
        audio_storage_path: uploaded.path || "",
        audio_metadata: {
          source_type: "user_upload",
          original_file_name: audioFile?.name,
          mime_type: audioFile?.type,
          file_size: audioFile?.size,
        },
        uploaded: true,
      };
      const saved = await persistLesson(draft);
      addLessonToState({
        ...draft,
        ...(saved || {}),
        id: saved?.id || `uploaded-listening-${Date.now()}`,
      });
      setAudioFile(null);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not save uploaded listening lesson."));
    } finally {
      setLoadingAction("");
    }
  };

  const generateQuiz = async () => {
    if (!lesson) return;
    setLoadingAction("quiz");
    setError("");
    try {
      const response = await backendPost<any>("/api/listening/quiz", {
        user_id: getCurrentUserId(),
        title: lesson.title,
        transcript,
        learner_level: lesson.level,
        question_count: 5,
        question_types: activeMode === "Multiple Choice" ? ["mcq"] : ["mcq", "true_false", "short_answer", "fill_blank"],
      });
      const generated = parseQuestions(response);
      setQuizQuestions(generated);
      setQuizResponses({});
      setQuizScore(null);
      setAiQuiz(generated.length ? "" : plainQuizText(response.output));
    } catch (err) {
      setAiQuiz(getFriendlyErrorMessage(err, "Could not generate a listening quiz right now. Please try again later."));
    } finally {
      setLoadingAction("");
    }
  };

  const practiceQuestions = quizQuestions.length ? quizQuestions : questions;
  const answerCount = Object.keys(quizResponses).length;
  const allAnswered = practiceQuestions.length > 0 && practiceQuestions.every((question, index) => quizResponses[question.id || String(index)] !== undefined);
  const dictationStats = dictationSegments.reduce((acc, segment, index) => {
    return normalizeForCompare(dictationAnswers[index]) === normalizeForCompare(segment) ? acc + 1 : acc;
  }, 0);

  const submitQuiz = async () => {
    if (!allAnswered) return;
    setLoadingAction("score");
    setError("");
    try {
      const response = await backendPost<any>("/api/listening/score", {
        user_id: getCurrentUserId(),
        questions: practiceQuestions,
        responses: quizResponses,
        use_ai_feedback: true,
      });
      setQuizScore(response);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not score this listening quiz right now. Please try again later."));
    } finally {
      setLoadingAction("");
    }
  };

  const quizPanel = (
    <div className="bg-white rounded-2xl border border-border p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot size={18} style={{ color: "#2D6A4F" }} />
          <div>
            <h3 className="text-foreground font-semibold" style={{ fontSize: "1rem" }}>Listening Quiz</h3>
            <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>Answer below the audio, then submit for scoring.</p>
          </div>
        </div>
        <button onClick={generateQuiz} disabled={loadingAction === "quiz"} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.875rem" }}>
          {loadingAction === "quiz" ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />}
          Generate new quiz
        </button>
      </div>
      {practiceQuestions.length > 0 && (
        <div className="space-y-4">
          {practiceQuestions.map((question, index) => {
            const key = question.id || String(index);
            const selected = quizResponses[key];
            const scoreResult = quizScore?.data?.results?.find((item: any) => String(item.question_id) === String(key) || String(item.question_id) === String(index));
            const choices = asArray(question.choices);
            return (
              <div key={key} className="rounded-2xl border border-border p-4">
                <p className="text-foreground mb-3" style={{ fontSize: "0.9375rem", fontWeight: 650, lineHeight: 1.55 }}>{index + 1}. {question.prompt}</p>
                {choices.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {choices.map((choice, choiceIndex) => (
                      <button key={choiceIndex} onClick={() => !quizScore && setQuizResponses(prev => ({ ...prev, [key]: choiceIndex }))} className="w-full rounded-xl border px-4 py-3 text-left transition-colors" style={{ fontSize: "0.875rem", borderColor: selected === choiceIndex ? "#2D6A4F" : "#E8F5EE", background: selected === choiceIndex ? "#D8F3DC" : "white", lineHeight: 1.45 }}>
                        {String.fromCharCode(65 + choiceIndex)}. {choice}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input value={selected || ""} onChange={event => setQuizResponses(prev => ({ ...prev, [key]: event.target.value }))} disabled={!!quizScore} className="w-full rounded-xl border border-border px-4 py-3 disabled:bg-muted" placeholder="Your answer" style={{ fontSize: "0.875rem" }} />
                )}
                {scoreResult && (
                  <div className="mt-3 rounded-xl p-3" style={{ background: scoreResult.correct ? "#F0FAF4" : "#FFF7ED" }}>
                    <p className="inline-flex items-center gap-1 text-foreground" style={{ fontSize: "0.8125rem", fontWeight: 700 }}>
                      <CheckCircle2 size={14} style={{ color: scoreResult.correct ? "#2D6A4F" : "#FF8C42" }} />
                      {scoreResult.correct ? "Correct" : `Answer: ${answerLabel(question) || scoreResult.expected}`}
                    </p>
                    {(question.explanation || question.transcript_evidence) && <p className="text-muted-foreground mt-1" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>{question.explanation || question.transcript_evidence}</p>}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
            <span className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{quizScore ? `Score: ${quizScore.data?.correct_count || 0}/${quizScore.data?.question_count || practiceQuestions.length}` : `${answerCount}/${practiceQuestions.length} answered`}</span>
            <button onClick={submitQuiz} disabled={!allAnswered || !!quizScore || loadingAction === "score"} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.875rem" }}>
              {loadingAction === "score" && <Loader2 size={14} className="animate-spin" />}
              Submit
            </button>
          </div>
        </div>
      )}
      {aiQuiz && <pre className="rounded-xl p-4 whitespace-pre-wrap overflow-auto" style={{ background: "#F0FAF4", fontSize: "0.8125rem", lineHeight: 1.6 }}>{aiQuiz}</pre>}
    </div>
  );

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Listening Practice</h1>
        <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>Practice listening with transcript, dictation, shadowing, and scored quizzes</p>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <select value={lesson?.id || ""} onChange={e => setLesson(lessons.find(item => item.id === e.target.value) || null)} className="w-full bg-white border border-border rounded-xl px-3 py-2 mb-5">
        {lessons.map(item => <option key={item.id} value={item.id}>{item.sample ? `${item.title} (Sample)` : item.title}</option>)}
      </select>

      <div className="bg-white rounded-2xl border border-border p-4 mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>Create Listening Practice</h2>
            <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>Generate a lesson with AI or upload your own audio and transcript.</p>
          </div>
          <button onClick={() => setCreatorOpen(value => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-muted-foreground hover:bg-muted hover:text-foreground" style={{ fontSize: "0.8125rem" }}>
            {creatorOpen ? <RotateCcw size={14} /> : <Wand2 size={14} />}
            {creatorOpen ? "Close" : "Create"}
          </button>
        </div>

        {creatorOpen && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {CREATOR_MODES.map(mode => (
                <button key={mode} onClick={() => setCreatorMode(mode)} className={`rounded-full border px-4 py-1.5 whitespace-nowrap ${creatorMode === mode ? "text-white border-primary" : "text-muted-foreground border-border"}`} style={{ background: creatorMode === mode ? "#2D6A4F" : "white", fontSize: "0.8125rem" }}>
                  {mode}
                </button>
              ))}
            </div>

            {creatorMode === "AI Generate" ? (
              <div className="grid gap-3 md:grid-cols-[1fr_110px_150px_120px_120px_auto] md:items-end">
                <label className="grid gap-1">
                  <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Topic</span>
                  <input value={aiForm.topic} onChange={event => setAiForm((prev: any) => ({ ...prev, topic: event.target.value }))} className="rounded-xl border border-border px-3 py-2 outline-none" placeholder="food, travel, workplace..." />
                </label>
                <label className="grid gap-1">
                  <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Level</span>
                  <select value={aiForm.level} onChange={event => setAiForm((prev: any) => ({ ...prev, level: event.target.value }))} className="rounded-xl border border-border px-3 py-2 bg-white">
                    {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Kind</span>
                  <select value={aiForm.contentKind} onChange={event => setAiForm((prev: any) => ({ ...prev, contentKind: event.target.value }))} className="rounded-xl border border-border px-3 py-2 bg-white">
                    {CONTENT_KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Seconds</span>
                  <input type="number" min={30} max={600} value={aiForm.durationSeconds} onChange={event => setAiForm((prev: any) => ({ ...prev, durationSeconds: Number(event.target.value) }))} className="rounded-xl border border-border px-3 py-2 outline-none" />
                </label>
                <label className="grid gap-1">
                  <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Speakers</span>
                  <input type="number" min={1} max={4} value={aiForm.speakerCount} onChange={event => setAiForm((prev: any) => ({ ...prev, speakerCount: Number(event.target.value) }))} className="rounded-xl border border-border px-3 py-2 outline-none" />
                </label>
                <button onClick={generateListeningLesson} disabled={loadingAction === "generate-lesson" || !aiForm.topic.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.875rem" }}>
                  {loadingAction === "generate-lesson" ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                  Generate
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_110px_150px]">
                  <label className="grid gap-1">
                    <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Title</span>
                    <input value={uploadForm.title} onChange={event => setUploadForm((prev: any) => ({ ...prev, title: event.target.value }))} className="rounded-xl border border-border px-3 py-2 outline-none" placeholder="My listening lesson" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Topic</span>
                    <input value={uploadForm.topic} onChange={event => setUploadForm((prev: any) => ({ ...prev, topic: event.target.value }))} className="rounded-xl border border-border px-3 py-2 outline-none" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Level</span>
                    <select value={uploadForm.level} onChange={event => setUploadForm((prev: any) => ({ ...prev, level: event.target.value }))} className="rounded-xl border border-border px-3 py-2 bg-white">
                      {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Kind</span>
                    <select value={uploadForm.contentKind} onChange={event => setUploadForm((prev: any) => ({ ...prev, contentKind: event.target.value }))} className="rounded-xl border border-border px-3 py-2 bg-white">
                      {CONTENT_KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Audio file</span>
                  <input type="file" accept="audio/*" onChange={event => setAudioFile(event.target.files?.[0] || null)} className="rounded-xl border border-border px-3 py-2" />
                </label>
                <label className="grid gap-1">
                  <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Transcript</span>
                  <textarea value={uploadForm.transcript} onChange={event => setUploadForm((prev: any) => ({ ...prev, transcript: event.target.value }))} className="min-h-32 rounded-xl border border-border px-3 py-2 outline-none" placeholder="Paste or type the transcript manually..." style={{ fontSize: "0.875rem", lineHeight: 1.6 }} />
                </label>
                <button onClick={saveUploadedLesson} disabled={loadingAction === "upload-lesson" || !uploadForm.transcript.trim()} className="inline-flex w-fit items-center justify-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.875rem" }}>
                  {loadingAction === "upload-lesson" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Save uploaded lesson
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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
                      <p className="text-green-300" style={{ fontSize: "0.8125rem" }}>{lesson.topic} - {lesson.level || "level"} - {lesson.content_kind}{lesson.sample ? " - Sample" : ""}</p>
                    </div>
                  </div>

                  {lesson.audio_url ? (
                    <audio controls src={lesson.audio_url} className="w-full" />
                  ) : (
                    <div className="flex items-center justify-center gap-4">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={playWebSpeech} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#B7E4C7" }}>
                        {playing ? <Pause size={20} style={{ color: "#1B4332" }} /> : <Play size={20} style={{ color: "#1B4332", marginLeft: "2px" }} />}
                      </motion.button>
                      <button onClick={() => playText(transcript)} className="text-green-300 hover:text-white transition-colors"><Volume2 size={18} /></button>
                      <span className="text-green-300" style={{ fontSize: "0.8125rem" }}>Web Speech playback</span>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  {activeMode === "Dictation" ? (
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Dictation</h3>
                        {dictationSubmitted && (
                          <span className="rounded-full px-2.5 py-1 text-primary bg-primary/5 border border-primary" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                            {dictationStats}/{dictationSegments.length} exact
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        {dictationSegments.map((segment, index) => {
                          const correct = normalizeForCompare(dictationAnswers[index]) === normalizeForCompare(segment);
                          return (
                            <div key={index} className="rounded-xl border border-border p-3">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Line {index + 1}</span>
                                <button onClick={() => playText(segment)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-muted-foreground hover:bg-muted" style={{ fontSize: "0.75rem" }}>
                                  <Play size={12} /> Play
                                </button>
                              </div>
                              <textarea value={dictationAnswers[index] || ""} onChange={event => setDictationAnswers(prev => ({ ...prev, [index]: event.target.value }))} disabled={dictationSubmitted} className="w-full min-h-20 rounded-xl border border-border p-3 outline-none disabled:bg-muted" placeholder="Type what you hear..." style={{ fontSize: "0.8125rem", lineHeight: 1.6 }} />
                              {dictationSubmitted && (
                                <div className="mt-2 rounded-xl p-3" style={{ background: correct ? "#F0FAF4" : "#FFF7ED" }}>
                                  <p className="text-foreground" style={{ fontSize: "0.8125rem", fontWeight: 700 }}>{correct ? "Exact match" : "Review this line"}</p>
                                  <p className="text-muted-foreground mt-1" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>{segment}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button onClick={() => setDictationSubmitted(true)} disabled={dictationSegments.length === 0} className="rounded-xl px-4 py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}>Check Dictation</button>
                        <button onClick={() => { setDictationAnswers({}); setDictationSubmitted(false); }} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-muted-foreground hover:bg-muted" style={{ fontSize: "0.8125rem" }}><RotateCcw size={13} /> Reset</button>
                      </div>
                    </div>
                  ) : activeMode === "Shadowing" ? (
                    <div>
                      <h3 className="text-foreground font-semibold mb-3" style={{ fontSize: "0.875rem" }}>Shadowing Lines</h3>
                      <div className="space-y-3">
                        {shadowingLines.map((line, index) => (
                          <div key={index} className="rounded-xl border border-border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-foreground" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{line}</p>
                              <button onClick={() => playText(line)} className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-muted-foreground hover:bg-muted" style={{ fontSize: "0.75rem" }}>
                                <Play size={12} /> Play
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Script</h3>
                        <button onClick={() => setShowTranscript(value => !value)} className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" style={{ fontSize: "0.75rem" }}>
                          {showTranscript ? "Hide script" : "Show script"}
                        </button>
                      </div>
                      {showTranscript ? (
                        <div className="space-y-3">
                          {turns.map((seg: any, i: number) => (
                            <div key={i} className="p-3 rounded-xl hover:bg-muted transition-all">
                              <span className="text-primary font-semibold mr-2" style={{ fontSize: "0.75rem" }}>{seg.speaker || "Audio"}</span>
                              <span className="text-foreground" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{seg.text}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border bg-muted p-5 text-center">
                          <p className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Script is hidden</p>
                          <p className="text-muted-foreground mt-1" style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}>
                            Listen first, then reveal the script when you are ready to check details.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {quizPanel}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
