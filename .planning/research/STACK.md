# Technology Stack

**Project:** Vimeo Gyorsito (Vimeo Speed Controller Chrome Extension)
**Researched:** 2026-03-06

## Recommended Stack

### Core Platform

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Chrome Manifest V3 | V3 | Extension manifest format | MV2 is fully deprecated since mid-2025. MV3 is the only option for new extensions. | HIGH |
| Vanilla JavaScript (ES2020+) | N/A | All extension code | This extension is tiny (popup + content script + service worker). TypeScript adds a build step, config files, and complexity for ~200 lines of code. Not worth it. | HIGH |
| Chrome Storage API | `chrome.storage.sync` | Persist speed preference | Built-in, syncs across devices, no external dependencies. 100KB quota is more than enough for a single number. | HIGH |

### Extension Components

| Component | File(s) | Purpose | Why |
|-----------|---------|---------|-----|
| Popup (HTML/CSS/JS) | `popup.html`, `popup.js` | UI for setting default speed | Simple form with preset buttons + custom input. No framework needed for 5 buttons and an input field. |
| Content Script | `content.js` | Inject into pages, find video elements, set playbackRate | Runs in the page context where it can access the DOM and HTML5 video elements directly. |
| Service Worker | `background.js` | Handle extension lifecycle events | MV3 requires a service worker instead of background page. Minimal -- mainly handles install event and potentially message routing. |
| Manifest | `manifest.json` | Extension configuration | Declares permissions, content script targets, popup, icons. |

### Video Speed Control Strategy

| Approach | Use Case | Why | Confidence |
|----------|----------|-----|------------|
| Direct `HTMLVideoElement.playbackRate` | vimeo.com native player | On vimeo.com, the content script runs in the same origin as the `<video>` element. Direct DOM access via `document.querySelector('video').playbackRate = X` is the simplest and most reliable approach. No library needed. | HIGH |
| Direct `HTMLVideoElement.playbackRate` via `all_frames: true` | Embedded Vimeo player (iframe) | For embedded players on third-party sites, Vimeo serves content from `player.vimeo.com`. By declaring `player.vimeo.com` in content_scripts matches with `all_frames: true`, Chrome injects the content script directly into the Vimeo iframe. The script then has same-origin access to the `<video>` element inside. | HIGH |
| `MutationObserver` | Detect dynamically loaded videos | Vimeo players may load asynchronously (SPA navigation, lazy loading). MutationObserver watches for `<video>` elements appearing in the DOM and applies the speed setting. Essential for reliability. | HIGH |

### Key Manifest Configuration

```json
{
  "manifest_version": 3,
  "permissions": ["storage"],
  "content_scripts": [
    {
      "matches": [
        "*://*.vimeo.com/*",
        "*://player.vimeo.com/*"
      ],
      "all_frames": true,
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  }
}
```

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | N/A | N/A | This extension needs zero external dependencies. All required APIs are built into the browser and Chrome Extensions platform. |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| `@vimeo/player` (v2.30.3) | Designed for page authors embedding their own Vimeo videos, not for extensions injecting into arbitrary pages. Adds 30KB+ for one function call (`setPlaybackRate`) that we can do with one line of vanilla JS (`video.playbackRate = x`). Also: the Vimeo Player API respects creator restrictions on speed control -- direct `playbackRate` on the HTML5 element bypasses this, which is what users want. |
| TypeScript | Build step overhead for a ~200-line extension. No complex types, no large codebase, no team. Plain JS with JSDoc comments if needed. |
| React / Preact / any UI framework | The popup is 5 buttons and one input field. A framework would be 100x the code size of the actual UI logic. |
| Webpack / Vite / any bundler | No modules to bundle, no transpilation needed. The extension is 3-4 plain JS files loaded directly by the manifest. |
| CRXJS / Plasmo / WXT | Extension development frameworks add abstraction over a simple manifest.json. Useful for large extensions, massive overkill here. The extension has exactly one feature. |
| `chrome.scripting.executeScript` (programmatic injection) | Declarative content_scripts in manifest.json is simpler and more reliable for this use case. Programmatic injection requires the `scripting` permission and more complex service worker logic. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Speed control | Direct `video.playbackRate` | Vimeo Player API (`@vimeo/player`) | Adds dependency, respects creator speed restrictions (bad for user), larger bundle |
| Language | Vanilla JS | TypeScript | Build step not justified for <300 lines total |
| UI | Plain HTML/CSS | React/Preact | 5 buttons + 1 input does not need a framework |
| Build tool | None (raw files) | Vite/Webpack | Nothing to transpile or bundle |
| Extension framework | None (raw manifest) | Plasmo/WXT/CRXJS | Massive overhead for a single-feature extension |
| Storage | `chrome.storage.sync` | `chrome.storage.local` | `sync` gives cross-device sync for free, same API |

## Project Structure

```
vimeo-gyorsito/
  manifest.json          # MV3 manifest
  popup.html             # Speed setting UI
  popup.js               # Popup logic (read/write speed to storage)
  popup.css              # Popup styling
  content.js             # Content script (find videos, set speed)
  background.js          # Service worker (minimal, install handler)
  icons/
    icon16.png
    icon48.png
    icon128.png
```

No `node_modules/`, no `package.json`, no build step, no `dist/` folder. The source IS the distributable.

## Installation / Development

```bash
# No install step needed. Development workflow:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the project directory
# 5. Edit files, click "Reload" on the extension card

# For packaging:
# Chrome Web Store requires a .zip of the extension directory
zip -r vimeo-gyorsito.zip manifest.json popup.* content.js background.js icons/
```

## Critical Technical Notes

1. **Cross-origin iframe access**: The key insight is that `all_frames: true` in content_scripts causes Chrome to inject the content script into every frame matching the URL pattern, including `player.vimeo.com` iframes on third-party sites. This gives the content script same-origin access to the `<video>` element inside the iframe. No cross-origin hacks needed.

2. **Video element timing**: Vimeo loads videos dynamically. The content script must use `MutationObserver` to detect when `<video>` elements are added to the DOM, then set `playbackRate`. Also re-apply on the `loadeddata` or `play` event because Vimeo's own JS may reset the playback rate.

3. **Speed range**: Direct `HTMLVideoElement.playbackRate` supports values from 0.0625 to 16x in Chrome (browser-dependent). The Vimeo Player API caps at 2x. Going direct gives users more flexibility.

4. **No `host_permissions` needed**: Content scripts declared in `content_scripts` manifest key automatically get access to their matched URLs without needing `host_permissions`. This simplifies the permission model and avoids scary permission warnings during install.

5. **Service worker lifecycle**: MV3 service workers are ephemeral -- they shut down when idle. For this extension, that is fine because the service worker has almost no responsibility (storage is accessed directly by popup and content script).

## Sources

- [Chrome Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) -- HIGH confidence, official docs
- [Chrome Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) -- HIGH confidence, official docs
- [Vimeo Player.js GitHub](https://github.com/vimeo/player.js/) -- HIGH confidence, official repository. Current version: 2.30.3
- [@vimeo/player npm](https://www.npmjs.com/package/@vimeo/player) -- HIGH confidence, official package
- [Video Speed Controller extensions](https://github.com/igrigorik/videospeed) -- MEDIUM confidence, established open-source pattern showing `video.playbackRate` approach works
- [Chrome Content Scripts manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) -- HIGH confidence, official docs on `all_frames` and `match_about_blank`
