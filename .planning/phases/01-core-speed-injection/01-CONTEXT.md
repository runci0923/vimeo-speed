# Phase 1: Core Speed Injection - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Content script that finds and controls Vimeo video playback speed across vimeo.com and embedded iframes on third-party sites. Uses hardcoded default speed (no UI yet). Phase 2 adds the popup UI and user-configurable speed.

</domain>

<decisions>
## Implementation Decisions

### Default speed value
- Hardcoded 1.5x in Phase 1 (no storage, no UI yet)
- Phase 2 will introduce chrome.storage and popup for user configuration

### Speed enforcement
- Re-apply speed immediately when Vimeo player resets it (ratechange event)
- Throttle to max 10 retries per second to prevent infinite loops
- Cover all reset triggers: seek, pause, quality change, buffering

### Visual feedback
- Silent operation — no toast, overlay, or visual indication on the video
- Speed change happens invisibly to the user

### Speed range limits
- Minimum: 0.5x
- Maximum: 4x
- These limits apply to Phase 2's UI as well (preset buttons and free input validation)

### Claude's Discretion
- MutationObserver strategy for detecting dynamically loaded video elements
- Debounce/throttle implementation details for the ratechange listener
- run_at timing (document_idle vs document_end)
- Whether to use match_origin_as_fallback for edge-case iframe configs

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key insight from research: use direct `video.playbackRate` (not Vimeo Player SDK) and `all_frames: true` with `*://player.vimeo.com/*` match pattern.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project

### Established Patterns
- None — first phase establishes patterns

### Integration Points
- manifest.json defines the extension structure
- Content script runs in both vimeo.com and player.vimeo.com contexts

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-speed-injection*
*Context gathered: 2026-03-06*
