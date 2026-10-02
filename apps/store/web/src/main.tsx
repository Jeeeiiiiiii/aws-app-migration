import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Store } from "./Store.tsx";
import "./store.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Store />
  </StrictMode>,
);
