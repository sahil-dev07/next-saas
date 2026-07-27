# Maintenance scripts

One-off operational scripts. All are **idempotent** — safe to re-run.

Each needs `MONGODB_URL` in the environment (the same variable the app uses). Run from the
repo root so the npm aliases resolve.

| Script | Alias | What it does | When to run |
|---|---|---|---|
| `backfill-timestamps.js` | `npm run backfill:timestamps` | Gives pre-existing image docs an `updatedAt`, copied from the legacy misspelled `updateAt` (falling back to `createdAt`). | **Once, at the `dev` → `main` production cutover.** Required for correct profile-page ordering — see below. |

## backfill-timestamps

The `Image` schema used to hand-roll its timestamps and misspelled one of them as `updateAt`
(no 'd'), while `getUserImages` sorts by `updatedAt`. Mongo treats a sort on a missing path as
a null key, so that ordering never actually worked.

Phase BUGS-2 moved the schema to `{ timestamps: true }`, so mongoose now maintains a correct
`updatedAt` — but **only for documents written after the deploy**. Every image already in the
database still lacks the field and would sort as a null-key group.

Run this once against production after deploying, to make the now-working sort correct for the
whole collection:

```sh
npm run backfill:timestamps
```

It reports how many documents were missing the field, how many it modified, and verifies none
remain. It does not drop the legacy `updateAt` field, so a rollback to the previous deploy
still works.
