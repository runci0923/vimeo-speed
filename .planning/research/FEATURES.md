# Feature Research

**Domain:** Chrome Extension -- Vimeo Video Speed Control
**Researched:** 2026-03-06
**Confidence:** HIGH

## Competitive Landscape

The Vimeo speed control extension space has a clear gap. The dominant player, "Video Speed Controller" (igrigorik, 3M+ users), is a generic all-site HTML5 video speed tool -- powerful but not Vimeo-focused. The only Vimeo-specific extension, "Vimeo Repeat & Speed" (100K+ users), was removed from the Chrome Web Store in July 2022 for trademark infringement and has no replacement. This leaves a clear opening for a focused, Vimeo-only speed extension.

### Vimeo Native Speed Control Limitations

Vimeo's built-in speed control offers 0.5x, 0.75x, 1x, 1.25x, 1.5x, and 2x. Critical limitations:

- **Does NOT remember speed between videos** -- this is the core pain point
- **Maximum 2x** -- no higher speeds available
- **Requires manual interaction** every time via gear icon > Speed menu
- **Only available on Pro/Business/Premium uploaded videos** -- video owner must enable it
- **Can be disabled by video owner** in embed settings

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Set default playback speed | Core value proposition -- the entire reason the extension exists. Every competitor offers this. | LOW | Store in chrome.storage.sync so it persists across devices |
| Preset speed buttons (1x, 1.25x, 1.5x, 1.75x, 2x) | Users expect quick one-tap selection of common speeds. All competitors offer preset buttons. | LOW | Match Vimeo's native presets plus 1.75x which Vimeo lacks |
| Persist setting across browser sessions | Users set it once and forget. If speed resets on browser restart, extension is broken. | LOW | chrome.storage.sync handles this automatically |
| Auto-apply speed on video load | The "gyorsito" (accelerator) promise. Video must start at chosen speed without user action. | MEDIUM | Content script must detect video element, set playbackRate. Needs MutationObserver for SPAs and dynamically loaded players |
| Work on vimeo.com | Basic platform support. Users watch videos on vimeo.com directly. | LOW | Content script with match pattern for vimeo.com |
| Work on embedded Vimeo players (iframes) | PROJECT.md explicitly states this. The club site uses embedded Vimeo. This is the primary use case. | HIGH | Requires content script injected into iframes via all_frames:true in manifest, or matching player.vimeo.com in content_scripts. MV3 complicates iframe injection. |
| Simple popup UI for speed selection | Users need a way to change their default speed. Popup is the standard Chrome extension UX. | LOW | HTML popup with speed buttons and custom input field |

### Differentiators (Competitive Advantage)

Features that set the product apart from generic speed controllers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Custom speed input (e.g., 1.3x, 2.5x) | Vimeo caps at 2x and only offers fixed presets. Generic controllers use keyboard increment (imprecise). Direct numeric input is faster for "I always want 1.7x" users. | LOW | Simple number input field in popup, validate range 0.25-4x |
| Speeds beyond 2x (up to 4x) | Vimeo native maxes at 2x. Power users consuming educational content want 2.5x-3x. The removed "Vimeo Repeat & Speed" extension supported this. | LOW | HTML5 video.playbackRate supports up to 16x natively, but audio becomes unusable above 4x. Cap at 4x. |
| Zero-config operation | Unlike Video Speed Controller (requires learning keyboard shortcuts, understanding overlay), this extension should work immediately after install with sensible default (1x). Set desired speed in popup, done forever. | LOW | This is a design philosophy, not a feature to build. Keep UI minimal. |
| Instant speed indicator badge | Show current speed on extension icon badge so user always knows what speed is set without opening popup. | LOW | chrome.action.setBadgeText in service worker |
| Works even when video owner disables speed controls | Vimeo lets video owners disable the speed menu. But HTML5 playbackRate still works on the underlying video element. Extension bypasses this limitation. | LOW | Direct video.playbackRate manipulation, not dependent on Vimeo UI |

### Anti-Features (Deliberately NOT Building)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Per-video speed memory | "Remember I watch this lecture at 1.5x but that music video at 1x" | Massively increases complexity (need video ID tracking, storage schema, lookup logic). PROJECT.md explicitly scopes this out. The use case is "always the same speed for all videos." | Single global default speed. User can temporarily change in Vimeo's native controls if needed for one video. |
| Video overlay/on-screen controls | "Show speed buttons on the video like Video Speed Controller does" | Adds visual clutter, risks breaking Vimeo's player UI, requires CSS injection that may conflict with Vimeo updates. PROJECT.md explicitly excludes this. For a "set once" tool, overlay is unnecessary. | Popup UI for the rare speed change. Badge shows current speed. |
| Keyboard shortcuts for speed change | Video Speed Controller's core UX. Power users love D/S for increment/decrement. | Adds complexity, potential conflicts with Vimeo's own shortcuts, requires options page for customization. Overkill for "set and forget" use case. | Popup is sufficient for occasional changes. |
| Support for YouTube/Netflix/other platforms | "Why only Vimeo? Make it universal!" | Scope creep. Generic speed controllers already exist (Video Speed Controller has 3M users). Competing with them is pointless. Vimeo-only focus is the value prop. | Stay Vimeo-only. Recommend Video Speed Controller for other platforms. |
| Repeat/loop functionality | The removed "Vimeo Repeat & Speed" had this. | Different use case (music listeners, not course consumers). Adds UI complexity for a feature the target user does not need. | Vimeo has native loop controls. |
| Speed profiles (e.g., "Learning mode 1.5x", "Review mode 2x") | Seems organized and user-friendly | Over-engineering for a single-value setting. The user wants ONE speed, always. If they change it, they change the one global value. | Single speed value. |
| Pitch correction at high speeds | Transpose extension does this for musicians | Requires Web Audio API integration, significantly increases complexity. Course content is speech -- pitch shift at 1.5-2x is acceptable without correction. | Not needed for the target use case. |

