import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "node",
    // scripts/ 配下のテストは nightly で個別実行 (npm run test:balance)
    exclude: ["node_modules", "dist", "scripts"],
  },
});
