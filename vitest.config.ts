// Vitest configuration. Uses Vite's TS path alias from vite.config.
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
    // Use a shorter timeout so fast tests don't hang CI.
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      // Match the "@" alias from vite config.
      "@": resolve(__dirname, "./src"),
    },
  },
});
