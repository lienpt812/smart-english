import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  backendPost,
  getCurrentUserId,
  getFriendlyErrorMessage,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "../lib/api";

type ParsedAiText = Record<string, any> | string;

const LEVELS = ["All", "A1", "A2", "B1", "B2", "C1", "C2"];

const SAMPLE_PASSAGES = [
  {
    id: "sample-reading-ai-study-buddy",
    title: "An AI Study Buddy That Learns With You",
    topic: "Technology",
    level: "B1",
    estimated_minutes: 4,
    sample: true,
    body: "Mina used to study English with a notebook, a dictionary, and a long list of words. She worked hard, but she often forgot what to review next. One day, her school introduced an AI study buddy. The tool did not replace her teacher. Instead, it helped Mina notice patterns in her mistakes.\n\nAfter each reading task, the study buddy showed her three useful words, two grammar points, and one short speaking question. Mina liked this because the advice was small enough to follow. She also saw a weekly chart of her progress. When her vocabulary score improved, she felt more confident.\n\nThe most helpful feature was not the score. It was the explanation. When Mina chose the wrong answer, the tool highlighted the sentence that contained the evidence. Slowly, she learned to read more carefully instead of guessing quickly.",
    vocabulary: [
      { term: "replace", definition: "to take the position of something or someone", example: "AI can support teachers, but it should not replace them.", level: "B1" },
      { term: "patterns", definition: "repeated ways that something happens", example: "The app found patterns in Mina's mistakes.", level: "B1" },
      { term: "evidence", definition: "information that proves or explains an answer", example: "Find evidence in the text before answering.", level: "B1" },
    ],
    questions: [
      { id: "sample-reading-ai-study-buddy-q1", prompt: "What problem did Mina have before using the AI study buddy?", choices: ["She had no dictionary.", "She forgot what to review next.", "She disliked her teacher.", "She could not read at all."], answer_schema: { correctIndex: 1, explanation: "The first paragraph says she often forgot what to review next." } },
      { id: "sample-reading-ai-study-buddy-q2", prompt: "What did the tool do after each reading task?", choices: ["It gave a small practice plan.", "It wrote essays for Mina.", "It removed her homework.", "It called her parents."], answer_schema: { correctIndex: 0, explanation: "It showed useful words, grammar points, and a speaking question." } },
      { id: "sample-reading-ai-study-buddy-q3", prompt: "Why was highlighting evidence helpful?", choices: ["It made Mina guess faster.", "It taught Mina to read more carefully.", "It translated every word.", "It hid the answer."], answer_schema: { correctIndex: 1, explanation: "The final sentence says she learned to read more carefully." } },
    ],
  },
  {
    id: "sample-reading-urban-gardens",
    title: "Small Gardens in Busy Cities",
    topic: "Environment",
    level: "B1",
    estimated_minutes: 5,
    sample: true,
    body: "In many large cities, people are turning empty spaces into small gardens. These gardens can appear on rooftops, beside apartment buildings, or even near train stations. They are usually not very big, but they can change how a neighborhood feels.\n\nA city garden gives people a quiet place to meet. Older residents can teach children how to plant herbs and vegetables. Office workers sometimes visit during lunch to rest their eyes and breathe fresher air. In summer, plants also help cool the area around them.\n\nHowever, city gardens need planning. Someone must water the plants, clean the paths, and decide how the food is shared. When neighbors make these decisions together, the garden becomes more than a green space. It becomes a small community project.",
    vocabulary: [
      { term: "rooftops", definition: "the flat or outer top parts of buildings", example: "Some gardens are built on rooftops.", level: "B1" },
      { term: "residents", definition: "people who live in a place", example: "Residents met every Sunday to water the plants.", level: "B1" },
      { term: "community", definition: "people who live or work together in one area", example: "The garden became a community project.", level: "B1" },
    ],
    questions: [
      { id: "sample-reading-urban-gardens-q1", prompt: "Where can city gardens appear?", choices: ["Only in forests", "Only inside schools", "On rooftops and near buildings", "Under the sea"], answer_schema: { correctIndex: 2, explanation: "The first paragraph lists rooftops and spaces beside apartment buildings." } },
      { id: "sample-reading-urban-gardens-q2", prompt: "What is one benefit of plants in summer?", choices: ["They cool the area.", "They stop all traffic.", "They make offices bigger.", "They remove all noise."], answer_schema: { correctIndex: 0, explanation: "The second paragraph says plants help cool the area." } },
      { id: "sample-reading-urban-gardens-q3", prompt: "What does a garden become when neighbors plan together?", choices: ["A private shop", "A train station", "A community project", "A large factory"], answer_schema: { correctIndex: 2, explanation: "The final sentence states this directly." } },
    ],
  },
  {
    id: "sample-reading-workplace-feedback",
    title: "How Good Feedback Helps a Team",
    topic: "Work",
    level: "B2",
    estimated_minutes: 5,
    sample: true,
    body: "Feedback is most useful when it is specific, timely, and connected to a clear goal. A manager who says, 'Good job,' may sound kind, but the employee does not know what to repeat. A better comment is, 'Your chart made the sales trend easy to understand.' This tells the employee exactly which choice worked well.\n\nGood feedback also creates trust. When team members only hear comments after something goes wrong, they may become defensive. Regular feedback makes improvement feel normal. It also gives people a chance to fix small problems before they become serious.\n\nStill, feedback should not become constant judgment. People need time to try, reflect, and adjust. The best teams use feedback as a conversation, not as a final grade.",
    vocabulary: [
      { term: "specific", definition: "clear and exact", example: "Specific feedback is easier to use.", level: "B2" },
      { term: "defensive", definition: "protecting yourself from criticism", example: "People may become defensive after harsh comments.", level: "B2" },
      { term: "adjust", definition: "to change something slightly to improve it", example: "The team adjusted their plan.", level: "B2" },
    ],
    questions: [
      { id: "sample-reading-workplace-feedback-q1", prompt: "Which feedback is more useful according to the passage?", choices: ["Good job.", "Work harder.", "Your chart made the sales trend easy to understand.", "That was bad."], answer_schema: { correctIndex: 2, explanation: "The passage explains that this comment is specific." } },
      { id: "sample-reading-workplace-feedback-q2", prompt: "Why is regular feedback helpful?", choices: ["It replaces all meetings.", "It makes improvement feel normal.", "It avoids every mistake.", "It gives final grades faster."], answer_schema: { correctIndex: 1, explanation: "The second paragraph says regular feedback makes improvement feel normal." } },
      { id: "sample-reading-workplace-feedback-q3", prompt: "How should the best teams use feedback?", choices: ["As a conversation", "As a punishment", "As a secret", "As a final grade only"], answer_schema: { correctIndex: 0, explanation: "The final sentence says feedback should be a conversation." } },
    ],
  },
];

