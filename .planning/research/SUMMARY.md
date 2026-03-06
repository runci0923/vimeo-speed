# Project Research Summary

**Project:** Vimeo Gyorsito (Vimeo Speed Controller Chrome Extension)
**Domain:** Chrome Extension -- Browser-based Video Playback Control
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

Vimeo Gyorsito is a single-purpose Chrome extension that auto-applies a user-chosen playback speed to all Vimeo videos, including embedded players on third-party sites. This is a small, well-scoped project: ~200 lines of vanilla JavaScript across 5-6 files, zero dependencies, zero build step, targeting Chrome Manifest V3. The competitive landscape has a clear gap -- the only Vimeo-specific speed extension was removed from the Chrome Web Store in 2022 for trademark infringement, and the dominant generic alternative (Video Speed Controller, 3M+ users) is not Vimeo-optimized and still runs on MV2.

The recommended approach is direct HTML5 `video.playbackRate` manipulation via a content script injected into both vimeo.com pages and Vimeo player iframes (using `all_frames: true`). This bypasses Vimeo's account-level speed restrictions and avoids any dependency on the Vimeo Player SDK. Communication between the popup UI and content script flows through `chrome.storage.sync` -- no service worker needed as an intermediary. The entire extension is raw HTML/CSS/JS loaded directly from the manifest.

The two critical risks are: (1) getting the iframe injection strategy wrong, which would make the extension useless for its primary use case (embedded players on a club site), and (2) Vimeo's player JavaScript resetting `playbackRate` on state changes (play, seek, buffer). Both are well-understood problems with proven solutions (manifest `all_frames: true` for iframes, `ratechange` event listener for speed resets). If these two things work, everything else is straightforward.

## Key Findings

### Recommended Stack

Zero-dependency vanilla JavaScript on Chrome Manifest V3. No TypeScript, no frameworks, no bundlers, no extension toolkits. The extension is too small to justify any build tooling -- the source files ARE the distributable.

**Core technologies:**
- **Chrome Manifest V3**: Only option for new extensions since MV2 deprecation in mid-2025
- **Vanilla JavaScript (ES2020+)**: ~200 lines total across all files; TypeScript build step not justified
- **`chrome.storage.sync`**: Persists speed preference, syncs across devices, 100KB quota (we store one number)
- **Direct `HTMLVideoElement.playbackRate`**: Browser-native API, bypasses Vimeo restrictions, supports 0.0625x-16x range
- **MutationObserver**: Detects dynamically loaded video elements in Vimeo's SPA architecture

**Explicitly rejected:** Vimeo Player SDK (respects creator speed restrictions, adds 30KB), React/Preact (5 buttons do not need a framework), Webpack/Vite (nothing to bundle), Plasmo/WXT/CRXJS (massive overhead for a single-feature extension).

### Expected Features

**Must have (table stakes):**
- Set and persist a default playback speed across sessions and devices
- Preset speed buttons (1x, 1.25x, 1.5x, 1.75x, 2x)
- Auto-apply speed on video load without user interaction
- Work on vimeo.com native pages
- Work on embedded Vimeo players in iframes on any site (primary use case)
- Simple popup UI for speed selection

**Should have (differentiators):**
- Custom speed input (e.g., 1.3x, 2.5x) beyond Vimeo's fixed presets
- Speeds beyond 2x (up to 4x) -- Vimeo native caps at 2x
- Extension badge showing current speed
- Works even when video owner disables speed controls
- Zero-config operation -- install, set speed, done forever

**Defer (v2+):**
- Per-video speed memory (explicitly out of scope)
- Video overlay / on-screen controls (explicitly excluded)
- Keyboard shortcuts
- Firefox port
- Localization

### Architecture Approach

Four-file architecture with no service worker: `manifest.json` declares injection rules, `content.js` finds and controls video elements, `popup.html`/`popup.js` provides the settings UI, and `chrome.storage.sync` serves as the communication channel between them. The content script runs in two contexts (vimeo.com pages and player.vimeo.com iframes) but uses identical logic in both.

**Major components:**
1. **`manifest.json`** -- Declares permissions (`storage` only), content script injection for `*.vimeo.com` and `player.vimeo.com` with `all_frames: true`
2. **`content.js`** -- MutationObserver to detect `<video>` elements, applies `playbackRate`, guards against player resets via `ratechange` listener, listens for storage changes
3. **`popup.html` + `popup.js`** -- Preset buttons + custom input, reads/writes `chrome.storage.sync`
4. **`chrome.storage.sync`** -- Single source of truth for speed preference, replaces need for message passing or service worker

### Critical Pitfalls

