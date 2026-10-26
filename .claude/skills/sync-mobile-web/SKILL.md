---
name: sync-mobile-web
description: Use whenever a feature, fix or visible change is made to the Heubert Tracker web app (src/) or mobile app (mobile/), and before calling that work done - carries the change to the other app, keeps docs/mobile-web-parity.md current, and ships both in the right order. Also use when asked to sync, port or compare the two apps.
---

# Sync mobile and web

The web app (`src/`, Next.js) and the mobile app (`mobile/`, Expo Router) are one product.
A change in one is not done until the other has it too, or `docs/mobile-web-parity.md` says
why it doesn't. Both apps talk to the same Supabase projects, so the database is shared;
the screens, logic and styles are not, and are kept equal by hand and by tests.

## How the two apps line up

| Concern | Web | Mobile |
|---|---|---|
| Screens | `src/components/*Page.js`, tabs in `src/lib/navigation.js` | `mobile/app/(tabs)/*.js` (tab bar), `mobile/app/*.js` (stack, linked from `app/(tabs)/more.js`) |
| Shared app data | `src/context/AppContext.js` | `mobile/context/AppContext.js` (a port: same tables and queries, AsyncStorage for localStorage) |
| Module data (loaded when its tab opens) | hooks like `src/lib/useTasks.js` | the same hook rewritten in `mobile/lib/use*.js` |
| Pure logic | `src/lib/*.js` (no `@/` imports) | mirrored into `mobile/lib/*.js` (the app cannot import from `src/`) |
| Keeping logic equal | - | `src/lib/mobile<Name>.test.mjs` runs both copies on the same inputs |
| Colours, fonts, radii | `src/app/globals.css` (`@tokens dark` / `@tokens light`) | `mobile/lib/tokens.js` (checked by `src/lib/mobileTokens.test.mjs`) |
| UI pieces | CSS classes in `globals.css` | `mobile/components/ui.js` (Screen, Card, Button, Chip, Select, Pill, FormModal…) |
| Server-only work (service keys, email, Google APIs) | `src/app/api/*/route.js` | calls the deployed route at `EXPO_PUBLIC_API_BASE_URL` |
| Designs | `<Name>.dc.html` artboards on the design canvas | `Mobile<Name>.dc.html` artboards on the same canvas |

## Steps for every change

1. **Read the parity list.** Open `docs/mobile-web-parity.md` and find the feature's row. If the
   change closes or touches an open gap, say so.

2. **Sort the change into one of these**:
   - **Database only** (migration, RLS, trigger, RPC): both apps get it once it's pushed. Check
     that each app's queries still work with it (a renamed column breaks both).
   - **Behaviour or screen**: build it in both apps (steps 3–6).
   - **Web only or mobile only on purpose** (server email, cron jobs, Expo OTA banner): build it in
     one app and record the reason in the parity list. A feature people use day to day is never
     "web only" just because the mobile part is more work: record it as a **gap** instead.

3. **Put the logic where both apps can use it.** Rules, sums and formatting go in a pure module in
   `src/lib/` with a `*.test.mjs` beside it. When mobile needs it, copy it into `mobile/lib/` with a
   header saying what it mirrors (see `mobile/lib/nepaliDate.js`), and add or extend
   `src/lib/mobile<Name>.test.mjs` so both copies run on the same cases. When either copy
   changes, the test fails until the other matches. Never let one copy quietly differ.

4. **Data.** Use the same tables, columns and RLS from both apps; never add a mobile-only
   shortcut around a policy. A module's data loads in its own hook when the screen opens (as
   `useTasks` does), not in AppContext's startup load. Anything that needs a secret goes through a
   web API route; mobile calls it with the signed-in user's token, never with a key bundled in the
   app.

5. **Screen.** Build it from `mobile/components/ui.js` and the theme tokens (`useThemeColors()` from `lib/theme.js` and
   `lib/tokens.js`), never hard-coded colours. Lay it out for a phone (one column, sheets for
   forms, 44 px touch targets), not as a shrunken copy of the web page. React Native 0.86 has
   `StyleSheet.absoluteFill` only (`src/lib/mobileStyleSheet.test.mjs` fails on
   `absoluteFillObject`). A new screen gets a route in `mobile/app/` and a row in
   `app/(tabs)/more.js` or a tab in `app/(tabs)/_layout.js`; a new web tab gets an entry in
   `src/lib/navigation.js`.

6. **Design canvas.** When the change shows on screen, update both artboards: the web one and its
   `Mobile…` twin (or add a `Mobile…` artboard next to the mobile row), so the canvas stays the
   reference for both apps.

7. **Check both apps.**
   - `npm test` (Node 22: `source ~/.nvm/nvm.sh && nvm use 22`), which runs every parity test.
   - Web: `npx eslint <changed files>` and `npx next build`.
   - Mobile: bundle it to catch import and syntax errors:
     `cd mobile && npx expo export --platform android --output-dir <scratchpad>/expo-check`.
   - Anything touching Supabase or a screen is checked in the running apps (web at
     localhost:3000; mobile in the dev build with `npx expo start --dev-client`). Say plainly
     which of these you could not run.

8. **Update `docs/mobile-web-parity.md`**: the feature's row (files on both sides, status), and the
   Open gaps list (remove what's closed, add what's left, largest first).

9. **Update What's new** (`whats-new/`, shown by the web's What's new modal and the app's More →
   What's new, both through `/api/whats-new`), when the change is something the team would notice:
   - Add a release to the top of `releases` in `whats-new/content.json`: today's date, the
     platforms it reached (`"web"`, `"mobile"`), a short title, and one plain-words note per change.
     Same day and same work: extend that release instead of adding another.
   - A new feature or screen gets an entry in `features` (`web: { "tab": "<navigation.js id>" }` or
     `{ "path": "/meeting" }`, `mobile: { "path": "/<route>" }`, `null` on a side that lacks it).
   - Recapture the screens that changed, with `npm run dev` running:
     `npm run whats-new:shots -- --only=<feature ids>` (`--platform=web|mobile` for one side).
     Open each image before keeping it; a blank, error or still-loading screen means retake it
     (slow screens take `"wait": <ms>` in content.json).
   - It goes live with the web deploy (step 10.2), for both apps.

10. **Ship in this order**, and ask the user before each one (publishing is theirs to approve):
   1. Database: the migration goes through `npm run db:check` then `db:push`, or the manual
      Bitbucket step. Never push production yourself.
   2. Web: merge to `main` (Vercel deploys), so any API route the mobile app calls is live.
   3. Mobile: if `mobile/.env` changed, `eas env:push preview --path .env --force` first; then
      `eas update --branch preview --environment preview --message "<what changed>"` (only the
      `preview` channel has installs). A new native dependency or `app.config.js` change needs a
      new build (`eas build --profile preview`), not an update.

## When a change can't reach the other app yet

Finish the side that was asked for, add the missing side to Open gaps with what's needed
(tables, logic module, API route), and tell the user in one line which gap now exists. Don't
leave a half-built screen in the other app.
