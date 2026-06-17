import { Outlet, useLocation } from "react-router";
import { Layout } from "./components/Layout";

const APP_ROUTES = [
  "/dashboard", "/ai-tutor", "/vocabulary", "/flashcards",
  "/listening", "/speaking", "/reading", "/writing",
  "/toeic", "/ielts", "/pomodoro", "/analytics", "/community", "/settings"
];

export function Root() {
  const location = useLocation();
  const isAppRoute = APP_ROUTES.some(r => location.pathname.startsWith(r));

  if (isAppRoute) {
    return (
      <Layout>
        <Outlet />
      </Layout>
    );
  }

  return <Outlet />;
}
