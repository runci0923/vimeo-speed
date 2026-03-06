# Architecture Patterns

**Domain:** Chrome Extension -- Vimeo Video Speed Control
**Researched:** 2026-03-06

## Recommended Architecture

A Manifest V3 Chrome extension with four distinct components: manifest configuration, service worker (background), content script (injected into video pages), and popup UI. The content script is the critical component -- it runs inside every matching frame (including cross-origin Vimeo iframes embedded on third-party sites) and directly manipulates the HTML5 `<video>` element's `playbackRate` property.

```
+---------------------+       chrome.storage.sync        +------------------+
|    Popup UI         | --------------------------------> | Chrome Storage   |
| (popup.html/js)     |   (writes speed preference)      | (sync)           |
+---------------------+                                  +------------------+
                                                                |
                                                  storage.onChanged event
                                                                |
                                                                v
+---------------------+       chrome.storage.sync.get    +------------------+
|  Content Script     | <------------------------------ | Chrome Storage   |
| (runs in every      |   (reads speed on init +         | (sync)           |
|  matching frame)    |    listens for changes)          +------------------+
+---------------------+
        |
        | document.querySelector('video').playbackRate = speed
        v
+---------------------+
|  HTML5 <video>      |
|  element on page    |
+---------------------+
```

**No service worker (background script) needed.** This extension is simple enough that the popup writes directly to `chrome.storage.sync` and the content script reads from it. There is no need for a background service worker as an intermediary -- this reduces complexity and avoids the MV3 service worker lifecycle issues entirely.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `manifest.json` | Declares permissions, content script injection rules, popup | Chrome runtime (declarative) |
| `popup.html` + `popup.js` | UI for setting default speed (presets + custom input) | `chrome.storage.sync` (write) |
| `content.js` | Finds `<video>` elements, applies playbackRate, watches for new videos | `chrome.storage.sync` (read + onChange listener) |
| `chrome.storage.sync` | Persists speed preference across devices | Popup (writer), Content script (reader) |

### Data Flow

1. **User sets speed in popup** -- popup.js writes `{ speed: 1.5 }` to `chrome.storage.sync`
2. **Content script initializes** -- on page load, content.js reads speed from `chrome.storage.sync.get("speed")`
3. **Content script applies speed** -- finds `<video>` element via `document.querySelector("video")`, sets `video.playbackRate = speed`
4. **Video appears late (SPA / lazy load)** -- MutationObserver watches for new `<video>` elements added to DOM, applies speed immediately
5. **User changes speed while watching** -- `chrome.storage.onChanged` listener in content.js picks up new value, applies to current video instantly
6. **Vimeo resets speed** -- Vimeo player may override playbackRate on certain events (play, seek, quality change). A polling mechanism or event listener on `ratechange` detects resets and re-applies the desired speed.

### Critical: Two Injection Contexts

The content script must run in two different contexts:

| Context | URL Pattern | How Video is Accessed |
|---------|-------------|----------------------|
| **vimeo.com** (native) | `*://vimeo.com/*` | Direct DOM access to `<video>` element on page |
| **Embedded player** (iframe) | `*://player.vimeo.com/*` | Content script injected into iframe via `all_frames: true` in manifest; direct DOM access within that iframe's context |
| **Third-party site** (host page) | `*://*/*` (NOT needed) | The content script does NOT need to run on the host page -- it only needs to run inside the `player.vimeo.com` iframe |

This is the key architectural insight: Chrome's `all_frames: true` with matching URL patterns means the content script automatically runs inside cross-origin Vimeo iframes on ANY website, without needing host page permissions. The manifest `matches` only needs `vimeo.com` and `player.vimeo.com`.

## Manifest V3 Configuration (Core Architecture)

```json
{
  "manifest_version": 3,
  "name": "Vimeo Gyorsito",
  "version": "1.0",
  "description": "Auto-set Vimeo playback speed",
  "permissions": ["storage"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "content_scripts": [
    {
      "matches": [
        "*://vimeo.com/*",
        "*://player.vimeo.com/*"
      ],
      "js": ["content.js"],
      "all_frames": true,
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
}
```

**Confidence: HIGH** -- Based on official Chrome developer documentation for content_scripts, all_frames, and chrome.storage APIs.

## Patterns to Follow

### Pattern 1: MutationObserver for Late-Loading Videos
**What:** Vimeo's player loads the `<video>` element dynamically. The content script cannot rely on the element existing at `document_idle`. Use MutationObserver to detect when `<video>` appears in the DOM.
**When:** Always -- Vimeo is a SPA and loads video elements asynchronously.
**Example:**
```javascript
function applySpeed(video, speed) {
  video.playbackRate = speed;
}

function observeForVideos(speed) {
  // Apply to any existing videos
  document.querySelectorAll('video').forEach(v => applySpeed(v, speed));

  // Watch for new video elements
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === 'VIDEO') {
          applySpeed(node, speed);
        }
        if (node.querySelectorAll) {
          node.querySelectorAll('video').forEach(v => applySpeed(v, speed));
        }
      }
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
}
```

### Pattern 2: Storage-Driven Communication (No Message Passing)
**What:** Use `chrome.storage.sync` as the single source of truth. Popup writes, content script reads and listens for changes. No need for `chrome.runtime.sendMessage` or service worker.
**When:** Simple extensions where components do not need request/response communication.
**Example:**
```javascript
// popup.js
document.getElementById('speed-btn').addEventListener('click', () => {
  const speed = parseFloat(document.getElementById('speed-input').value);
  chrome.storage.sync.set({ speed });
});

// content.js
chrome.storage.onChanged.addListener((changes) => {
  if (changes.speed) {
    const newSpeed = changes.speed.newValue;
    document.querySelectorAll('video').forEach(v => {
      v.playbackRate = newSpeed;
    });
  }
});
```

