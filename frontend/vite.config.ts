import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward API and WebSocket calls to the API gateway when it runs locally.
    // If the gateway is down, the app falls back to Demo mode automatically.
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
      "/ws": { target: "http://localhost:8080", ws: true, changeOrigin: true },
    },
  },
});
