import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
    plugins: [tsconfigPaths()], // resolves the @/* alias from tsconfig.json
    test: {
        environment: "node", // server actions / webhooks — no DOM needed
        include: ["**/__tests__/**/*.test.ts"],
        clearMocks: true,
    },
})
