import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";

const MODES = [
  { label: "Focus", minutes: 25 },
  { label: "Short Break", minutes: 5 },
  { label: "Long Break", minutes: 15 },
];

export function PomodoroPage() {
  const [mode, setMode] = useState(MODES[0]);
  const [secondsLeft, setSecondsLeft] = useState(mode.minutes * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSecondsLeft(mode.minutes * 60);
    setRunning(false);
  }, [mode]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          window.clearInterval(id);
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");
  const progress = 1 - secondsLeft / (mode.minutes * 60);

  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-border p-8 text-center">
        <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#D8F3DC" }}>
          <Timer size={22} style={{ color: "#2D6A4F" }} />
        </div>
        <h1 className="text-foreground mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Pomodoro</h1>
        <p className="text-muted-foreground mb-6" style={{ fontSize: "0.875rem" }}>Local focus timer. Tasks and music will appear when their APIs are available.</p>

        <div className="flex justify-center gap-2 mb-8">
          {MODES.map(item => (
            <button key={item.label} onClick={() => setMode(item)} className={`px-4 py-2 rounded-xl border ${mode.label === item.label ? "text-white" : "text-muted-foreground bg-white"}`} style={{ background: mode.label === item.label ? "#2D6A4F" : undefined, fontSize: "0.8125rem" }}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mx-auto mb-8 rounded-full flex items-center justify-center" style={{ width: 220, height: 220, background: `conic-gradient(#2D6A4F ${progress * 360}deg, #E8F5EE 0deg)` }}>
          <div className="rounded-full bg-white flex items-center justify-center" style={{ width: 190, height: 190 }}>
            <span className="text-foreground font-mono" style={{ fontSize: "3rem", fontWeight: 800 }}>{minutes}:{seconds}</span>
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <button onClick={() => setRunning(!running)} className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: "#2D6A4F" }}>
            {running ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={() => { setRunning(false); setSecondsLeft(mode.minutes * 60); }} className="w-12 h-12 rounded-xl flex items-center justify-center border border-border">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
