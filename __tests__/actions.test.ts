import { describe, it, expect, vi, beforeEach } from "vitest"

// Complements money-paths.test.ts. That file pins the payment/credit invariants; this one
// covers the authorization + ownership guards on the image and user actions.

const h = vi.hoisted(() => ({
    authMock: vi.fn(),
    userFindOneMock: vi.fn(),
    userFindOneAndUpdateMock: vi.fn(),
    userFindByIdAndDeleteMock: vi.fn(),
    imageCreateMock: vi.fn(),
    imageFindByIdMock: vi.fn(),
    imageFindByIdAndUpdateMock: vi.fn(),
    imageFindByIdAndDeleteMock: vi.fn(),
}))

vi.mock("@clerk/nextjs/server", () => ({ auth: h.authMock }))

vi.mock("@/lib/Database/mongoose", () => ({
    connectToDatabase: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/Database/models/user.model", () => ({
    default: {
        findOne: h.userFindOneMock,
        findOneAndUpdate: h.userFindOneAndUpdateMock,
        findByIdAndDelete: h.userFindByIdAndDeleteMock,
    },
}))

vi.mock("@/lib/Database/models/image.model", () => ({
    default: {
        create: h.imageCreateMock,
        findById: h.imageFindByIdMock,
        findByIdAndUpdate: h.imageFindByIdAndUpdateMock,
        findByIdAndDelete: h.imageFindByIdAndDeleteMock,
    },
}))

vi.mock("next/navigation", () => ({
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
    vi.clearAllMocks()
})

// A valid image payload as the client would send it.
const clientImage = {
    title: "A cat",
    publicId: "pub_1",
    transformationType: "recolor",
    width: 100,
    height: 100,
    config: { recolor: { to: "red" } },
    secureURL: "https://res.cloudinary.com/x.png",
    transformationUrl: "https://res.cloudinary.com/t.png",
    aspectRatio: "1:1",
    prompt: "hat",
    color: "red",
}

describe("addImage — server-derived ownership", () => {
    it("attributes the image to the AUTH-derived user, ignoring any client-sent author", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_owner" })
        h.userFindOneMock.mockResolvedValue({ _id: "mongo_owner" })
        h.imageCreateMock.mockResolvedValue({ _id: "img_1" })

        const { addImage } = await import("@/lib/actions/image.actions")
        await addImage({
            // A malicious client tries to attribute the image to someone else.
            image: { ...clientImage, author: "victim_id", _id: "forced_id" } as never,
            path: "/",
        })

        const created = h.imageCreateMock.mock.calls[0][0]
        expect(created.author).toBe("mongo_owner")
        // Mass-assignment guard: the field whitelist must drop the injected _id.
        expect(created._id).toBeUndefined()
    })

    it("rejects an unauthenticated caller before writing", async () => {
        h.authMock.mockReturnValue({ userId: null })

        const { addImage } = await import("@/lib/actions/image.actions")
        await expect(addImage({ image: clientImage as never, path: "/" })).rejects.toThrow()
        expect(h.imageCreateMock).not.toHaveBeenCalled()
    })

    it("rejects when the Clerk user has no matching Mongo record", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_ghost" })
        h.userFindOneMock.mockResolvedValue(null)

        const { addImage } = await import("@/lib/actions/image.actions")
        await expect(addImage({ image: clientImage as never, path: "/" })).rejects.toThrow()
        expect(h.imageCreateMock).not.toHaveBeenCalled()
    })
})

