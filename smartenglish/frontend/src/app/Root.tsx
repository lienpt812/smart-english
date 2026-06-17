import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Layout } from "./components/Layout";
import { getAccessToken, saveAuthFromHash, supabaseSelect } from "./lib/api";

const APP_ROUTES = [
  "/dashboard", "/ai-tutor", "/vocabulary", "/flashcards",
  "/listening", "/speaking", "/reading", "/writing",
  "/toeic", "/ielts", "/pomodoro", "/analytics", "/community", "/settings"
];

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAppRoute = APP_ROUTES.some(r => location.pathname.startsWith(r));

  useEffect(() => {
    let mounted = true;

    async function routeAfterOAuthHash() {
      const hasOAuthHash = window.location.hash.includes("access_token=");
      if (!hasOAuthHash) return;

      const saved = saveAuthFromHash();
      if (!saved || !getAccessToken()) return;

      try {
        const rows = await supabaseSelect<any>("profiles", {
          select: "onboarding_completed",
          limit: 1,
        });
        if (!mounted) return;
        navigate(rows[0]?.onboarding_completed ? "/dashboard" : "/onboarding", { replace: true });
      } catch {
        if (mounted) navigate("/onboarding", { replace: true });
      }
    }

    routeAfterOAuthHash();

    return () => {
      mounted = false;
    };
  }, [navigate, location.pathname]);

  if (isAppRoute) {
    return (
      <Layout>
        <Outlet />
      </Layout>
    );
  }

  return <Outlet />;
}
