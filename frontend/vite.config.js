import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Keep GitHub Pages as the default; the VM serves the app at the domain root.
  base: mode === "vm" ? "/" : "/web_project_around_auth/",
  server: {
    port: 5173,
  },
}));
