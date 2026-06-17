import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getAccessToken, supabasePatch, supabaseSelect } from "../lib/api";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any | null>(null);
  const [form, setForm] = useState({ display_name: "", level: "B1", target_cert: "TOEIC" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) return;
    supabaseSelect<any>("profiles", { select: "*", limit: 1 })
      .then(rows => {
        const next = rows[0] || null;
        setProfile(next);
        setForm({
          display_name: next?.display_name || "",
          level: next?.level || "B1",
          target_cert: next?.target_cert || "TOEIC",
        });
      })
      .catch(err => setError(err instanceof Error ? err.message : "Could not load profile."));
  }, []);

  const save = async () => {
    if (!getAccessToken()) {
      navigate("/dashboard");
      return;
    }
    try {
      await supabasePatch("profiles", { id: `eq.${profile?.id}` }, {
        ...form,
        onboarding_completed: true,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save onboarding.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#F8F9FA" }}>
      <div className="w-full max-w-xl bg-white rounded-2xl border border-border p-6">
        <h1 className="text-foreground mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Set Up Your Profile</h1>
        <p className="text-muted-foreground mb-6" style={{ fontSize: "0.875rem" }}>
          This form saves directly to your Supabase `profiles` row. Placement testing will appear when its API is available.
        </p>
        {error && <p className="text-muted-foreground mb-4" style={{ fontSize: "0.8125rem" }}>{error}</p>}
        <div className="space-y-4">
          <label className="block">
            <span className="text-foreground" style={{ fontSize: "0.8125rem" }}>Display name</span>
            <input value={form.display_name} onChange={e => setForm(prev => ({ ...prev, display_name: e.target.value }))} className="mt-1 w-full border border-border rounded-xl px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-foreground" style={{ fontSize: "0.8125rem" }}>Current level</span>
            <select value={form.level} onChange={e => setForm(prev => ({ ...prev, level: e.target.value }))} className="mt-1 w-full border border-border rounded-xl px-3 py-2 bg-white">
              {["A1", "A2", "B1", "B2", "C1", "C2"].map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-foreground" style={{ fontSize: "0.8125rem" }}>Goal</span>
            <select value={form.target_cert} onChange={e => setForm(prev => ({ ...prev, target_cert: e.target.value }))} className="mt-1 w-full border border-border rounded-xl px-3 py-2 bg-white">
              {["TOEIC", "IELTS", "COMMUNICATION"].map(goal => <option key={goal} value={goal}>{goal}</option>)}
            </select>
          </label>
        </div>
        <button onClick={save} className="mt-6 w-full rounded-xl py-3 text-white" style={{ background: "#2D6A4F" }}>
          Continue
        </button>
      </div>
    </div>
  );
}
