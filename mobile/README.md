# Heubert Tracker — Mobile

React Native (Expo) app with the same feature set as the web app (`../src`), talking to the
**same** Supabase projects and, for Planning Poker / Retrospective / Memories, the **same**
Next.js API routes on the deployed web app.

## Setup

1. Install deps (Node 22+ required):
   ```sh
   npm install
   ```
2. Create `mobile/.env` (this file is git-ignored) with:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://krejvasgafbqtbiswyji.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<same value as NEXT_PUBLIC_SUPABASE_ANON_KEY in ../.env.local>

   EXPO_PUBLIC_STANDUP_SUPABASE_URL=https://mtryofugsnbwlobgwjyt.supabase.co
   EXPO_PUBLIC_STANDUP_SUPABASE_ANON_KEY=<same value as NEXT_PUBLIC_STANDUP_SUPABASE_ANON_KEY in ../.env.local>

   EXPO_PUBLIC_API_BASE_URL=https://heubert-tracker.vercel.app

   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<same value as NEXT_PUBLIC_GOOGLE_CLIENT_ID in ../.env.local>
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
   ```
3. Sign-in uses `@react-native-google-signin/google-signin` (Google's native SDK), **not** a
   generic OAuth redirect — Google's servers reject a raw `code`+`redirect_uri` flow for
   Android/iOS-type client IDs with `Error 400: invalid_request`, since those client types are
   meant to be driven by Google's own native SDK, which handles the redirect internally. In the
   same Google Cloud project as the web app's OAuth client:
   - Create an **iOS** OAuth client ID, bundle ID `com.heubert.tracker` →
     `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
   - Create an **Android** OAuth client ID, package name `com.heubert.tracker`, with the app's
     SHA-1 signing fingerprint (`npx eas-cli credentials` → Android → generates/shows it if you
     don't have one yet) → `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is **not** a new client — reuse the existing *Web*
     client ID (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the web app's `.env.local`). This is required:
     the ID token `GoogleSignin.signIn()` returns is always issued for the Web client's
     audience, and that's what Supabase's Google provider is already configured to trust.
4. This uses a native module, so **Expo Go cannot run it at all** (not even the rest of the app
   without sign-in) — you need a development build:
   ```sh
   npx eas-cli build --profile development --platform android
   # or: npx expo run:android / npx expo run:ios if you have the native SDKs installed locally
   ```
   Install the resulting build on your device, then run `npx expo start --dev-client` and
   connect to it from the dev-client's home screen.

## Architecture notes

- `context/AppContext.js` is a near-verbatim port of the web app's data layer — same Supabase
  tables/queries, `AsyncStorage` instead of `localStorage`.
- Planning Poker (`app/planning-poker.js`), Retrospective (`app/retrospective.js`), and Memories
  delete/edit (`context/AppContext.js`'s `deleteMemory`/`updateMemory`) call the **deployed
  Next.js app's API routes** directly (`/api/poker`, `/api/retro`, `/api/memories`) rather than
  duplicating that backend logic — set `EXPO_PUBLIC_API_BASE_URL` to wherever that's hosted.
- Dates are entered as plain `YYYY-MM-DD` text fields for now rather than a native date picker
  (no date-picker library is installed yet) — functional but not the nicest input UX; a good
  follow-up is `@react-native-community/datetimepicker`.

## Known gaps vs. the web app (fast-follow candidates)

- **Deep linking**: the Poker/Retro share links/QR codes still point at the web URL
  (`https://<domain>/planning-poker/<id>`) and open in the phone's browser rather than this app.
  Making them open the native app needs Universal Links (iOS) / App Links (Android) — hosting
  `apple-app-site-association` / `assetlinks.json` on the web domain, plus `associatedDomains` /
  `intentFilters` config here.
- **Retrospective**: card drag-and-drop between columns, the shared countdown timer, live
  "X is typing…" indicators, and @mention autocomplete are not implemented — create/join, add
  card, edit/delete your own card, vote, and end session all work.
- **Planning Poker**: QR code image isn't rendered (no QR library installed yet); the session
  ID/link is shown as plain text to copy/share instead.
- **Capacity tab** and the local→cloud migration / seed-data utilities from the web app were
  intentionally left out — they're either unused (Capacity's nav entry is commented out on web
  too) or one-time bootstrap tools that don't apply to a second client on an already-seeded DB.
- App icon/splash are still the default Expo placeholders — drop a real Heubert Tracker icon
  into `assets/` when one exists.

## Building for real devices / stores

`eas.json` has `development`/`preview`/`production` build profiles pre-configured. Actually
producing installable builds and publishing to the App Store / Play Store needs your own Apple
Developer and Google Play Console accounts (`eas build`, then `eas submit`) — that part can't be
done from here.
