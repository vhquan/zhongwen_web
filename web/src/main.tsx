import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { EditionPage } from "./pages/EditionPage";
import { HomePage } from "./pages/HomePage";
import { SessionPage } from "./pages/SessionPage";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/edition/:edition" element={<EditionPage />} />
        <Route path="/edition/:edition/level/:level/:mode" element={<SessionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
