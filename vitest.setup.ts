import { afterEach } from "vitest"

// Registers @testing-library/jest-dom's custom matchers (toBeInTheDocument, toHaveValue, …)
// for the component suites. Server-side suites run in the node environment and simply don't
// use them.
import "@testing-library/jest-dom/vitest"

// React Testing Library only self-registers its afterEach cleanup when a global `afterEach`
// exists — and this project runs vitest with the default `globals: false`. Without this the
// rendered DOM accumulates across cases in a file and queries start matching several
// elements at once. Imported dynamically and only under jsdom, because the node-environment
// suites load this same setup file and RTL requires a document at import time.
if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react")
    afterEach(cleanup)
}
