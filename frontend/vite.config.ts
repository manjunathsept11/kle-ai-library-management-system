import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // 5180, not the Vite default 5173 — that port is used by another local app.
    port: 5180,
    strictPort: true,
    // Proxy API calls in dev so the browser only ever talks to one origin.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
