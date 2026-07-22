/* eslint-disable camelcase */
import { clerkClient, WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { createUser, deleteUser, updateUser } from "@/lib/actions/user.actions"

export async function POST(req: Request) {
    // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        throw new Error(
            "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
        );
    }

    // Get the headers. Next 15: headers() returns a Promise and must be awaited. (A backward-compat
    // shim still exposes .get() on the un-awaited Promise with a deprecation warning, but that is
    // being removed — awaiting is the correct, future-proof form for svix verification below.)
    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response("Error occured -- no svix headers", {
            status: 400,
        });
    }

    // Svix signs the EXACT raw request bytes. Re-serializing a parsed object
    // (JSON.stringify) can reorder keys / change whitespace and break verification,
    // so verify against the raw text (parse from evt.data afterwards).
    const body = await req.text();

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: WebhookEvent;

    // Verify the payload with the headers
    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        }) as WebhookEvent;
    } catch (err) {
        console.error("Error verifying webhook:", err);
        return new Response("Error occured", {
            status: 400,
        });
    }

    // Get the ID and type
    const { id } = evt.data;
    const eventType = evt.type;

    // CREATE
    if (eventType === "user.created") {
        const { id, email_addresses, image_url, first_name, last_name, username } = evt.data;

        const user = {
            clerkId: id,
            email: email_addresses[0].email_address,
            username: username!,
            firstName: first_name ?? "", // Clerk v6 types these as string | null
            lastName: last_name ?? "",
            photo: image_url,
        };

        const newUser = await createUser(user);

        // Set public metadata
        if (newUser) {
            // Clerk v6: clerkClient is an async factory, not a singleton.
            const client = await clerkClient();
            await client.users.updateUserMetadata(id, {
                publicMetadata: {
                    userId: newUser._id,
                },
            });
        }

        return NextResponse.json({ message: "OK", user: newUser });
    }

    // UPDATE
    if (eventType === "user.updated") {
        const { id, image_url, first_name, last_name, username } = evt.data;

        const user = {
            firstName: first_name ?? "", // Clerk v6 types these as string | null
            lastName: last_name ?? "",
            username: username!,
            photo: image_url,
        };

        const updatedUser = await updateUser(id, user);

        return NextResponse.json({ message: "OK", user: updatedUser });
    }

    // DELETE
    if (eventType === "user.deleted") {
        const { id } = evt.data;

        const deletedUser = await deleteUser(id!);

        return NextResponse.json({ message: "OK", user: deletedUser });
    }

    console.log(`Webhook with and ID of ${id} and type of ${eventType}`);
    console.log("Webhook body:", body);

    return new Response("", { status: 200 });
}