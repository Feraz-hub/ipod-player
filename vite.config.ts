import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import appShell from "./scripts/pwa.mjs";
export default defineConfig(({ mode }) => ({
  plugins: [react(), appShell()],
  base: loadEnv(mode, ".", "").VITE_BASE_PATH || "/",
}));
