# Eclatale: Claude Code Project Brief

## What this is
Eclatale (eclatale.com) is the AI personal brand growth OS for LinkedIn. Solo founder: Mohit Saini, Toronto.

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

## Key rules, never break these
- Only PUBLISHED LinkedIn posts count toward any metric. Never drafts
- Never scrape LinkedIn. Official API only
- Claude Haiku for cheap tasks, Sonnet for quality tasks. Never switch to DeepSeek
- Three-dimension brand score: Consistency + Quality + Authority

## RULE ZERO: zero em dashes, everywhere
Every piece of content Eclatale produces or displays must read as human-written and must
survive an AI-detector. The em dash is the single biggest AI tell, and it is the first thing
a reader notices.

- NEVER use an em dash (—) or en dash (–) in ANY content. Zero. No exceptions.
- This applies to: website copy, landing page, blog posts, UI strings, button labels, toasts,
  error messages, email templates, resource guides and PDFs, meta descriptions, AI prompt
  strings sent to Claude, and every word of AI-generated output.
- Replace with a period (best), a colon, a comma, or parentheses. Never a bare hyphen.
- Also banned in prose: arrows (→), bullet characters (•), "::", and semicolons.
- PROSE vs UI CHROME: the arrow and bullet bans apply to prose only, meaning text a reader
  evaluates as writing. They do NOT apply to interface iconography, which stays:
  CTA affordances ("View all →"), breadcrumb separators ("Settings → Billing"), and the
  `'• '` string that the Bullets toolbar in Phase2Editor.tsx inserts (removing that one
  breaks the feature). Em and en dashes have NO such exemption. Those are always zero.
- The ONLY allowed appearance is inside `UNIVERSAL_HUMAN_WRITING_RULES` itself, where the
  character must be shown to define what is banned.
- AI prompt strings matter most: if a prompt contains em dashes, Claude mirrors them into
  every post a user generates. Keep all prompts in `backend/lib/` dash-free.

Full ruleset lives in `UNIVERSAL_HUMAN_WRITING_RULES` in `backend/lib/writingStyles.ts`.
It governs every piece of content, not just LinkedIn posts. Read it before writing any copy.

Check before every commit that touches content:
`node scripts/check-content-rules.js`
It exits 1 on any em or en dash and warns on banned vocabulary. A few vocabulary hits are
legitimate (a glossary headword, a code identifier, an image orientation) and the script
allowlists the known ones, so read each warning rather than blindly rewriting it.

## Confirmed deployed and working
- Smart Canvas 3-phase /create redesign
- Phase 0 starting point picker (4 modes)
- Free tools page /tools (9 tools)
- Industry Pattern Intelligence
- Hook Library with 20 proven formulas (F01 to F20) + 2026 algorithm lift labels
- Weekly Industry Briefing
- Analytical dashboard with 3-dimension brand score (Consistency/Quality/Voice)
- Google OAuth (Google Identity Services)
- Notification system
- LinkedIn Insights dashboard (Chrome extension scraper + sync backend)
- 5-pass humanizer (Humanize button in Phase2Editor). Pass 1 is punctuation, the em dash strip
- UNIVERSAL_HUMAN_WRITING_RULES: 2026 algorithm data + 30+ banned words + structural anti-patterns

## Still needs fixing
- None known

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
