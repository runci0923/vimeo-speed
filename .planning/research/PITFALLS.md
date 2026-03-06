# Domain Pitfalls

**Domain:** Chrome Extension -- Vimeo Video Speed Control
**Researched:** 2026-03-06

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Ignoring the Iframe Boundary for Embedded Vimeo Players

**What goes wrong:** The extension works on vimeo.com but fails completely on embedded Vimeo players. Developers write a content script that queries `document.querySelector('video')` on the host page, but embedded Vimeo videos live inside a cross-origin `<iframe>` pointing to `player.vimeo.com`. The content script on the host page cannot reach into that iframe's DOM due to the same-origin policy.

**Why it happens:** Developers test only on vimeo.com (where the `<video>` element is in the same origin) and forget that embedded players are cross-origin iframes. The project requirements explicitly state embedded players must work, and the primary use case (online klub with 1000+ videos) uses embedded players.

**Consequences:** The extension is useless for the primary use case. A late discovery means a fundamental architecture change.

**Prevention:** Design two separate injection strategies from day one:
1. **vimeo.com**: Content script matches `*://*.vimeo.com/*`, directly accesses the `<video>` element in the page DOM, sets `video.playbackRate`.
2. **Embedded players on any site**: Content script with `"all_frames": true` injects into the Vimeo iframe itself (matching `*://player.vimeo.com/*`). Inside the iframe, the `<video>` element is same-origin and directly accessible.

The manifest must include both match patterns and `"all_frames": true`. Use `"match_origin_as_fallback": true` if dealing with `about:blank` or `blob:` subframes.

**Detection:** If your manifest `content_scripts` section only has one `matches` entry or lacks `"all_frames": true`, you have this problem.

**Phase relevance:** Must be addressed in Phase 1 (core architecture). Getting this wrong means rewriting the manifest and content script structure.

### Pitfall 2: Vimeo Player Resets playbackRate on Every State Change

**What goes wrong:** You set `video.playbackRate = 1.5` and it works -- until the user pauses, seeks, or the video buffers. The Vimeo player's internal JavaScript resets `playbackRate` to 1.0 on these events because it manages playback state independently.

**Why it happens:** The Vimeo player listens for `play`, `seeked`, `loadeddata`, and other events, and resets `playbackRate` as part of its internal state management. A one-shot speed setting gets overwritten.

**Consequences:** Users see the speed flicker or revert. They think the extension is broken. This is the #1 complaint in existing video speed controller extensions (see igrigorik/videospeed issue #459).

**Prevention:** Use a persistent enforcement strategy:
1. Listen for `ratechange` events on the `<video>` element. When the rate changes to something other than the user's desired speed, set it back immediately.
2. Use a `MutationObserver` watching for new `<video>` elements (in case the player rebuilds the DOM).
3. As a belt-and-suspenders approach, use `Object.defineProperty` to intercept `playbackRate` setter on the video element prototype, though this is fragile and may conflict with the player.

The recommended approach is the `ratechange` event listener -- it fires every time the rate changes, letting you immediately re-apply the desired speed.

**Detection:** Test by setting speed, then pausing and resuming. If speed resets, you have this problem.

**Phase relevance:** Must be addressed in Phase 1. This is core functionality, not polish.

### Pitfall 3: Vimeo Account-Level Speed Control Restrictions

**What goes wrong:** The Vimeo Player API's `setPlaybackRate()` method respects account-level restrictions. Videos uploaded by Basic/Free accounts may not support speed controls through the API. Calling `setPlaybackRate()` fails with a rejection or silently does nothing.

**Why it happens:** Vimeo restricts speed controls to paid plans (Pro, Business, Premium). The API enforces this server-side.

**Consequences:** If you rely on the Vimeo Player API (`@vimeo/player` postMessage-based SDK) instead of directly manipulating the HTML5 `<video>` element, speed control silently fails for many videos.

**Prevention:** Do NOT use the Vimeo Player JavaScript SDK (`@vimeo/player`) for setting speed. Instead, directly manipulate the `<video>` element's `playbackRate` property via a content script injected into the iframe. The HTML5 `playbackRate` property is a browser-level feature that does not respect Vimeo's account restrictions -- it works regardless of plan type. This is the same approach used by successful extensions like Video Speed Controller.

