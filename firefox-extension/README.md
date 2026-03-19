# Spotifuck – Firefox Ad-Free Spotify Web Player

A Firefox browser extension that delivers a fully ad-free experience on
`open.spotify.com`.  No UI, no options page, no telemetry — it silently does
its job in the background.

> **Note for repo maintainers:** This `firefox-extension/` directory is
> completely invisible to apktool.  It will never be swept into an Android APK
> build.  The Android build system only processes `smali/`, `res/`, `assets/`,
> `AndroidManifest.xml`, and `apktool.yml`.

---

## What it does

| Feature | Details |
|---|---|
| **Ad network blocking** | Cancels all requests to DoubleClick, Google Syndication, AppNexus, Google Ad Services before they reach the network |
| **Spotify ad endpoint blocking** | Cancels calls to `spclient.wg.spotify.com/ads/*` and `*.spotify.com/ads/*` |
| **Silent audio substitution** | Redirects ad audio streams (`type: media` on ad paths) to a bundled 1-second silent MP3 so the player advances cleanly |
| **Fingerprint spoofing** | Reports `Win32` platform, `Google Inc.` vendor, and `1920×1080` screen/window dimensions to the Spotify page context |
| **Fake feature version** | Injects `window.featVer` as `web-player_YYYY-MM-DD_<timestamp>_<8-hex-chars>` |
| **Classic login button** | Adds an "Email + Password Classic Login" button (blue, rounded) above the social login buttons on `/login` |
| **Auto-enter player** | Automatically clicks `button[data-testid="web-player-link"]` when it appears after sign-in |
| **Stuck-playback unlock** | If the play button stays in "Play" (paused) state for 10 seconds after a play attempt, skips forward to unblock ad-frozen playback |
| **Facebook GDPR bypass** | Auto-clicks the accept button on `facebook.com/privacy/consent/*` consent dialogs that Spotify surfaces |
| **Debug mode** | `DEBUG = true` in `background.js` logs every Spotify request to the browser console with outcome: BLOCKED / SILENCED / PASS |

---

## File structure

```
firefox-extension/
├── manifest.json       MV2 Firefox manifest
├── background.js       webRequest ad-blocker + debug logger
├── content.js          All page-context injection (Spotify + Facebook)
├── assets/
│   └── silent.mp3      Bundled 1-second silent MP3 (ID3v2.4, 32 kbps, mono)
└── README.md           This file
```

---

## Installation — Firefox Developer Edition

### Prerequisites

- [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/) (or
  Firefox Nightly).  The extension is unsigned, so standard Firefox Release will
  refuse to run it permanently.

### Step 1 — Disable signature enforcement

1. Open a new tab and navigate to `about:config`.
2. Accept the risk warning.
3. Search for `xpinstall.signatures.required`.
4. Double-click the preference to set its value to **`false`**.

> This allows Firefox to load unsigned extensions.  It only affects Developer
> Edition / Nightly; the preference has no effect in Firefox Release.

### Step 2 — Load the extension temporarily

1. Open a new tab and navigate to `about:debugging`.
2. Click **"This Firefox"** in the left sidebar.
3. Click **"Load Temporary Add-on…"**.
4. Navigate to the `firefox-extension/` directory of this repository and select
   **`manifest.json`**.
5. The extension appears in the list as *Spotifuck – Spotify Ad-Free Web Player*.

### Step 3 — Verify it is active

Open `https://open.spotify.com` — the extension is now active.  With
`DEBUG = true` in `background.js`, open the Browser Console
(**Tools → Browser Tools → Browser Console** or `Ctrl+Shift+J`) and look for
`[Spotifuck]` log lines showing BLOCKED / SILENCED / PASS per-request outcomes.

### Persistence

Temporarily loaded extensions are removed when Firefox is closed.  To reload:
- Return to `about:debugging → This Firefox → Load Temporary Add-on…` and
  select `manifest.json` again.

For a permanent install without Developer Edition you can package the extension
as a signed `.xpi` using the
[`web-ext` tool](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/):

```sh
cd firefox-extension
npx web-ext build          # creates web-ext-artifacts/spotifuck-1.0.0.zip
npx web-ext sign           # requires AMO API credentials (optional)
```

---

## Turning off debug logging

Open `background.js` and change line 8:

```js
// Before
const DEBUG = true;

// After
const DEBUG = false;
```

Then reload the extension in `about:debugging`.

---

## Permissions explained

| Permission | Reason |
|---|---|
| `webRequest` + `webRequestBlocking` | Intercept and cancel/redirect network requests before they complete |
| `storage` | Reserved for future settings persistence |
| `*://*.spotify.com/*` | Intercept Spotify requests and run content scripts |
| `*://*.facebook.com/*` | Block Facebook trackers loaded by Spotify; run GDPR consent auto-accept |
| `*://*.doubleclick.net/*` etc. | Required by Firefox for `webRequest` to intercept those domains |
