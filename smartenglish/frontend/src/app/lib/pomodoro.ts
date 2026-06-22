import {
  getAccessToken,
  getCurrentUserId,
  getFriendlyErrorMessage,
  supabaseInsert,
} from "./api";

export type TimerMode = "focus" | "short_break" | "long_break";
export type SoundKind = "none" | "rain" | "cafe" | "white_noise";

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  sound: SoundKind;
  volume: number;
};

export type PomodoroLog = {
  id: string;
  mode: TimerMode;
  label: string;
  minutes: number;
  completedAt: string;
};

export type ActivePomodoro = {
  id: string;
  mode: TimerMode;
  label: string;
  startedAt: string;
  endsAt: string;
  durationSeconds: number;
  minutes: number;
  sound: SoundKind;
  volume: number;
};

export type CompletedPomodoro = {
  log: PomodoroLog;
  saveMessage: string;
  errorMessage?: string;
};

export const POMODORO_SETTINGS_KEY = "smartenglish.pomodoro.settings";
export const POMODORO_LOG_KEY = "smartenglish.pomodoro.logs";
export const POMODORO_ACTIVE_KEY = "smartenglish.pomodoro.active";
export const POMODORO_EVENT = "smartenglish:pomodoro";
export const POMODORO_COMPLETE_EVENT = "smartenglish:pomodoro-complete";

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  sound: "none",
  volume: 0.25,
};

export const SOUND_LABELS: Record<SoundKind, string> = {
  none: "No sound",
  rain: "Soft rain",
  cafe: "Cafe ambience",
  white_noise: "White noise",
};

export function modeLabel(mode: TimerMode) {
  if (mode === "short_break") return "Short Break";
  if (mode === "long_break") return "Long Break";
  return "Focus";
}

export function minutesForMode(mode: TimerMode, settings: PomodoroSettings) {
  if (mode === "short_break") return settings.shortBreakMinutes;
  if (mode === "long_break") return settings.longBreakMinutes;
  return settings.focusMinutes;
}

export function loadPomodoroSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(POMODORO_SETTINGS_KEY);
    return raw ? { ...DEFAULT_POMODORO_SETTINGS, ...JSON.parse(raw) } : DEFAULT_POMODORO_SETTINGS;
  } catch {
    return DEFAULT_POMODORO_SETTINGS;
  }
}

export function savePomodoroSettings(settings: PomodoroSettings) {
  localStorage.setItem(POMODORO_SETTINGS_KEY, JSON.stringify(settings));
  emitPomodoroEvent();
}

export function loadPomodoroLogs(): PomodoroLog[] {
  try {
    return JSON.parse(localStorage.getItem(POMODORO_LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePomodoroLogs(logs: PomodoroLog[]) {
  localStorage.setItem(POMODORO_LOG_KEY, JSON.stringify(logs.slice(0, 50)));
  emitPomodoroEvent();
}

export function readActivePomodoro(): ActivePomodoro | null {
  try {
    const raw = localStorage.getItem(POMODORO_ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeActivePomodoro(active: ActivePomodoro | null) {
  if (active) {
    localStorage.setItem(POMODORO_ACTIVE_KEY, JSON.stringify(active));
  } else {
    localStorage.removeItem(POMODORO_ACTIVE_KEY);
  }
  emitPomodoroEvent();
}

export function emitPomodoroEvent() {
  window.dispatchEvent(new Event(POMODORO_EVENT));
}

export function emitPomodoroCompleteEvent(detail: CompletedPomodoro) {
  window.dispatchEvent(new CustomEvent<CompletedPomodoro>(POMODORO_COMPLETE_EVENT, { detail }));
}

export function remainingSeconds(active: ActivePomodoro) {
  return Math.max(0, Math.ceil((new Date(active.endsAt).getTime() - Date.now()) / 1000));
}

export function createActivePomodoro(
  mode: TimerMode,
  secondsLeft: number,
  settings: PomodoroSettings,
  startedAt?: string | null,
): ActivePomodoro {
  const now = Date.now();
  const durationSeconds = minutesForMode(mode, settings) * 60;
  return {
    id: crypto.randomUUID(),
    mode,
    label: modeLabel(mode),
    startedAt: startedAt || new Date(now).toISOString(),
    endsAt: new Date(now + secondsLeft * 1000).toISOString(),
    durationSeconds,
    minutes: minutesForMode(mode, settings),
    sound: settings.sound,
    volume: settings.volume,
  };
}

export function nextModeAfterCompletion(
  completedMode: TimerMode,
  settings: PomodoroSettings,
  logs: PomodoroLog[] = loadPomodoroLogs(),
) {
  if (completedMode !== "focus") return "focus";
  const completedFocusCount = logs.filter(log => log.mode === "focus").length;
  return completedFocusCount % settings.longBreakEvery === 0 ? "long_break" : "short_break";
}

export async function completeActivePomodoro(active: ActivePomodoro): Promise<CompletedPomodoro> {
  const completedAt = new Date().toISOString();
  const log: PomodoroLog = {
    id: crypto.randomUUID(),
    mode: active.mode,
    label: active.label,
    minutes: active.minutes,
    completedAt,
  };
  const logs = [log, ...loadPomodoroLogs()].slice(0, 50);
  savePomodoroLogs(logs);
  writeActivePomodoro(null);

  let saveMessage = "Session saved locally.";
  let errorMessage = "";

  if (active.mode === "focus" && getAccessToken()) {
    try {
      await supabaseInsert("sessions", {
        user_id: getCurrentUserId(),
        kind: "practice",
        title: "Pomodoro focus session",
        started_at: active.startedAt,
        ended_at: completedAt,
        payload: {
          module: "pomodoro",
          focus_minutes: active.minutes,
          sound: active.sound,
          source: "frontend_m13_runtime",
        },
      });
      try {
        await supabaseInsert("xp_events", {
          user_id: getCurrentUserId(),
          event_type: "study_session_completed",
          xp: Math.max(10, Math.min(100, active.minutes * 2)),
          metadata: {
            module: "pomodoro",
            minutes: active.minutes,
          },
        });
      } catch {
        // XP is motivational metadata; study-session saving remains the primary action.
      }
      saveMessage = "Focus session saved to Dashboard.";
    } catch (err) {
      errorMessage = getFriendlyErrorMessage(err, "Could not save Pomodoro session to Dashboard.");
    }
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`${active.label} complete`, {
      body: active.mode === "focus" ? "Time for a break." : "Ready for the next focus session?",
    });
  }

  const result = { log, saveMessage, errorMessage: errorMessage || undefined };
  emitPomodoroCompleteEvent(result);
  return result;
}
