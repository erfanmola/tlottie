import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const root = document.getElementById("app");
if (root) createRoot(root).render(<App />);
