# Phase 1: Core Speed Injection - Research

**Researched:** 2026-03-06
**Domain:** Chrome Extension MV3 content scripts, HTML5 Video playbackRate API, Vimeo iframe injection
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hardcoded 1.5x in Phase 1 (no storage, no UI yet)
- Phase 2 will introduce chrome.storage and popup for user configuration
- Re-apply speed immediately when Vimeo player resets it (ratechange event)
- Throttle to max 10 retries per second to prevent infinite loops
- Cover all reset triggers: seek, pause, quality change, buffering
- Silent operation -- no toast, overlay, or visual indication on the video
- Speed range limits: 0.5x minimum, 4x maximum
- Use direct video.playbackRate (not Vimeo Player SDK)
- Use all_frames: true with *://player.vimeo.com/* match pattern

### Claude's Discretion
- MutationObserver strategy for detecting dynamically loaded video elements
- Debounce/throttle implementation details for the ratechange listener
- run_at timing (document_idle vs document_end)
- Whether to use match_origin_as_fallback for edge-case iframe configs

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPEED-01 | User can set a default playback speed that auto-applies to every Vimeo video | Hardcoded 1.5x applied via content script on video element detection; MutationObserver pattern for dynamic videos |
| SPEED-05 | Speed is re-applied when Vimeo player resets it (seek, pause, quality change) | ratechange event listener with throttled re-application; guard flag pattern to prevent infinite loops |
| EMBED-01 | Extension works on vimeo.com video pages | Content script with matches: ["*://*.vimeo.com/*"] |
| EMBED-02 | Extension works on embedded Vimeo iframes on any third-party website | all_frames: true + matches: ["*://player.vimeo.com/*"] injects content script into cross-origin Vimeo iframes |
</phase_requirements>

## Summary

This phase implements a Chrome Extension (Manifest V3) content script that automatically sets Vimeo video playback speed to 1.5x. The core challenge is reliably detecting `<video>` elements across two contexts: the vimeo.com main site and player.vimeo.com iframes embedded on third-party sites.

The technical approach is straightforward: use the HTML5 `video.playbackRate` property directly (bypassing the Vimeo Player SDK which has account-level restrictions limiting speed to 0-2x range for PRO/Business accounts only). A MutationObserver watches for dynamically inserted `<video>` elements, and a `ratechange` event listener re-applies the desired speed when Vimeo's player resets it. The `all_frames: true` manifest option ensures the content script runs inside cross-origin Vimeo player iframes.

The main risk is the ratechange infinite loop: setting `playbackRate` fires `ratechange`, which triggers our listener to set `playbackRate` again. This is solved with a guard flag pattern combined with throttling.

**Primary recommendation:** Build a single content script with MutationObserver-based video detection, guard-flag-protected ratechange enforcement, and a two-pattern manifest (vimeo.com + player.vimeo.com) with `all_frames: true`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension MV3 | Manifest V3 | Extension framework | Required for Chrome Web Store as of 2025 |
| HTML5 Video API | Web standard | playbackRate control | Direct, no SDK dependency, no account restrictions |

### Supporting
No additional libraries needed. This is pure vanilla JS with Web APIs.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct video.playbackRate | Vimeo Player SDK (player.js) | SDK limited to 0-2x range, requires PRO/Business account, adds dependency. Direct API has no restrictions. |
| MutationObserver | Polling (setInterval) | Polling wastes CPU and has detection delay. MutationObserver is event-driven and immediate. |

**Installation:**
No npm packages. Pure browser extension with no build step needed for Phase 1.

## Architecture Patterns

