import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AITutorPage } from "./pages/AITutorPage";
import { VocabularyPage } from "./pages/VocabularyPage";
import { FlashcardsPage } from "./pages/FlashcardsPage";
import { ListeningPage } from "./pages/ListeningPage";
import { SpeakingPage } from "./pages/SpeakingPage";
import { ReadingPage } from "./pages/ReadingPage";
import { WritingPage } from "./pages/WritingPage";
import { TOEICPage } from "./pages/TOEICPage";
import { IELTSPage } from "./pages/IELTSPage";
import { PomodoroPage } from "./pages/PomodoroPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CommunityPage } from "./pages/CommunityPage";
import { SettingsPage } from "./pages/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: LandingPage },
      { path: "auth", Component: AuthPage },
      { path: "onboarding", Component: OnboardingPage },
      { path: "dashboard", Component: DashboardPage },
      { path: "ai-tutor", Component: AITutorPage },
      { path: "vocabulary", Component: VocabularyPage },
      { path: "flashcards", Component: FlashcardsPage },
      { path: "listening", Component: ListeningPage },
      { path: "speaking", Component: SpeakingPage },
      { path: "reading", Component: ReadingPage },
      { path: "writing", Component: WritingPage },
      { path: "toeic", Component: TOEICPage },
      { path: "ielts", Component: IELTSPage },
      { path: "pomodoro", Component: PomodoroPage },
      { path: "analytics", Component: AnalyticsPage },
      { path: "community", Component: CommunityPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
