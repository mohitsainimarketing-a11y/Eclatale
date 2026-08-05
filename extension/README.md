# Eclatale Chrome Extension

Manifest V3, no build step — load it straight from this folder.

## Load it for testing

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**, select this `extension/` folder
4. Pin the Eclatale icon from the extensions toolbar menu

## Sign in

1. Click the extension icon → **Sign in →**
2. This opens `eclatale.com/extension-auth?extId=<your local extension ID>`
   in a new tab
3. If you're already logged into Eclatale in that browser, it connects
   automatically. If not, log in — the page redirects back and completes
   the connection.
4. Reopen the popup — you should see your name, stats, and the three
   action buttons.

Note: every time you reload the unpacked extension, Chrome assigns it a
new random ID (until it's published, or you pin an ID via a `key` in
manifest.json). You'll need to re-run the sign-in step after each reload
for that reason — this is normal for local dev, not a bug.

## What to test

- **Popup**: sign-in flow, stats loading, repurpose-this-page link, and
  (when on your own `linkedin.com/in/...` page) the profile-copy helper
  buttons.
- **LinkedIn sidebar**: visit linkedin.com, look for the gradient "A"
  button on the right edge of the screen. Click it — the sidebar should
  slide in and show different content depending on whether you're on the
  feed, a post, a profile, or a company page.
- **Context menu**: select text on any non-Eclatale webpage, right-click,
  look for "Repurpose with Eclatale". Clicking it opens
  `eclatale.com/create/resource` with the text pre-filled.
- **Floating repurpose button**: select more than ~20 characters of text
  on any page (not eclatale.com) — a small gradient button should appear
  near the selection as an alternative to the context menu.

## Not done yet

- Chrome Web Store submission (screenshots, promo tile, and the
  submission itself) — see `STORE_LISTING.md`. Explicitly out of scope
  for this pass per the build instructions.
- The extension currently sends an `Authorization: Bearer <token>` header
  on API calls, but the Eclatale backend does not yet verify that token
  server-side — it trusts the `userId` in the request body, the same way
  the main web app's frontend does today. This is a pre-existing
  characteristic of the whole backend, not something introduced by the
  extension, but worth knowing before treating the extension's auth as a
  real security boundary.
