<p align="center">
  <img src="mute_tube.png" width="520">
</p>

# Mute Tube
A lightweight Chrome extension that automatically mutes YouTube ads and skips them when possible. — v2.1.0

## 2026 Maintenance Status

Current as of 2026-08-03:

- Manifest V3
- No remote extension code
- No outbound extension network access (`connect-src 'none'`)
- Production content script does not read form/input values
- Content script is scoped to `www.youtube.com`, `m.youtube.com`, and `music.youtube.com`
- Popup includes a small security deck for enabled state, network policy, and audit-log count
- `npm test` runs a local validator for manifest, CSP, permissions, and production-code privacy boundaries

## What It Does

- Auto-mutes YouTube ads the moment they start
- Auto-clicks skip buttons as soon as they appear
- Restores your original volume when the ad ends
- Runs silently. Zero configuration.

## Installation

1. Clone this repo
2. Open Chrome → `chrome://extensions/`
3. Enable Developer mode (top right toggle)
4. Click "Load unpacked" → select the extension folder
5. Done.

## How It Works

Content scripts watch the YouTube DOM for ad state changes. When an ad loads, the extension mutes the player and clicks skip the moment the button is available. When the ad ends, volume is restored.

```javascript
const adSelectors = [
    '.ad-showing',
    '.video-ads',
    '.ytp-ad-player-overlay',
    '.ytp-ad-preview-container',
    '.ytp-ad-module',
    '.ytp-ad-overlay-container',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '[class*="ad-showing"]'
];
```

That selector list is a changelog. Every entry represents a round where YouTube changed a class name and the extension adapted. Class rotation is YouTube's cheapest defensive move. Wildcard matching is the counter.

The extension runs a MutationObserver plus a 500ms interval while enabled — both simultaneously — because YouTube's different ad types mutate the DOM in different patterns. One approach misses what the other catches. Disabling the extension stops both watchers and restores the pre-ad mute/volume state.

## The More Interesting Point

The app working is not the point.

The point is what you learn by watching a trillion-dollar company respond to a browser extension. YouTube's escalation — class name rotation, behavioral timing detection, server-side ad injection — follows the same pattern as any large defended system under persistent low-level adversarial pressure. Probe it. Watch how it responds. Probe differently. Watch again.

Phase one responses are cheap: rename the identifier, break the hardcoded selector. Phase two is behavioral: detect mechanical timing patterns that humans don't produce. Phase three is infrastructure-level spend: move the problem upstream of where client-side code can reach it.

Every large system has a cost ceiling — a point where the defense costs more than the business case supports. Understanding where that ceiling is, and what pressure it takes to reach it, is the methodology behind security auditing at scale.

This extension is a live, observable case study in that methodology. YouTube is a public target. The responses are visible in the DOM. The breakage is documented in the commit history. The escalation is real.

Full breakdown: [ghostintheprompt.com/articles/mute-tube](https://ghostintheprompt.com/articles/mute-tube)

## Security Proving Ground

Browser extensions are one of the highest-privilege, least-audited attack surfaces in an enterprise environment. Most users install them without reading the source. Most companies don't audit them at all. This section documents Mute Tube as a reference implementation for what a hardened extension looks like — and why.

### Permissions

Two. `activeTab` and `storage`. That's the entire API permission surface. The content script is explicitly scoped to the YouTube surfaces it needs.

`activeTab` is user-gesture-gated and ephemeral. It grants temporary access to the active tab only when the user clicks the popup — and only for that tab, for that moment. It cannot enumerate other tabs, read browse history, or persist across navigations. It is the narrowest tab permission Chrome offers.

`storage` is used exclusively for the internal audit log and the enabled toggle. No user-identifiable data. No sensitive content.

Every permission that isn't declared is a permission the browser will deny at the API level regardless of what the code tries. See `security/manifest_audit.md` for the full justification.

### Content Security Policy

```
connect-src 'none'
```

This directive blocks every outbound network connection from extension pages — fetch, XHR, WebSocket, EventSource. The browser enforces it, not the extension code. A supply chain compromise that injects a credential-exfiltrating `fetch()` call into `background.js` cannot transmit anything. The attempt is blocked and logged.

`script-src 'self'` blocks inline script execution and external script loading. `object-src 'none'` eliminates plugin execution. The full policy is in `manifest.json`.

### Telemetry Monitor

`src/background/background.js` wraps `self.fetch` with an auditing interceptor. Any outbound fetch attempt — from extension code or an injected dependency — is logged to `chrome.storage.local` and rejected. The audit log is accessible from the popup's security dashboard.

A clean install produces a log containing one entry: the `INSTALL` lifecycle event. Nothing else. That is the proof.

### Research Lab

`research/` contains documented demonstrations of the attacks this extension's architecture defends against:

- `dom_hijack_demo.js` — shows how a content script enumerates password fields and observes change events (T1056.004). Values are never read. The code shows the attack structure a defender needs to recognize.
- `supply_chain_sim.js` — simulates what a malicious background.js update looks like, with entropy analysis and manifest diff tooling for detection. Network simulation is dry-run unless explicitly armed in a controlled lab.

### YARA Rules

`security/extension.yar` contains seven rules covering: outbound fetch calls, input capture patterns, cookie theft, permission overreach, remote script loading, runtime messaging abuse, and storage accumulation. Written against the specific techniques demonstrated in the research lab.

To scan this repo:
```bash
yara -r security/extension.yar src/
```
Expected output: zero matches.

Built-in validation:

```bash
npm test
```

Expected output:

```text
Mute Tube validation passed.
```

### Threat Model

`docs/THREAT_MODEL.md` maps five attack paths against this extension's architecture — credential harvest, session theft, history surveillance, supply chain update, and frame manipulation — with MITRE ATT&CK references, specific controls, and residual risk assessment.

---

## File Structure

```
├── manifest.json             # Minimal permissions + strict CSP
├── src/
│   ├── content/              # Runs on YouTube pages
│   ├── background/           # Service worker + telemetry monitor
│   ├── popup/                # Extension UI
│   └── utils/                # Helpers
├── security/
│   ├── manifest_audit.md     # Permission justification (PoLP)
│   └── extension.yar         # YARA detection rules
├── research/
│   ├── dom_hijack_demo.js    # Input capture technique demo
│   └── supply_chain_sim.js   # Malicious update simulation
└── docs/
    └── THREAT_MODEL.md       # Full attack surface analysis
```

## Contributing

YouTube changed something and it broke? Open an issue or submit a PR. That is how this has always worked. Hit the big boys in the pocket. Let them feel it. 

## Read It Before You Trust It

This extension touches YouTube pages you visit. Read `src/content/content.js` before you install it. It should take ten minutes to verify. If something surprises you, open an issue.

occhio per occhio dente per dente
