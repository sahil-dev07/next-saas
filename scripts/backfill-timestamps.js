// One-time migration: give pre-existing image documents an `updatedAt` field.
//
// WHY: the Image schema originally hand-rolled its own timestamps and MISSPELLED one of
// them — `updateAt` (no 'd') — while `getUserImages` sorts by `.sort({ updatedAt: -1 })`.
// Mongo silently treats a sort on a non-existent path as a null key, so the profile-page
// ordering never actually worked. Phase BUGS-2 switched the schema to `{ timestamps: true }`,
// which makes mongoose maintain the correctly-spelled `createdAt`/`updatedAt` from now on.
//
// But that only applies to documents written AFTER the deploy. Every image already in the
// database has `createdAt` + the misspelled `updateAt` and NO `updatedAt`, so those docs
// would sort as a null-key group (last, in a descending sort) and stay unordered among
// themselves. This backfills them so the now-working sort is correct for the whole
// collection.
//
// The value is taken from the misspelled `updateAt` when present — that WAS the real last
// -touched time — and falls back to `createdAt` otherwise.
//
// SAFE TO RE-RUN: the filter only matches documents that still lack `updatedAt`, so a second
// run is a no-op. It deliberately does NOT drop the legacy `updateAt` field, so the change is
// reversible and a rollback to the previous deploy keeps working.
//
// RUN (against the production DB, from the repo root):
//   npm run backfill:timestamps
// Requires MONGODB_URL in the environment (same var the app uses).

const mongoose = require("mongoose");

async function main() {
    const MONGODB_URL = process.env.MONGODB_URL;
    if (!MONGODB_URL) {
        console.error("MONGODB_URL is not set — aborting");
        process.exit(1);
    }

    // dbName must match lib/Database/mongoose.ts, or this silently migrates nothing.
    await mongoose.connect(MONGODB_URL, { dbName: "Imaginify", bufferCommands: false });

    // Work on the raw collection: the app's Image model now has timestamps:true, and letting
    // mongoose manage them here would stamp "now" instead of preserving the historical time.
    const images = mongoose.connection.collection("images");

    // Treat an explicit null the same as a missing field — both sort as a null key.
    const NEEDS_BACKFILL = { $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }] };

    const missing = await images.countDocuments(NEEDS_BACKFILL);
    console.log(`Images missing updatedAt: ${missing}`);

    if (missing === 0) {
        console.log("Nothing to backfill.");
        await mongoose.disconnect();
        return;
    }

    // Aggregation-pipeline update so the new value can be COPIED from another field in the
    // same document: prefer the legacy misspelled `updateAt`, else `createdAt`, else the
    // server clock.
    //
    // NESTED 2-argument $ifNull on purpose. The N-ary form ($ifNull: [a, b, c]) only exists
    // on MongoDB >= 5.0; nesting the 2-arg form behaves identically and also runs on 4.x.
    // `$$NOW` is the SERVER's time — a client `new Date()` would bake in this machine's clock.
    const result = await images.updateMany(
        NEEDS_BACKFILL,
        [
            {
                $set: {
                    updatedAt: {
                        $ifNull: ["$updateAt", { $ifNull: ["$createdAt", "$$NOW"] }],
                    },
                },
            },
        ]
    );

    console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}`);

    const remaining = await images.countDocuments(NEEDS_BACKFILL);
    console.log(
        remaining === 0
            ? "Backfill complete — every image now has updatedAt."
            : `WARNING: ${remaining} document(s) still lack updatedAt.`
    );

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error("Backfill failed:", error);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
});
