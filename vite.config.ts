import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // مسارات نسبية حتى يعمل التطبيق داخل WebView أندرويد
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": import.meta.dirname + "/src" },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 900,
  },
});
