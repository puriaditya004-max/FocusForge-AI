# Android Signed Release Build — Setup Guide

## Why this exists

Building an installable Android app from this Capacitor project
(`assembleDebug`) already worked before this change — that's what
Item 7 in the blueprint meant by the app being "PARTIAL." What was
missing is the piece Play Store actually requires: a **signed
release build**, using a key that stays the same for every future
update you ever publish. This doc covers generating that key
(you do this once, yourself — see the security note below) and
producing the signed `.aab` file Play Console wants.

## Step 0 — Requirements

- Android Studio installed (gives you a JDK with `keytool` bundled),
  or a standalone JDK with `keytool` on your PATH
- This repo cloned locally, `frontend/` dependencies installed
  (`npm install`)

## Step 1 — Generate your release keystore (do this once, yourself)

This is the one step that has to happen on your own machine — not
something to generate in a shared chat/tool, since the file this
produces has to stay secret and permanent for the app's whole
lifetime on Play Store.

```bash
cd frontend/android
keytool -genkeypair -v \
  -keystore focusforge-release.jks \
  -alias focusforge \
  -keyalg RSA -keysize 2048 -validity 10000
```

It'll ask for a keystore password, then some identity questions
(name, org, city, country — these go into the certificate, not
anywhere user-facing, so answers don't need to be exact), then a key
password (you can press Enter to reuse the keystore password).

**Back this file up somewhere durable and private right now** — a
password manager's file storage, an encrypted drive, wherever you'd
keep something you can never regenerate. If you lose
`focusforge-release.jks`, there is no recovery path: you would not
be able to publish any update to this app ever again under the same
Play Store listing, only a brand-new listing that all existing
users would have to reinstall from scratch.

## Step 2 — Point the build at it

```bash
cd frontend/android
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties`:
```properties
storeFile=../focusforge-release.jks
storePassword=<the password you set in Step 1>
keyAlias=focusforge
keyPassword=<the key password you set in Step 1>
```

This file is gitignored — it stays on your machine only, never gets
pushed. If you set up CI later (GitHub Actions building releases
automatically), those values become encrypted CI secrets instead of
a local file, but the underlying keystore itself is the same one —
never regenerate it for CI, just feed it the same file/passwords
some other way.

## Step 3 — Build the release

```bash
cd frontend
npm run build          # regular Vite build -> dist/
npx cap sync android    # copies dist/ into the Android project
cd android
./gradlew bundleRelease
```

Output lands at:
```
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

That `.aab` (Android App Bundle) is what you upload to Play Console
— Play Store wants `.aab`, not `.apk`, for new apps.

If you ever need a standalone signed `.apk` instead (e.g. to
sideload for testing, not for Play Store), `./gradlew assembleRelease`
produces one at `app/build/outputs/apk/release/app-release.apk`,
signed the same way.

## Step 4 — Every future release

1. Bump `versionCode` (integer, must increase every single release —
   Play Store rejects an upload with a versionCode it's already seen)
   and `versionName` (the human-readable version, e.g. "1.1") in
   `frontend/android/app/build.gradle`
2. Repeat Step 3
3. Upload the new `.aab` to Play Console

`keystore.properties` and the `.jks` file never change between
releases — same key, forever, by design.

## What changed in this repo to make this possible

- `AndroidManifest.xml` — added the `CAMERA` permission. Focus Mode
  (the MediaPipe-based feature) uses `getUserMedia` in the WebView,
  which silently fails on Android without this declared, even though
  it wasn't needed before Focus Mode existed.
- `app/build.gradle` — added a `signingConfigs.release` block that
  reads from `keystore.properties` if present. If that file is
  missing (fresh clone, no keystore set up yet), release builds fail
  with a clear Gradle error instead of silently producing an
  unsigned artifact Play Store would reject anyway.
- `.gitignore` — keystore file patterns were present but commented
  out before; uncommented, plus `keystore.properties` itself added.
