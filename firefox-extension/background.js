'use strict';

// ─── Debug toggle ─────────────────────────────────────────────────────────────
// true  → log every *.spotify.com request to the browser console (BLOCKED /
//          SILENCED / PASS).  false → completely silent operation.
const DEBUG = true;

// ─── Silent audio URL ─────────────────────────────────────────────────────────
const SILENT_MP3 = browser.runtime.getURL('assets/silent.mp3');

// ─── URL patterns ─────────────────────────────────────────────────────────────

// Layer 1 — Third-party ad networks: always cancel outright.
// Host permissions for these domains are declared in manifest.json so Firefox
// actually invokes the listener for them.
const CANCEL_PATTERNS = [
  '*://*.doubleclick.net/*',
  '*://*.googlesyndication.com/*',
  '*://*.adnxs.com/*',
  '*://*.googleadservices.com/*',
];

// Layer 2 — Spotify-owned ad endpoints.
// Media requests (type === 'media') are redirected to the bundled silent MP3
// so the player sees a valid audio response and advances normally.
// Non-media requests (ad API calls, tracking pixels, etc.) are cancelled.
const SPOTIFY_AD_PATTERNS = [
  '*://spclient.wg.spotify.com/ads/*',
  '*://*.spotify.com/ads/*',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dbg(outcome, url) {
  if (DEBUG) {
    console.log('[Spotifuck]', outcome, url);
  }
}

// ─── Listener 1: cancel third-party ad networks ───────────────────────────────
browser.webRequest.onBeforeRequest.addListener(
  function (details) {
    dbg('BLOCKED', details.url);
    return { cancel: true };
  },
  { urls: CANCEL_PATTERNS },
  ['blocking']
);

// ─── Listener 2: Spotify ad endpoints — cancel or redirect to silence ─────────
browser.webRequest.onBeforeRequest.addListener(
  function (details) {
    // Audio ad: substitute with the bundled silent MP3 so the player
    // receives a valid response and can move on to the next track.
    if (details.type === 'media') {
      dbg('SILENCED', details.url);
      return { redirectUrl: SILENT_MP3 };
    }
    // Ad API / tracking call: drop entirely.
    dbg('BLOCKED', details.url);
    return { cancel: true };
  },
  { urls: SPOTIFY_AD_PATTERNS },
  ['blocking']
);

// ─── Listener 3 (DEBUG only): log all Spotify requests that pass through ──────
// onCompleted only fires for requests that actually completed (i.e. were not
// cancelled or permanently redirected), so this accurately represents PASS.
if (DEBUG) {
  browser.webRequest.onCompleted.addListener(
    function (details) {
      // Filter out the extension's own silent.mp3 redirect responses.
      if (!details.url.startsWith(browser.runtime.getURL(''))) {
        dbg('PASS', details.url);
      }
    },
    { urls: ['*://*.spotify.com/*'] }
  );
}
