export type AppUsageDay = {
  date: string;
  seconds: number;
};

export const APP_USAGE_KEY = "smartenglish.app_usage.days";
export const APP_USAGE_EVENT = "smartenglish:app-usage";

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function loadAppUsage(): AppUsageDay[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_USAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter(item => typeof item?.date === "string" && Number.isFinite(Number(item?.seconds)))
          .map(item => ({ date: item.date, seconds: Math.max(0, Number(item.seconds)) }))
      : [];
  } catch {
    return [];
  }
}

export function addAppUsageSeconds(seconds: number) {
  if (seconds <= 0) return;
  const today = dayKey();
  const rows = loadAppUsage();
  const index = rows.findIndex(item => item.date === today);
  if (index >= 0) {
    rows[index] = { ...rows[index], seconds: rows[index].seconds + seconds };
  } else {
    rows.push({ date: today, seconds });
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 120);
  const nextRows = rows
    .filter(item => new Date(`${item.date}T00:00:00`).getTime() >= cutoff.getTime())
    .sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(APP_USAGE_KEY, JSON.stringify(nextRows));
  window.dispatchEvent(new Event(APP_USAGE_EVENT));
}

export function appUsageMinutesForDate(date: Date, rows = loadAppUsage()) {
  const found = rows.find(item => item.date === dayKey(date));
  return found ? Math.round(found.seconds / 60) : 0;
}