**Detection:** Test with a video uploaded by a free Vimeo account. If speed control fails, you are using the wrong approach.

**Phase relevance:** Architecture decision in Phase 1. Choosing the wrong API is a fundamental mistake.

## Moderate Pitfalls

### Pitfall 4: Content Script Timing -- Video Element Not Yet in DOM

**What goes wrong:** The content script runs at `document_idle` (default) or `document_end`, but the Vimeo player hasn't yet created the `<video>` element. The script finds no video element and silently does nothing.

**Why it happens:** Vimeo's player initializes asynchronously. The `<video>` element is created by JavaScript after the initial DOM is ready, especially in embedded players where the iframe loads its own scripts.

**Prevention:** Use a `MutationObserver` to watch for `<video>` elements being added to the DOM. Do not rely on `document.querySelector('video')` at script load time.

```javascript
const observer = new MutationObserver((mutations) => {
  const video = document.querySelector('video');
  if (video) {
    applyPlaybackRate(video);
    observer.disconnect();
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });
```

Also check immediately on script load (the element might already exist), then fall back to the observer.

**Detection:** The extension works inconsistently -- sometimes it applies speed, sometimes it does not, depending on page load timing.

**Phase relevance:** Phase 1 -- part of core content script implementation.

### Pitfall 5: Chrome Web Store Rejection Due to Overly Broad Permissions

**What goes wrong:** The extension requests `<all_urls>` or `*://*/*` host permissions to "work on any site with an embedded Vimeo player." Chrome Web Store rejects this as overly broad.

**Why it happens:** Developers want the extension to work on any page that embeds a Vimeo video, which feels like it requires broad host permissions.

**Prevention:** Use narrow host permissions:
- `*://*.vimeo.com/*` -- covers vimeo.com and player.vimeo.com (the iframe origin)
- For embedded players on arbitrary host pages: the content script with `"all_frames": true` and matching `*://player.vimeo.com/*` injects into the Vimeo iframe regardless of the host page's origin. You do NOT need host permission for the embedding page itself.

This means the extension only needs `*://*.vimeo.com/*` permission, which is narrow and justified.

**Detection:** Review your manifest's `permissions` and `host_permissions` arrays. If you see `<all_urls>` or wildcard patterns beyond `vimeo.com`, you are over-requesting.

**Phase relevance:** Phase 1 manifest setup, but also Phase 3 (Chrome Web Store submission).

### Pitfall 6: Service Worker (Background Script) Misuse in MV3

**What goes wrong:** Developers store the user's speed preference in a global variable in the service worker, or use `setTimeout`/`setInterval` for periodic tasks. The service worker gets terminated after ~30 seconds of inactivity, losing all in-memory state.

**Why it happens:** Manifest V3 replaced persistent background pages with ephemeral service workers. Developers accustomed to MV2 patterns carry over assumptions about persistent state.

**Prevention:**
- Use `chrome.storage.local` or `chrome.storage.sync` for all persistent state (speed preference). Never store state in service worker global variables.
- Register all event listeners at the top level of the service worker (not inside async callbacks or promises).
- Do not use `setTimeout`/`setInterval` -- use `chrome.alarms` if needed (though this extension likely does not need background timers).
- For this extension, the service worker may not even be necessary. The content script can read speed from `chrome.storage` directly, and the popup can write to `chrome.storage` directly. No background coordination needed.

**Detection:** Speed preference "forgets" itself after the browser has been idle or after a restart.

**Phase relevance:** Phase 1 architecture decision. Minimize service worker usage.

### Pitfall 7: SPA Navigation on Vimeo.com Breaks Speed Application

**What goes wrong:** Vimeo.com uses client-side routing (SPA). When a user navigates between videos on vimeo.com, the page does not fully reload. The content script ran once on initial page load and never re-applies speed to the new video.

**Why it happens:** Content scripts run once per page load by default. SPA navigation changes the video without triggering a new page load, so no new content script injection occurs.

**Prevention:** The `MutationObserver` approach (Pitfall 4) solves this as well -- it watches for new `<video>` elements continuously. Do not `disconnect()` the observer after the first video is found. Instead, keep it running and re-apply speed whenever a new `<video>` element appears or the existing one's `src` changes.

