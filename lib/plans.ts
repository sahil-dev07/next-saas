// Server-authoritative pricing + credit-fee whitelist.
// Clients may send ONLY a planId; price + credits are looked up here and are
// NEVER trusted from the client. Reuses the display `plans` array in constants
// so there is a single source of truth for pack pricing.
import { plans } from "@/constants";

export type ServerPlan = { _id: number; name: string; price: number; credits: number };

// Look up a purchasable plan by its numeric id (1|2|3).
// Returns null for unknown/tampered ids; callers additionally reject price <= 0
// (the Free plan is not purchasable).
export function getPlanById(planId: number): ServerPlan | null {
  const plan = plans.find((p) => p._id === Number(planId));
  if (!plan) return null;
  return { _id: plan._id, name: plan.name, price: plan.price, credits: plan.credits };
}

// The ONLY credit delta a single transformation may spend (absolute, positive).
// Mirrors constants `creditFee = -1` (Decision: flat 1 credit per transform).
export const TRANSFORMATION_CREDIT_COST = 1;
