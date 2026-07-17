import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.FUTURE_WEB_HOST ?? "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": process.env.FUTURE_API_PROXY ?? "http://127.0.0.1:4174",
    },
  },
});
