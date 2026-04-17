# Threat Model: Browser Extension Attack Surface

This document covers the threats an extension like Mute Tube could pose if it were malicious — and documents the controls that prevent each one. It's structured as a standard threat model: asset → attacker → attack path → control → residual risk.

---

## Assets at Risk

| Asset | Description | Value to Attacker |
|---|---|---|
| YouTube session cookie | Authenticates the user's Google account | Account takeover, OAuth token theft |
| Keystrokes on youtube.com | Search queries, comments, potentially passwords if reused | Credential harvest |
| Browsing history | Every URL visited while extension is active | Surveillance, targeting |
| Local storage / IndexedDB | May contain auth tokens, preferences, session data | Session hijacking |
| Other open tabs | Content of non-YouTube pages if broad permissions were granted | Cross-site data theft |

---

## Threat Actors

**T1 — Malicious Extension Developer**
Ships a browser extension with hidden functionality. Legitimate use case is real (ad muting works), but background script exfiltrates data. Distribution via Chrome Web Store. Often discovered months after publication when a researcher reverse-engineers the extension.

**T2 — Supply Chain Attacker**
Compromises a dependency or gains access to the extension developer's publishing credentials. Ships a malicious update to an existing, trusted extension. Users auto-update silently. Mitigation window is the time between publish and detection.

**T3 — Insider / Rogue Contributor**
Open-source extension accepts a PR that adds a subtle exfiltration path. Reviewer misses it. Ships in the next version. Entropy analysis and manifest diffing are primary detections.

---

## Attack Paths

### Attack Path 1: Credential Harvest via Input Capture

```
Extension loaded on youtube.com
→ content.js enumerates input[type="password"] fields
→ addEventListener('keydown') attached to all matches
→ keystrokes buffered in chrome.storage.local
→ background.js batch-POSTs buffer to C2 every 60 seconds
```

**MITRE ATT&CK:** T1056.004 — Input Capture: Credential API Hooking

**Controls in Mute Tube:**
- `content.js` enumerates sensitive fields but reads NO values (research mode logs presence only)
- `connect-src 'none'` in CSP blocks all outbound connections — buffer cannot be exfiltrated
- `background.js` wraps `self.fetch` and rejects all calls — secondary enforcement
- YARA rule `Extension_Input_Capture` detects the pattern in source

**Residual Risk:** Low. CSP is enforced by the browser engine, not by extension code.

---

### Attack Path 2: Session Cookie Theft

```
Extension requests 'cookies' permission
→ chrome.cookies.getAll({ domain: '.youtube.com' })
→ Returns auth cookies including SSID, SID, HSID
→ Transmitted to attacker via XHR in background worker
```

**MITRE ATT&CK:** T1539 — Steal Web Session Cookie

**Controls in Mute Tube:**
- `cookies` permission is not declared in `manifest.json` — browser will not grant it
- `connect-src 'none'` blocks transmission even if cookies were read
- YARA rule `Extension_Cookie_Theft` detects access patterns

**Residual Risk:** None. Permission not declared = browser enforces denial at API level.

---

### Attack Path 3: Browsing History Surveillance

```
Extension requests 'tabs' permission
→ chrome.tabs.onUpdated fires on every navigation
→ tab.url logged with timestamp
→ Exfiltrated periodically to C2
```

**MITRE ATT&CK:** T1217 — Browser Information Discovery

**Controls in Mute Tube:**
- `tabs` permission not declared — `activeTab` is used instead (user-gesture-gated, ephemeral)
- No `tabs.onUpdated` listener in background.js
- YARA rule `Extension_Manifest_Permission_Overreach` flags `tabs` + `<all_urls>` combinations

**Residual Risk:** Low.

---

### Attack Path 4: Supply Chain Update

```
Attacker gains publishing credentials (phishing, credential reuse)
→ Ships background.js with added C2 fetch in chrome.tabs.onUpdated
→ Chrome auto-updates 200,000 installed instances silently
→ All users begin leaking browse history with no visible change
```

**MITRE ATT&CK:** T1195.002 — Compromise Software Supply Chain

**Controls in Mute Tube:**
- `connect-src 'none'` CSP blocks the exfil fetch — even the compromised version can't phone home
- `background.js` fetch wrapper logs and rejects the call
- `research/supply_chain_sim.js` documents detection via entropy analysis and manifest diff
- YARA rule `Extension_Supply_Chain_Remote_Script` detects dynamic script loading

**Residual Risk:** Medium. CSP is a strong control here, but defenders should also implement hash-pinning and monitor extension update events in their EDR.

---

### Attack Path 5: Cross-Origin Frame Manipulation

```
Extension content script runs in page context
→ Overrides window.top to neutralize frame-busting JS
→ Embeds target page in attacker-controlled iframe
→ Clickjacking attack proceeds against user
```

**MITRE ATT&CK:** T1185 — Browser Session Hijacking

**Controls in Mute Tube:**
- Content script is scoped to `*.youtube.com` only — cannot run on arbitrary sites
- Frame manipulation is documented in `research/dom_hijack_demo.js` as an educational artifact
- No such override exists in production `content.js`

**Residual Risk:** Low for this extension specifically. High for extensions with `<all_urls>`.

---

## Enterprise Deployment Controls

For organizations managing Chrome via policy:

**ExtensionInstallBlocklist / Allowlist**
Use `chrome.adm` Group Policy templates to whitelist only approved extensions by ID. Block all others. Default-deny is the correct posture.

**ExtensionInstallForcelist**
Force-install approved extensions from the CWS or a self-hosted update server. Users cannot remove them.

**Managed Configuration (chrome.storage.managed)**
Administrators can push JSON configuration to extensions that declare `storage` managed namespace. Mute Tube can be extended to read `chrome.storage.managed` for enterprise channel/blocklist controls without user-configurable overrides.

**Network Policy**
Block chrome.exe from initiating connections to domains registered less than 90 days ago. This catches the majority of extension C2 infrastructure.

---

## Security Test Results

| Test | Tool | Finding |
|---|---|---|
| Permission analysis | Manual manifest review | 2 permissions declared. Both justified. See `security/manifest_audit.md`. |
| CSP validation | Manual | `connect-src 'none'` enforced. No external script sources. |
| YARA scan | `yara -r security/extension.yar src/` | 0 matches. Clean. |
| Outbound connections | Browser DevTools Network tab | 0 external requests observed during normal operation. |
| Storage contents | `chrome.storage.local.get(null, console.log)` | Audit log and enabled state only. |

---

## What This Document Is For

Every extension is implicitly trusted by the browser. Users grant that trust at install time based on permission dialogs they rarely read. This threat model is the artifact a security engineer should produce before asking an organization to trust an extension — and it's the artifact you should demand before installing one.
