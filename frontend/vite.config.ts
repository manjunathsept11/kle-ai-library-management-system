import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Only used to point the dev proxy at a different backend (e.g. the Playwright stack).
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react()],
  server: {
    // 5180, not the Vite default 5173 — that port is used by another local app.
    port: 5180,
    strictPort: true,
    // Proxy API calls in dev so the browser only ever talks to one origin.
    proxy: {
      "/api": {
        target: process.env.API_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