Additionally, listen for `ratechange` events to handle the case where the same `<video>` element is reused with a new source.

**Detection:** Test by navigating between videos on vimeo.com without a full page reload. If speed only applies to the first video, you have this problem.

**Phase relevance:** Phase 1, but can be refined in Phase 2.

## Minor Pitfalls

### Pitfall 8: Speed Value Validation Gaps

**What goes wrong:** User enters a speed like "0" or "100" or "abc" in the custom speed input. The extension tries to set `video.playbackRate = 0` (pauses video) or an absurdly high value (audio becomes unintelligible garbage).

**Prevention:** Clamp speed values to a reasonable range (0.25 to 4.0). Validate input is a positive number. Show validation feedback in the popup UI.

**Phase relevance:** Phase 1 popup implementation.

### Pitfall 9: Multiple Content Script Instances in Nested Iframes

**What goes wrong:** A page has multiple nested iframes. With `"all_frames": true`, the content script injects into every frame, including non-Vimeo iframes where it finds no video element. While not harmful, it wastes resources and can produce console noise.

**Prevention:** The `matches` pattern `*://player.vimeo.com/*` already limits injection to Vimeo player frames only. Ensure the matches pattern is specific enough. Do not use broad patterns like `<all_urls>` with `"all_frames": true`.

**Phase relevance:** Phase 1 manifest configuration.

### Pitfall 10: Popup UI Not Reflecting Current State

**What goes wrong:** User opens the popup but it shows the default speed instead of the currently active speed. Or the user changes speed in the popup but the change does not take effect until the next page load.

**Prevention:**
- Popup reads current speed from `chrome.storage` on open.
- When speed is changed in popup, write to `chrome.storage` and send a message to the active tab's content script via `chrome.tabs.sendMessage()` to apply immediately.
- Content script listens for messages and applies new speed to the current `<video>` element in real time.

**Phase relevance:** Phase 1 popup + content script communication.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core architecture (Phase 1) | Iframe injection strategy wrong (Pitfall 1) | Design dual-strategy from day one: vimeo.com direct + iframe injection |
| Core architecture (Phase 1) | Using Vimeo SDK instead of direct video element manipulation (Pitfall 3) | Use HTML5 `playbackRate` directly, not Vimeo Player API |
| Content script (Phase 1) | Video element timing (Pitfall 4) + player resets speed (Pitfall 2) | MutationObserver + ratechange listener |
| Popup UI (Phase 1) | No real-time communication with content script (Pitfall 10) | chrome.storage + chrome.tabs.sendMessage for live updates |
| State management (Phase 1) | Service worker state loss (Pitfall 6) | Use chrome.storage, minimize or eliminate service worker |
| SPA handling (Phase 1-2) | Navigation breaks speed on vimeo.com (Pitfall 7) | Persistent MutationObserver, do not disconnect after first video |
| Chrome Web Store (Phase 3) | Overly broad permissions (Pitfall 5) | Only request `*://*.vimeo.com/*` |
| Input validation (Phase 1) | Invalid speed values crash or break playback (Pitfall 8) | Clamp to 0.25-4.0, validate numeric input |

## Sources

- [Chrome Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- HIGH confidence (official docs)
- [Vimeo Player.js SDK](https://github.com/vimeo/player.js/) -- HIGH confidence (official repo)
- [Video Speed Controller Issues - Speed Reset](https://github.com/igrigorik/videospeed/issues/459) -- MEDIUM confidence (community issue tracker)
- [Vimeo Player.js - Playback Rate Issue #465](https://github.com/vimeo/player.js/issues/465) -- MEDIUM confidence (official issue tracker)
- [Chrome Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) -- HIGH confidence (official docs)
- [SPA Support for Chrome Extensions](https://medium.com/@softvar/making-chrome-extension-smart-by-supporting-spa-websites-1f76593637e8) -- LOW confidence (blog post, verify patterns)
- [Chrome Web Store Extension Rejection Reasons](https://www.extensionradar.com/blog/chrome-extension-rejected) -- MEDIUM confidence (multiple sources agree on permission issues)
- [Vimeo Speed Controls Help Article](https://help.vimeo.com/hc/en-us/articles/12426285015441-About-playback-speed-controls) -- MEDIUM confidence (official Vimeo, but could not fetch full content)
