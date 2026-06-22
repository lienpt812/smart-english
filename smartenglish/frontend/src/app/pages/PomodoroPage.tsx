import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  Coffee,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Save,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  getAccessToken,
  getCurrentUserId,
  getFriendlyErrorMessage,
  supabaseInsert,
} from "../lib/api";

type TimerMode = "focus" | "short_break" | "long_break";
type SoundKind = "none" | "rain" | "cafe" | "white_noise";

type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  sound: SoundKind;
  volume: number;
};

type PomodoroLog = {
  id: string;
  mode: TimerMode;
  label: string;
  minutes: number;
  completedAt: string;
};

const STORAGE_KEY = "smartenglish.pomodoro.settings";
const LOG_KEY = "smartenglish.pomodoro.logs";

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  sound: "none",
  volume: 0.25,
};

const SOUND_LABELS: Record<SoundKind, string> = {
  none: "No sound",
  rain: "Soft rain",
  cafe: "Cafe ambience",
  white_noise: "White noise",
};

function loadSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadLogs(): PomodoroLog[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function modeLabel(mode: TimerMode) {
  if (mode === "short_break") return "Short Break";
  if (mode === "long_break") return "Long Break";
  return "Focus";
}

function minutesForMode(mode: TimerMode, settings: PomodoroSettings) {
  if (mode === "short_break") return settings.shortBreakMinutes;
  if (mode === "long_break") return settings.longBreakMinutes;
  return settings.focusMinutes;
}

function createNoiseBuffer(context: AudioContext, kind: SoundKind) {
  const seconds = 2;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === "rain") {
      data[i] = white * (Math.random() > 0.985 ? 0.8 : 0.18);
    } else if (kind === "cafe") {
      data[i] = Math.sin(i / 70) * 0.08 + white * 0.12;
    } else {
      data[i] = white * 0.22;
    }
  }

  return buffer;
}

