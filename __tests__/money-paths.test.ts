import { describe, it, expect, vi, beforeEach } from "vitest"

// Shared mock handles. vi.hoisted lets the vi.mock factories (which are hoisted
// above the imports) reference these safely.
const h = vi.hoisted(() => ({
    authMock: vi.fn(),
    findOneAndUpdateMock: vi.fn(),
    userFindOneMock: vi.fn(),
    userFindByIdAndUpdateMock: vi.fn(),
    imageFindByIdMock: vi.fn(),
    imageFindByIdAndDeleteMock: vi.fn(),
    txFindOneMock: vi.fn(),
    txCreateMock: vi.fn(),
    constructEventMock: vi.fn(),
    sessionsCreateMock: vi.fn(),
}))

// ── Module mocks ────────────────────────────────────────────────────────────
vi.mock("@clerk/nextjs", () => ({ auth: h.authMock }))

vi.mock("@/lib/Database/mongoose", () => ({
    connectToDatabase: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/Database/models/user.model", () => ({
    default: {
        findOneAndUpdate: h.findOneAndUpdateMock,
        findOne: h.userFindOneMock,
        findByIdAndUpdate: h.userFindByIdAndUpdateMock,
    },
}))

vi.mock("@/lib/Database/models/image.model", () => ({
    default: { findById: h.imageFindByIdMock, findByIdAndDelete: h.imageFindByIdAndDeleteMock },
}))

vi.mock("@/lib/Database/models/transaction.model", () => ({
    default: { findOne: h.txFindOneMock, create: h.txCreateMock },
}))

// redirect throws NEXT_REDIRECT (mirrors real Next behavior).
vi.mock("next/navigation", () => ({
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Stripe: static `Stripe.webhooks.constructEvent` (used by the webhook route) +
// instance `new Stripe().checkout.sessions.create` (used by checkoutCredits).
// NOTE: must be a real `function` (not an arrow) so `new Stripe()` constructs an
// instance whose `checkout` is defined.
vi.mock("stripe", () => {
    function StripeMock(this: any) {
        this.checkout = { sessions: { create: h.sessionsCreateMock } }
    }
    ;(StripeMock as any).webhooks = { constructEvent: h.constructEventMock }
    return { default: StripeMock }
})

beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = "sk_test_x"
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x"
    process.env.NEXT_PUBLIC_SERVER_URL = "http://localhost:3000"
})

// ── 1) Webhook rejects a forged/invalid signature with HTTP 400 ─────────────
describe("stripe webhook signature", () => {
    it("returns 400 when constructEvent throws (no 200 on bad signature)", async () => {
        h.constructEventMock.mockImplementation(() => { throw new Error("bad sig") })
        const { POST } = await import("@/app/api/webhooks/stripe/route")
        const req = new Request("http://x/api/webhooks/stripe", {
            method: "POST",
            headers: { "stripe-signature": "t=1,v1=deadbeef" },
            body: "{}",
        })
        const res = await POST(req)
        expect(res.status).toBe(400)
    })
})

// ── 2) spendCredits floor rejects when balance < cost ───────────────────────
describe("spendCredits floor", () => {
    it("returns null (no throw) when the conditional $inc matches nothing", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_123" })
        h.findOneAndUpdateMock.mockResolvedValue(null) // guard matched nothing
        const { spendCredits } = await import("@/lib/actions/user.actions")
        const result = await spendCredits()
        expect(result).toBeNull()
        const [filter, update] = h.findOneAndUpdateMock.mock.calls[0]
        expect(filter).toMatchObject({ clerkId: "clerk_123" })
        expect(filter.creditBalance).toHaveProperty("$gte")
        expect(update.$inc.creditBalance).toBeLessThan(0)
    })

    it("does not decrement for an unauthenticated caller", async () => {
        h.authMock.mockReturnValue({ userId: null })
        const { spendCredits } = await import("@/lib/actions/user.actions")
        // handleError rethrows the "Not authenticated" error.
        await expect(spendCredits()).rejects.toThrow()
        expect(h.findOneAndUpdateMock).not.toHaveBeenCalled()
    })
})

// ── 3) checkoutCredits prices from the server plans table (ignores any client amount) ──
describe("checkout server pricing", () => {
    it("prices Pro (planId 2) at $40 / 120 credits from the server table", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_123" })
        h.userFindOneMock.mockResolvedValue({ _id: "buyer_1" }) // getUserById -> buyer
        h.sessionsCreateMock.mockResolvedValue({ url: "http://stripe/checkout" })
        const { checkoutCredits } = await import("@/lib/actions/transaction.action")
        // signature accepts ONLY planId — a tampered amount cannot even be passed.
        try { await checkoutCredits({ planId: 2 }) } catch { /* redirect throws NEXT_REDIRECT */ }
        const arg = h.sessionsCreateMock.mock.calls[0][0]
        expect(arg.line_items[0].price_data.unit_amount).toBe(4000) // $40.00 in cents
        expect(arg.metadata.credits).toBe("120")
        expect(arg.metadata.buyerId).toBe("buyer_1")
    })
})

// ── 4) createTransaction is idempotent on webhook redelivery ────────────────
describe("transaction idempotency", () => {
    it("does not create/grant twice for the same stripeId", async () => {
        h.txFindOneMock.mockResolvedValue({ _id: "t1", stripeId: "sess_1" }) // already recorded
        const { createTransaction } = await import("@/lib/actions/transaction.action")
        await createTransaction({
            stripeId: "sess_1", amount: 40, credits: 120, plan: "Pro Package",
            buyerId: "buyer_1", createdAt: new Date(),
        } as any)
        expect(h.txCreateMock).not.toHaveBeenCalled()
    })
})

// ── 5) deleteImage rejects a non-owner (IDOR) ───────────────────────────────
describe("deleteImage IDOR", () => {
    it("does not delete when the caller is not the owner", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_attacker" })
        h.userFindOneMock.mockResolvedValue({ _id: "attacker_id" })
        h.imageFindByIdMock.mockResolvedValue({ _id: "img1", author: "victim_id" })
        const { deleteImage } = await import("@/lib/actions/image.actions")
        // handleError rethrows the "Unauthorized" error before any delete.
        await expect(deleteImage("img1")).rejects.toThrow()
        expect(h.imageFindByIdAndDeleteMock).not.toHaveBeenCalled()
    })
})