let readingSnapshot: any = null;

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseAiText(value: unknown): ParsedAiText {
  if (!value) return "";
  if (typeof value === "object") return value as Record<string, any>;
  const text = stripCodeFence(String(value));
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item).trim()).filter(Boolean)
    : [];
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function displayLevel(passage: any) {
  return String(passage?.level || passage?.cefr_level || "CEFR");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseAiObject(response: any) {
  const parsed = parseAiText(response?.data || response?.output || response);
  return typeof parsed === "string" ? {} : parsed;
}

function parseAiQuestions(response: any) {
  const parsed = parseAiText(response?.data || response?.output || response);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object") {
    return asArray(parsed.questions || parsed.items || parsed.quiz);
  }
  return [];
}

function normalizeGeneratedQuestion(question: any, index: number) {
  const correct = question.correct_index ?? question.correctIndex ?? question.answer_index ?? question.answerIndex ?? 0;
  return {
    ...question,
    id: question.id || `ai-question-${Date.now()}-${index}`,
    question_type: question.question_type || "mcq",
    choices: asArray(question.choices),
    answer_schema: {
      correctIndex: Number.isFinite(Number(correct)) ? Number(correct) : 0,
      explanation: question.explanation,
    },
    position: index + 1,
    published: true,
  };
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl bg-white/70 border border-border p-3">
      <p className="text-primary font-semibold mb-1" style={{ fontSize: "0.72rem" }}>{label}</p>
      <div className="text-foreground" style={{ fontSize: "0.875rem", lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

function WordExplanation({ item }: { item: any }) {
  const parsed = parseAiText(item.ai ? item.definition : item.data || item.definition || item);
  const data = typeof parsed === "string" ? item : { ...item, ...parsed };
  const plainText = typeof parsed === "string" ? parsed : "";
  const definition = firstText(data.simple_definition, data.definition, data.meaning, plainText);
  const meaning = firstText(data.meaning_in_context, data.context_meaning, data.in_context);
  const hint = firstText(data.vietnamese_hint, data.vi_hint, data.hint);
  const cefr = firstText(data.cefr_guess, data.cefr_level, data.level);
  const collocations = asStringList(data.common_collocations || data.collocations);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-primary font-semibold" style={{ fontSize: "1rem" }}>{data.term || item.term}</span>
        {cefr && (
          <span className="rounded-full px-2 py-0.5" style={{ background: "#D8F3DC", color: "#2D6A4F", fontSize: "0.68rem", fontWeight: 700 }}>
            {cefr}
          </span>
        )}
      </div>
      <DetailBlock label="Meaning">{definition}</DetailBlock>
      <DetailBlock label="In this passage">{meaning}</DetailBlock>
      <DetailBlock label="Example">{firstText(data.example)}</DetailBlock>
      <DetailBlock label="Vietnamese hint">{hint}</DetailBlock>
      {collocations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {collocations.map(item => (
            <span key={item} className="rounded-full bg-white border border-border px-2.5 py-1 text-muted-foreground" style={{ fontSize: "0.75rem" }}>
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryView({ value }: { value: string }) {
  const parsed = parseAiText(value);
  if (!value) {
    return <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>Loading AI summary...</p>;
  }
  if (typeof parsed === "string") {
    return <p className="text-muted-foreground" style={{ fontSize: "0.8125rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>{parsed}</p>;
  }

  const keyPoints = asStringList(parsed.key_points);
  const vocabulary = asStringList(parsed.useful_vocabulary || parsed.vocabulary || parsed.important_vocabulary);
  const questions = asStringList(parsed.follow_up_questions || parsed.questions);

  return (
    <div className="space-y-4">
      <DetailBlock label="Short summary">{firstText(parsed.short_summary, parsed.summary, parsed.main_idea)}</DetailBlock>
      {keyPoints.length > 0 && (
        <DetailBlock label="Key points">
          <ul className="space-y-1">
            {keyPoints.map(point => <li key={point}>- {point}</li>)}
          </ul>
        </DetailBlock>
      )}
      {vocabulary.length > 0 && (
        <DetailBlock label="Useful vocabulary">
          <div className="flex flex-wrap gap-2">
            {vocabulary.map(item => (
              <span key={item} className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground" style={{ fontSize: "0.75rem" }}>{item}</span>
            ))}
          </div>
        </DetailBlock>
      )}
      {questions.length > 0 && (
        <DetailBlock label="Review questions">
          <ul className="space-y-1">
            {questions.map(question => <li key={question}>- {question}</li>)}
          </ul>
        </DetailBlock>
      )}
    </div>
  );
}

export function ReadingPage() {
  const restoredRef = useRef(!!readingSnapshot);
  const [passages, setPassages] = useState<any[]>(readingSnapshot?.passages || SAMPLE_PASSAGES);
  const [passage, setPassage] = useState<any | null>(readingSnapshot?.passage || SAMPLE_PASSAGES[0]);
  const [vocab, setVocab] = useState<any[]>(readingSnapshot?.vocab || []);
  const [decks, setDecks] = useState<any[]>(readingSnapshot?.decks || []);
  const [questions, setQuestions] = useState<any[]>(readingSnapshot?.questions || []);
  const [progressRows, setProgressRows] = useState<any[]>(readingSnapshot?.progressRows || []);
  const [selectedWord, setSelectedWord] = useState<any | null>(readingSnapshot?.selectedWord || null);
  const [showFlashcardForm, setShowFlashcardForm] = useState(readingSnapshot?.showFlashcardForm || false);
  const [deckChoice, setDeckChoice] = useState<"existing" | "new">(readingSnapshot?.deckChoice || "existing");
  const [selectedDeckId, setSelectedDeckId] = useState(readingSnapshot?.selectedDeckId || "");
  const [newDeckName, setNewDeckName] = useState(readingSnapshot?.newDeckName || "");
  const [flashcard, setFlashcard] = useState(readingSnapshot?.flashcard || { front: "", back: "", note: "" });
  const [answers, setAnswers] = useState<Record<number, number>>(readingSnapshot?.answers || {});
  const [submitted, setSubmitted] = useState(readingSnapshot?.submitted || false);
  const [showAISummary, setShowAISummary] = useState(readingSnapshot?.showAISummary || false);
  const [summary, setSummary] = useState(readingSnapshot?.summary || "");
  const [difficulty, setDifficulty] = useState(readingSnapshot?.difficulty || "");
  const [query, setQuery] = useState(readingSnapshot?.query || "");
  const [levelFilter, setLevelFilter] = useState(readingSnapshot?.levelFilter || "All");
  const [topicFilter, setTopicFilter] = useState(readingSnapshot?.topicFilter || "All");
  const [generatorOpen, setGeneratorOpen] = useState(readingSnapshot?.generatorOpen || false);
  const [generator, setGenerator] = useState(readingSnapshot?.generator || { level: "B1", topic: "technology", wordCount: 220, questionCount: 5 });
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");

  const userId = getCurrentUserId();
  const canTrackProgress = isUuid(userId);

  useEffect(() => {
    readingSnapshot = {
      passages,
      passage,
      vocab,
      decks,
      questions,
      progressRows,
      selectedWord,
      showFlashcardForm,
      deckChoice,
      selectedDeckId,
      newDeckName,
      flashcard,
      answers,
      submitted,
      showAISummary,
      summary,
      difficulty,
      query,
      levelFilter,
      topicFilter,
      generatorOpen,
      generator,
    };
  }, [answers, deckChoice, decks, difficulty, flashcard, generator, generatorOpen, levelFilter, newDeckName, passage, passages, progressRows, query, questions, selectedDeckId, selectedWord, showAISummary, showFlashcardForm, submitted, summary, topicFilter, vocab]);

  useEffect(() => {
    async function load() {
      try {
        const rows = await supabaseSelect<any>("reading_passages", { select: "*", published: "eq.true", order: "created_at.desc" });
        const deckRows = await supabaseSelect<any>("decks", { select: "id,name,created_at", order: "created_at.desc" });
        const merged = [...rows, ...SAMPLE_PASSAGES.filter(sample => !rows.some(row => row.id === sample.id))];
        setPassages(prev => {
          const generated = prev.filter(item => String(item.id).startsWith("ai-"));
          return [...generated, ...merged.filter(item => !generated.some(g => g.id === item.id))];
        });
        setPassage(prev => prev ? [...rows, ...SAMPLE_PASSAGES].find(item => item.id === prev.id) || prev : merged[0] || null);
        setDecks(deckRows);
        setSelectedDeckId(prev => prev || deckRows[0]?.id || "");
        if (canTrackProgress) {
          const progress = await supabaseSelect<any>("reading_progress", { select: "*", user_id: `eq.${userId}`, order: "last_read_at.desc" });
          setProgressRows(progress);
        }
      } catch (err) {
        setPassages(prev => prev.length ? prev : SAMPLE_PASSAGES);
        setPassage(prev => prev || SAMPLE_PASSAGES[0]);
        setError(getFriendlyErrorMessage(err, "Could not load reading library. Sample passages are still available."));
      }
    }
    load();
  }, [canTrackProgress, userId]);

  useEffect(() => {
    if (!passage?.id) return;
    const isLocal = String(passage.id).startsWith("ai-") || String(passage.id).startsWith("sample-reading-");
    if (restoredRef.current && readingSnapshot?.passage?.id === passage.id) {
      restoredRef.current = false;
      return;
    }
    restoredRef.current = false;
    setAnswers({});
    setSubmitted(false);
    setSelectedWord(null);
    setShowFlashcardForm(false);
    setSummary("");
    setDifficulty("");

    if (isLocal) {
      setVocab(asArray(passage.vocabulary));
      setQuestions(asArray(passage.questions).map(normalizeGeneratedQuestion));
      return;
    }

    Promise.all([
      supabaseSelect<any>("reading_vocabulary", { select: "*", passage_id: `eq.${passage.id}`, order: "position_start.asc" }),
      supabaseSelect<any>("reading_questions", { select: "*", passage_id: `eq.${passage.id}`, published: "eq.true", order: "position.asc" }),
    ]).then(([v, q]) => {
      setVocab(v);
      setQuestions(q);
    }).catch(err => setError(getFriendlyErrorMessage(err, "Could not load reading details. Please try again.")));
  }, [passage?.id]);

  const body = passage?.body || passage?.content || "";
  const paragraphs = body.split(/\n+/).filter(Boolean);
  const progressByPassage = useMemo(
    () => Object.fromEntries(progressRows.map(row => [row.passage_id, row])),
    [progressRows],
  );
  const currentProgress = passage?.id ? progressByPassage[passage.id] : null;
  const topics = useMemo(
    () => ["All", ...Array.from(new Set(passages.map(item => String(item.topic || "General")).filter(Boolean))).sort()],
    [passages],
  );
  const filteredPassages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return passages.filter(item => {
      const levelMatch = levelFilter === "All" || displayLevel(item) === levelFilter;
      const topicMatch = topicFilter === "All" || String(item.topic || "General") === topicFilter;
      const searchText = `${item.title || ""} ${item.topic || ""} ${item.body || ""}`.toLowerCase();
      return levelMatch && topicMatch && (!term || searchText.includes(term));
    });
  }, [levelFilter, passages, query, topicFilter]);
  const vocabByTerm = Object.fromEntries(vocab.map(item => [String(item.term || "").toLowerCase(), item]));

  const wordFields = (item: any) => {
    const parsed = parseAiText(item?.ai ? item.definition : item?.data || item?.definition || item);
    const data = typeof parsed === "string" ? item : { ...item, ...parsed };
    const plainText = typeof parsed === "string" ? parsed : "";
    return {
      front: String(data?.term || item?.term || "").trim(),
      back: firstText(data.simple_definition, data.definition, data.meaning, plainText),
      note: firstText(data.example, data.meaning_in_context, data.context_meaning, data.in_context),
    };
  };

  const openFlashcardForm = () => {
    if (!selectedWord) return;
    setFlashcard(wordFields(selectedWord));
    setShowFlashcardForm(true);
  };

  const saveFlashcard = async () => {
    if (!flashcard.front.trim() || !flashcard.back.trim()) return;
    try {
      let targetDeckId = deckChoice === "existing" ? selectedDeckId : "";
      if (deckChoice === "new") {
        if (!newDeckName.trim()) return;
        const rows = await supabaseInsert<any>("decks", { owner_id: userId, name: newDeckName.trim() });
        targetDeckId = rows[0]?.id || "";
        setDecks(prev => [...rows, ...prev]);
        setSelectedDeckId(targetDeckId);
      }
      if (!targetDeckId) return;
      await supabaseInsert("cards", {
        deck_id: targetDeckId,
        front: flashcard.front.trim(),
        back: flashcard.back.trim(),
        example: flashcard.note.trim() || null,
        source_type: "reading",
        source_ref: { passage_id: passage?.id, passage_title: passage?.title },
      });
      setNewDeckName("");
      setDeckChoice("existing");
      setShowFlashcardForm(false);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not save this flashcard. Please try again."));
    }
  };

  const handleWordClick = async (word: string) => {
    const clean = word.toLowerCase().replace(/[^a-z']/g, "");
    if (!clean) return;
    const local = vocabByTerm[clean];
    if (local) {
      setSelectedWord(local);
      return;
    }
    try {
      const response = await backendPost<any>("/api/reading/explain", {
        user_id: userId,
        term: clean,
        sentence: word,
        passage_context: body.slice(0, 4000),
        learner_level: displayLevel(passage),
      });
      setSelectedWord({ term: clean, definition: response.output, data: response.data, ai: true });
    } catch {
      setSelectedWord(null);
    }
  };

  const summarize = async () => {
    setShowAISummary(!showAISummary);
    if (summary || !passage) return;
    try {
      const response = await backendPost<any>("/api/reading/summarize", {
        user_id: userId,
        passage_title: passage.title,
        passage_body: body,
        learner_level: displayLevel(passage),
      });
      setSummary(response.output);
    } catch (err) {
      setSummary(getFriendlyErrorMessage(err, "Could not summarize this reading now. Please try again later."));
    }
  };

  const generateQuiz = async () => {
    if (!passage) return;
    setLoadingAction("quiz");
    setError("");
    try {
      const response = await backendPost<any>("/api/reading/quiz", {
        user_id: userId,
        passage_title: passage.title,
        passage_body: body,
        learner_level: displayLevel(passage),
        question_count: 5,
        question_type: "mixed",
      });
      const generated = parseAiQuestions(response).map(normalizeGeneratedQuestion);
      if (generated.length) {
        setQuestions(generated);
        setAnswers({});
        setSubmitted(false);
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not generate questions right now."));
    } finally {
      setLoadingAction("");
    }
  };

  const assessDifficulty = async () => {
    if (!passage) return;
    setLoadingAction("difficulty");
    setError("");
    try {
      const response = await backendPost<any>("/api/reading/difficulty", {
        user_id: userId,
        passage_title: passage.title,
        passage_body: body,
        learner_level: displayLevel(passage),
      });
      setDifficulty(response.output || "");
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not assess difficulty right now."));
    } finally {
      setLoadingAction("");
    }
  };

  const generatePractice = async () => {
    setLoadingAction("generate");
    setError("");
    try {
      const response = await backendPost<any>("/api/reading/generate", {
        user_id: userId,
        learner_level: generator.level,
        topic: generator.topic,
        word_count: generator.wordCount,
        question_count: generator.questionCount,
      });
      const data = parseAiObject(response);
      const generatedPassage = {
        id: `ai-${Date.now()}`,
        title: firstText(data.title) || `AI Practice - ${generator.topic}`,
        topic: firstText(data.topic) || generator.topic,
        level: firstText(data.level, data.cefr_level) || generator.level,
        body: firstText(data.body, data.passage, data.content),
        estimated_minutes: data.estimated_minutes || Math.max(3, Math.round(generator.wordCount / 120)),
        vocabulary: asArray(data.vocabulary),
        questions: asArray(data.questions),
        generated: true,
      };
      if (!generatedPassage.body) throw new Error("AI response did not include a passage body.");
      setPassages(prev => [generatedPassage, ...prev.filter(item => item.id !== generatedPassage.id)]);
      setPassage(generatedPassage);
      setGeneratorOpen(false);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Could not generate a new reading passage right now."));
    } finally {
      setLoadingAction("");
    }
  };

  const saveProgress = async (completed: boolean) => {
    if (!canTrackProgress || !passage?.id || String(passage.id).startsWith("ai-") || String(passage.id).startsWith("sample-reading-")) return;
    const wordsRead = body.split(/\s+/).filter(Boolean).length;
    const existing = progressByPassage[passage.id];
    const payload = {
      user_id: userId,
      passage_id: passage.id,
      words_read: wordsRead,
      completed,
      last_read_at: new Date().toISOString(),
    };
    try {
      const rows = existing?.id
        ? await supabasePatch<any>("reading_progress", { id: `eq.${existing.id}` }, payload)
        : await supabaseInsert<any>("reading_progress", payload);
      if (rows[0]) {
        setProgressRows(prev => [rows[0], ...prev.filter(row => row.id !== rows[0].id)]);
      }
    } catch {
      // Progress is helpful, but it should never block practice.
    }
  };

  const answerSchema = (question: any) => {
    const raw = question.answer_schema ?? question.answer ?? {};
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : { value: raw };
      } catch {
        return { value: raw };
      }
    }
    return raw && typeof raw === "object" ? raw : { value: raw };
  };
  const choiceToIndex = (value: unknown, choices: string[]) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value ?? "").trim();
    if (!text) return -1;
    if (/^\d+$/.test(text)) return Number(text);
    if (/^[A-D]$/i.test(text)) return text.toUpperCase().charCodeAt(0) - 65;
    const normalized = text.toLowerCase();
    return choices.findIndex(choice => String(choice).trim().toLowerCase() === normalized);
  };
  const answerIndex = (question: any, choices: string[] = []) => {
    const schema = answerSchema(question);
    const value = question.correct_index
      ?? question.correctIndex
      ?? schema.correctIndex
      ?? schema.correct_index
      ?? schema.choiceIndex
      ?? schema.choice_index
      ?? schema.index
      ?? schema.correctAnswer
      ?? schema.correct_answer
      ?? schema.answer
      ?? schema.value;
    const index = choiceToIndex(value, choices);
    return index >= 0 && index < choices.length ? index : -1;
  };
  const answerExplanation = (question: any) => firstText(
    question.explanation,
    answerSchema(question).explanation,
    answerSchema(question).reason,
    answerSchema(question).rationale,
  );
  const correctCount = questions.reduce((sum, question, index) => {
    const choices = Array.isArray(question.choices) ? question.choices : [];
    const answer = answerIndex(question, choices);
    return answer >= 0 && answers[index] === answer ? sum + 1 : sum;
  }, 0);
  const allAnswered = questions.length > 0 && questions.every((_, index) => answers[index] !== undefined);
  const submitAnswers = () => {
    if (!allAnswered) return;
    setSubmitted(true);
    saveProgress(true);
  };
  const retryQuiz = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Reading Library</h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>
            Practice with curated passages, AI support, vocabulary, and progress tracking.
          </p>
        </div>
        <button onClick={() => setGeneratorOpen(value => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-white" style={{ background: "#2D6A4F", fontSize: "0.875rem" }}>
          <Sparkles size={16} /> AI Practice Builder
        </button>
      </div>

      {error && <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>{error}</div>}

      <AnimatePresence>
        {generatorOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-white rounded-2xl border border-border p-4 mb-5">
            <div className="grid gap-3 md:grid-cols-[120px_1fr_150px_150px_auto] md:items-end">
              <label className="grid gap-1">
                <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Level</span>
                <select value={generator.level} onChange={event => setGenerator(prev => ({ ...prev, level: event.target.value }))} className="border border-border rounded-xl px-3 py-2 bg-white">
                  {LEVELS.filter(item => item !== "All").map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Topic</span>
                <input value={generator.topic} onChange={event => setGenerator(prev => ({ ...prev, topic: event.target.value }))} className="border border-border rounded-xl px-3 py-2" placeholder="business, travel, health..." />
              </label>
              <label className="grid gap-1">
                <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Words</span>
                <input type="number" min={120} max={650} value={generator.wordCount} onChange={event => setGenerator(prev => ({ ...prev, wordCount: Number(event.target.value) }))} className="border border-border rounded-xl px-3 py-2" />
              </label>
              <label className="grid gap-1">
                <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Questions</span>
                <input type="number" min={1} max={10} value={generator.questionCount} onChange={event => setGenerator(prev => ({ ...prev, questionCount: Number(event.target.value) }))} className="border border-border rounded-xl px-3 py-2" />
              </label>
              <button onClick={generatePractice} disabled={loadingAction === "generate"} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-white disabled:opacity-50" style={{ background: "#2D6A4F", fontSize: "0.875rem" }}>
                {loadingAction === "generate" ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                Generate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search passages" className="w-full border border-border rounded-xl pl-9 pr-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className="inline-flex items-center gap-1 text-muted-foreground" style={{ fontSize: "0.75rem" }}><Filter size={12} /> Level</span>
                <select value={levelFilter} onChange={event => setLevelFilter(event.target.value)} className="border border-border rounded-xl px-3 py-2 bg-white">
                  {LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>Topic</span>
                <select value={topicFilter} onChange={event => setTopicFilter(event.target.value)} className="border border-border rounded-xl px-3 py-2 bg-white">
                  {topics.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            {filteredPassages.map(item => {
              const active = passage?.id === item.id;
              const progress = progressByPassage[item.id];
              return (
                <button key={item.id} onClick={() => setPassage(item)} className={`w-full rounded-2xl border p-4 text-left transition-all ${active ? "border-primary bg-primary/5" : "border-border bg-white hover:bg-muted"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-foreground" style={{ fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.35 }}>{item.title}</h2>
                      <p className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem" }}>{item.topic || "General"}</p>
                    </div>
                    {progress?.completed && <CheckCircle2 size={17} style={{ color: "#2D6A4F" }} />}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2.5 py-1" style={{ background: "#D8F3DC", color: "#2D6A4F", fontSize: "0.7rem", fontWeight: 700 }}>{displayLevel(item)}</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground" style={{ fontSize: "0.72rem" }}><Clock3 size={12} /> {item.estimated_minutes || 5} min</span>
                    {item.generated && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground" style={{ fontSize: "0.7rem" }}>AI</span>}
                    {item.sample && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground" style={{ fontSize: "0.7rem" }}>Sample</span>}
                  </div>
                </button>
              );
            })}
            {filteredPassages.length === 0 && (
              <div className="bg-white rounded-2xl border border-border p-5 text-muted-foreground" style={{ fontSize: "0.875rem" }}>No passages match these filters.</div>
            )}
          </div>
        </aside>

        <main className="min-w-0">
          {!passage ? (
            <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground">No published reading passages found.</div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-border overflow-hidden mb-5">
                <div className="p-6 border-b border-border">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-full" style={{ background: "#D8F3DC", color: "#2D6A4F", fontSize: "0.75rem", fontWeight: 700 }}>{displayLevel(passage)}</span>
                        <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{passage.topic || passage.slug || "Reading passage"}</span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground" style={{ fontSize: "0.75rem" }}><Clock3 size={12} /> {passage.estimated_minutes || 5} min</span>
                        {currentProgress?.completed && <span className="inline-flex items-center gap-1 text-primary" style={{ fontSize: "0.75rem", fontWeight: 700 }}><CheckCircle2 size={13} /> Completed</span>}
                      </div>
                      <h2 className="text-foreground" style={{ fontSize: "1.375rem", fontWeight: 700, lineHeight: 1.4 }}>{passage.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={generateQuiz} disabled={loadingAction === "quiz"} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-muted-foreground hover:bg-muted disabled:opacity-50" style={{ fontSize: "0.8125rem" }}>
                        {loadingAction === "quiz" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        New Quiz
                      </button>
                      <button onClick={assessDifficulty} disabled={loadingAction === "difficulty"} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-muted-foreground hover:bg-muted disabled:opacity-50" style={{ fontSize: "0.8125rem" }}>
                        {loadingAction === "difficulty" ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                        Difficulty
                      </button>
                    </div>
                  </div>
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
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <WordExplanation item={selectedWord} />
                        </div>
                        <button onClick={openFlashcardForm} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-primary border border-primary" style={{ fontSize: "0.75rem" }}>
                          <Plus size={12} /> Flashcard
                        </button>
                      </div>
                      {showFlashcardForm && (
                        <div className="mt-4 grid gap-2 rounded-xl border border-border bg-white p-3">
                          <div className="grid sm:grid-cols-2 gap-2">
                            <button type="button" onClick={() => setDeckChoice("existing")} className={`rounded-xl border px-3 py-2 text-left ${deckChoice === "existing" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`} style={{ fontSize: "0.8125rem" }}>Add to existing deck</button>
                            <button type="button" onClick={() => setDeckChoice("new")} className={`rounded-xl border px-3 py-2 text-left ${deckChoice === "new" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`} style={{ fontSize: "0.8125rem" }}>Create new deck</button>
                          </div>
                          {deckChoice === "existing" ? (
                            <select value={selectedDeckId} onChange={event => setSelectedDeckId(event.target.value)} className="border border-border rounded-xl px-3 py-2 bg-white">
                              <option value="">Select deck</option>
                              {decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
                            </select>
                          ) : (
                            <input value={newDeckName} onChange={event => setNewDeckName(event.target.value)} placeholder="New deck name" className="border border-border rounded-xl px-3 py-2" />
                          )}
                          <input value={flashcard.front} onChange={event => setFlashcard(prev => ({ ...prev, front: event.target.value }))} placeholder="Front" className="border border-border rounded-xl px-3 py-2" />
                          <input value={flashcard.back} onChange={event => setFlashcard(prev => ({ ...prev, back: event.target.value }))} placeholder="Back" className="border border-border rounded-xl px-3 py-2" />
                          <textarea value={flashcard.note} onChange={event => setFlashcard(prev => ({ ...prev, note: event.target.value }))} placeholder="Note / example" className="border border-border rounded-xl px-3 py-2 min-h-20" />
                          <button onClick={saveFlashcard} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-white" style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}>
                            <Plus size={14} /> Save Flashcard
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-5">
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
                      <SummaryView value={summary} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {difficulty && (
                  <div className="bg-white rounded-xl border border-border p-5">
                    <DetailBlock label="Difficulty analysis">
                      <SummaryView value={difficulty} />
                    </DetailBlock>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-border p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} style={{ color: "#2D6A4F" }} />
                    <div>
                      <h3 className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>Comprehension Check</h3>
                      <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
                        Choose your answers, then submit to see the correct answers and explanations.
                      </p>
                    </div>
                  </div>
                  {submitted && (
                    <div className="rounded-xl px-3 py-2 text-primary border border-primary bg-primary/5" style={{ fontSize: "0.8125rem", fontWeight: 700 }}>
                      Score: {correctCount}/{questions.length}
                    </div>
                  )}
                </div>
                {questions.length === 0 ? <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>No questions for this passage yet. Use New Quiz to generate practice questions.</p> : (
                  <div className="space-y-5">
                    {questions.map((q, qi) => {
                      const choices = Array.isArray(q.choices) ? q.choices : [];
                      const answer = answerIndex(q, choices);
                      const explanation = answerExplanation(q);
                      const selectedAnswer = answers[qi];
                      const isCorrect = submitted && answer >= 0 && selectedAnswer === answer;
                      return (
                        <div key={q.id || qi} className="rounded-xl border border-border p-3">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <p className="text-foreground" style={{ fontSize: "0.875rem", fontWeight: 500 }}>{qi + 1}. {q.prompt}</p>
                            {submitted && (
                              <span className="flex-shrink-0 rounded-full px-2.5 py-1" style={{ background: isCorrect ? "#F0FAF4" : "#FFEEF0", color: isCorrect ? "#2D6A4F" : "#EF476F", fontSize: "0.7rem", fontWeight: 700 }}>
                                {isCorrect ? "Correct" : "Review"}
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {choices.map((opt: string, oi: number) => {
                              const selected = answers[qi] === oi;
                              const showResult = submitted;
                              const isAnswer = answer >= 0 && oi === answer;
                              return (
                                <button key={oi} onClick={() => !showResult && setAnswers(a => ({ ...a, [qi]: oi }))} className="w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all" style={{ borderColor: showResult && isAnswer ? "#52B788" : showResult && selected && !isAnswer ? "#EF476F" : selected ? "#2D6A4F" : "#E8F5EE", background: showResult && isAnswer ? "#F0FAF4" : showResult && selected && !isAnswer ? "#FFEEF0" : selected ? "#D8F3DC" : "transparent", fontSize: "0.8125rem", color: "#1F2937" }}>
                                  {String.fromCharCode(65 + oi)}. {opt}
                                </button>
                              );
                            })}
                          </div>
                          {submitted && (
                            <div className="mt-3 rounded-xl bg-muted p-3">
                              <p className="text-foreground" style={{ fontSize: "0.8125rem", fontWeight: 700 }}>
                                {answer >= 0 ? (
                                  <>Correct answer: {String.fromCharCode(65 + answer)}. {choices[answer]}</>
                                ) : (
                                  "Correct answer has not been provided."
                                )}
                              </p>
                              <p className="text-muted-foreground mt-1" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
                                {explanation || "No explanation has been provided for this question yet."}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
                      <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
                        {submitted ? "Review the explanations above, or try again." : `${Object.keys(answers).length}/${questions.length} answered`}
                      </p>
                      <div className="flex gap-2">
                        {submitted && (
                          <button onClick={retryQuiz} className="rounded-xl border border-border px-4 py-2 text-muted-foreground hover:bg-muted hover:text-foreground" style={{ fontSize: "0.8125rem" }}>
                            Try Again
                          </button>
                        )}
                        <button onClick={submitAnswers} disabled={!allAnswered || submitted} className="rounded-xl px-4 py-2 text-white disabled:opacity-45" style={{ background: "#2D6A4F", fontSize: "0.8125rem" }}>
                          Submit Answers
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
