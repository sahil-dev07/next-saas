import mongoose, { Mongoose } from "mongoose";

const MONGODB_URL = process.env.MONGODB_URL

interface MongooseConnection {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
}

// caching

let cached: MongooseConnection = (global as any).mongoose

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null }
}

export const connectToDatabase = async () => {
    if (cached.conn)
        return cached.conn

    if (!MONGODB_URL)
        throw new Error("MongoDB URL is not defined")

    cached.promise = cached.promise || mongoose.connect(MONGODB_URL, { dbName: 'Imaginify', bufferCommands: false })

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        // On failure, drop the cached rejected promise so the NEXT call retries a
        // fresh connect instead of re-awaiting the same permanently-rejected promise.
        cached.promise = null
        throw error
    }

    return cached.conn;
}

