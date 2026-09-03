# Eclatale — Claude Code Project Brief

## What this is
Eclatale (eclatale.com) — AI personal brand growth OS for LinkedIn. Solo founder: Mohit Saini, Toronto.

## Tech stack
- Frontend: React 18 + TypeScript + Tailwind → Vercel (prj_3gqQhO8IVXMnZlzPmqes75oj7GST)
- Backend: Node.js + Express → Vercel (prj_NPlQqhZiHPhBmLu64bZaS81YK8Wr)
- Database: Supabase (suacpplgbqhupktlmhrt.supabase.co)
- AI: Claude API (Sonnet for quality, Haiku for cheap tasks)
- Payments: Stripe
- Email: SendGrid
- Scraping: Firecrawl
- Storage: AWS S3
- Live URL: eclatale.com

## Key rules — never break these
- Only PUBLISHED LinkedIn posts count toward any metric — never drafts
- Never scrape LinkedIn — official API only
- Claude Haiku for cheap tasks, Sonnet for quality tasks — never switch to DeepSeek
- Three-dimension brand score: Consistency + Quality + Authority

## Confirmed deployed and working
- Smart Canvas 3-phase /create redesign
- Phase 0 starting point picker (4 modes)
- Free tools page /tools (9 tools)
- Industry Pattern Intelligence
- Hook Library
- Weekly Industry Briefing
- Analytical dashboard
- Google OAuth (Google Identity Services)
- Notification system

## Still needs fixing
1. url.parse() in backend/api/intelligence.js → replace with new URL()
2. Stripe webhook signature verification → raw body parser fix
3. Three-dimension brand score full UI implementation
4. Post-publish Phase 3 loop

## Pending manual steps (Mohit only)
- Supabase Site URL → https://eclatale.com
- Google Console → add Supabase callback URI
- LinkedIn Member Post Analytics API → apply at LinkedIn developer portal
- Stripe → switch to live keys
- Chrome Web Store → submit extension

## How to deploy
Frontend: cd frontend && npx vercel --prod
Backend: cd backend && npx vercel --prod
Push: git add . && git commit -m "message" && git push origin main

## Before every task
1. Read this file
2. Read ARCHITECTURE.md if it exists
3. Read relevant source files before editing
4. TypeScript check before deploying: npx tsc --noEmit
