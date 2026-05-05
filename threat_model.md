# Threat Model

## Project Overview

TalkPrep is an AI-powered conversation-prep application with an Expo mobile client and an Express API server. Users authenticate with Clerk, store conversation sessions in PostgreSQL, use Stripe-backed subscriptions for paid features, and send sensitive free-form conversation content to OpenAI-backed server endpoints that stream responses over SSE. Production scope is the Express API, the mobile app’s production network behavior, and shared libraries used by those paths. `artifacts/mockup-sandbox` is dev-only and out of scope unless production reachability is demonstrated.

Assumptions for future scans:
- Production deployments run with `NODE_ENV=production`.
- TLS between clients and the deployed app is provided by the platform.
- Only vulnerabilities reachable in production should be proposed.

## Assets

- **User accounts and sessions** — Clerk-authenticated identities and bearer tokens used to access saved sessions, AI features, and billing functions.
- **Conversation content and coaching history** — scenario details, roleplay messages, annotations, scores, and debrief notes may contain sensitive personal or workplace information.
- **Billing state** — Stripe customer IDs, subscription IDs, product/price selection, and webhook-driven subscription updates affect entitlement and revenue.
- **Application secrets and third-party credentials** — Clerk secret key, Stripe secret key, SendGrid API key, OpenAI integration credentials, and database credentials.
- **Usage and entitlement data** — per-user monthly AI usage counts and Pro/free status enforce commercial limits.

## Trust Boundaries

- **Mobile client / API boundary** — all client input is untrusted and must be authenticated, authorized, and validated on the server.
- **API / Clerk boundary** — the API relies on Clerk middleware and proxy behavior to validate authenticated users.
- **API / PostgreSQL boundary** — the server has direct read/write access to user session data, usage counters, and local user billing linkage.
- **API / Stripe boundary** — the server creates checkout and billing-portal sessions and ingests unauthenticated Stripe webhooks.
- **API / OpenAI boundary** — sensitive user conversation content is forwarded to OpenAI and streamed back to the client.
- **Public / authenticated boundary** — health and some Stripe catalog endpoints are public; session, AI, and billing-management endpoints are authenticated.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, mounted `/api` routes in `artifacts/api-server/src/routes/*`.
- **Highest-risk code areas:** `artifacts/api-server/src/routes/stripe.ts`, `artifacts/api-server/src/lib/stripeClient.ts`, `artifacts/api-server/src/lib/webhookHandlers.ts`, `artifacts/api-server/src/routes/talkprep.ts`, `artifacts/api-server/src/routes/sessions.ts`, `artifacts/api-server/src/middlewares/*`.
- **Public surfaces:** `/healthz`, `/api/stripe/publishable-key`, `/api/stripe/products`, `/api/stripe/webhook`.
- **Authenticated surfaces:** all `/api/talkprep/*`, `/api/sessions*`, `/api/stripe/subscription`, `/api/stripe/checkout`, `/api/stripe/portal`.
- **Usually dev-only:** `artifacts/mockup-sandbox/**`, build scripts under `artifacts/mobile/scripts/**`, local workflow/log state.

## Threat Categories

### Spoofing

The API depends on Clerk-authenticated bearer tokens and `requireAuth` to bind requests to a user ID. Protected endpoints must continue to require a valid Clerk-authenticated request, and any proxy-derived host or identity context used for Clerk must not be attacker-controlled in production.

### Tampering

Clients can submit free-form session data, scores, billing parameters, and AI prompt content. The server must validate security-sensitive fields server-side, especially payment-related parameters and any values that influence redirects, entitlements, or cross-system state.

### Information Disclosure

The application stores and processes highly sensitive conversation content. Session queries and mutations must stay scoped to the authenticated user; logs, errors, and streaming responses must avoid leaking secrets, tokens, or other users’ data; and third-party credentials must never reach client code or untrusted outputs.

### Denial of Service

Authenticated AI endpoints can trigger expensive OpenAI streaming work. The service must maintain effective per-user usage enforcement, avoid accidental unlimited fallbacks on backend errors, and prevent request patterns that let attackers amplify compute or database cost beyond intended limits.

### Elevation of Privilege

The main privilege boundaries are between unauthenticated users, authenticated users, and paid subscribers. The server must enforce ownership on session records, restrict billing actions to the caller’s own Stripe customer, and prevent client-controlled parameters from granting unintended entitlements, redirects, or access to sensitive flows.