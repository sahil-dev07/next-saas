/* eslint-disable camelcase */
import { createTransaction } from "@/lib/actions/transaction.action";
import { getPlanById } from "@/lib/plans";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature") as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    // 1) Signature verification. On failure return HTTP 400 (NOT 200) so forged /
    //    unsigned events are rejected and Stripe marks the delivery failed & retries.
    try {
        event = Stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
        console.error("Stripe webhook signature verification failed:", err);
        return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const { id, amount_total, metadata } = session;

        // 2) Re-derive credits/price from the SERVER plans table via planId.
        //    Never trust the client-sent credits value.
        const planId = Number(metadata?.planId);
        const plan = getPlanById(planId);
        if (!plan) {
            console.error(`Webhook ${event.id}: unknown planId ${metadata?.planId}`);
            return NextResponse.json({ message: "Unknown plan" }, { status: 400 });
        }

        // 3) Buyer must be present. Guard BEFORE any write: otherwise createTransaction
        //    would persist a buyer="" row and the grant would fail on the invalid id —
        //    and the idempotent short-circuit would then never re-grant on Stripe's retry.
        const buyerId = metadata?.buyerId;
        if (!buyerId) {
            console.error(`Webhook ${event.id}: missing buyerId in metadata`);
            return NextResponse.json({ message: "Missing buyer" }, { status: 400 });
        }

        // 4) Cross-check the redundant client-copied metadata against the server plan.
        //    We always grant the SERVER value; a mismatch just means client drift/tamper.
        const claimedCredits = Number(metadata?.credits);
        if (claimedCredits !== plan.credits) {
            console.warn(
                `Webhook ${event.id}: credits mismatch (metadata=${claimedCredits}, server=${plan.credits}) — granting server value`
            );
        }

        // 5) Persist + grant. createTransaction is idempotent (unique stripeId +
        //    E11000 no-op), so a webhook redelivery with the same session.id is safe.
        const transaction = {
            stripeId: id as string,
            amount: amount_total ? amount_total / 100 : plan.price,
            plan: plan.name,
            credits: plan.credits, // SERVER-authoritative credits
            buyerId,
            createdAt: new Date(),
        };

        const newTransaction = await createTransaction(transaction);
        return NextResponse.json({ message: "OK", transaction: newTransaction }, { status: 200 });
    }

    // Any other verified event: acknowledge so Stripe stops retrying.
    return new Response("", { status: 200 });
}
