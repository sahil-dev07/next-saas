// @vitest-environment jsdom
//
// Component tests for the search box. Every case here maps to a defect BUGS-2 fixed —
// this file exists so those specific regressions cannot come back silently.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()

// One STABLE router object. Next's real useRouter returns a stable reference, and the push
// effect lists `router` in its dependency array — returning a fresh `{ push }` per call would
// change identity on every render, re-running the effect and re-arming its debounce timer
// each time. That would make these tests flakier than the real app, not more faithful.
const router = { push }

// Mutable between tests so a test can simulate a different URL, or a URL that changes
// underneath the component (Back/Forward).
let currentSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
    useRouter: () => router,
    useSearchParams: () => currentSearchParams,
}))

// next/image needs no real optimizer here; render a plain img.
vi.mock("next/image", () => ({
    default: ({ src, alt }: { src: string; alt: string }) =>
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} />,
}))

import { Search } from "@/components/shared/Search"

// The effect debounces by 300ms.
const DEBOUNCE = 300

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    push.mockClear()
    currentSearchParams = new URLSearchParams()
    window.history.replaceState({}, "", "/")
})

afterEach(() => {
    vi.useRealTimers()
})

const flushDebounce = async () => {
    await act(async () => {
        vi.advanceTimersByTime(DEBOUNCE)
    })
}

describe("Search — mount behaviour", () => {
    it("does NOT navigate on mount with an empty query", async () => {
        render(<Search />)
        await flushDebounce()

        // The original code pushed removeKeysFromQuery -> "/" here. Under Next 15
        // (staleTimes.dynamic = 0) that redundant self-navigation is a real extra server
        // render of the page on every visit.
        expect(push).not.toHaveBeenCalled()
    })

    it("does NOT navigate on mount when the URL already carries a query", async () => {
        currentSearchParams = new URLSearchParams("query=cat")
        window.history.replaceState({}, "", "/?query=cat")

        render(<Search />)
        await flushDebounce()

        expect(push).not.toHaveBeenCalled()
    })

    it("seeds the input from the URL so a shared link shows its search term", () => {
        currentSearchParams = new URLSearchParams("query=cat")
        window.history.replaceState({}, "", "/?query=cat")

        render(<Search />)

        // Previously state started at "" while the URL stayed filtered, so the user saw a
        // filtered gallery above an empty search box.
        expect(screen.getByPlaceholderText("Search")).toHaveValue("cat")
    })

    it("renders an empty input when the URL has no query", () => {
        render(<Search />)
        expect(screen.getByPlaceholderText("Search")).toHaveValue("")
    })
})

describe("Search — typing", () => {
    it("pushes a query URL after the debounce", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        render(<Search />)

        await user.type(screen.getByPlaceholderText("Search"), "cat")
        await flushDebounce()

        expect(push).toHaveBeenCalledTimes(1)
        expect(push).toHaveBeenCalledWith("/?query=cat", { scroll: false })
    })

    it("coalesces rapid keystrokes into a single navigation", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        render(<Search />)

        await user.type(screen.getByPlaceholderText("Search"), "cats")
        await flushDebounce()

        // One push for the whole word, not one per character.
        expect(push).toHaveBeenCalledTimes(1)
        expect(push).toHaveBeenCalledWith("/?query=cats", { scroll: false })
    })

    it("clears the query param when the user empties a real search", async () => {
        currentSearchParams = new URLSearchParams("query=cat")
        window.history.replaceState({}, "", "/?query=cat")

        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        render(<Search />)

        await user.clear(screen.getByPlaceholderText("Search"))
        await flushDebounce()

        // The mount guard must not suppress this — it only suppresses the no-op case.
        expect(push).toHaveBeenCalledTimes(1)
        expect(push.mock.calls[0][0]).not.toContain("query=cat")
    })
})

describe("Search — external URL changes", () => {
    it("adopts a Back/Forward navigation instead of pushing stale local state", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const { rerender } = render(<Search />)

        // User searches for "dog".
        await user.type(screen.getByPlaceholderText("Search"), "dog")
        await flushDebounce()
        expect(push).toHaveBeenCalledWith("/?query=dog", { scroll: false })
        push.mockClear()

        // Browser Back lands on an earlier "cat" search: the URL changes underneath the
        // component while local state still holds "dog".
        currentSearchParams = new URLSearchParams("query=cat")
        window.history.replaceState({}, "", "/?query=cat")
        await act(async () => {
            rerender(<Search />)
        })
        await flushDebounce()

        // Must NOT shove "dog" back into the URL — that made Back look broken.
        expect(push).not.toHaveBeenCalled()
        // And the box should now show where we actually are.
        expect(screen.getByPlaceholderText("Search")).toHaveValue("cat")
    })

    it("still pushes normally after adopting an external change", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const { rerender } = render(<Search />)

        currentSearchParams = new URLSearchParams("query=cat")
        window.history.replaceState({}, "", "/?query=cat")
        await act(async () => {
            rerender(<Search />)
        })
        await flushDebounce()
        push.mockClear()

        // Typing after the adoption must work — the sync ref must not wedge it shut.
        await user.type(screen.getByPlaceholderText("Search"), "s")
        await flushDebounce()

        expect(push).toHaveBeenCalledTimes(1)
        expect(push).toHaveBeenCalledWith("/?query=cats", { scroll: false })
    })
})

describe("Search — re-render stability", () => {
    it("does not navigate when re-rendered with an unchanged URL (StrictMode-safe)", async () => {
        const { rerender } = render(<Search />)
        await flushDebounce()

        // A first-render useRef guard would have been consumed by the first pass and let
        // this second one through; a value comparison is idempotent.
        await act(async () => {
            rerender(<Search />)
        })
        await flushDebounce()

        expect(push).not.toHaveBeenCalled()
    })
})