### Pattern 3: Defending Against Player Speed Resets
**What:** Vimeo's player JavaScript may reset `playbackRate` to 1x on certain events (play, seek, quality change, advancement to next video). The content script must detect and re-apply the desired speed.
**When:** Whenever the Vimeo player fires events that trigger internal speed resets.
**Example:**
```javascript
function guardSpeed(video, speed) {
  video.playbackRate = speed;
  video.addEventListener('ratechange', () => {
    if (video.playbackRate !== speed) {
      video.playbackRate = speed;
    }
  });
  // Also re-apply on play event (some players reset on play)
  video.addEventListener('play', () => {
    if (video.playbackRate !== speed) {
      video.playbackRate = speed;
    }
  });
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using a Service Worker as Message Broker
**What:** Creating a background service worker just to relay messages between popup and content script.
**Why bad:** Adds unnecessary complexity. Service workers in MV3 have lifecycle issues (they sleep after 30 seconds of inactivity). For this use case, `chrome.storage` is a simpler, more reliable communication channel.
**Instead:** Let popup and content script communicate through `chrome.storage.sync` directly.

### Anti-Pattern 2: Injecting Content Script on All URLs
**What:** Using `"matches": ["<all_urls>"]"` or `"*://*/*"` to ensure the extension works on embedded players.
**Why bad:** Unnecessarily broad permissions. Chrome Web Store review will flag it. Users will distrust the extension. Content script runs on every page load even when there is no Vimeo content.
**Instead:** Use targeted matches: `*://vimeo.com/*` and `*://player.vimeo.com/*`. With `all_frames: true`, this catches embedded players on any host site.

### Anti-Pattern 3: Using the Vimeo Player.js API Instead of Direct DOM Access
**What:** Including the Vimeo Player.js library and using `player.setPlaybackRate()`.
**Why bad:** Adds a dependency, requires the iframe to expose the API (which depends on Vimeo's embed settings and the account tier -- playback rate API is limited to Pro/Business accounts). Direct `video.playbackRate` manipulation works universally because it operates on the standard HTML5 video element API, bypassing Vimeo's restrictions.
**Instead:** Use `document.querySelector('video').playbackRate` directly within the content script running inside the iframe.

### Anti-Pattern 4: Polling for Video Elements
**What:** Using `setInterval` to repeatedly check for video elements.
**Why bad:** Wasteful of CPU, introduces latency (speed applied late), and can cause race conditions.
**Instead:** Use MutationObserver for immediate detection.

## File Structure

```
vimeo-gyorsito/
  manifest.json          # Extension manifest (MV3)
  popup.html             # Speed setting UI
  popup.js               # Popup logic (read/write chrome.storage)
  popup.css              # Popup styling
  content.js             # Injected into vimeo.com + player.vimeo.com frames
  icons/
    icon16.png
    icon48.png
    icon128.png
```

Total: 5-6 source files. No build step needed. No framework needed. Plain HTML/CSS/JS.

## Suggested Build Order (Dependencies)

```
Phase 1: manifest.json + content.js (hardcoded speed)
    |     -- Get injection working, verify video speed changes
    |     -- Test on vimeo.com AND embedded player
    v
Phase 2: chrome.storage integration in content.js
    |     -- Read speed from storage instead of hardcoded value
    |     -- Add MutationObserver for dynamic video loading
    |     -- Add ratechange guard against player resets
    v
Phase 3: popup.html + popup.js + popup.css
    |     -- UI for preset speeds + custom input
    |     -- Write to chrome.storage.sync
    |     -- Real-time update via storage.onChanged in content.js
    v
Phase 4: Polish + Package
          -- Icons, description, edge cases
          -- Test across vimeo.com, embedded players on various sites
          -- Package for Chrome Web Store or local distribution
```

**Rationale:** Content script is the riskiest component (will it actually inject into Vimeo iframes? Will Vimeo's player reset the speed?). Build and validate it first with a hardcoded speed before adding the popup UI layer.

## Scalability Considerations

This is a personal-use Chrome extension, not a scaled service. "Scalability" here means:

| Concern | Current Approach | If Needed Later |
|---------|-----------------|-----------------|
| Multiple video sites | Vimeo only | Add URL patterns to manifest matches |
| Per-video speed memory | Single global speed | Add URL-keyed storage (out of scope per PROJECT.md) |
| Extension size | < 50 KB total | Not a concern |
| Browser compatibility | Chrome only | Firefox uses nearly identical WebExtensions API |

## Sources

- [Chrome Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- HIGH confidence, official docs
- [Chrome Manifest Content Scripts Reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- HIGH confidence, official docs
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) -- HIGH confidence, official docs
- [Chrome Service Worker Basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics) -- HIGH confidence, official docs
- [Manifest V3 Overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) -- HIGH confidence, official docs
- [Video Speed Controller Extension (igrigorik/videospeed)](https://github.com/igrigorik/videospeed) -- MEDIUM confidence, reference implementation
- [Vimeo Player.js](https://github.com/vimeo/player.js/) -- MEDIUM confidence, explicitly NOT recommended for this use case
