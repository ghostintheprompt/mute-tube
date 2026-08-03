const AD_STATE_SELECTORS = [
    '.ad-showing',
    '.ytp-ad-player-overlay',
    '.ytp-ad-preview-container',
    '.ytp-ad-module',
    '.ytp-ad-text',
    '.ytp-ad-simple-ad-badge',
    '.ytp-ad-image-overlay',
    '.ytp-ad-overlay-container',
    '.video-ads',
    '[class*="ad-showing"]'
];

const SKIP_BUTTON_SELECTORS = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    'button.ytp-skip-ad-button',
    '[class*="ytp-ad-skip"]',
    'button[aria-label^="Skip"]',
    'button[aria-label*="Skip ad"]'
];

// Selectors for DOM elements considered sensitive in a security context.
// Research Mode reports presence only. Production code must never read values.
const SENSITIVE_SELECTORS = [
    'input[type="password"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="current-password"]',
    'input[name*="token"]',
    'input[name*="secret"]',
    'input[name*="api_key"]',
    'meta[name="csrf-token"]',
    'meta[name*="token"]'
];

let savedVideoState = null;
let isAdPlaying = false;
let extensionEnabled = true;
let researchModeActive = false;
let sensitivityScanDone = false;
let observer = null;
let pollId = null;

function getVideo() {
    return document.querySelector('video');
}

function getPlayer() {
    return document.querySelector('#movie_player, .html5-video-player');
}

function isVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function queryVisible(selectors) {
    for (const selector of selectors) {
        const match = [...document.querySelectorAll(selector)].find(isVisible);
        if (match) return match;
    }
    return null;
}

function isAdActive() {
    const player = getPlayer();
    if (player?.classList?.contains('ad-showing')) return true;
    return Boolean(queryVisible(AD_STATE_SELECTORS));
}

function findSkipButton() {
    return queryVisible(SKIP_BUTTON_SELECTORS);
}

function pageContext() {
    return {
        host: location.hostname,
        path: location.pathname
    };
}

function rememberVideoState(video) {
    if (savedVideoState) return;
    savedVideoState = {
        muted: video.muted,
        volume: video.volume
    };
}

function restoreVideoState(video) {
    if (!savedVideoState || !video) return;
    video.muted = savedVideoState.muted;
    video.volume = savedVideoState.volume;
    savedVideoState = null;
}

function clickSkipIfAvailable() {
    const skipButton = findSkipButton();
    if (skipButton && !skipButton.disabled) {
        skipButton.click();
        sendAuditEvent('SKIP_CLICKED', pageContext());
    }
}

function detectAndMuteAds() {
    if (!extensionEnabled) return;

    const video = getVideo();
    const adActive = isAdActive();

    if (adActive && video) {
        if (!isAdPlaying) {
            rememberVideoState(video);
            isAdPlaying = true;
            sendAuditEvent('AD_DETECTED', pageContext());
        }
        video.muted = true;
        clickSkipIfAvailable();
        return;
    }

    if (isAdPlaying && video) {
        restoreVideoState(video);
        isAdPlaying = false;
        sendAuditEvent('AD_ENDED', pageContext());
    }
}

function runSensitivityScan() {
    if (sensitivityScanDone) return;
    sensitivityScanDone = true;

    const findings = [];

    for (const selector of SENSITIVE_SELECTORS) {
        const matches = [...document.querySelectorAll(selector)];
        if (matches.length > 0) {
            findings.push({
                selector,
                count: matches.length,
                tagNames: matches.map(el => el.tagName.toLowerCase()),
                fieldTypes: matches.map(el => el.getAttribute('type') || el.tagName.toLowerCase())
            });
        }
    }

    if (findings.length > 0) {
        sendAuditEvent('SENSITIVE_DOM_FLAGGED', {
            ...pageContext(),
            findings,
            note: 'Presence-only scan. Values are not read or stored.'
        });
    }
}

function sendAuditEvent(event, detail = {}) {
    try {
        const result = chrome.runtime.sendMessage({ type: 'AUDIT_EVENT', event, detail });
        if (result?.catch) result.catch(() => {
            // Service worker may be inactive; non-critical.
        });
    } catch {
        // Extension context may be unavailable during page teardown.
    }
}

function startMonitoring() {
    if (!document.body) {
        window.setTimeout(startMonitoring, 100);
        return;
    }

    if (!observer) {
        observer = new MutationObserver(detectAndMuteAds);
    }

    observer.disconnect();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-label'] });

    if (!pollId) {
        pollId = window.setInterval(detectAndMuteAds, 500);
    }

    detectAndMuteAds();
}

function stopMonitoring() {
    if (observer) observer.disconnect();
    if (pollId) {
        window.clearInterval(pollId);
        pollId = null;
    }

    if (isAdPlaying) {
        restoreVideoState(getVideo());
        isAdPlaying = false;
    }
}

function setEnabled(enabled) {
    extensionEnabled = Boolean(enabled);
    chrome.storage?.local?.set({ enabled: extensionEnabled });

    if (extensionEnabled) {
        startMonitoring();
    } else {
        stopMonitoring();
    }

    sendAuditEvent(extensionEnabled ? 'EXTENSION_ENABLED' : 'EXTENSION_DISABLED', pageContext());
}

chrome.storage?.local?.get({ enabled: true }, ({ enabled }) => {
    extensionEnabled = Boolean(enabled);
    if (extensionEnabled) startMonitoring();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    if (message.action === 'toggle') {
        setEnabled(message.enabled);
        sendResponse?.({ ok: true, enabled: extensionEnabled });
        return false;
    }

    if (message.action === 'skip') {
        clickSkipIfAvailable();
        sendResponse?.({ ok: true });
        return false;
    }

    if (message.action === 'mute') {
        const video = getVideo();
        if (video) video.muted = Boolean(message.muted);
        sendResponse?.({ ok: Boolean(video), muted: Boolean(message.muted) });
        return false;
    }

    if (message.action === 'getState') {
        sendResponse?.({ ok: true, enabled: extensionEnabled, isAdPlaying });
        return false;
    }

    if (message.action === 'researchMode') {
        researchModeActive = Boolean(message.enabled);
        if (researchModeActive) runSensitivityScan();
        sendResponse?.({ ok: true, researchModeActive });
        return false;
    }

    return false;
});
