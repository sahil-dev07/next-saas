import { describe, it, expect } from "vitest"

// The backfill runs ONCE against production Atlas at the dev->main cutover, so its filter and
// pipeline get exactly one chance to be right. These tests pin their shape without needing a
// live database — a careless edit that widened the filter or broke the fallback chain would
// otherwise only be discovered against real data.
//
// eslint-disable-next-line @typescript-eslint/no-require-imports
const script = require("../scripts/backfill-timestamps.js")
const { NEEDS_BACKFILL, BACKFILL_PIPELINE, DB_NAME, COLLECTION } = script

describe("backfill target", () => {
    it("points at the same database the app connects to", () => {
        // lib/Database/mongoose.ts connects with dbName "Imaginify". A mismatch here would
        // make the migration silently no-op against an empty database.
        expect(DB_NAME).toBe("Imaginify")
        expect(COLLECTION).toBe("images")
    })

    it("matches ONLY documents lacking a usable updatedAt", () => {
        expect(NEEDS_BACKFILL).toEqual({
            $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }],
        })
    })

    it("does not match a document that already has updatedAt", () => {
        // Mirrors the $or semantics: an existing non-null value satisfies neither clause, so
        // re-running the migration is a no-op. This is what makes the script safe to re-run.
        const alreadyMigrated = { updatedAt: new Date() }
        const matchesExistsClause = !("updatedAt" in alreadyMigrated)
        const matchesNullClause = alreadyMigrated.updatedAt === null
        expect(matchesExistsClause || matchesNullClause).toBe(false)
    })

    it("matches a legacy document (misspelled updateAt, no updatedAt)", () => {
        const legacy: Record<string, unknown> = { updateAt: new Date(), createdAt: new Date() }
        expect("updatedAt" in legacy).toBe(false) // -> caught by the $exists:false clause
    })
})

describe("backfill pipeline", () => {
    it("sets updatedAt from updateAt, falling back to createdAt then the SERVER clock", () => {
        expect(BACKFILL_PIPELINE).toEqual([
            {
                $set: {
                    updatedAt: {
                        $ifNull: ["$updateAt", { $ifNull: ["$createdAt", "$$NOW"] }],
                    },
                },
            },
        ])
    })

    it("uses NESTED 2-arg $ifNull, not the N-ary form", () => {
        // The N-ary form ($ifNull: [a, b, c]) requires MongoDB >= 5.0. Nesting behaves
        // identically and also runs on 4.x, so the migration can't fail on an older cluster.
        const outer = BACKFILL_PIPELINE[0].$set.updatedAt.$ifNull
        expect(outer).toHaveLength(2)
        expect(outer[1].$ifNull).toHaveLength(2)
    })

    it("never uses a client-side date literal", () => {
        // A `new Date()` here would bake in the migrating machine's clock (and timezone/skew)
        // instead of the database server's. $$NOW is evaluated server-side.
        const serialized = JSON.stringify(BACKFILL_PIPELINE)
        expect(serialized).toContain("$$NOW")
        // No ISO-8601 timestamp literal should have been serialized into the pipeline.
        expect(serialized).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
    })

    it("touches ONLY updatedAt — never drops the legacy field", () => {
        // Keeping `updateAt` is what makes a rollback to the previous deploy safe.
        const stage = BACKFILL_PIPELINE[0]
        expect(Object.keys(stage)).toEqual(["$set"])
        expect(Object.keys(stage.$set)).toEqual(["updatedAt"])
        expect(JSON.stringify(stage)).not.toContain("$unset")
    })
})
