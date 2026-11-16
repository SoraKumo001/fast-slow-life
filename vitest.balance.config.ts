import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

// バランスシミュレーション専用設定 (npm run test:balance)
// 通常の vite.config.ts は scripts/ を exclude しているため、
// scripts/balance-sim.test.ts を実行するにはこの設定を使う。
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
  },
});
