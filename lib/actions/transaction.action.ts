"use server"
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { auth } from '@clerk/nextjs' // v4: synchronous auth()
import { handleError } from '../utils'
import { connectToDatabase } from '../Database/mongoose'
import Transaction from '../Database/models/transaction.model'
import { creditBuyer, getUserById } from './user.actions'
import { getPlanById } from '../plans'

// Client sends ONLY a planId. Price, credits and buyer are all derived
// server-side, so the amount/credits/buyer can no longer be tampered with.
export async function checkoutCredits({ planId }: CheckoutTransactionParams) {
    // 1) Server-authoritative price + credits from the plans table.
    const plan = getPlanById(planId)
    if (!plan || plan.price <= 0) {
        // Unknown plan, or the free plan which is not purchasable.
        throw new Error("Invalid plan")
    }

    // 2) Server-derived buyer — never trust a client buyerId.
    const { userId: clerkId } = auth()
    if (!clerkId) throw new Error("Not authenticated")
    const buyer = await getUserById(clerkId)
    if (!buyer?._id) throw new Error("Buyer not found")

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const amount = Math.round(plan.price * 100) // cents, from the SERVER price

    const session = await stripe.checkout.sessions.create({
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    unit_amount: amount,
                    product_data: {
                        name: plan.name,
                    }
                },
                quantity: 1,
            }
        ],
        // metadata is server-computed. planId lets the webhook re-derive credits;
        // credits is a redundant copy the webhook cross-checks against the plan.
        metadata: {
            planId: String(plan._id),
            plan: plan.name,
            credits: String(plan.credits),
            buyerId: String(buyer._id),
        },
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/profile`,
        cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
    })
    redirect(session.url!)
}

export async function createTransaction(transaction: CreateTransactionParams) {
    try {
        await connectToDatabase()

        // Idempotency (M0-safe, no Mongo transaction): stripeId === Stripe session.id
        // is unique. A webhook redelivery for the same session is a no-op — no double grant.
        const existing = await Transaction.findOne({ stripeId: transaction.stripeId })
        if (existing) return JSON.parse(JSON.stringify(existing))

        const newTransaction = await Transaction.create({
            ...transaction, buyer: transaction.buyerId
        })

        // Grant the (server-verified) credits, keyed by the buyer's Mongo _id.
        await creditBuyer(transaction.buyerId, transaction.credits)

        return JSON.parse(JSON.stringify(newTransaction))
    } catch (error: any) {
        // Race between two concurrent redeliveries: the unique stripeId index rejects
        // the second insert (E11000) — swallow it as an idempotent no-op, don't re-grant.
        if (error?.code === 11000) return null
        handleError(error)
    }
}