import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Etapa 5 · Fatia 10 · Fase D (incidente #3) — prova de correspondência
// código↔servidor por hash de commit, verificável no console antes de
// qualquer passo de homologação. Só em dev: nunca vazar hash de commit em
// build de produção.
if (import.meta.env.DEV) {
  console.info(`[Kora] BUILD ${__KORA_BUILD_COMMIT__} (${__KORA_BUILD_BRANCH__})`);
}

createRoot(document.getElementById("root")!).render(<App />);
