# Eclatale Extension — Privacy & Data Access

This document is the source of truth for what the Eclatale Chrome extension
does and does not access. It exists to be linked from the Chrome Web Store
listing and to make compliance review straightforward.

## What the extension does NOT do

- **Does not scrape LinkedIn.** No content script reads post text, profile
  fields, connection lists, messages, or any other LinkedIn page data. The
  only thing `content.js` (the script that runs on linkedin.com) reads is
  `window.location.pathname`, to tell whether you're on the feed, a post, a
  profile, or a company page — a URL string, not page content.
- **Does not access LinkedIn cookies or your LinkedIn session.** The
  extension has no `cookies` permission and never talks to LinkedIn's API.
  All LinkedIn account connectivity (for publishing posts) happens through
  LinkedIn's own official OAuth flow inside the main Eclatale web app, not
  through the extension.
- **Does not automatically scrape any other website.** The "repurpose"
  features (right-click menu, and the floating button on text selection)
  only ever act on text you have explicitly selected yourself. Nothing is
  read from a page until you select text and click.
- **Does not track your browsing.** The extension does not log, store, or
  transmit your browsing history or the pages you visit, beyond the current
  tab's title/URL when you open the popup (used only to label the
  "repurpose this page" button) or invoke the context menu.

## What the extension DOES access

- **Your Eclatale account.** After you sign in via `eclatale.com/extension-auth`,
  the extension stores a Supabase access token and basic profile info
  (name, avatar URL) in `chrome.storage.local` — local to your browser
  profile, not synced, not readable by any web page.
- **The active tab's title and URL**, only when you open the popup or use
  the context menu — used to pre-fill the "repurpose this page" link.
- **Text you explicitly select**, only when you invoke "Repurpose with
  Eclatale" (right-click menu or the floating button) — capped at 2000
  characters, sent to `eclatale.com/create/resource` as a URL parameter.
- **Eclatale's own backend API** (`eclatale.com` and its backend host), to
  fetch your stats (streak, growth stage) and post ideas for display in the
  popup and sidebar.

## Permissions justification

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab's title/URL when you open the popup, for the repurpose feature. |
| `storage` | Store your Eclatale auth token locally so you stay signed in. |
| `contextMenus` | Add the "Repurpose with Eclatale" right-click item. |
| `notifications` | Show a brief confirmation when a repurpose action completes. |
| `host_permissions` (linkedin.com, eclatale.com, backend host) | Inject the Aria sidebar on LinkedIn; call the Eclatale API; open Eclatale pages. |

## Data retention

Signing out of the extension (or uninstalling it) clears the stored token
and user info immediately. No data is retained by the extension itself
after that point — your account data continues to live in Eclatale's own
systems, governed by the main [Eclatale Privacy Policy](https://eclatale.com/privacy).