1. **Iframe injection strategy wrong** -- Content script works on vimeo.com but fails on embedded players. Prevention: `all_frames: true` with `*://player.vimeo.com/*` match pattern from day one. Test embedded players immediately.
2. **Vimeo player resets playbackRate** -- Speed reverts on pause, seek, or buffer. Prevention: `ratechange` event listener that immediately re-applies desired speed. Keep MutationObserver running (do not disconnect).
3. **Using Vimeo Player SDK instead of direct DOM** -- SDK respects account-level speed restrictions, silently fails on free-tier videos. Prevention: Use `video.playbackRate` directly, never the Vimeo SDK.
4. **Video element not in DOM at script load** -- Vimeo loads `<video>` asynchronously. Prevention: MutationObserver pattern, not one-shot `querySelector`.
5. **Overly broad permissions** -- `<all_urls>` triggers Chrome Web Store rejection. Prevention: Only `*://*.vimeo.com/*` needed; `all_frames: true` handles embedding sites without host permissions.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Injection and Speed Control

**Rationale:** The content script with correct iframe injection is the riskiest and most critical component. If this does not work, nothing else matters. Validate the hardest technical problem first.
**Delivers:** A working extension that sets a hardcoded speed on any Vimeo video (native or embedded). Proves the injection strategy works.
**Addresses:** Auto-apply speed, vimeo.com support, embedded iframe support
**Avoids:** Pitfall 1 (iframe boundary), Pitfall 2 (speed resets), Pitfall 3 (wrong API choice), Pitfall 4 (video element timing)

### Phase 2: Storage and Popup UI

**Rationale:** With injection proven, add the user-facing configuration. Storage integration is straightforward and well-documented. The popup is 5 buttons and one input field.
**Delivers:** Fully functional extension -- user sets speed in popup, it persists and auto-applies everywhere.
**Addresses:** Persist speed, preset buttons, custom speed input, speeds beyond 2x, badge indicator
**Avoids:** Pitfall 6 (service worker misuse -- we skip the service worker), Pitfall 8 (speed validation), Pitfall 10 (popup not reflecting state)

### Phase 3: Polish and Distribution

**Rationale:** Core functionality complete. Add icons, handle edge cases, test across sites, package for distribution.
**Delivers:** Production-ready extension, packaged as .zip for Chrome Web Store or local install.
**Addresses:** Icons, description, edge case handling, SPA navigation robustness
**Avoids:** Pitfall 5 (overly broad permissions), Pitfall 7 (SPA navigation)

### Phase Ordering Rationale

- Content script injection is the only technically uncertain piece -- validate it first before building UI around it
- Storage and popup are standard Chrome extension patterns with zero uncertainty -- safe to build second
- Polish and packaging depend on everything else being stable
- All three phases are small; the entire project could realistically be a single phase, but splitting de-risks the iframe injection question

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Verify `all_frames: true` behavior with `player.vimeo.com` iframes on real third-party sites. Test whether Vimeo has changed iframe structure recently. This is the one area where real-world testing trumps documentation.

Phases with standard patterns (skip research-phase):
- **Phase 2:** `chrome.storage` API and popup UI are thoroughly documented with countless examples. No research needed.
- **Phase 3:** Standard Chrome extension packaging and distribution. Well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero dependencies, all Chrome platform APIs, official documentation covers everything |
| Features | HIGH | Clear competitive gap, well-defined scope from PROJECT.md, anti-features explicitly listed |
| Architecture | HIGH | Standard Chrome extension pattern, official docs confirm `all_frames` approach, reference implementations exist |
| Pitfalls | HIGH | Pitfalls verified against real issue trackers (igrigorik/videospeed), Chrome docs, and Vimeo SDK docs |

**Overall confidence:** HIGH

### Gaps to Address

- **Vimeo iframe structure changes**: Vimeo could change how embedded players work (e.g., switch from `player.vimeo.com` to a different domain, use shadow DOM). Mitigate by testing on real embedded videos early in Phase 1.
- **`ratechange` infinite loop risk**: If both the extension and Vimeo's player fight over `playbackRate`, there could be a rapid fire loop of `ratechange` events. Mitigate with a debounce or a flag to distinguish user-initiated changes.
- **Trademark considerations**: The removed "Vimeo Repeat & Speed" was pulled for trademark infringement. The name "Vimeo Gyorsito" includes "Vimeo" -- this may matter if publishing to Chrome Web Store. Mitigate by considering a name that does not include "Vimeo" for public distribution.

## Sources

### Primary (HIGH confidence)
- [Chrome Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Content Scripts Manifest Reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Chrome Service Worker Basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics)
- [Vimeo Player.js GitHub](https://github.com/vimeo/player.js/) -- version 2.30.3
- [Vimeo Help Center - Speed Controls](https://vimeo.zendesk.com/hc/en-us/articles/115012275447)

### Secondary (MEDIUM confidence)
- [Video Speed Controller (igrigorik/videospeed)](https://github.com/igrigorik/videospeed) -- reference implementation for `playbackRate` approach
- [Video Speed Controller - Speed Reset Issue #459](https://github.com/igrigorik/videospeed/issues/459)
- [Vimeo Player.js - Playback Rate Issue #465](https://github.com/vimeo/player.js/issues/465)
- [Vimeo Repeat & Speed removal](https://github.com/rudiedirkx/Vimeo-repeat/issues/19)

### Tertiary (LOW confidence)
- [SPA Support for Chrome Extensions](https://medium.com/@softvar/making-chrome-extension-smart-by-supporting-spa-websites-1f76593637e8) -- verify patterns against official docs

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
