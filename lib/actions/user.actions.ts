"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@clerk/nextjs/server" // Clerk v6: async auth() from /server

import User from "../Database/models/user.model"

import { connectToDatabase } from "../Database/mongoose"
import { handleError } from "../utils"
import { TRANSFORMATION_CREDIT_COST } from "../plans"

// CREATE
export async function createUser(user: CreateUserParams) {
  try {
    await connectToDatabase()

    const newUser = await User.create(user)

    return JSON.parse(JSON.stringify(newUser))
  } catch (error) {
    handleError(error)
  }
}

// READ
export async function getUserById(userId: string) {
  try {
    await connectToDatabase()

    const user = await User.findOne({ clerkId: userId })

    if (!user) throw new Error("User not found")

    return JSON.parse(JSON.stringify(user))
  } catch (error) {
    handleError(error)
  }
}

// UPDATE
export async function updateUser(clerkId: string, user: UpdateUserParams) {
  try {
    await connectToDatabase()

    const updatedUser = await User.findOneAndUpdate({ clerkId }, user, {
      new: true,
    })

    if (!updatedUser) throw new Error("User update failed")

    return JSON.parse(JSON.stringify(updatedUser))
  } catch (error) {
    handleError(error)
  }
}

// DELETE
export async function deleteUser(clerkId: string) {
  try {
    await connectToDatabase()

    // Find user to delete
    const userToDelete = await User.findOne({ clerkId })

    if (!userToDelete) {
      throw new Error("User not found")
    }

    // Delete user
    const deletedUser = await User.findByIdAndDelete(userToDelete._id)
    revalidatePath("/")

    return deletedUser ? JSON.parse(JSON.stringify(deletedUser)) : null
  } catch (error) {
    handleError(error)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT ECONOMY (server-authoritative)
//
// The old `updateCredits(userId, delta)` was a client-callable action taking an
// arbitrary user id + arbitrary delta with no auth — anyone could mint unlimited
// credits. It is replaced by: an INTERNAL grant (webhook-only) and a PUBLIC spend
// that resolves the caller from the Clerk session and can never go negative.
// ─────────────────────────────────────────────────────────────────────────────

// INTERNAL grant helper — NOT exported, so the browser can never import/call it.
// Only reached from the verified Stripe-webhook path (createTransaction).
// `amount` is a positive integer of credits to add, keyed by the buyer's Mongo _id.
async function grantCredits(userObjectId: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Invalid grant amount")
  }
  await connectToDatabase()

  const updated = await User.findByIdAndUpdate(
    userObjectId,
    { $inc: { creditBalance: amount } },
    { new: true }
  )
  if (!updated) throw new Error("Credit grant failed: buyer not found")
  return JSON.parse(JSON.stringify(updated))
}

// Exported ONLY for the trusted transaction/webhook flow (transaction.action.ts).
// Reached only after Stripe signature verification, so it is not a client attack surface.
export async function creditBuyer(buyerObjectId: string, credits: number) {
  return grantCredits(buyerObjectId, credits)
}

// PUBLIC server action used by the transformation flow. Takes NO client id and NO
// client delta: the caller is resolved from the Clerk session and the fee is a
// server constant. The decrement is a CONDITIONAL atomic $inc guarded by
// { creditBalance: { $gte: cost } } so it can never drive a balance negative and
// cannot be raced. Returns null when the user is out of credits (so the client can
// show the insufficient-credits UX) instead of throwing.
export async function spendCredits() {
  try {
    await connectToDatabase()

    const { userId: clerkId } = await auth() // Clerk v6: async
    if (!clerkId) throw new Error("Not authenticated")

    const cost = TRANSFORMATION_CREDIT_COST // server constant, positive int

    const updated = await User.findOneAndUpdate(
      { clerkId, creditBalance: { $gte: cost } },
      { $inc: { creditBalance: -cost } },
      { new: true }
    )

    if (!updated) return null // insufficient credits (or unknown user)
    return JSON.parse(JSON.stringify(updated))
  } catch (error) {
    handleError(error)
  }
}
