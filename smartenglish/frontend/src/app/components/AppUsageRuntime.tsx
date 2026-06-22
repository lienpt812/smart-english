import { useEffect, useRef } from "react";
import { addAppUsageSeconds } from "../lib/appUsage";

export function AppUsageRuntime() {
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const deltaSeconds = Math.min(60, Math.max(0, Math.round((now - lastTickRef.current) / 1000)));
      lastTickRef.current = now;
      if (document.visibilityState !== "visible") return;
      addAppUsageSeconds(deltaSeconds);
    };

    const onVisibilityChange = () => {
      lastTickRef.current = Date.now();
    };

    lastTickRef.current = Date.now();
    const id = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", tick);

    return () => {
      tick();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", tick);
    };
  }, []);

  return null;
}
