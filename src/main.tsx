import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { StoreProvider } from "@/lib/store";
import { MusicApp } from "@/components/music/App";
import { Toaster } from "@/components/ui/sonner";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <MusicApp />
      <Toaster position="top-center" />
    </StoreProvider>
  </StrictMode>,
);
