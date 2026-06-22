import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard, Bot, BookOpen, Headphones, Mic,
  FileText, PenLine, Award, GraduationCap,
  Timer, BarChart2, Settings, Menu, X, Zap,
  ChevronRight, PanelLeftClose, PanelLeftOpen, Map
} from "lucide-react";
import { clearAuth, getAccessToken, supabaseSelect } from "../lib/api";
import { PomodoroRuntime } from "./PomodoroRuntime";
import { AppUsageRuntime } from "./AppUsageRuntime";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Roadmap", icon: Map, path: "/roadmap" },
  { label: "AI Tutor", icon: Bot, path: "/ai-tutor" },
  { label: "Vocabulary", icon: BookOpen, path: "/flashcards" },
  { label: "Listening", icon: Headphones, path: "/listening" },
  { label: "Speaking", icon: Mic, path: "/speaking" },
  { label: "Reading", icon: FileText, path: "/reading" },
  { label: "Writing", icon: PenLine, path: "/writing" },
  { label: "TOEIC", icon: Award, path: "/toeic" },
  { label: "IELTS", icon: GraduationCap, path: "/ielts" },
  { label: "Pomodoro", icon: Timer, path: "/pomodoro" },
  { label: "Analytics", icon: BarChart2, path: "/analytics" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("smartenglish.sidebar.collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [profile, setProfile] = useState<{ display_name?: string; email?: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getAccessToken()) return;
    supabaseSelect<any>("profiles", { select: "display_name,email", limit: 1 })
      .then(rows => setProfile(rows[0] || null))
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    localStorage.setItem("smartenglish.sidebar.collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const profileName = profile?.display_name || profile?.email || (getAccessToken() ? "Learner" : "Guest");

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-30 flex flex-col h-full bg-white border-r border-border transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"} w-64
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-2.5 py-5 border-b border-border ${sidebarCollapsed ? "lg:px-4" : "px-5"}`}>
          <div className="w-8 h-8 rounded-lg flex shrink-0 items-center justify-center" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>
            <Zap size={16} className="text-white" />
          </div>
          <span className={`font-bold text-foreground whitespace-nowrap overflow-hidden transition-all ${sidebarCollapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"}`} style={{ fontSize: "1.05rem", letterSpacing: "-0.02em" }}>SmartEnglish</span>
          <button
            type="button"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setSidebarCollapsed(prev => !prev)}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button className="ml-auto lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto py-4 scrollbar-thin ${sidebarCollapsed ? "lg:px-3" : "px-3"}`}>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  title={sidebarCollapsed ? label : undefined}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
                    ${sidebarCollapsed ? "lg:justify-center" : ""}
                    ${isActive
                      ? "bg-secondary text-sidebar-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={17} className={`shrink-0 ${isActive ? "text-primary" : "text-current opacity-70"}`} />
                      <span className={`whitespace-nowrap overflow-hidden transition-all ${sidebarCollapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"}`} style={{ fontSize: "0.875rem" }}>{label}</span>
                      {isActive && !sidebarCollapsed && <ChevronRight size={14} className="ml-auto text-primary opacity-60" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User profile */}
        <div className={`py-4 border-t border-border ${sidebarCollapsed ? "lg:px-3" : "px-4"}`}>
          <div
            className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors ${sidebarCollapsed ? "lg:justify-center" : ""}`}
            title={sidebarCollapsed ? profileName : undefined}
            onClick={() => navigate("/settings")}
          >
            <div className="w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-white text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>{profileName.slice(0, 1).toUpperCase()}</div>
            <div className={`flex-1 min-w-0 overflow-hidden transition-all ${sidebarCollapsed ? "lg:w-0 lg:flex-none lg:opacity-0" : "opacity-100"}`}>
              <p className="text-foreground font-medium truncate" style={{ fontSize: "0.8125rem" }}>{profileName}</p>
              <p className="text-muted-foreground truncate" style={{ fontSize: "0.75rem" }}>{getAccessToken() ? "Signed in" : "Guest mode"}</p>
            </div>
            {getAccessToken() && !sidebarCollapsed && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  clearAuth();
                  navigate("/auth");
                }}
                className="text-muted-foreground hover:text-foreground"
                style={{ fontSize: "0.7rem" }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3.5 bg-white border-b border-border">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2D6A4F, #52B788)" }}>
              <Zap size={13} className="text-white" />
            </div>
            <span className="font-bold text-foreground" style={{ fontSize: "0.95rem" }}>SmartEnglish</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-border flex">
        {NAV_ITEMS.slice(0, 5).map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors
              ${isActive ? "text-primary" : "text-muted-foreground"}`
            }
          >
            <Icon size={20} />
            <span style={{ fontSize: "0.625rem" }}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <AppUsageRuntime />
      <PomodoroRuntime />
    </div>
  );
}
