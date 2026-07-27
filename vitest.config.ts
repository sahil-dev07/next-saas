import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
    // react plugin supplies the JSX transform for the .tsx component suites.
    plugins: [tsconfigPaths(), react()], // tsconfigPaths resolves the @/* alias from tsconfig.json
    test: {
        // Default environment. Most suites are server actions / webhooks and need no DOM;
        // component suites opt into jsdom with a `// @vitest-environment jsdom` docblock,
        // which keeps the fast node default for the majority.
        environment: "node",
        include: ["**/__tests__/**/*.test.{ts,tsx}"],
        setupFiles: ["./vitest.setup.ts"],
        clearMocks: true,
    },
})
