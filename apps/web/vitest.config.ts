import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["quality/**/*.test.ts", "app/journey-url.test.ts"],
  },
});
