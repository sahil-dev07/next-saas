"use server"
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { handleError } from '../utils'
import { connectToDatabase } from '../Database/mongoose'
import Transaction from '../Database/models/transaction.model'
import { updateCredits } from './user.actions'

export async function checkoutCredits(transaction: CheckoutTransactionParams) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    //  stripe transact with cents * 100 = 1 buck
    const amount = Number(transaction.amount) * 100

    const session = await stripe.checkout.sessions.create({
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    unit_amount: amount,
                    product_data: {
                        name: transaction.plan,
                    }
                },
                quantity: 1,
            }
        ],
        metadata: {
            plan: transaction.plan,
            credits: transaction.credits,
            buyerId: transaction.buyerId,
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

        const newTransaction = await Transaction.create({
            ...transaction, buyer: transaction.buyerId
        })

        await updateCredits(transaction.buyerId, transaction.credits)

        // Mongoose Document object, which includes additional properties and methods beyond the raw data stored in the database. To ensure that only the raw data is returned and not the entire Mongoose Document object, the result is serialized to JSON using JSON.stringify. 
        return JSON.parse(JSON.stringify(newTransaction))
    } catch (error) {
        handleError(error)

    }
}