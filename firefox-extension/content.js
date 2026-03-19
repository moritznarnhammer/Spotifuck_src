'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — Fingerprint spoof + fake feature version
//
// Firefox MV2 content scripts running at document_start share the real
// window/navigator/screen objects with the page.  Object.defineProperty called
// here takes effect before any page script runs — no <script> tag injection
// needed (and a <script> tag would be blocked by Spotify's strict CSP anyway).
// ═══════════════════════════════════════════════════════════════════════════════
(function spoofFingerprint() {
  function def(obj, prop, val) {
    try {
      Object.defineProperty(obj, prop, {
        get: function () { return val; },
        configurable: true
      });
    } catch (e) {}
  }

  // Navigator
  def(navigator, 'platform', 'Win32');
  def(navigator, 'vendor',   'Google Inc.');

  // Screen dimensions
  def(screen, 'width',       1920);
  def(screen, 'height',      1080);
  def(screen, 'availWidth',  1920);
  def(screen, 'availHeight', 1040);

  // Window size
  def(window, 'outerWidth',  1920);
  def(window, 'outerHeight', 978);
  def(window, 'innerWidth',  1920);
  def(window, 'innerHeight', 978);

  // Fake feature version
  var d   = new Date();
  var ds  = d.toISOString().slice(0, 10);
  var ts  = d.getTime();
  var rnd = Math.random().toString(16).slice(2, 10);
  window.featVer = 'web-player_' + ds + '_' + ts + '_' + rnd;
}());

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B — Facebook GDPR consent auto-accept
//
// When Spotify redirects through the Facebook privacy consent flow, this
// automatically clicks the accept button so the user is returned to Spotify
// without manual interaction.
// ═══════════════════════════════════════════════════════════════════════════════
if (location.hostname.includes('facebook.com')) {
  function tryGdprClick() {
    var btn = document.querySelector('#facebook div[role="button"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  if (!tryGdprClick()) {
    var gdprObs = new MutationObserver(function () {
      if (tryGdprClick()) gdprObs.disconnect();
    });
    gdprObs.observe(document.documentElement, { childList: true, subtree: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C — Spotify SPA features
//
// Everything below only runs on spotify.com pages.  Because Spotify is a
// single-page application, several helpers use MutationObserver and/or
// setInterval to catch DOM elements that appear after the initial load or
// after client-side navigation.
// ═══════════════════════════════════════════════════════════════════════════════
if (location.hostname.endsWith('spotify.com')) {

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Run `fn` whenever the DOM changes (SPA route changes, element insertion).
  function onDomChange(fn) {
    var obs = new MutationObserver(fn);
    function attach() {
      obs.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    }
    if (document.body) {
      attach();
    } else {
      document.addEventListener('DOMContentLoaded', attach);
    }
    return obs;
  }

  // Run `fn` now, and again on every DOM change until `fn` returns true.
  function waitFor(fn) {
    if (fn()) return;
    var obs = onDomChange(function () {
      if (fn()) obs.disconnect();
    });
  }

  // ── C1: Classic email/password login button ────────────────────────────────
  // Inject a prominent "Email + Password Classic Login" link above the social
  // login buttons on the /login page.  The `fuckd` class prevents re-injection
  // after SPA re-renders.

  function injectLoginButton() {
    if (!/\/login/.test(location.pathname)) return false;
    if (document.querySelector('.fuckd')) return false;

    // Target the first social login button (Facebook / Google / Apple).
    var socialBtn = document.querySelector(
      '[data-testid="facebook-button"], ' +
      '[data-testid="google-button"], ' +
      '[data-testid="apple-button"]'
    );
    if (!socialBtn) return false;

    var a = document.createElement('a');
    a.className = 'fuckd';
    a.href = '?allow_password=1';
    a.textContent = 'Email + Password Classic Login';
    a.style.cssText =
      'display:block;' +
      'background:#1877f2;' +
      'color:#ffffff;' +
      'padding:14px 32px;' +
      'border-radius:500px;' +
      'text-align:center;' +
      'font-weight:700;' +
      'font-size:14px;' +
      'text-decoration:none;' +
      'margin-bottom:8px;' +
      'cursor:pointer;' +
      'letter-spacing:.1em;';

    socialBtn.parentNode.insertBefore(a, socialBtn);
    return true;
  }

  // Run immediately and re-run on every DOM change (SPA navigations).
  injectLoginButton();
  onDomChange(injectLoginButton);

  // ── C2: Login detection — auto-enter the web player ───────────────────────
  // Spotify sometimes shows a "Go to web player" button after login.  Click it
  // automatically so the user lands straight in the player.

  function tryEnterPlayer() {
    var btn = document.querySelector('button[data-testid="web-player-link"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  waitFor(tryEnterPlayer);

  // ── C3: Unlock mechanism — auto-skip when playback stalls ─────────────────
  // If the user initiates playback but the player remains in "Play" (paused)
  // state for 10 seconds — which typically indicates a silent ad is blocking
  // the track — skip forward to resume real content.
  //
  // ulFlag prevents the skip from firing repeatedly after the first trigger.

  var playAttemptTime = null;
  var ulFlag = false;

  function actSkipForward() {
    var btn = document.querySelector(
      '[data-testid="control-button-skip-forward"], ' +
      '[data-testid="next-button"]'
    );
    if (btn) btn.click();
  }

  // Detect when the user clicks the play/pause button while it shows "Play"
  // (i.e. they are attempting to start playback).
  document.addEventListener('click', function (e) {
    var pBtn = e.target && e.target.closest
      ? e.target.closest('[data-testid="control-button-playpause"]')
      : null;
    if (pBtn && pBtn.getAttribute('aria-label') === 'Play') {
      playAttemptTime = Date.now();
      ulFlag = false;
    }
  }, true);

  // Poll every second: if 10 s have elapsed since the play attempt and the
  // button is still showing "Play", the player is stuck — skip ahead.
  setInterval(function () {
    if (!playAttemptTime || ulFlag) return;
    if (Date.now() - playAttemptTime < 10000) return;

    var pBtn = document.querySelector('[data-testid="control-button-playpause"]');
    if (pBtn && pBtn.getAttribute('aria-label') === 'Play') {
      ulFlag = true;
      actSkipForward();
    }
  }, 1000);

} // end Spotify block
