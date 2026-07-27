# Maintenance scripts

One-off operational scripts. All are **idempotent** — safe to re-run.

Each needs `MONGODB_URL` in the environment (the same variable the app uses). Run from the
repo root so the npm aliases resolve.

| Script | Alias | What it does | When to run |
|---|---|---|---|
| `backfill-timestamps.js` | `npm run backfill:timestamps` | Gives pre-existing image docs an `updatedAt`, copied from the legacy misspelled `updateAt` (falling back to `createdAt`). Supports `--dry-run`. | **Once, at the `dev` → `main` production cutover.** Required for correct profile-page ordering — see below. |

## backfill-timestamps

The `Image` schema used to hand-roll its timestamps and misspelled one of them as `updateAt`
(no 'd'), while `getUserImages` sorts by `updatedAt`. Mongo treats a sort on a missing path as
a null key, so that ordering never actually worked.

Phase BUGS-2 moved the schema to `{ timestamps: true }`, so mongoose now maintains a correct
`updatedAt` — but **only for documents written after the deploy**. Every image already in the
database still lacks the field and would sort as a null-key group.

Run this once against production after deploying, to make the now-working sort correct for the
whole collection.

**Preview first — this writes nothing:**

```sh
npm run backfill:timestamps -- --dry-run
```

It prints the total document count, how many are missing `updatedAt`, and a sample of up to 10
documents showing the exact value that would be written and which field it came from. The
preview is computed by running the real pipeline through an aggregation, so what you see is
what you get — not a guess.

**Then apply:**

```sh
npm run backfill:timestamps
```

It reports how many documents matched and were modified, then re-counts to verify none remain.

Safety properties, all covered by `__tests__/backfill-timestamps.test.ts`:

- **Idempotent** — the filter matches only documents lacking a usable `updatedAt`, so a second
  run is a no-op.
- **Reversible** — it never drops the legacy `updateAt` field, so rolling back to the previous
  deploy still works.
- **Server-side clock** — the final fallback is `$$NOW`, not a client `new Date()`, so no local
  clock skew is baked into the data.
- **Version-safe** — uses nested 2-argument `$ifNull`; the N-ary form needs MongoDB ≥ 5.0.
