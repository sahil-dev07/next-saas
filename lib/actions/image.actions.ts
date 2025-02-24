"use server"

import { revalidatePath } from "next/cache"
import { connectToDatabase } from "../Database/mongoose"
import { handleError } from "../utils"
import User from "../Database/models/user.model"
import Image from "../Database/models/image.model"
import { redirect } from "next/navigation"
import { v2 as cloudinary } from 'cloudinary'
import { AwardIcon } from "lucide-react"
const populateUser = (query: any) => {

    return query.populate({
        path: 'author',
        model: User,
        select: '_id firstName lastName clerkId'
    })

}

// ADD IMAGE
export async function addImage({ image, userId, path }: AddImageParams) {

    try {
        await connectToDatabase()

        const author = await User.findById(userId)

        if (!author)
            throw new Error("User not found")

        const newImage = await Image.create({
            ...image,
            author: author._id
        })


        revalidatePath(path)
        return JSON.parse(JSON.stringify(newImage))
    } catch (error) {
        handleError(error)
    }
}

// UPDATE IMAGE
export async function updateImage({ image, userId, path }: UpdateImageParams) {

    try {
        await connectToDatabase()

        const imageToUpadate = await Image.findById(image._id)

        if (!imageToUpadate || imageToUpadate.author.toHexString() != userId)
            throw new Error("Unauthorised or Image not found")

        const updatedImage = await Image.findByIdAndUpdate(
            // image._id,
            imageToUpadate._id,
            image,
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

    try {
        await connectToDatabase()


        const imageToDelete = await Image.findById(imageId)

        if (!imageToDelete)
            throw new Error("Image not found")

        await Image.findByIdAndDelete(imageId)


        // await Image.findByIdAndDelete(imageId)

    } catch (error) {
        handleError(error)
    } finally {
        redirect('/')
    }
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

        if (searchQuery)
            expression += `AND ${searchQuery}`

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

        const totalImages: any = await Image.find(query).countDocuments()
        const savedImages = await Image.find().countDocuments()
        // console.log("total Images : ",totalImages)
        // console.log("saved Images : ",savedImages)
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

        const totalImages: any = await Image.find({ author: userId }).countDocuments

        return {
            data: JSON.parse(JSON.stringify(images)),
            totalPage: Math.ceil(totalImages / limit),
        }
    } catch (error) {
        handleError(error)
    }

}