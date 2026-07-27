"use server"

import { revalidatePath } from "next/cache"
import { connectToDatabase } from "../Database/mongoose"
import { handleError } from "../utils"
import User from "../Database/models/user.model"
import Image from "../Database/models/image.model"
import { redirect } from "next/navigation"
import { v2 as cloudinary } from 'cloudinary'
import { auth } from "@clerk/nextjs/server" // Clerk v6: async auth() from /server

const populateUser = (query: any) => {

    return query.populate({
        path: 'author',
        model: User,
        select: '_id firstName lastName clerkId'
    })

}

// Resolve the Clerk-authenticated caller to their Mongo user.
// Central owner-identity source for all mutating image actions (kills IDOR):
// ownership is always checked against this, never a client-supplied userId.
const getAuthUser = async () => {
    const { userId: clerkId } = await auth()
    if (!clerkId) throw new Error("Not authenticated")
    const user = await User.findOne({ clerkId })
    if (!user) throw new Error("User not found")
    return user
}

// Whitelist of client-writable image fields — prevents mass-assignment via raw
// spread (a client could otherwise inject `author`/`_id`). `transformationUrl` is
// the canonical key (matches the mongoose schema).
const pickImageFields = (image: any) => ({
    title: image.title,
    publicId: image.publicId,
    transformationType: image.transformationType,
    width: image.width,
    height: image.height,
    config: image.config,
    secureURL: image.secureURL,
    transformationUrl: image.transformationUrl,
    aspectRatio: image.aspectRatio,
    prompt: image.prompt,
    color: image.color,
})

// ADD IMAGE
export async function addImage({ image, path }: AddImageParams) {

    try {
        await connectToDatabase()

        // Owner is the authenticated caller, not a client-sent userId.
        const author = await getAuthUser()

        const newImage = await Image.create({
            ...pickImageFields(image),
            author: author._id
        })


        revalidatePath(path)
        return JSON.parse(JSON.stringify(newImage))
    } catch (error) {
        handleError(error)
    }
}

// UPDATE IMAGE
export async function updateImage({ image, path }: UpdateImageParams) {

    try {
        await connectToDatabase()

        const author = await getAuthUser()
        const imageToUpdate = await Image.findById(image._id)

        // Ownership = resource.author === auth-derived _id (compare as strings).
        if (!imageToUpdate || String(imageToUpdate.author) !== String(author._id))
            throw new Error("Unauthorized or image not found")

        const updatedImage = await Image.findByIdAndUpdate(
            imageToUpdate._id,
            pickImageFields(image), // no raw spread — author/_id can't be overwritten
            { new: true }
        )


        revalidatePath(path)
        return JSON.parse(JSON.stringify(updatedImage))
    } catch (error) {
        handleError(error)
    }
}

// Delete IMAGE
export async function deleteImage(imageId: string) {

    let deleted = false
    try {
        await connectToDatabase()

        const author = await getAuthUser()
        const imageToDelete = await Image.findById(imageId)

        if (!imageToDelete)
            throw new Error("Image not found")

        // IDOR guard: only the owner may delete.
        if (String(imageToDelete.author) !== String(author._id))
            throw new Error("Unauthorized")

        await Image.findByIdAndDelete(imageId)
        revalidatePath("/")
        deleted = true
    } catch (error) {
        handleError(error)
    }

    // redirect() throws NEXT_REDIRECT internally, so it must run OUTSIDE try/catch —
    // otherwise handleError swallows the control-flow throw and no navigation happens.
    // Only redirect on a real delete; on error handleError already threw.
    if (deleted) redirect('/')
}

// GET IMAGE
export async function getImageById(imageId: string) {

    try {
        await connectToDatabase()

        const image = await populateUser(Image.findById(imageId))
        if (!image)
            throw new Error("Image not found")
        return JSON.parse(JSON.stringify(image))
    } catch (error) {
        handleError(error)
    }

}


// GET ALL IMAGE
export async function getAllImage({ limit = 9, page = 1, searchQuery = '' }: {
    limit?: number,
    page: number,
    searchQuery?: string
}) {

    try {
        await connectToDatabase()

        cloudinary.config({
            cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        })

        let expression = 'folder=imaginify'

        if (searchQuery) {
            // Escape backslashes/quotes so a user query can't break out of the
            // Cloudinary search expression (injection). Note the LEADING SPACE before
            // AND — the original produced "imaginifyAND <q>" (invalid, never matched).
            const safe = String(searchQuery).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
            expression += ` AND "${safe}"`
        }

        const { resources } = await cloudinary.search
            .expression(expression)
            .execute()

        const resourceIds = resources.map((resource: any) => resource.public_id)

        let query = {}
        if (searchQuery) {
            query = {
                publicId: {
                    $in: resourceIds
                }
            }
        }

        const skipAmount = (Number(page) - 1) * limit

        const images = await populateUser(Image.find(query))
            .sort({ createdAt: -1 })
            .skip(skipAmount)
            .limit(limit)

        const totalImages: number = await Image.find(query).countDocuments()
        const savedImages = await Image.find().countDocuments()
        return {
            data: JSON.parse(JSON.stringify(images)),
            totalPage: Math.ceil(totalImages / limit),
            savedImages
        }
    } catch (error) {
        handleError(error)
    }

}

export async function getUserImages({ limit = 9, page = 1, userId }: {
    limit?: number,
    page: number,
    userId: string
}) {

    try {
        await connectToDatabase()
        const skipAmount = (Number(page) - 1) * limit

        const images = await populateUser(Image.find({ author: userId }))
            .sort({ updatedAt: -1 })
            .skip(skipAmount)
            .limit(limit)

        // NOTE: countDocuments() must be CALLED — the original omitted the parens,
        // awaiting the function reference, so totalPage was Math.ceil(NaN) = NaN and
        // profile pagination never rendered.
        const totalImages: number = await Image.countDocuments({ author: userId })

        return {
            data: JSON.parse(JSON.stringify(images)),
            totalPage: Math.ceil(totalImages / limit),
        }
    } catch (error) {
        handleError(error)
    }

}