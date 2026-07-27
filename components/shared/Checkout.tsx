"use client";

import { loadStripe } from "@stripe/stripe-js";
import { useEffect } from "react";

import { useToast } from "@/components/ui/use-toast";
import { checkoutCredits } from "@/lib/actions/transaction.action";

import { Button } from "../ui/button";

const Checkout = ({
    planId,
}: {
    planId: number;
}) => {
    const { toast } = useToast();

    useEffect(() => {
        loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
    }, []);

    useEffect(() => {
        // Check to see if this is a redirect back from Checkout
        const query = new URLSearchParams(window.location.search);
        if (query.get("success")) {
            toast({
                title: "Order placed!",
                description: "You will receive an email confirmation",
                duration: 3000,
                className: "success-toast",
            });
        }

        if (query.get("canceled")) {
            toast({
                title: "Order canceled!",
                description: "Continue to shop around and checkout when you're ready",
                duration: 3000,
                className: "error-toast",
            });
        }
    }, [toast]);

    const onCheckout = async () => {
        try {
            // Only the planId leaves the client. Price, credits and buyer are derived
            // server-side in checkoutCredits — no tampering surface.
            await checkoutCredits({ planId });
        } catch (error) {
            // checkoutCredits ends in redirect(), which signals navigation by THROWING a
            // NEXT_REDIRECT error — rethrow it or the redirect to Stripe is swallowed and
            // checkout silently does nothing.
            if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw error;

            // Real failure (not authenticated, invalid plan, Stripe down). Without this the
            // rejected action escalates to the root error boundary and replaces the page.
            console.error("checkoutCredits failed:", error);
            toast({
                title: "Checkout failed",
                description: "Could not start checkout. Please try again.",
                duration: 3000,
                className: "error-toast",
            });
        }
    };

    return (
        <form action={onCheckout}>
            <section>
                <Button
                    type="submit"
                    role="link"
                    className="w-full rounded-full bg-purple-gradient bg-cover"
                >
                    Buy Credit
                </Button>
            </section>
        </form>
    );
};

export default Checkout;