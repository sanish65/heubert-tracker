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

If `package.json` gained or changed a native dependency (`expo-*`, `react-native-*`, `@react-native-*`)
or `app.config.js` / `eas.json` changed, stop. Tell the user it needs
`npx eas-cli build --profile preview --platform android` and a reinstall, not an update.

## 3. Check it works

```bash
cd ..
npm test                                          # includes the web ↔ mobile parity tests
cd mobile
npx expo export --platform android --output-dir <scratchpad>/expo-deploy-check   # the bundle builds
```

Delete the export folder afterwards. If the mobile app calls a web API route that changed and isn't
on `main` yet (`git diff --name-only origin/main -- ../src/app/api`), warn the user: the web has to
deploy first or those screens fail on phones.

## 4. Send the environment

`eas update` reads environment values from Expo's store, not `mobile/.env`. Push the local file so
the update never ships stale values. Don't print or read the file's contents.

```bash
npx eas-cli env:push preview --path .env --force
```

## 5. Publish

```bash
npx eas-cli update --branch preview --environment preview --message "<message>" --non-interactive
```

## 6. Report

Give the user:
- the message;
- the update group ID and the link `eas update` prints;
- when phones get it: they download it in the background, and the in-app banner (`UpdateBanner`)
  offers a restart;
- anything skipped or warned about.

To undo a bad update, `npx eas-cli update:rollback` or republish the previous commit. Ask the
user before doing either.
