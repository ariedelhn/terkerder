import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/source-serif-4/500.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/500.css";
import "@fontsource/source-sans-3/600.css";
import "@/styles.css";
import { Dashboard } from "@/components/ledger/dashboard";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
