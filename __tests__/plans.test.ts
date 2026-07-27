import { describe, it, expect } from "vitest"

import { getPlanById, TRANSFORMATION_CREDIT_COST } from "@/lib/plans"
import { plans, creditFee } from "@/constants"

// The server plans table is the ONLY source of price/credits — the client sends just a
// planId (SEC-1). These tests pin that contract so a future edit can't reopen the
// price-tampering hole.
describe("getPlanById", () => {
    it("returns the server-side price and credits for a paid plan", () => {
        expect(getPlanById(2)).toEqual({
            _id: 2,
            name: "Pro Package",
            price: 40,
            credits: 120,
        })
    })

    it("coerces a numeric string id (Stripe metadata round-trips as a string)", () => {
        // The Stripe webhook does Number(metadata.planId); this guards the looser path too.
        expect(getPlanById("3" as unknown as number)?.credits).toBe(2000)
    })

    it("returns null for an unknown id", () => {
        expect(getPlanById(999)).toBeNull()
    })

    it("returns null for non-numeric / malformed ids rather than throwing", () => {
        for (const bad of ["abc", null, undefined, {}, NaN]) {
            expect(getPlanById(bad as unknown as number)).toBeNull()
        }
    })

    it("still returns the Free plan, which callers must reject via price <= 0", () => {
        // getPlanById does NOT itself gate purchasability — checkoutCredits rejects
        // price <= 0. If that ever moves, this test documents where the guard lived.
        const free = getPlanById(1)
        expect(free).not.toBeNull()
        expect(free!.price).toBe(0)
    })
})

describe("credit economy invariants", () => {
    it("charges exactly one credit per transformation", () => {
        expect(TRANSFORMATION_CREDIT_COST).toBe(1)
    })

    it("keeps the server cost and the display creditFee in agreement", () => {
        // constants.creditFee is the negative display value; the server constant is positive.
        expect(TRANSFORMATION_CREDIT_COST).toBe(Math.abs(creditFee))
    })

    it("advertises Free-plan credits that match what a new user actually receives", () => {
        // BUGS-2 regression guard: the Free plan used to advertise 20 credits while the User
        // model granted 2. Keep this in step with `creditBalance` default in user.model.ts.
        const NEW_USER_CREDIT_DEFAULT = 2
        const free = plans.find((p) => p._id === 1)
        // Assert presence first, so a removed/renumbered Free plan fails with a clear message
        // instead of a TypeError on property access.
        expect(free).toBeDefined()
        expect(free!.credits).toBe(NEW_USER_CREDIT_DEFAULT)
        // The marketing copy has to match the number too.
        expect(free!.inclusions[0].label).toBe(`${NEW_USER_CREDIT_DEFAULT} Free Credits`)
    })

    it("has a positive integer credit count for every purchasable plan", () => {
        for (const plan of plans.filter((p) => p.price > 0)) {
            expect(Number.isInteger(plan.credits)).toBe(true)
            expect(plan.credits).toBeGreaterThan(0)
        }
    })

    it("exposes unique plan ids (getPlanById relies on find())", () => {
        const ids = plans.map((p) => p._id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
