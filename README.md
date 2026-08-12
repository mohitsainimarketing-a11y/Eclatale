# Eclatale

AI-powered LinkedIn content creation platform. Helps professionals generate persona-aligned posts, track content performance, and grow their personal brand.

**Live:** [eclatale.com](https://eclatale.com)

---

## What It Is

Eclatale is a full-stack SaaS application with:
- A React 19 SPA (frontend)
- Vercel serverless functions in TypeScript (backend)
- Supabase for PostgreSQL, Auth, and Storage
- Claude (Anthropic) as the AI engine
- Stripe for billing
- LinkedIn API for direct post publishing

---

## Project Structure

```
Eclatale/
├── frontend/     # React 19 SPA (Create React App)
├── backend/      # Vercel serverless functions (TypeScript)
├── extension/    # Chrome extension (MV3, plain JS)
└── supabase/     # Migrations + auth email templates
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Supabase project
- An Anthropic API key

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in values (see env vars below)
npm start                     # http://localhost:3000
```

### Backend

```bash
cd backend
npm install
cp .env.example .env          # fill in values (see env vars below)
npm run dev                   # http://localhost:3001
```

Set `REACT_APP_API_URL=http://localhost:3001` in `frontend/.env.local` for local development.

---

## Environment Variables

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_SUPABASE_URL` | Yes | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public, safe for browser) |
| `REACT_APP_API_URL` | Yes | Backend base URL (`http://localhost:3001` for dev, production backend URL for prod) |
| `REACT_APP_GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID for "Sign in with Google" |
| `REACT_APP_VAPID_PUBLIC_KEY` | Yes | Web push VAPID public key |

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (bypasses RLS) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_LAUNCH50_PROMO_CODE_ID` | Optional | Stripe promo code ID for LAUNCH50 discount |
| `LINKEDIN_CLIENT_ID` | Yes | LinkedIn OAuth app client ID |
| `LINKEDIN_CLIENT_SECRET` | Yes | LinkedIn OAuth app client secret |
| `LINKEDIN_REDIRECT_URI` | Yes | LinkedIn OAuth redirect URI |
| `TOGETHER_API_KEY` | Yes | Together AI API key (for image generation) |
| `GMAIL_USER` | Yes | noreply@ Gmail address for transactional email |
| `GMAIL_APP_PASSWORD` | Yes | noreply@ Gmail app password |
| `GMAIL_HELLO_USER` | Yes | hello@ Gmail address for marketing email |
| `GMAIL_HELLO_APP_PASSWORD` | Yes | hello@ Gmail app password |
| `VAPID_PUBLIC_KEY` | Yes | Web push VAPID public key |
| `VAPID_PRIVATE_KEY` | Yes | Web push VAPID private key |
| `VAPID_SUBJECT` | Yes | VAPID subject (e.g. `mailto:support@eclatale.com`) |
| `CRON_SECRET` | Yes | Secret for Vercel cron job authentication |
| `ADMIN_SECRET` | Yes | Secret for admin-only API actions |
| `FRONTEND_URL` | Yes | Frontend base URL (e.g. `https://eclatale.com`) |
| `PORT` | Optional | Local dev server port (default: 3001) |

---

## Deployment

### Frontend (Vercel)

The frontend is a Vercel project connected to GitHub. Pushes to `main` auto-deploy.

Manual deploy:
```bash
cd frontend
vercel --prod
```

### Backend (Vercel)

The backend is a separate Vercel project. It does NOT auto-deploy from GitHub — manual deploy required.

```bash
cd backend
vercel --prod
```

The backend URL is `https://backend-xi-olive-8eewk5s8qv.vercel.app`. This is hardcoded in `extension/manifest.json` — update there if the backend project changes.

### Supabase Migrations

Run migrations via Supabase CLI or the Supabase dashboard SQL editor. Migration files are in `supabase/migrations/`.

```bash
# Apply all pending migrations
supabase db push
```

---

## Cron Jobs

All cron jobs are defined in `backend/vercel.json`:

| Schedule | Endpoint | Description |
|----------|----------|-------------|
| Mondays 7am UTC | `/api/weekly-industry-briefing-cron` | Weekly Industry Briefing email |
| Mondays 1pm UTC | `/api/weekly-digest-cron` | Weekly email digest |
| Daily 9am UTC | `/api/reengagement-cron` | Re-engagement emails for inactive users |
| Daily 12pm UTC | `/api/schedule/publish-due` | Publish all due scheduled posts |

---

## Subscription Tiers

| Tier | Posts/week | Features |
|------|-----------|---------|
| Free | 3 | Post generation, basic analytics |
| Individual | Unlimited | All features including competitor intelligence, advanced analytics |

Free trial: 7 days on Individual tier. LAUNCH50 promo code gives 50% off.

---

## Chrome Extension

Located in `extension/`. Built as Manifest V3. Must be manually built and submitted to the Chrome Web Store. It connects to both `eclatale.com` (for auth) and the backend Vercel URL (for API calls).

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, data flow, all endpoints
- [DATABASE.md](DATABASE.md) — All tables, columns, relationships, RLS
- [CODEBASE_AUDIT.md](CODEBASE_AUDIT.md) — Complete audit (features, issues, dependencies, recommendations)
