
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { applyTheme, readTheme } from "./app/lib/theme.ts";
  import "./styles/index.css";

  applyTheme(readTheme());

  createRoot(document.getElementById("root")!).render(<App />);
  