describe("updateImage — IDOR + mass assignment", () => {
    it("refuses to update an image owned by someone else", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_attacker" })
        h.userFindOneMock.mockResolvedValue({ _id: "attacker_id" })
        h.imageFindByIdMock.mockResolvedValue({ _id: "img_1", author: "victim_id" })

        const { updateImage } = await import("@/lib/actions/image.actions")
        await expect(
            updateImage({ image: { ...clientImage, _id: "img_1" } as never, path: "/" })
        ).rejects.toThrow()
        expect(h.imageFindByIdAndUpdateMock).not.toHaveBeenCalled()
    })

    it("allows the owner and never lets the payload overwrite author/_id", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_owner" })
        h.userFindOneMock.mockResolvedValue({ _id: "owner_id" })
        h.imageFindByIdMock.mockResolvedValue({ _id: "img_1", author: "owner_id" })
        h.imageFindByIdAndUpdateMock.mockResolvedValue({ _id: "img_1" })

        const { updateImage } = await import("@/lib/actions/image.actions")
        await updateImage({
            image: { ...clientImage, _id: "img_1", author: "someone_else" } as never,
            path: "/",
        })

        const [, update] = h.imageFindByIdAndUpdateMock.mock.calls[0]
        expect(update.author).toBeUndefined()
        expect(update._id).toBeUndefined()
        expect(update.title).toBe("A cat")
    })

    it("compares ownership as strings (ObjectId vs string must still match)", async () => {
        // The real author is an ObjectId; String() coercion on both sides is what makes the
        // comparison work. A regression to === would lock the true owner out of their image.
        h.authMock.mockReturnValue({ userId: "clerk_owner" })
        h.userFindOneMock.mockResolvedValue({ _id: { toString: () => "owner_id" } })
        h.imageFindByIdMock.mockResolvedValue({
            _id: "img_1",
            author: { toString: () => "owner_id" },
        })
        h.imageFindByIdAndUpdateMock.mockResolvedValue({ _id: "img_1" })

        const { updateImage } = await import("@/lib/actions/image.actions")
        await updateImage({ image: { ...clientImage, _id: "img_1" } as never, path: "/" })

        expect(h.imageFindByIdAndUpdateMock).toHaveBeenCalled()
    })

    it("rejects when the image does not exist", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_owner" })
        h.userFindOneMock.mockResolvedValue({ _id: "owner_id" })
        h.imageFindByIdMock.mockResolvedValue(null)

        const { updateImage } = await import("@/lib/actions/image.actions")
        await expect(
            updateImage({ image: { ...clientImage, _id: "nope" } as never, path: "/" })
        ).rejects.toThrow()
        expect(h.imageFindByIdAndUpdateMock).not.toHaveBeenCalled()
    })
})

describe("deleteImage", () => {
    it("deletes for the owner, then redirects OUTSIDE the try/catch", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_owner" })
        h.userFindOneMock.mockResolvedValue({ _id: "owner_id" })
        h.imageFindByIdMock.mockResolvedValue({ _id: "img_1", author: "owner_id" })
        h.imageFindByIdAndDeleteMock.mockResolvedValue({ _id: "img_1" })

        const { deleteImage } = await import("@/lib/actions/image.actions")

        // redirect() signals by throwing NEXT_REDIRECT. It must escape — if it were caught by
        // the action's own catch, handleError would swallow it and no navigation would happen.
        await expect(deleteImage("img_1")).rejects.toThrow("NEXT_REDIRECT")
        expect(h.imageFindByIdAndDeleteMock).toHaveBeenCalledWith("img_1")
    })

    it("does not redirect when the delete failed", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_attacker" })
        h.userFindOneMock.mockResolvedValue({ _id: "attacker_id" })
        h.imageFindByIdMock.mockResolvedValue({ _id: "img_1", author: "victim_id" })

        const { deleteImage } = await import("@/lib/actions/image.actions")

        // The thrown error is the authorization failure, NOT a redirect — a non-owner must
        // never be sent to "/" as though the delete succeeded.
        await expect(deleteImage("img_1")).rejects.toThrow(/Unauthorized/)
        expect(h.imageFindByIdAndDeleteMock).not.toHaveBeenCalled()
    })

    it("rejects when the image is missing", async () => {
        h.authMock.mockReturnValue({ userId: "clerk_owner" })
        h.userFindOneMock.mockResolvedValue({ _id: "owner_id" })
        h.imageFindByIdMock.mockResolvedValue(null)

        const { deleteImage } = await import("@/lib/actions/image.actions")
        await expect(deleteImage("gone")).rejects.toThrow()
        expect(h.imageFindByIdAndDeleteMock).not.toHaveBeenCalled()
    })
})

describe("user actions", () => {
    it("getUserById throws for an unknown clerkId rather than returning undefined", async () => {
        h.userFindOneMock.mockResolvedValue(null)
        const { getUserById } = await import("@/lib/actions/user.actions")
        await expect(getUserById("clerk_ghost")).rejects.toThrow(/User not found/)
    })

    it("updateUser throws when no record matched", async () => {
        h.userFindOneAndUpdateMock.mockResolvedValue(null)
        const { updateUser } = await import("@/lib/actions/user.actions")
        await expect(
            updateUser("clerk_ghost", {
                firstName: "A", lastName: "B", username: "ab", photo: "p",
            })
        ).rejects.toThrow(/User update failed/)
    })

    it("deleteUser throws when the user does not exist", async () => {
        h.userFindOneMock.mockResolvedValue(null)
        const { deleteUser } = await import("@/lib/actions/user.actions")
        await expect(deleteUser("clerk_ghost")).rejects.toThrow(/User not found/)
        expect(h.userFindByIdAndDeleteMock).not.toHaveBeenCalled()
    })
})