export function PomodoroPage() {
  const [settings, setSettings] = useState<PomodoroSettings>(() => loadSettings());
  const [logs, setLogs] = useState<PomodoroLog[]>(() => loadLogs());
  const [mode, setMode] = useState<TimerMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(() => DEFAULT_SETTINGS.focusMinutes * 60);
  const [running, setRunning] = useState(false);
  const [completedFocus, setCompletedFocus] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const audioRef = useRef<{
    context: AudioContext;
    source: AudioBufferSourceNode;
    gain: GainNode;
  } | null>(null);

  const durationSeconds = minutesForMode(mode, settings) * 60;
  const progress = durationSeconds ? 1 - secondsLeft / durationSeconds : 0;
  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayLogs = logs.filter(log => new Date(log.completedAt).toDateString() === today);
    const focusLogs = logs.filter(log => log.mode === "focus");
    return {
      todayCount: todayLogs.length,
      todayMinutes: todayLogs.reduce((sum, log) => sum + log.minutes, 0),
      focusMinutes: focusLogs.reduce((sum, log) => sum + log.minutes, 0),
    };
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, 50)));
  }, [logs]);

  useEffect(() => {
    setSecondsLeft(durationSeconds);
    setRunning(false);
    setSessionStartedAt(null);
  }, [durationSeconds, mode]);

  useEffect(() => {
    if (!running) return;
    if (!sessionStartedAt) setSessionStartedAt(new Date().toISOString());

    const id = window.setInterval(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [running, sessionStartedAt]);

  useEffect(() => {
    if (secondsLeft !== 0 || !running) return;
    setRunning(false);
    finishSession();
  }, [secondsLeft, running]);

  useEffect(() => {
    if (!running || settings.sound === "none") {
      stopSound();
      return;
    }
    startSound();
    return () => stopSound();
  }, [running, settings.sound, settings.volume]);

  const stopSound = () => {
    if (!audioRef.current) return;
    try {
      audioRef.current.source.stop();
      audioRef.current.context.close();
    } catch {
      // Audio nodes may already be stopped by the browser.
    }
    audioRef.current = null;
  };

  const startSound = () => {
    stopSound();
    if (settings.sound === "none") return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const gain = context.createGain();
    const source = context.createBufferSource();
    source.buffer = createNoiseBuffer(context, settings.sound);
    source.loop = true;
    gain.gain.value = settings.volume;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
    audioRef.current = { context, source, gain };
  };

  const nextModeAfterCompletion = () => {
    if (mode !== "focus") return "focus";
    const nextFocusCount = completedFocus + 1;
    return nextFocusCount % settings.longBreakEvery === 0 ? "long_break" : "short_break";
  };

  const finishSession = async () => {
    const completedAt = new Date().toISOString();
    const minutesCompleted = minutesForMode(mode, settings);
    const startedAt = sessionStartedAt || new Date(Date.now() - minutesCompleted * 60_000).toISOString();
    const nextLog: PomodoroLog = {
      id: crypto.randomUUID(),
      mode,
      label: modeLabel(mode),
      minutes: minutesCompleted,
      completedAt,
    };

    setLogs(prev => [nextLog, ...prev].slice(0, 50));
    setSavedMessage("Session saved locally.");
    window.setTimeout(() => setSavedMessage(""), 3500);

    if (mode === "focus") {
      setCompletedFocus(prev => prev + 1);
      if (getAccessToken()) {
        try {
          await supabaseInsert("sessions", {
            user_id: getCurrentUserId(),
            kind: "practice",
            title: "Pomodoro focus session",
            started_at: startedAt,
            ended_at: completedAt,
            payload: {
              module: "pomodoro",
              focus_minutes: minutesCompleted,
              sound: settings.sound,
              source: "frontend_m13",
            },
          });
          setSavedMessage("Focus session saved to Dashboard.");
        } catch (err) {
          setError(getFriendlyErrorMessage(err, "Could not save Pomodoro session to Dashboard."));
        }
      }
    }

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`${modeLabel(mode)} complete`, {
        body: mode === "focus" ? "Time for a break." : "Ready for the next focus session?",
      });
    }

    const nextMode = nextModeAfterCompletion();
    setMode(nextMode);
    setSessionStartedAt(null);
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
  };

  const updateSetting = (key: keyof PomodoroSettings, value: number | SoundKind) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetTimer = () => {
    setRunning(false);
    setSecondsLeft(durationSeconds);
    setSessionStartedAt(null);
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Pomodoro
          </h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>
            Focus timer with local history, ambient sound, and Dashboard study-time logging.
          </p>
        </div>
        <button
          onClick={requestNotifications}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-muted-foreground hover:text-foreground"
          style={{ fontSize: "0.8125rem" }}
        >
          <Bell size={15} />
          Enable alerts
        </button>
      </div>

      {error && (
        <div className="bg-white rounded-xl border border-border p-3 mb-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      {savedMessage && (
        <div className="bg-white rounded-xl border border-border p-3 mb-4 text-primary flex items-center gap-2" style={{ fontSize: "0.8125rem" }}>
          <CheckCircle2 size={15} />
          {savedMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-6">
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#D8F3DC" }}>
            <Timer size={22} style={{ color: "#2D6A4F" }} />
          </div>
          <h2 className="text-foreground mb-2" style={{ fontSize: "1.25rem", fontWeight: 750 }}>
            {modeLabel(mode)}
          </h2>
          <p className="text-muted-foreground mb-6" style={{ fontSize: "0.875rem" }}>
            {mode === "focus" ? "Stay with one task until the timer ends." : "Recover before the next focus block."}
          </p>

          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {(["focus", "short_break", "long_break"] as TimerMode[]).map(item => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`px-4 py-2 rounded-xl border ${mode === item ? "text-white" : "text-muted-foreground bg-white"}`}
                style={{ background: mode === item ? "#2D6A4F" : undefined, fontSize: "0.8125rem" }}
              >
                {modeLabel(item)}
              </button>
            ))}
          </div>

          <div
            className="mx-auto mb-8 rounded-full flex items-center justify-center"
            style={{
              width: 240,
              height: 240,
              background: `conic-gradient(#2D6A4F ${progress * 360}deg, #E8F5EE 0deg)`,
            }}
          >
            <div className="rounded-full bg-white flex flex-col items-center justify-center" style={{ width: 205, height: 205 }}>
              <span className="text-foreground font-mono" style={{ fontSize: "3.1rem", fontWeight: 800 }}>
                {minutes}:{seconds}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
                {Math.round(progress * 100)}% complete
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => setRunning(prev => !prev)}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
              style={{ background: "#2D6A4F" }}
            >
              {running ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={resetTimer} className="w-12 h-12 rounded-xl flex items-center justify-center border border-border">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-border p-5">
            <h3 className="text-foreground font-semibold mb-4" style={{ fontSize: "0.9375rem" }}>
              Timer Settings
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["focusMinutes", "Focus", 5, 90],
                ["shortBreakMinutes", "Short break", 1, 30],
                ["longBreakMinutes", "Long break", 5, 45],
                ["longBreakEvery", "Long break every", 2, 8],
              ].map(([key, label, min, max]) => (
                <label key={key as string} className="block">
                  <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{label}</span>
                  <input
                    type="number"
                    min={min as number}
                    max={max as number}
                    value={settings[key as keyof PomodoroSettings] as number}
                    onChange={event => updateSetting(key as keyof PomodoroSettings, Number(event.target.value))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none"
                    style={{ fontSize: "0.875rem" }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Music2 size={16} style={{ color: "#2D6A4F" }} />
              <h3 className="text-foreground font-semibold" style={{ fontSize: "0.9375rem" }}>
                Background Sound
              </h3>
            </div>
            <select
              value={settings.sound}
              onChange={event => updateSetting("sound", event.target.value as SoundKind)}
              className="w-full rounded-xl border border-border px-3 py-2 bg-white mb-4"
            >
              {(Object.keys(SOUND_LABELS) as SoundKind[]).map(sound => (
                <option key={sound} value={sound}>{SOUND_LABELS[sound]}</option>
              ))}
            </select>
            <div className="flex items-center gap-3">
              {settings.sound === "none" ? <VolumeX size={16} className="text-muted-foreground" /> : <Volume2 size={16} style={{ color: "#2D6A4F" }} />}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={event => updateSetting("volume", Number(event.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Clock, label: "Today", value: `${stats.todayMinutes}m` },
              { icon: Coffee, label: "Blocks", value: stats.todayCount },
              { icon: Save, label: "Focus total", value: `${stats.focusMinutes}m` },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-2xl border border-border p-4">
                <item.icon size={16} style={{ color: "#2D6A4F" }} />
                <div className="text-foreground mt-2" style={{ fontSize: "1.125rem", fontWeight: 800 }}>{item.value}</div>
                <div className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5 mt-6">
        <h3 className="text-foreground font-semibold mb-4" style={{ fontSize: "0.9375rem" }}>
          Recent Pomodoro History
        </h3>
        {logs.length === 0 ? (
          <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
            Complete a timer to save local history and, for focus sessions, log study time to Dashboard.
          </p>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 8).map(log => (
              <div key={log.id} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                <div>
                  <p className="text-foreground" style={{ fontSize: "0.875rem", fontWeight: 650 }}>{log.label}</p>
                  <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>{new Date(log.completedAt).toLocaleString()}</p>
                </div>
                <span className="text-primary" style={{ fontSize: "0.8125rem", fontWeight: 700 }}>{log.minutes}m</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
