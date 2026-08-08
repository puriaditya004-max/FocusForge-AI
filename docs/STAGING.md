# Staging Environment — Setup Guide

## Why this exists

Right now there's no staging environment — anything you test happens
directly against the same infrastructure production will use (or *is*
production, once launched). That means every schema migration, every
risky change, every "let me just try this" gets tested for the first
time on real data with real users. Staging gives you a fully separate
copy of the whole stack — its own database, its own backend, its own
frontend — where you can break things safely before they reach
production.

This is a setup/infra task, not a code change, so nothing in this repo
had to change to make it possible. This doc is the checklist.

## The shape of it

Every piece of the stack gets a staging counterpart, running
side-by-side with (not instead of) production:

| Piece | Production | Staging |
|---|---|---|
| Database | Neon main branch | **Neon branch** (see below) |
| Backend | Render service #1 | Render service #2 (same repo, different env vars) |
| Frontend | Vercel project (main) | Vercel Preview deployment, or a second Vercel project |
| Admin app | Vercel project (main) | Vercel Preview deployment, or a second Vercel project |
| Redis | Upstash/Render KV instance #1 | Same instance is fine — use a key prefix, or a second free instance |
| R2 bucket | `focusforge-uploads` | Same bucket with a `staging/` key prefix, or a second bucket |

## Step 1 — Database: use a Neon branch, not a new database

Neon (which you're already on) supports **database branching**, the
same idea as a git branch but for your Postgres data — a staging
branch starts as an instant copy-on-write copy of production data,
and only diverges as you write to it. This is the fastest way to get
a realistic staging database without manually re-seeding it.

1. Neon console → your project → **Branches** → **Create branch**
2. Branch from `main` (or `production`, whatever your primary branch
   is named), name it `staging`
3. Neon gives you a separate connection string for this branch — grab
   the **pooled** version of it (same `-pooler` guidance as the main
   `DATABASE_URL`, see `backend/.env.example`)
4. This becomes `DATABASE_URL` for the staging backend only — never
   share a connection string between production and staging

## Step 2 — Backend: a second Render Web Service

1. Render dashboard → **New** → **Web Service** → same GitHub repo
   (`puriaditya004-max/FocusForge-AI`), root directory `backend`
2. Name it something obviously distinct, e.g. `focusforge-backend-staging`
3. Environment variables — copy every var from the production service,
   then override these to point at staging-only resources:
   - `DATABASE_URL` → the Neon `staging` branch's pooled connection
     string from Step 1
   - `NODE_ENV` → `production` (staging should behave like production
     code-wise — cookies, security headers, etc. — it's the *data*
     and *audience* that differ, not the runtime mode)
   - `CLIENT_URL` / `ADMIN_URL` → the staging frontend URLs from Step 3
   - `REDIS_URL` → can reuse the same Redis instance as production
     (Redis keys are already prefixed per-purpose, e.g. `rl:auth:`,
     `chatrl:`, so there's no collision risk) — or spin up a second
     free instance if you'd rather keep them fully separate
   - `S3_BUCKET` → can reuse the same R2 bucket with a distinct
     folder, e.g. set uploads to go under a `staging/` prefix, or
     create a second free R2 bucket (10GB free tier is per-account,
     not per-bucket, so a second bucket costs nothing extra while
     you're under the combined 10GB)
   - `SENTRY_DSN` → **use a separate Sentry project** for staging so
     staging noise doesn't pollute production alerts (Sentry's free
     tier supports multiple projects)
   - Payment keys (`RAZORPAY_KEY_ID`/`SECRET`) → use Razorpay's
     **test mode** keys here, never live keys, so no real money moves
     during staging testing
4. Auto-deploy: point this service at a `staging` git branch instead
   of `main`, so pushing to `staging` deploys here without touching
   production. Merge `staging` → `main` when you're ready to promote
   a change to production.

## Step 3 — Frontend + Admin app: Vercel

Simplest option — you likely already get this for free with Vercel's
default behavior:

- **Vercel Preview Deployments**: every branch/PR you push already
  gets its own preview URL automatically, with its own environment
  variables if you set them under Vercel → Project → Settings →
  Environment Variables → scope a variable to "Preview" instead of
  "Production". Set `VITE_API_URL` (and the admin-app equivalent) to
  the staging backend's Render URL, scoped to Preview only.
- If you want a *stable* staging URL instead of a new one per push,
  create a second Vercel project pointed at the same repo but the
  `staging` branch, with its own env vars.

## Step 4 — Keep production and staging genuinely isolated

A few rules worth holding firm on, since staging's whole point is
being a safe place to break things:

- Staging's `DATABASE_URL` should **never** point at the production
  Neon branch, even temporarily — a staging bug that writes bad data
  should never be able to touch real user data.
- Staging's Razorpay keys should always be **test mode** — this is
  the one that causes real damage (real charges) if mixed up.
- Don't share `JWT_SECRET` between the two — a token minted by
  staging shouldn't be valid against production, and vice versa.
- It's fine (and normal) for staging to share Redis and the R2
  bucket with production, as long as key/folder prefixes keep them
  from colliding — those two are lower-risk to share than the
  database or payment keys.

## What "done" looks like

- A push to the `staging` branch deploys a fully working copy of the
  app (backend + frontend + admin) against the Neon staging branch,
  with test-mode payments, without touching anything production uses.
- You can run a full signup → course purchase → refund cycle on
  staging without it appearing anywhere in real Razorpay/production
  data.
- Promoting a change to production is just merging `staging` → `main`.
