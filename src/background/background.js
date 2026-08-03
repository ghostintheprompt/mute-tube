// Telemetry Monitor
// Intercepts and logs every outbound network attempt from the extension's service worker.
// A clean run proves zero external connections. Any fetch logged here is an anomaly worth investigating.

const MAX_LOG_ENTRIES = 200;
const MAX_STRING_LENGTH = 300;
const SENSITIVE_KEY_PATTERN = /(password|passwd|pwd|secret|token|cookie|authorization|api[_-]?key|value)/i;

function sanitizeDetail(value, depth = 0) {
    if (depth > 4) return '[depth-limit]';
    if (value == null) return value;
    if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 25).map(item => sanitizeDetail(item, depth + 1));
    if (typeof value !== 'object') return String(value).slice(0, MAX_STRING_LENGTH);

    const cleaned = {};
    for (const [key, childValue] of Object.entries(value)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            cleaned[key] = '[redacted]';
            continue;
        }
        cleaned[key] = sanitizeDetail(childValue, depth + 1);
    }
    return cleaned;
}

function logAuditEvent(type, detail) {
    const entry = {
        ts: Date.now(),
        type: String(type || 'UNKNOWN').slice(0, 80),
        detail: sanitizeDetail(detail || {}),
        extensionId: chrome.runtime.id
    };
    chrome.storage.local.get({ auditLog: [] }, ({ auditLog }) => {
        const updated = [...auditLog, entry].slice(-MAX_LOG_ENTRIES);
        chrome.storage.local.set({ auditLog: updated });
    });
}

// Wrap self.fetch to intercept any outbound connection attempt.
// The strict CSP (connect-src 'none') blocks these at the browser level,
// but this wrapper logs the attempt before the browser rejects it.
// RESTORATION: Functional incident reporting (INC-001).
const _originalFetch = self.fetch.bind(self);
self.fetch = function auditedFetch(resource, init) {
    const url = typeof resource === 'string' ? resource : resource?.url ?? 'unknown';
    
    // SCENARIO INC-001: Telemetry Alert for unexpected outbound connection
    logAuditEvent('INCIDENT_INC-001', { 
        url, 
        stack: new Error().stack?.split('\n')[2]?.trim(),
        note: 'High-fidelity alert triggered by UIP V1.5 mandate.'
    });
    
    console.warn('[SECURITY INC-001] Unexpected outbound fetch intercepted:', url);
    
    // Reject rather than silently drop — makes supply chain attacks visible.
    return Promise.reject(new Error(`Blocked by telemetry monitor (INC-001): ${url}`));
};

chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
    logAuditEvent('LIFECYCLE', {
        event: reason,
        previousVersion: previousVersion ?? null,
        version: chrome.runtime.getManifest().version
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    switch (message.type) {
        case 'AUDIT_EVENT':
            logAuditEvent(message.event, message.detail);
            break;
        case 'GET_AUDIT_LOG':
            chrome.storage.local.get({ auditLog: [] }, ({ auditLog }) => {
                sendResponse({ log: auditLog });
            });
            return true; // keep channel open for async response
        case 'CLEAR_AUDIT_LOG':
            chrome.storage.local.set({ auditLog: [] });
            sendResponse({ cleared: true });
            break;
    }
});
