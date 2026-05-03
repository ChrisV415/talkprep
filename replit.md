# TalkPrep

## Overview

AI-powered conversation prep mobile app. Expo (React Native) frontend + Express API server. Helps users prepare for difficult conversations with AI-generated prep guides, persona roleplay, transcript annotation, outcome scoring, and debrief.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24 / TypeScript 5.9
- **Mobile**: Expo SDK 54, expo-router, React Native 0.81.5
- **API**: Express 5, pino logging, esbuild
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Auth**: Clerk (`@clerk/expo` on mobile, `@clerk/express` on server)
- **AI**: OpenAI via Replit AI integration (SSE streaming)
- **Email**: SendGrid via Replit integration (`@sendgrid/mail`)
- **Payments**: Stripe via Replit integration (ready for next month)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`

## Architecture

### Artifacts
- `artifacts/api-server` — Express API server (`@workspace/api-server`)
- `artifacts/mobile` — Expo mobile app (`@workspace/mobile`)

### Shared Libraries
- `lib/db` — Drizzle schema + DB client (`@workspace/db`)
- `lib/api-zod` — Zod schemas from OpenAPI spec
- `lib/api-client-react` — React Query hooks from OpenAPI spec

### Database Tables
- `tp_sessions` — User conversation sessions (synced from mobile)
- `usage_counts` — Per-user monthly AI call tracking (rate limiting)
- `conversations`, `messages` — Original scaffold tables

## Key Features (all screens built)
1. **Home** — Scenario quick-start grid
2. **Prep** — Form: scenario, who, situation, outcome, tone
3. **Result** — AI-generated prep guide (4 tabs: Opening / Key Points / Responses / Full)
4. **Persona** — Configure AI opponent behavior (sliders + difficulty)
5. **Roleplay** — Live chat practice with coaching nudges every 2 exchanges
6. **Transcript** — Annotated replay with GOOD / MISSED OPPORTUNITY per message
7. **Score** — Rate performance (Clarity, Composure, Outcome 1–5)
8. **Debrief** — Log what happened + AI reflection
9. **History** — Session list with score badges (synced to cloud when signed in)
10. **Dashboard** — Progress charts, averages, trend, scenario distribution

## API Endpoints (all protected by requireAuth + rateLimiter)
- `POST /api/talkprep/generate` — Prep guide (SSE)
- `POST /api/talkprep/roleplay` — Roleplay response (SSE)
- `POST /api/talkprep/nudge` — Coaching tip (SSE)
- `POST /api/talkprep/annotate` — Transcript annotation (SSE)
- `POST /api/talkprep/debrief` — AI debrief (SSE)
- `GET  /api/sessions` — List user sessions
- `POST /api/sessions` — Save new session
- `PATCH /api/sessions/:id` — Update scores/debrief
- `DELETE /api/sessions/:id` — Delete session

## Auth Flow (Clerk)
- **Mobile**: `ClerkProvider` wraps app in `_layout.tsx`; `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` injected via dev script
- **Server**: `clerkMiddleware` + `clerkProxyMiddleware` in `app.ts`; `requireAuth` middleware on all AI + session routes
- **Auth screens**: `app/(auth)/sign-in.tsx`, `app/(auth)/sign-up.tsx` — custom TalkPrep-branded, email+password
- **Guard**: `(tabs)/_layout.tsx` redirects unauthenticated users to `/(auth)/sign-in`

## Rate Limiting
- 20 free AI calls/user/month tracked in `usage_counts` table
- `rateLimiter` middleware in `artifacts/api-server/src/middlewares/rateLimiter.ts`
- Returns HTTP 429 with friendly message when limit reached

## Integrations
- **OpenAI** — Replit AI integration (`AI_INTEGRATIONS_OPENAI_API_KEY`)
- **Clerk** — Replit-managed (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
- **SendGrid** — Replit connection; helper at `artifacts/api-server/src/lib/email.ts`
- **Stripe** — Replit connection (sandbox); helper at `artifacts/api-server/src/lib/stripe.ts`
- **Database** — `DATABASE_URL` env var; Postgres provisioned

## Design
- Cream `#f9f5ef`, Rust `#c4622d`, Sage `#5c7a6a`, Ink `#1c1814`
- All colors in `artifacts/mobile/constants/colors.ts`
- Font: Inter (via `@expo-google-fonts/inter`)

## Key Commands
- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/db run push` — push DB schema (dev)
- `pnpm --filter @workspace/api-spec run codegen` — regen API hooks