## Feature Dependencies

```
[Chrome Storage (persist speed)]
    └──required-by──> [Popup UI (read/write speed)]
    └──required-by──> [Content Script (read speed, apply to video)]

[Content Script (find video element)]
    └──required-by──> [Auto-apply speed on load]
    └──required-by──> [Embedded iframe support]

[Service Worker]
    └──required-by──> [Badge text update]
    └──listens-to──> [Storage change events]
```

### Dependency Notes

- **Popup UI requires Chrome Storage:** Popup reads current speed and writes new speed to storage.
- **Content Script requires Chrome Storage:** Content script reads the saved speed to apply it to video elements.
- **Auto-apply requires Content Script:** Must detect video element before setting playbackRate.
- **Iframe support requires Content Script with all_frames:** The content script must be configured to run inside iframes (player.vimeo.com) not just the top-level page.
- **Badge requires Service Worker:** Service worker listens for storage changes and updates badge text.

## MVP Definition

### Launch With (v1)

Minimum viable product -- validates the core value proposition.

- [x] Popup UI with preset speed buttons (1x, 1.25x, 1.5x, 1.75x, 2x) -- covers 90% of users
- [x] Custom speed input field (0.25x - 4x) -- covers power users
- [x] Persist speed in chrome.storage.sync -- survives browser restart, syncs across devices
- [x] Content script auto-applies speed on vimeo.com -- core functionality
- [x] Content script auto-applies speed on embedded Vimeo iframes -- primary use case (club site)
- [x] Extension icon badge showing current speed -- instant visibility

### Add After Validation (v1.x)

Features to add once core is proven working.

- [ ] Speed adjustment via right-click context menu -- alternative access method if popup feels slow
- [ ] Per-domain enable/disable -- if users want extension active only on specific sites with embeds
- [ ] "Speed applied" visual confirmation -- brief toast/flash when speed is set on a video

### Future Consideration (v2+)

- [ ] Firefox port -- if there is demand beyond Chrome
- [ ] Localization (Hungarian primary, English) -- if published to Chrome Web Store for wider audience

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auto-apply saved speed to Vimeo videos | HIGH | MEDIUM | P1 |
| Popup UI with presets + custom input | HIGH | LOW | P1 |
| Persist speed in chrome.storage | HIGH | LOW | P1 |
| Embedded iframe support | HIGH | MEDIUM | P1 |
| Extension badge with current speed | MEDIUM | LOW | P1 |
| Speeds beyond 2x (up to 4x) | MEDIUM | LOW | P1 |
| Per-domain enable/disable | LOW | MEDIUM | P3 |
| Context menu speed control | LOW | LOW | P3 |
| Firefox support | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Video Speed Controller (igrigorik) | Vimeo Repeat & Speed (removed) | Vimeo Native | Our Approach |
|---------|-----------------------------------|--------------------------------|--------------|--------------|
| Speed range | 0.07x - 16x | Custom input | 0.5x - 2x | 0.25x - 4x (practical range) |
| Remember speed | Yes (per-domain or global) | Yes (via options) | NO | Yes (global, chrome.storage.sync) |
| Auto-apply | Via "preferred speed" shortcut | Via default speed option | NO | Automatic, zero-interaction |
| UI approach | Video overlay + keyboard shortcuts | Button on Vimeo player | Gear menu > Speed | Popup + badge (minimal, non-intrusive) |
| Vimeo-specific | No (generic for all sites) | Yes | N/A (is Vimeo) | Yes (Vimeo-only, optimized) |
| Embedded support | Yes (any HTML5 video) | Vimeo.com only | Depends on owner settings | Yes (vimeo.com + embedded iframes) |
| Setup required | Learn shortcuts, configure settings | Set default in options | Click through menus each time | Install, set speed once, done |
| Manifest version | MV2 (may face deprecation) | MV2 (removed from store) | N/A | MV3 (future-proof) |
| Permissions | All URLs (broad) | vimeo.com only | N/A | vimeo.com + player.vimeo.com (minimal) |

## Sources

- [Video Speed Controller - Chrome Web Store](https://chromewebstore.google.com/detail/video-speed-controller/nffaoalbilbmmfgbnbgppjihopabppdk) -- MEDIUM confidence (verified features via Chrome Web Store listing)
- [Video Speed Controller - GitHub (igrigorik)](https://github.com/igrigorik/videospeed) -- HIGH confidence (source code and README)
- [Vimeo Repeat & Speed - chrome-stats.com](https://chrome-stats.com/d/noonakfaafcdaagngpjehilgegefdima) -- MEDIUM confidence (extension removed, stats from archive)
- [Vimeo Repeat & Speed removal issue - GitHub](https://github.com/rudiedirkx/Vimeo-repeat/issues/19) -- HIGH confidence (primary source for removal reason)
- [Vimeo Help Center - About playback speed controls](https://vimeo.zendesk.com/hc/en-us/articles/115012275447-About-playback-speed-controls) -- HIGH confidence (official Vimeo documentation)
- [Vimeo OTT - Player speed controls](https://support.vhx.tv/article/945-player-speed-controls) -- MEDIUM confidence (Vimeo OTT-specific, may differ)
- [7 Best Video Speed Controller Extensions for Chrome](https://fixthephoto.com/best-video-speed-controller-chrome-extension.html) -- LOW confidence (roundup article)

---
*Feature research for: Vimeo Gyorsito -- Chrome Extension for Vimeo Speed Control*
*Researched: 2026-03-06*
