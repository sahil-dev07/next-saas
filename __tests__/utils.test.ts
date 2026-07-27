import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import {
    cn,
    debounce,
    deepMergeObjects,
    formUrlQuery,
    getImageSize,
    handleError,
    removeKeysFromQuery,
} from "@/lib/utils"

// formUrlQuery/removeKeysFromQuery read window.location.pathname. The suite runs in the
// node environment, so provide the one property they touch.
beforeEach(() => {
    vi.stubGlobal("window", { location: { pathname: "/" } })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

// ── debounce ────────────────────────────────────────────────────────────────
// These lock in the behaviour BUGS-2 fixed. The original `debounce(fn, d)()` built a fresh
// wrapper (and therefore a fresh timer) on every call, so nothing ever coalesced.
describe("debounce", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("does not invoke before the delay elapses", () => {
        const fn = vi.fn()
        debounce(fn, 1000)()

        vi.advanceTimersByTime(999)
        expect(fn).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it("coalesces rapid calls on ONE wrapper into a single trailing invocation", () => {
        const fn = vi.fn()
        const debounced = debounce(fn, 1000)

        debounced()
        vi.advanceTimersByTime(500)
        debounced()
        vi.advanceTimersByTime(500)
        debounced()
        vi.advanceTimersByTime(1000)

        // Three calls, one invocation — this is what the old per-call form never did.
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it("passes the LATEST arguments through", () => {
        const fn = vi.fn()
        const debounced = debounce(fn, 1000)

        debounced("first")
        debounced("second")
        vi.advanceTimersByTime(1000)

        expect(fn).toHaveBeenCalledExactlyOnceWith("second")
    })

    it("regression: a fresh wrapper per call never debounces", () => {
        // Documents the ORIGINAL bug. Each debounce(...) returns its own closure with its own
        // timeoutId, so no call can clear another's timer and every one fires.
        const fn = vi.fn()

        debounce(fn, 1000)()
        debounce(fn, 1000)()
        debounce(fn, 1000)()
        vi.advanceTimersByTime(1000)

        expect(fn).toHaveBeenCalledTimes(3)
    })

    it("keeps separate wrappers independent (so per-field timers are possible)", () => {
        const a = vi.fn()
        const b = vi.fn()
        const debouncedA = debounce(a, 1000)
        const debouncedB = debounce(b, 1000)

        debouncedA()
        debouncedB()
        vi.advanceTimersByTime(1000)

        // Neither cancels the other — the property TransformationForm's pendingEditsRef
        // preserves while still using a single shared timer.
        expect(a).toHaveBeenCalledTimes(1)
        expect(b).toHaveBeenCalledTimes(1)
    })
})

// ── handleError ─────────────────────────────────────────────────────────────
describe("handleError", () => {
    it("throws for an Error input, preserving the message", () => {
        expect(() => handleError(new Error("boom"))).toThrow("Error: boom")
    })

    it("throws for a string input", () => {
        expect(() => handleError("plain failure")).toThrow("Error: plain failure")
    })

    it("throws for an unknown input rather than returning", () => {
        expect(() => handleError({ code: 42 })).toThrow(/Unknown error/)
    })

    it("never returns a value on any branch", () => {
        // The `never` return type is only sound because EVERY branch throws. If a branch ever
        // fell through, callers relying on control-flow narrowing would silently break.
        for (const input of [new Error("x"), "x", { x: 1 }, null, undefined, 0]) {
            expect(() => handleError(input)).toThrow()
        }
    })
})

// ── query-string helpers ────────────────────────────────────────────────────
describe("formUrlQuery", () => {
    it("adds a key to an empty query", () => {
        expect(formUrlQuery({ searchParams: "", key: "query", value: "cat" }))
            .toBe("/?query=cat")
    })

    it("overwrites an existing value instead of appending a duplicate", () => {
        const url = formUrlQuery({ searchParams: "query=dog", key: "query", value: "cat" })
        expect(url).toBe("/?query=cat")
    })

    it("preserves unrelated params", () => {
        const url = formUrlQuery({ searchParams: "page=2", key: "query", value: "cat" })
        expect(url).toContain("page=2")
        expect(url).toContain("query=cat")
    })
})

describe("removeKeysFromQuery", () => {
    it("removes the requested key", () => {
        expect(removeKeysFromQuery({ searchParams: "query=cat", keysToRemove: ["query"] }))
            .toBe("/?")
    })

    it("leaves other keys intact", () => {
        const url = removeKeysFromQuery({
            searchParams: "query=cat&page=2",
            keysToRemove: ["query"],
        })
        expect(url).toContain("page=2")
        expect(url).not.toContain("query")
    })
})

// ── misc helpers ────────────────────────────────────────────────────────────
describe("getImageSize", () => {
    it("reads the aspect-ratio table for the fill transformation", () => {
        expect(getImageSize("fill", { aspectRatio: "1:1" }, "width")).toBe(1000)
        expect(getImageSize("fill", { aspectRatio: "9:16" }, "height")).toBe(1778)
    })

    it("falls back to 1000 for an unknown aspect ratio", () => {
        expect(getImageSize("fill", { aspectRatio: "nope" }, "width")).toBe(1000)
    })

    it("uses the image's own dimension for non-fill transformations", () => {
        expect(getImageSize("restore", { width: 640, height: 480 }, "width")).toBe(640)
    })

    it("falls back to 1000 when the dimension is missing", () => {
        expect(getImageSize("restore", {}, "width")).toBe(1000)
    })
})

describe("deepMergeObjects", () => {
    it("merges nested objects, with obj1 winning on conflicts", () => {
        const merged = deepMergeObjects(
            { recolor: { prompt: "hat", to: "red" } },
            { recolor: { to: "blue", multiple: true } }
        )
        expect(merged).toEqual({ recolor: { prompt: "hat", to: "red", multiple: true } })
    })

    it("returns obj1 when obj2 is null or undefined", () => {
        expect(deepMergeObjects({ a: 1 }, null)).toEqual({ a: 1 })
        expect(deepMergeObjects({ a: 1 }, undefined)).toEqual({ a: 1 })
    })

    it("keeps keys unique to obj2", () => {
        expect(deepMergeObjects({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
    })
})

describe("cn", () => {
    it("merges conflicting tailwind classes, last one winning", () => {
        expect(cn("p-2", "p-4")).toBe("p-4")
    })

    it("drops falsy values", () => {
        expect(cn("a", false && "b", undefined, "c")).toBe("a c")
    })
})
