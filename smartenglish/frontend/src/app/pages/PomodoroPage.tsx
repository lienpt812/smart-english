import { useEffect, useMemo, useState } from "react";
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
  ActivePomodoro,
  createActivePomodoro,
  DEFAULT_POMODORO_SETTINGS,
  loadPomodoroLogs,
  loadPomodoroSettings,
  minutesForMode,
  modeLabel,
  nextModeAfterCompletion,
  POMODORO_COMPLETE_EVENT,
  POMODORO_EVENT,
  PomodoroLog,
  PomodoroSettings,
  readActivePomodoro,
  remainingSeconds,
  savePomodoroSettings,
  SoundKind,
  SOUND_LABELS,
  TimerMode,
  writeActivePomodoro,
} from "../lib/pomodoro";

export function PomodoroPage() {
  const initialActive = readActivePomodoro();
  const [settings, setSettings] = useState<PomodoroSettings>(() => loadPomodoroSettings());
  const [logs, setLogs] = useState<PomodoroLog[]>(() => loadPomodoroLogs());
  const [mode, setMode] = useState<TimerMode>(() => initialActive?.mode || "focus");
  const [secondsLeft, setSecondsLeft] = useState(() =>
    initialActive ? remainingSeconds(initialActive) : DEFAULT_POMODORO_SETTINGS.focusMinutes * 60,
  );
  const [running, setRunning] = useState(Boolean(initialActive));
  const [activeTimer, setActiveTimer] = useState<ActivePomodoro | null>(initialActive);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(initialActive?.startedAt || null);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [notificationStatus, setNotificationStatus] = useState(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );
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
    savePomodoroSettings(settings);
  }, [settings]);

  useEffect(() => {
    const syncFromStorage = () => {
      const current = readActivePomodoro();
      setLogs(loadPomodoroLogs());
      setActiveTimer(current);
      setRunning(Boolean(current));
      if (current) {
        setMode(current.mode);
        setSecondsLeft(remainingSeconds(current));
        setSessionStartedAt(current.startedAt);
      }
    };

    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ log: PomodoroLog; saveMessage: string; errorMessage?: string }>).detail;
      const nextLogs = loadPomodoroLogs();
      const latestSettings = loadPomodoroSettings();
      const nextMode = nextModeAfterCompletion(detail.log.mode, latestSettings, nextLogs);
      setLogs(nextLogs);
      setSettings(latestSettings);
      setMode(nextMode);
      setSecondsLeft(minutesForMode(nextMode, latestSettings) * 60);
      setRunning(false);
      setActiveTimer(null);
      setSessionStartedAt(null);
      setSavedMessage(detail.saveMessage || "Session saved locally.");
      setError(detail.errorMessage || "");
      window.setTimeout(() => setSavedMessage(""), 3500);
    };

    window.addEventListener(POMODORO_EVENT, syncFromStorage);
    window.addEventListener(POMODORO_COMPLETE_EVENT, onComplete);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(POMODORO_EVENT, syncFromStorage);
      window.removeEventListener(POMODORO_COMPLETE_EVENT, onComplete);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (running) return;
    setSecondsLeft(durationSeconds);
    setSessionStartedAt(null);
  }, [durationSeconds, mode, running]);

  useEffect(() => {
    if (!running) return;

    const id = window.setInterval(() => {
      const current = readActivePomodoro();
      if (!current) {
        setRunning(false);
        setActiveTimer(null);
        return;
      }
      setActiveTimer(current);
      setSecondsLeft(remainingSeconds(current));
    }, 500);

    return () => window.clearInterval(id);
  }, [running]);

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setNotificationStatus("unsupported");
      setError("Browser notifications are not supported in this browser.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
    setSavedMessage(permission === "granted" ? "Alerts enabled." : "Browser alerts are not allowed yet.");
    window.setTimeout(() => setSavedMessage(""), 3500);
  };

  const updateSetting = (key: keyof PomodoroSettings, value: number | SoundKind) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      const current = readActivePomodoro();
      if (current && (key === "sound" || key === "volume")) {
        writeActivePomodoro({ ...current, sound: next.sound, volume: next.volume });
      }
      return next;
    });
  };

  const startTimer = () => {
    const startedAt = sessionStartedAt || new Date().toISOString();
    const active = createActivePomodoro(mode, secondsLeft, settings, startedAt);
    writeActivePomodoro(active);
    setActiveTimer(active);
    setSessionStartedAt(startedAt);
    setRunning(true);
    setError("");
  };

  const pauseTimer = () => {
    const current = activeTimer || readActivePomodoro();
    if (current) setSecondsLeft(remainingSeconds(current));
    writeActivePomodoro(null);
    setActiveTimer(null);
    setRunning(false);
  };

  const resetTimer = () => {
    writeActivePomodoro(null);
    setActiveTimer(null);
    setRunning(false);
    setSecondsLeft(durationSeconds);
    setSessionStartedAt(null);
  };

  const switchMode = (nextMode: TimerMode) => {
    if (running) return;
    setMode(nextMode);
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-foreground" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Pomodoro
          </h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>
            Focus timer with persistent countdown, local history, ambient sound, and Dashboard study-time logging.
          </p>
        </div>
        <button
          onClick={requestNotifications}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-muted-foreground hover:text-foreground"
          style={{ fontSize: "0.8125rem" }}
        >
          <Bell size={15} />
          Enable alerts
          <span className="rounded-full bg-muted px-2 py-0.5" style={{ fontSize: "0.68rem" }}>
            {notificationStatus}
          </span>
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
            {running
              ? "This timer keeps running while you move around the app."
              : mode === "focus"
                ? "Stay with one task until the timer ends."
                : "Recover before the next focus block."}
          </p>

          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {(["focus", "short_break", "long_break"] as TimerMode[]).map(item => (
              <button
                key={item}
                onClick={() => switchMode(item)}
                disabled={running}
                className={`px-4 py-2 rounded-xl border ${mode === item ? "text-white" : "text-muted-foreground bg-white"} ${running ? "opacity-60 cursor-not-allowed" : ""}`}
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
              background: `conic-gradient(#2D6A4F ${Math.max(0, Math.min(1, progress)) * 360}deg, #E8F5EE 0deg)`,
            }}
          >
            <div className="rounded-full bg-white flex flex-col items-center justify-center" style={{ width: 205, height: 205 }}>
              <span className="text-foreground font-mono" style={{ fontSize: "3.1rem", fontWeight: 800 }}>
                {minutes}:{seconds}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
                {Math.round(Math.max(0, Math.min(1, progress)) * 100)}% complete
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={running ? pauseTimer : startTimer}
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
                    disabled={running}
                    value={settings[key as keyof PomodoroSettings] as number}
                    onChange={event => updateSetting(key as keyof PomodoroSettings, Number(event.target.value))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none disabled:opacity-60"
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
