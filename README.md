# imaginify

AI-powered image transformation SaaS built with the Next.js 14 App Router. Users buy credit packs (Stripe) and spend credits on Cloudinary-backed AI transforms (restore, generative fill, object remove/recolor, background remove).

## Tech stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Auth:** Clerk
- **Payments:** Stripe (credit packs)
- **Database:** MongoDB via mongoose
- **Media / AI:** Cloudinary (`next-cloudinary`)
- **UI:** Tailwind CSS 3 + Radix UI / shadcn

## Prerequisites

- Node.js **22** (`.nvmrc` — run `nvm use`), npm
- Accounts: MongoDB Atlas, Clerk, Stripe, Cloudinary

## Environment variables

Copy `.env.example` to `.env.local` and fill every value. All 15 are required:

| Variable | Service | Scope | Where |
|---|---|---|---|
| `MONGODB_URL` | MongoDB | server | Atlas connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | public | Clerk > API Keys |
| `CLERK_SECRET_KEY` | Clerk | server | Clerk > API Keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `..._SIGN_UP_URL` | Clerk | public | `/sign-in`, `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` / `..._AFTER_SIGN_UP_URL` | Clerk | public | post-auth landing (v4 names) |
| `WEBHOOK_SECRET` | Clerk webhook | server | Clerk > Webhooks > Signing Secret |
| `STRIPE_SECRET_KEY` | Stripe | server | Stripe > API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | public | Stripe > API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook | server | Stripe > Webhooks > Signing secret |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary | public | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary | server | Cloudinary dashboard |
| `NEXT_PUBLIC_SERVER_URL` | App | public | base URL for Stripe redirects |

> **Trap:** the Clerk webhook secret is `WEBHOOK_SECRET` (no `CLERK_` prefix); the Stripe one is `STRIPE_WEBHOOK_SECRET`. They are different values.
>
> **Clerk v5+ note:** `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` / `..._AFTER_SIGN_UP_URL` are renamed to `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `..._SIGN_UP_FALLBACK_REDIRECT_URL`.

## Local development

```bash
nvm use                 # Node 22
cp .env.example .env.local   # then fill in real values
npm install
npm run dev             # http://localhost:3000
```

## Webhook configuration

Register these endpoints in the provider dashboards (update the URLs whenever the deploy URL changes):

- **Clerk:** `https://<your-domain>/api/webhooks/clerk` — signing secret → `WEBHOOK_SECRET`. Local: use the Clerk Dashboard + a tunnel.
- **Stripe:** `https://<your-domain>/api/webhooks/stripe` — signing secret → `STRIPE_WEBHOOK_SECRET`. Local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

Both webhook routes are public in `middleware`; they are authenticated by their own signature secrets.

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint
- `npm test` / `npm run test:watch` / `npm run test:cov` — Vitest

## Deployment (Vercel)

1. Set all 15 env vars in **Project Settings → Environment Variables**.
2. **Node.js Version = 22.x**.
3. Set `NEXT_PUBLIC_SERVER_URL` to the production domain.
4. After deploy, register the two webhook endpoints (above) in Clerk and Stripe.

## Project structure

```text
app/                 App Router pages + api/webhooks/{clerk,stripe}
lib/actions/         server actions (user, image, transaction)
lib/Database/        mongoose connection + models
lib/plans.ts         server-authoritative pricing / credit-fee
components/          shared components + ui/ (shadcn)
constants/           nav, plans, transformation types
types/               shared TS types
```
