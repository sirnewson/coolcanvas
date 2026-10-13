import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { applyTheme, useStore } from "./store/store";
import { canvasRefs, renderToCanvas } from "./lib/export";
import "./styles.css";
import "./studio.css";
import "./builder/builder.css";
import "./studios/studios.css";

if (import.meta.env.DEV) {
  // Handy for poking at board state from the console during development.
  Object.assign(window as unknown as Record<string, unknown>, {
    flowcanvas: useStore,
    flowcanvasRefs: canvasRefs,
    flowcanvasRender: renderToCanvas,
  });
}

// Register offline Service Worker
if ("serviceWorker" in navigator && !import.meta.env.DEV) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[SW] Registration skipped:", err);
    });
  });
}

applyTheme(useStore.getState().theme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
