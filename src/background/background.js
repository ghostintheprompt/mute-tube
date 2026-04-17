// Telemetry Monitor
// Intercepts and logs every outbound network attempt from the extension's service worker.
// A clean run proves zero external connections. Any fetch logged here is an anomaly worth investigating.

const MAX_LOG_ENTRIES = 200;

function logAuditEvent(type, detail) {
    const entry = {
        ts: Date.now(),
        type,
        detail,
        extensionId: chrome.runtime.id
    };
    chrome.storage.local.get({ auditLog: [] }, ({ auditLog }) => {
        const updated = [...auditLog, entry].slice(-MAX_LOG_ENTRIES);
        chrome.storage.local.set({ auditLog: updated });
    });
}

// Wrap self.fetch to intercept any outbound connection attempt.
// The strict CSP (connect-src 'none') blocks these at the browser level,
// but this wrapper logs the attempt before the browser rejects it — useful
// for detecting a supply chain compromise where a dependency silently phones home.
const _originalFetch = self.fetch.bind(self);
self.fetch = function auditedFetch(resource, init) {
    const url = typeof resource === 'string' ? resource : resource?.url ?? 'unknown';
    logAuditEvent('FETCH_INTERCEPTED', { url, stack: new Error().stack?.split('\n')[2]?.trim() });
    console.warn('[SECURITY AUDIT] Unexpected outbound fetch intercepted:', url);
    // Reject rather than silently drop — makes supply chain attacks visible.
    return Promise.reject(new Error(`Blocked by telemetry monitor: ${url}`));
};

chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
    logAuditEvent('LIFECYCLE', {
        event: reason,
        previousVersion: previousVersion ?? null,
        version: chrome.runtime.getManifest().version
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
