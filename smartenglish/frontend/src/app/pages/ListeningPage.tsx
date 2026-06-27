import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Play, Pause, Volume2, Headphones, Bot, BookOpen, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { backendPost, getCurrentUserId, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";

const MODES = ["Active Listening", "Dictation", "Shadowing", "Multiple Choice"];

const SAMPLE_LISTENING_LESSONS = [
  {
    id: "sample-listening-cafe-plan",
    title: "Planning a Weekend Cafe Visit",
    topic: "Daily Life",
    level: "A2",
    content_kind: "dialogue",
    sample: true,
    transcript_text: "Emma: Are you free on Saturday morning? Liam: I think so. Why? Emma: A new cafe opened near the library. It has quiet tables, so we could study there. Liam: That sounds good. What time should we meet? Emma: How about ten thirty? Liam: Perfect. I will bring my notebook and vocabulary cards.",
    dialogue: [
      { speaker: "Emma", text: "Are you free on Saturday morning?" },
      { speaker: "Liam", text: "I think so. Why?" },
      { speaker: "Emma", text: "A new cafe opened near the library. It has quiet tables, so we could study there." },
      { speaker: "Liam", text: "That sounds good. What time should we meet?" },
      { speaker: "Emma", text: "How about ten thirty?" },
      { speaker: "Liam", text: "Perfect. I will bring my notebook and vocabulary cards." },
    ],
    key_vocabulary: [
      { word: "opened", meaning: "started welcoming customers", level: "A2" },
      { word: "quiet", meaning: "not noisy", level: "A2" },
      { word: "bring", meaning: "take something with you", level: "A2" },
    ],
    dictation_segments: [
      "A new cafe opened near the library.",
      "It has quiet tables, so we could study there.",
      "I will bring my notebook and vocabulary cards.",
    ],
    shadowing_lines: [
      "Are you free on Saturday morning?",
      "What time should we meet?",
      "Perfect. I will bring my notebook and vocabulary cards.",
    ],
    questions: [
      { id: "sample-listening-cafe-plan-q1", prompt: "Where is the new cafe?", choices: ["Near the park", "Near the library", "Inside the school", "Beside the station"], answer: { correctIndex: 1 }, explanation: "Emma says the cafe opened near the library." },
      { id: "sample-listening-cafe-plan-q2", prompt: "Why does Emma suggest the cafe?", choices: ["It has quiet tables.", "It has free lunch.", "It is very loud.", "It sells books."], answer: { correctIndex: 0 }, explanation: "She says it has quiet tables, so they could study there." },
      { id: "sample-listening-cafe-plan-q3", prompt: "What time will they meet?", choices: ["9:30", "10:30", "11:30", "12:30"], answer: { correctIndex: 1 }, explanation: "Emma suggests ten thirty." },
    ],
  },
  {
    id: "sample-listening-weather-announcement",
    title: "A Short Weather Announcement",
    topic: "Weather",
    level: "B1",
    content_kind: "monologue",
    sample: true,
    transcript_text: "Good morning. Here is today's weather update. The city will be cloudy in the morning, with light rain before noon. The rain should stop by two o'clock, and the afternoon will become warmer. If you are traveling by motorbike, please drive carefully because some roads may be slippery. Tomorrow will be sunny and dry.",
    key_vocabulary: [
      { word: "cloudy", meaning: "covered with clouds", level: "B1" },
      { word: "slippery", meaning: "easy to slide on", level: "B1" },
      { word: "forecast", meaning: "a report about future weather", level: "B1" },
    ],
    dictation_segments: [
      "The city will be cloudy in the morning.",
      "The rain should stop by two o'clock.",
      "Some roads may be slippery.",
    ],
    shadowing_lines: [
      "Here is today's weather update.",
      "The afternoon will become warmer.",
      "Tomorrow will be sunny and dry.",
    ],
    questions: [
      { id: "sample-listening-weather-announcement-q1", prompt: "When will there be light rain?", choices: ["Before noon", "After midnight", "Tomorrow morning", "All day"], answer: { correctIndex: 0 }, explanation: "The announcement says light rain before noon." },
      { id: "sample-listening-weather-announcement-q2", prompt: "Why should motorbike riders be careful?", choices: ["Roads may be slippery.", "There will be snow.", "The roads are closed.", "It will be too hot."], answer: { correctIndex: 0 }, explanation: "Some roads may be slippery." },
      { id: "sample-listening-weather-announcement-q3", prompt: "What will tomorrow's weather be like?", choices: ["Sunny and dry", "Cloudy and wet", "Cold and snowy", "Windy and dark"], answer: { correctIndex: 0 }, explanation: "The final sentence says tomorrow will be sunny and dry." },
    ],
  },
  {
    id: "sample-listening-team-feedback",
    title: "Team Feedback After a Presentation",
    topic: "Work",
    level: "B2",
    content_kind: "dialogue",
    sample: true,
    transcript_text: "Manager: Your presentation was clear, especially the part about customer growth. Analyst: Thank you. I was worried that the chart had too much information. Manager: The chart was useful, but next time, pause longer before explaining the numbers. It will give the audience time to read. Analyst: That's helpful. I can also move the key figure to the top. Manager: Good idea. Small design changes can make the message much stronger.",
    dialogue: [
      { speaker: "Manager", text: "Your presentation was clear, especially the part about customer growth." },
      { speaker: "Analyst", text: "Thank you. I was worried that the chart had too much information." },
      { speaker: "Manager", text: "The chart was useful, but next time, pause longer before explaining the numbers." },
      { speaker: "Analyst", text: "That's helpful. I can also move the key figure to the top." },
      { speaker: "Manager", text: "Good idea. Small design changes can make the message much stronger." },
    ],
    key_vocabulary: [
      { word: "especially", meaning: "more than other things", level: "B2" },
      { word: "audience", meaning: "people watching or listening", level: "B2" },
      { word: "figure", meaning: "a number or amount", level: "B2" },
    ],
    dictation_segments: [
      "Your presentation was clear, especially the part about customer growth.",
      "Pause longer before explaining the numbers.",
      "Small design changes can make the message much stronger.",
    ],
    shadowing_lines: [
      "I was worried that the chart had too much information.",
      "It will give the audience time to read.",
      "I can also move the key figure to the top.",
    ],
    questions: [
      { id: "sample-listening-team-feedback-q1", prompt: "What did the manager praise?", choices: ["The customer growth section", "The room size", "The speaker's clothes", "The lunch menu"], answer: { correctIndex: 0 }, explanation: "The manager says the customer growth part was clear." },
      { id: "sample-listening-team-feedback-q2", prompt: "What should the analyst do next time?", choices: ["Speak faster", "Pause longer before explaining numbers", "Remove all charts", "Cancel the presentation"], answer: { correctIndex: 1 }, explanation: "The manager suggests pausing longer." },
      { id: "sample-listening-team-feedback-q3", prompt: "Where might the analyst move the key figure?", choices: ["To the top", "To another report", "To the bottom corner", "To an email only"], answer: { correctIndex: 0 }, explanation: "The analyst says they can move the key figure to the top." },
    ],
  },
];

let listeningSnapshot: any = null;

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
    };
  }, [activeMode, aiQuiz, dictationAnswers, dictationSubmitted, lesson, lessons, questions, quizQuestions, quizResponses, quizScore, selectedVocab]);

  useEffect(() => {
    supabaseSelect<any>("listening_lessons", { select: "*", published: "eq.true", order: "created_at.desc" })
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
    const saved = asArray(lesson?.key_vocabulary || lesson?.vocabulary);
    if (saved.length) {
      return saved.slice(0, 8).map((item: any) => ({
        word: firstText(item.word, item.term, item.phrase) || String(item),
        meaning: firstText(item.meaning, item.definition, item.explanation) || "No explanation provided yet.",
        level: firstText(item.level, item.cefr) || lesson?.level || "B1",
      }));
    }
    const words = Array.from(new Set(transcript.toLowerCase().match(/[a-z]{6,}/g) || []));
    return words.slice(0, 6).map(word => ({ word, meaning: "Ask AI Tutor or add this word to flashcards for a full explanation.", level: lesson?.level || "B1" }));
  }, [transcript, lesson?.level, lesson?.key_vocabulary, lesson?.vocabulary]);

  const dictationSegments = useMemo(() => {
    const saved = asArray(lesson?.dictation_segments);
    const source = saved.length ? saved : turns.slice(0, 5).map((turn: any) => turn.text);
    return source.map((item: any) => typeof item === "string" ? item : firstText(item.text, item.line, item.sentence)).filter(Boolean).slice(0, 6);
  }, [lesson?.dictation_segments, turns]);

  const shadowingLines = useMemo(() => {
    const saved = asArray(lesson?.shadowing_lines);
    const source = saved.length ? saved : turns.slice(0, 5).map((turn: any) => turn.text);
    return source.map((item: any) => typeof item === "string" ? item : firstText(item.text, item.line, item.sentence)).filter(Boolean).slice(0, 6);
  }, [lesson?.shadowing_lines, turns]);

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
      setAiQuiz(generated.length ? "" : response.output);
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
                  )}
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
                  <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Listening Quiz</h3>
                </div>
                <button onClick={generateQuiz} disabled={loadingAction === "quiz"} className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-2 text-white mb-3 disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}>
                  {loadingAction === "quiz" ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  Generate new quiz
                </button>
                {practiceQuestions.length > 0 && (
                  <div className="space-y-3">
                    {practiceQuestions.map((question, index) => {
                      const key = question.id || String(index);
                      const selected = quizResponses[key];
                      const scoreResult = quizScore?.data?.results?.find((item: any) => String(item.question_id) === String(key) || String(item.question_id) === String(index));
                      const choices = asArray(question.choices);
                      return (
                        <div key={key} className="rounded-xl border border-border p-3">
                          <p className="text-foreground mb-2" style={{ fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.45 }}>{index + 1}. {question.prompt}</p>
                          {choices.length ? (
                            <div className="space-y-2">
                              {choices.map((choice, choiceIndex) => (
                                <button key={choiceIndex} onClick={() => !quizScore && setQuizResponses(prev => ({ ...prev, [key]: choiceIndex }))} className="w-full rounded-lg border px-3 py-2 text-left" style={{ fontSize: "0.75rem", borderColor: selected === choiceIndex ? "#2D6A4F" : "#E8F5EE", background: selected === choiceIndex ? "#D8F3DC" : "white" }}>
                                  {String.fromCharCode(65 + choiceIndex)}. {choice}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <input value={selected || ""} onChange={event => setQuizResponses(prev => ({ ...prev, [key]: event.target.value }))} disabled={!!quizScore} className="w-full rounded-lg border border-border px-3 py-2 disabled:bg-muted" placeholder="Your answer" style={{ fontSize: "0.75rem" }} />
                          )}
                          {scoreResult && (
                            <div className="mt-2 rounded-lg p-2" style={{ background: scoreResult.correct ? "#F0FAF4" : "#FFF7ED" }}>
                              <p className="inline-flex items-center gap-1 text-foreground" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                                <CheckCircle2 size={12} style={{ color: scoreResult.correct ? "#2D6A4F" : "#FF8C42" }} />
                                {scoreResult.correct ? "Correct" : `Answer: ${answerLabel(question) || scoreResult.expected}`}
                              </p>
                              {(question.explanation || question.transcript_evidence) && <p className="text-muted-foreground mt-1" style={{ fontSize: "0.72rem", lineHeight: 1.5 }}>{question.explanation || question.transcript_evidence}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{quizScore ? `Score: ${quizScore.data?.correct_count || 0}/${quizScore.data?.question_count || practiceQuestions.length}` : `${answerCount}/${practiceQuestions.length} answered`}</span>
                      <button onClick={submitQuiz} disabled={!allAnswered || !!quizScore || loadingAction === "score"} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.75rem" }}>
                        {loadingAction === "score" && <Loader2 size={13} className="animate-spin" />}
                        Submit
                      </button>
                    </div>
                  </div>
                )}
                {aiQuiz && <pre className="rounded-xl p-3 whitespace-pre-wrap overflow-auto" style={{ background: "#F0FAF4", fontSize: "0.75rem" }}>{aiQuiz}</pre>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