### Recommended Project Structure
```
vimeo-gyorsito/
├── manifest.json           # Extension manifest (MV3)
├── content.js              # Content script (speed injection logic)
└── icons/                  # Extension icons (16, 48, 128px)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Pattern 1: Manifest V3 Content Script Declaration
**What:** Static content script registration targeting Vimeo domains
**When to use:** Always -- this is how the extension injects into pages

```json
// Source: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
{
  "manifest_version": 3,
  "name": "Vimeo Gyorsito",
  "version": "1.0.0",
  "description": "Automatically speed up Vimeo videos",
  "content_scripts": [
    {
      "matches": [
        "*://*.vimeo.com/*",
        "*://player.vimeo.com/*"
      ],
      "js": ["content.js"],
      "all_frames": true,
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Key decisions on discretion items:**

- **run_at: "document_idle"** (recommended): This is the default and safest option. The MutationObserver will catch any videos added after injection. Using `document_end` would run slightly earlier but risks running before the DOM is ready in edge cases. Since we use MutationObserver anyway, `document_idle` is sufficient and preferred.

- **match_origin_as_fallback: not needed**: This property is for `about:`, `data:`, `blob:`, and `filesystem:` frames. Vimeo embeds use standard `https://player.vimeo.com/video/ID` URLs, so the regular `matches` pattern handles them. Only add if testing reveals edge cases with non-standard iframe src schemes.

### Pattern 2: MutationObserver Video Detection
**What:** Watch for dynamically added `<video>` elements throughout the page lifecycle
**When to use:** Always -- Vimeo loads video elements dynamically via JavaScript

```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
const TARGET_SPEED = 1.5;

function initSpeedControl(video) {
  applySpeed(video);
  attachRateChangeListener(video);
}

function findAndInitVideos(root) {
  const videos = root.querySelectorAll('video');
  videos.forEach(initSpeedControl);
}

// Process existing videos
findAndInitVideos(document);

// Watch for new videos
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.tagName === 'VIDEO') {
        initSpeedControl(node);
      } else if (node.querySelector) {
        const videos = node.querySelectorAll('video');
        videos.forEach(initSpeedControl);
      }
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
```

### Pattern 3: Guard Flag for ratechange Loop Prevention
**What:** Prevent infinite loop when our playbackRate set triggers ratechange which triggers our set again
**When to use:** Always -- this is the critical safety mechanism

```javascript
// Source: MDN HTMLMediaElement ratechange event + custom pattern
const TARGET_SPEED = 1.5;
const MAX_RETRIES_PER_SECOND = 10;
const THROTTLE_WINDOW = 1000; // ms

function attachRateChangeListener(video) {
  let retryCount = 0;
  let windowStart = Date.now();
  let settingSpeed = false; // Guard flag

  video.addEventListener('ratechange', () => {
    // Guard: ignore events triggered by our own set
    if (settingSpeed) return;

    // Already at target speed, nothing to do
    if (video.playbackRate === TARGET_SPEED) return;

    // Throttle: reset counter each second
    const now = Date.now();
    if (now - windowStart >= THROTTLE_WINDOW) {
      retryCount = 0;
      windowStart = now;
    }

    // Bail if too many retries (player is fighting us)
    if (retryCount >= MAX_RETRIES_PER_SECOND) return;

    retryCount++;
    settingSpeed = true;
    video.playbackRate = TARGET_SPEED;
    settingSpeed = false;
  });
}
```

### Anti-Patterns to Avoid
- **Polling for video elements:** Using `setInterval` to repeatedly query for `<video>` tags wastes CPU. Use MutationObserver instead.
- **Using Vimeo Player SDK:** Adds a dependency, has account-level restrictions (0-2x only for PRO/Business), and communicates via postMessage which is slower and more complex than direct DOM manipulation.
- **Setting playbackRate without a guard flag:** Causes infinite ratechange loop. Always use a guard flag.
- **Single match pattern:** Using only `*://*.vimeo.com/*` will NOT inject into player.vimeo.com iframes on third-party sites because the iframe's URL must independently match the pattern. Must include both `*://*.vimeo.com/*` and `*://player.vimeo.com/*` (though the first subsumes the second, being explicit helps clarity).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video element detection | Custom polling/interval | MutationObserver API | Browser-native, event-driven, zero CPU overhead when idle |
| Speed enforcement | Complex retry/backoff logic | Simple guard flag + throttle counter | The loop is synchronous; a boolean flag is sufficient |
| Cross-origin iframe injection | postMessage bridge to iframes | all_frames: true in manifest | Chrome handles injection automatically |

**Key insight:** The Chrome extension APIs handle the hardest part (cross-origin iframe injection) for free via `all_frames: true`. Do not try to build a messaging bridge to reach into iframes.

## Common Pitfalls

### Pitfall 1: ratechange Infinite Loop
**What goes wrong:** Setting `video.playbackRate` fires `ratechange`, your listener responds by setting `playbackRate` again, creating an infinite loop.
**Why it happens:** The `ratechange` event cannot distinguish between user-initiated and programmatic rate changes.
**How to avoid:** Use a boolean guard flag (`settingSpeed`) that is set to `true` before changing `playbackRate` and reset to `false` after. The listener checks this flag and exits early.
**Warning signs:** Browser tab freezing, high CPU usage on pages with Vimeo videos.

### Pitfall 2: Content Script Not Running in Iframes
**What goes wrong:** Extension works on vimeo.com but not on embedded videos on third-party sites.
**Why it happens:** `all_frames` defaults to `false`. Without it, content scripts only inject into the top-level frame, not sub-frames.
**How to avoid:** Set `"all_frames": true` in manifest.json content_scripts. The iframe URL (`https://player.vimeo.com/video/...`) must independently match the `matches` pattern.
**Warning signs:** Extension works on vimeo.com but speed stays at 1x on any embedded Vimeo video.

### Pitfall 3: Video Element Not Yet in DOM
**What goes wrong:** Content script runs but finds no `<video>` element because Vimeo's player JavaScript hasn't created it yet.
**Why it happens:** Vimeo dynamically creates the `<video>` element after page load. Even with `run_at: document_idle`, the video may not exist yet.
**How to avoid:** Use MutationObserver to detect when the `<video>` element is added to the DOM. Also do an initial scan of existing elements.
**Warning signs:** Extension works inconsistently -- sometimes applies speed, sometimes doesn't.

### Pitfall 4: Multiple Video Elements
**What goes wrong:** Page has multiple `<video>` elements (e.g., Vimeo homepage, ads) and speed is only applied to one.
**Why it happens:** Using `document.querySelector('video')` returns only the first match.
**How to avoid:** Use `document.querySelectorAll('video')` and process each, plus MutationObserver catches later additions. Track processed videos with a WeakSet to avoid duplicate listeners.
**Warning signs:** Some videos on a page play at target speed, others don't.

### Pitfall 5: Applying Speed Before Video is Ready
**What goes wrong:** Setting `playbackRate` on a video element that hasn't loaded metadata may not stick.
**Why it happens:** Some browsers/players reset playbackRate when metadata loads.
**How to avoid:** Listen for `loadedmetadata` event in addition to setting speed immediately. The ratechange enforcement loop will also catch this case.
**Warning signs:** Speed briefly flickers to target then resets to 1x.

## Code Examples

### Complete Content Script (Phase 1)
```javascript
// content.js - Vimeo Speed Injection
// Hardcoded target speed for Phase 1 (Phase 2 adds user configuration)
const TARGET_SPEED = 1.5;
const MAX_RETRIES_PER_SECOND = 10;
const THROTTLE_WINDOW_MS = 1000;

// Track processed videos to avoid duplicate listeners
const processedVideos = new WeakSet();

function applySpeed(video) {
  video.playbackRate = TARGET_SPEED;
}

function initSpeedControl(video) {
  if (processedVideos.has(video)) return;
  processedVideos.add(video);

  // Apply immediately
  applySpeed(video);

  // Re-apply when metadata loads (in case early set didn't stick)
  video.addEventListener('loadedmetadata', () => applySpeed(video), { once: true });

  // Enforce on ratechange with guard + throttle
  let retryCount = 0;
  let windowStart = Date.now();
  let settingSpeed = false;

  video.addEventListener('ratechange', () => {
    if (settingSpeed) return;
    if (video.playbackRate === TARGET_SPEED) return;

    const now = Date.now();
    if (now - windowStart >= THROTTLE_WINDOW_MS) {
      retryCount = 0;
      windowStart = now;
    }

    if (retryCount >= MAX_RETRIES_PER_SECOND) return;
    retryCount++;

    settingSpeed = true;
    video.playbackRate = TARGET_SPEED;
    settingSpeed = false;
  });
}

// Initial scan
document.querySelectorAll('video').forEach(initSpeedControl);

// Watch for dynamically added videos
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.tagName === 'VIDEO') {
        initSpeedControl(node);
      } else if (node.querySelector) {
        node.querySelectorAll('video').forEach(initSpeedControl);
      }
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
```

### Complete Manifest (Phase 1)
```json
{
  "manifest_version": 3,
  "name": "Vimeo Gyorsito",
  "version": "1.0.0",
  "description": "Automatically speed up Vimeo videos to 1.5x",
  "content_scripts": [
    {
      "matches": [
        "*://*.vimeo.com/*",
        "*://player.vimeo.com/*"
      ],
      "js": ["content.js"],
      "all_frames": true,
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manifest V2 | Manifest V3 required | June 2025 Chrome phase-out | Must use MV3 for new extensions |
| Vimeo Player SDK for speed | Direct HTML5 playbackRate | Always available | No account restrictions, works above 2x |
| Mutation Events (deprecated) | MutationObserver | Years ago | MutationObserver is the standard |

**Deprecated/outdated:**
- Manifest V2: Chrome Web Store no longer accepts MV2 extensions
- Vimeo Player SDK `setPlaybackRate()`: Limited to 0-2x range and requires PRO/Business account. Has had bugs where it rejects calls when controls are disabled (issue #465, closed 2021).

## Open Questions

1. **Does Vimeo actively fight playbackRate changes via JavaScript?**
   - What we know: The Vimeo Player SDK limits speed to 0-2x, but direct `video.playbackRate` manipulation bypasses this. Community extensions (Video Speed Controller, etc.) successfully use this approach up to 4x+.
   - What's unclear: Whether Vimeo has added or will add JavaScript that detects and reverts direct playbackRate changes on the `<video>` element.
   - Recommendation: The ratechange enforcement mechanism handles this case. If Vimeo actively fights, the throttle (max 10/sec) prevents infinite loops while still re-applying. Test on real Vimeo pages during implementation.

2. **Edge case: Vimeo OTT / custom player deployments**
   - What we know: Standard Vimeo embeds use `player.vimeo.com/video/ID` URLs. Vimeo OTT uses custom domains.
   - What's unclear: Whether OTT embeds still use player.vimeo.com URLs internally.
   - Recommendation: Phase 1 covers standard Vimeo embeds only. OTT is out of scope per the project's Vimeo-only focus.

## Sources

### Primary (HIGH confidence)
- [Chrome Developer Docs - Content Scripts Manifest](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) - all_frames, match_origin_as_fallback, run_at, matches properties
- [Chrome Developer Docs - Content Scripts Concepts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) - iframe injection, run_at timing, cross-origin behavior
- [MDN - MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) - DOM observation API
- [MDN - HTMLMediaElement ratechange event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ratechange_event) - event properties, behavior

### Secondary (MEDIUM confidence)
- [Vimeo Player.js GitHub](https://github.com/vimeo/player.js/) - SDK limitations, setPlaybackRate range (0-2x)
- [Vimeo Player.js Issue #465](https://github.com/vimeo/player.js/issues/465) - playbackRate broken with controls:false, confirms SDK limitations
- [VideoSpeedController extension](https://github.com/prashantsmp/VideoSpeedController) - validates community pattern of direct playbackRate manipulation up to 4x

### Tertiary (LOW confidence)
- Community extensions validate the direct playbackRate approach works on Vimeo, but no systematic testing data available

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Chrome MV3 and HTML5 Video API are well-documented web standards
- Architecture: HIGH - MutationObserver + ratechange pattern is well-established in video speed controller extensions
- Pitfalls: HIGH - ratechange loop and iframe injection are well-documented issues with known solutions

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable web APIs, unlikely to change)
