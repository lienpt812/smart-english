import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Timer, X } from "lucide-react";
import {
  ActivePomodoro,
  completeActivePomodoro,
  POMODORO_COMPLETE_EVENT,
  POMODORO_EVENT,
  readActivePomodoro,
  remainingSeconds,
  SoundKind,
} from "../lib/pomodoro";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
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

export function PomodoroRuntime() {
  const [active, setActive] = useState<ActivePomodoro | null>(() => readActivePomodoro());
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const current = readActivePomodoro();
    return current ? remainingSeconds(current) : 0;
  });
  const [toast, setToast] = useState("");
  const completingRef = useRef("");
  const audioRef = useRef<{
    context: AudioContext;
    source: AudioBufferSourceNode;
    gain: GainNode;
    activeId: string;
  } | null>(null);
  const navigate = useNavigate();

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

  const startSound = (current: ActivePomodoro) => {
    if (current.sound === "none") {
      stopSound();
      return;
    }
    if (audioRef.current?.activeId === current.id) {
      audioRef.current.gain.gain.value = current.volume;
      return;
    }

    stopSound();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const gain = context.createGain();
    const source = context.createBufferSource();
    source.buffer = createNoiseBuffer(context, current.sound);
    source.loop = true;
    gain.gain.value = current.volume;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
    audioRef.current = { context, source, gain, activeId: current.id };
  };

  useEffect(() => {
    const sync = () => {
      const current = readActivePomodoro();
      setActive(current);
      setSecondsLeft(current ? remainingSeconds(current) : 0);
      if (current) startSound(current);
      else stopSound();
    };

    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ log?: { label?: string }; errorMessage?: string }>).detail;
      setToast(detail?.errorMessage || `${detail?.log?.label || "Pomodoro"} complete.`);
      window.setTimeout(() => setToast(""), 7000);
    };

    window.addEventListener(POMODORO_EVENT, sync);
    window.addEventListener(POMODORO_COMPLETE_EVENT, onComplete);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(POMODORO_EVENT, sync);
      window.removeEventListener(POMODORO_COMPLETE_EVENT, onComplete);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(async () => {
      const current = readActivePomodoro();
      if (!current) {
        setActive(null);
        setSecondsLeft(0);
        completingRef.current = "";
        stopSound();
        return;
      }

      const nextSeconds = remainingSeconds(current);
      setActive(current);
      setSecondsLeft(nextSeconds);
      startSound(current);

      if (nextSeconds > 0 || completingRef.current === current.id) return;
      completingRef.current = current.id;
      try {
        await completeActivePomodoro(current);
      } finally {
        completingRef.current = "";
      }
    }, 1000);

    return () => {
      window.clearInterval(id);
      stopSound();
    };
  }, []);

  return (
    <>
      {active && (
        <button
          onClick={() => navigate("/pomodoro")}
          className="fixed right-4 bottom-20 lg:bottom-4 z-40 flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-foreground shadow-lg hover:bg-muted"
          style={{ fontSize: "0.8125rem" }}
        >
          <Timer size={15} style={{ color: "#2D6A4F" }} />
          <span className="font-semibold">{active.label}</span>
          <span className="font-mono text-primary">{formatTime(secondsLeft)}</span>
        </button>
      )}

      {toast && (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-border bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "#D8F3DC" }}>
              <Timer size={16} style={{ color: "#2D6A4F" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground font-semibold" style={{ fontSize: "0.875rem" }}>
                Pomodoro
              </p>
              <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.8125rem" }}>
                {toast}
              </p>
            </div>
            <button onClick={() => setToast("")} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
