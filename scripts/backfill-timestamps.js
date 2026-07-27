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
// RUN (from the repo root; MONGODB_URL must be set — same var the app uses):
//   npm run backfill:timestamps -- --dry-run   # preview only, writes NOTHING
//   npm run backfill:timestamps                # perform the migration

const mongoose = require("mongoose");

// dbName must match lib/Database/mongoose.ts, or this silently migrates nothing.
const DB_NAME = "Imaginify";
const COLLECTION = "images";

// Treat an explicit null the same as a missing field — both sort as a null key.
const NEEDS_BACKFILL = {
    $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }],
};

// Aggregation-pipeline update so the new value can be COPIED from another field in the same
// document: prefer the legacy misspelled `updateAt`, else `createdAt`, else the server clock.
//
// NESTED 2-argument $ifNull on purpose. The N-ary form ($ifNull: [a, b, c]) only exists on
// MongoDB >= 5.0; nesting the 2-arg form behaves identically and also runs on 4.x.
// `$$NOW` is the SERVER's time — a client `new Date()` would bake in this machine's clock.
const BACKFILL_PIPELINE = [
    {
        $set: {
            updatedAt: {
                $ifNull: ["$updateAt", { $ifNull: ["$createdAt", "$$NOW"] }],
            },
        },
    },
];

async function main({ dryRun }) {
    const MONGODB_URL = process.env.MONGODB_URL;
    if (!MONGODB_URL) {
        console.error("MONGODB_URL is not set — aborting");
        process.exit(1);
    }

    await mongoose.connect(MONGODB_URL, { dbName: DB_NAME, bufferCommands: false });

    // Work on the raw collection: the app's Image model now has timestamps:true, and letting
    // mongoose manage them here would stamp "now" instead of preserving the historical time.
    const images = mongoose.connection.collection(COLLECTION);

    const total = await images.countDocuments({});
    const missing = await images.countDocuments(NEEDS_BACKFILL);
    console.log(`Database : ${DB_NAME}.${COLLECTION}`);
    console.log(`Documents: ${total} total, ${missing} missing updatedAt`);

    if (missing === 0) {
        console.log("Nothing to backfill.");
        await mongoose.disconnect();
        return;
    }

    if (dryRun) {
        // Show exactly what WOULD be written, without writing. Runs the same pipeline through
        // an aggregation so the previewed value is computed by the server, not guessed here.
        const preview = await images
            .aggregate([
                { $match: NEEDS_BACKFILL },
                ...BACKFILL_PIPELINE,
                { $project: { _id: 1, title: 1, createdAt: 1, updateAt: 1, updatedAt: 1 } },
                { $limit: 10 },
            ])
            .toArray();

        console.log(`\nDRY RUN — nothing written. Sample of what would change (up to 10):`);
        for (const doc of preview) {
            const source = doc.updateAt ? "updateAt" : doc.createdAt ? "createdAt" : "$$NOW";
            console.log(
                `  ${doc._id}  ${String(doc.title ?? "").slice(0, 30).padEnd(30)}  ` +
                `updatedAt <- ${doc.updatedAt?.toISOString?.() ?? doc.updatedAt}  (from ${source})`
            );
        }
        console.log(`\nWould modify ${missing} document(s). Re-run without --dry-run to apply.`);
        await mongoose.disconnect();
        return;
    }

    const result = await images.updateMany(NEEDS_BACKFILL, BACKFILL_PIPELINE);
    console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}`);

    const remaining = await images.countDocuments(NEEDS_BACKFILL);
    console.log(
        remaining === 0
            ? "Backfill complete — every image now has updatedAt."
            : `WARNING: ${remaining} document(s) still lack updatedAt.`
    );

    await mongoose.disconnect();
}

// Exported for the unit test, which asserts the filter/pipeline shape without a live DB.
module.exports = { NEEDS_BACKFILL, BACKFILL_PIPELINE, DB_NAME, COLLECTION };

// Only run when invoked directly (`node scripts/backfill-timestamps.js`), not when required
// by the test.
if (require.main === module) {
    const dryRun = process.argv.includes("--dry-run");
    main({ dryRun }).catch(async (error) => {
        console.error("Backfill failed:", error);
        await mongoose.disconnect().catch(() => { });
        process.exit(1);
    });
}
