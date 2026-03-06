# Chrome Web Store Publishing Guide

## Prerequisites

1. Google Developer account ($5 one-time fee)
   - Register at: https://chrome.google.com/webstore/devconsole/register
   - Use any Google account

## Files Ready

| File | Purpose | Status |
|------|---------|--------|
| `vimeo-gyorsito.zip` | Extension package (upload this) | Ready |
| `store/description.txt` | Store listing description | Ready |
| `store/privacy-policy.html` | Privacy policy (host somewhere) | Ready |
| `store/promo-small-440x280.png` | Small promo tile | Ready |
| `icons/icon128.png` | Store icon | Ready |

## Still Needed (you provide)

- **Screenshots** (1280x800 or 640x400) — take 2-3 screenshots showing:
  1. Video playing with speed overlay visible
  2. Popup panel open showing speed settings
  3. Embedded video on your club site with overlay
- **Privacy policy URL** — host `privacy-policy.html` somewhere (GitHub Pages, your website, etc.)

## Publishing Steps

1. Go to https://chrome.google.com/webstore/devconsole
2. Click "New Item"
3. Upload `vimeo-gyorsito.zip`
4. Fill in listing:
   - **Language:** English (or Hungarian)
   - **Description:** Copy from `store/description.txt`
   - **Category:** Productivity
   - **Icon:** Already in the ZIP
   - **Screenshots:** Upload your screenshots
   - **Small promo tile:** Upload `store/promo-small-440x280.png`
5. Privacy practices:
   - "Does your extension use remote code?" → No
   - "Does your extension collect user data?" → No
   - Privacy policy URL → your hosted URL
6. Click "Submit for Review"

## Review Timeline

- Typically 1-3 business days
- May take longer for first submission
- "Vimeo" in the name might trigger trademark review — if rejected, rename to "Video Speed for Vimeo" or similar

## After Publishing

Share the Chrome Web Store link with your club members. They click "Add to Chrome" and it just works — no Developer mode needed.
