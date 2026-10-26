---
name: deploy-mobile
description: Publish the Heubert Tracker mobile app (mobile/) to the phones as an over-the-air EAS update on the preview channel. Run only when the user types /deploy-mobile.
disable-model-invocation: true
argument-hint: "[what changed, for the update message]"
---

# Deploy the mobile app

Typing `/deploy-mobile` is the user's go-ahead to publish. It sends an over-the-air update to
every installed phone. Only the **preview** channel has installs, so updates always go there.
Stop and report at the first failed step; never retry with checks skipped.

`$ARGUMENTS` is the update message. If it's empty, write one line from what changed in
`mobile/` since the last update (`git log` / `git diff`), in plain words.

## 1. Set up

```bash
cd "/home/sanish/heubert tracker/heubert-tracker/mobile"
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null    # eas-cli and expo need Node 20+
npx eas-cli whoami                               # signed in to Expo? If not, ask the user to run `npx eas-cli login`
```

## 2. Can this go out as an update?

An update can only change JavaScript and assets. A new native module, or a change to the native
config, needs a new build instead, and an update would crash the installed app.

```bash
npx eas-cli build:list --platform android --profile preview --status finished --limit 1 --json --non-interactive
```

Take that build's `gitCommitHash`, then:

```bash
git diff --name-only <gitCommitHash> -- package.json app.config.js eas.json
```

If any of them changed, the deciding check is the native fingerprint, which is the app's runtime
version (`app.config.js` uses the `fingerprint` policy). Compare it with that build's `runtimeVersion`:

```bash
npx expo-updates fingerprint:generate --platform android    # its "hash"
```

Same hash: the installed build already has that native code (a package that `expo` pulls in
anyway, such as `expo-font`, doesn't change it), so an update is safe. Different hash: stop. Tell
the user it needs `npx eas-cli build --profile preview --platform android` and a reinstall, not an
update. An update to a different runtime would never reach the installed phones.

## 3. Check it works

```bash
cd ..
npm test                                          # includes the web ↔ mobile parity tests
cd mobile
npx expo export --platform android --output-dir <scratchpad>/expo-deploy-check   # the bundle builds
```

Delete the export folder afterwards.

Then check that the web routes the app calls are live. Vercel deploys from Bitbucket, so compare with
`bitbucket/main` (`origin` is a GitHub mirror): `git fetch bitbucket && git diff --name-only
bitbucket/main -- ../src/app/api`. The app calls the host it was built with: find it in the export
(`grep -rhoa "https://[a-z0-9.-]*heubert\.com\|https://[a-z0-9.-]*vercel\.app" <export dir>`),
never by reading `.env`. A route the app uses should answer 401 there without a token, not 404. If a
changed route isn't live, ask the user before publishing: the web has to deploy first or those
screens fail on phones.

## 4. Update What's new

What's new (the web modal and the app's More → What's new) shows every feature with web and
mobile screenshots, and release notes, from `whats-new/` in the repo. Both apps read it from the
web's `/api/whats-new`, so it reaches phones when the web deploys, not with this update.

- Add a release to the top of `releases` in `whats-new/content.json` for what this update
  changes: `{ "date": "<today>", "platforms": ["mobile"] (or both), "title", "notes": [...] }`.
  Write notes for the team, in plain words, one per change they'd notice. Skip internal-only
  changes. If the same change shipped to the web already, add `"mobile"` to that release instead.
- A new screen gets a feature in `features` (`mobile: { "path": "/<route>" }`); a screen that
  looks different gets new screenshots. With `npm run dev` running at the repo root:
  `npm run whats-new:shots -- --platform=mobile --only=<feature ids>`. Look at each image
  before keeping it (blank, error or loading states mean the capture failed).
- These files ship with the web, so say in the report that the What's new change goes live
  with the next web deploy.

## 5. Send the environment

`eas update` reads environment values from Expo's store, not `mobile/.env`. Push the local file so
the update never ships stale values. Don't print or read the file's contents.

```bash
npx eas-cli env:push preview --path .env --force < /dev/null    # takes no --non-interactive flag
```

## 6. Publish

```bash
npx eas-cli update --branch preview --environment preview --message "<message>" --non-interactive
```

## 7. Report

Give the user:
- the message;
- the update group ID and the link `eas update` prints;
- when phones get it: they download it in the background, and the in-app banner (`UpdateBanner`)
  offers a restart;
- anything skipped or warned about.

To undo a bad update, `npx eas-cli update:rollback` or republish the previous commit. Ask the
user before doing either.
