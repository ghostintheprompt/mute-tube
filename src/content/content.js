const adSelectors = [
    '.video-ads',
    '.ytp-ad-player-overlay',
    '.ytp-ad-overlay-container',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '[class*="ad-showing"]'
];

// Selectors for DOM elements considered sensitive in a security context.
// Research Mode uses these to demonstrate how extensions can enumerate credential surfaces —
// the same technique used by malicious extensions performing input capture (T1056.004).
const SENSITIVE_SELECTORS = [
    'input[type="password"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="current-password"]',
    'input[autocomplete="new-password"]',
    'input[name*="token"]',
    'input[name*="secret"]',
    'input[name*="api_key"]',
    'meta[name="csrf-token"]',
    'meta[name*="token"]'
];

let originalVolume = 1;
let isAdPlaying = false;
let researchModeActive = false;
let sensitivityScanDone = false;

function detectAndMuteAds() {
    const video = document.querySelector('video');
    const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, [aria-label*="Skip"]');
    const adOverlay = document.querySelector('.ytp-ad-player-overlay, .video-ads');

    if (adOverlay && video) {
        if (!isAdPlaying) {
            originalVolume = video.volume;
            isAdPlaying = true;
            sendAuditEvent('AD_DETECTED', { url: location.href });
        }
        video.muted = true;
        if (skipButton && skipButton.offsetParent !== null) {
            skipButton.click();
        }
    } else if (isAdPlaying && video) {
        video.muted = false;
        video.volume = originalVolume;
        isAdPlaying = false;
        sendAuditEvent('AD_ENDED', { url: location.href });
    }
}

// Research Mode: enumerate sensitive DOM elements and report their presence (not their values).
// Demonstrates the attack surface available to any content script running on this page.
// A malicious extension would read .value here. This one only counts and reports element types.
function runSensitivityScan() {
    if (sensitivityScanDone) return;
    sensitivityScanDone = true;

    const findings = [];

    for (const selector of SENSITIVE_SELECTORS) {
        const matches = document.querySelectorAll(selector);
        if (matches.length > 0) {
            findings.push({
                selector,
                count: matches.length,
                tagNames: [...matches].map(el => el.tagName.toLowerCase())
            });
        }
    }

    if (findings.length > 0) {
        sendAuditEvent('SENSITIVE_DOM_FLAGGED', {
            url: location.hostname,
            findings,
            note: 'Presence only. No values read or transmitted.'
        });
    }
}

function sendAuditEvent(event, detail) {
    chrome.runtime.sendMessage({ type: 'AUDIT_EVENT', event, detail }).catch(() => {
        // Service worker may be inactive; non-critical.
    });
}

// Core loop
setInterval(detectAndMuteAds, 500);
const observer = new MutationObserver(detectAndMuteAds);
observer.observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'toggle') {
        if (!message.enabled) {
            observer.disconnect();
        } else {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }
    if (message.action === 'skip') {
        const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, [aria-label*="Skip"]');
        if (skipButton) skipButton.click();
    }
    if (message.action === 'mute') {
        const video = document.querySelector('video');
        if (video) video.muted = message.muted;
    }
    if (message.action === 'researchMode') {
        researchModeActive = message.enabled;
        if (researchModeActive) runSensitivityScan();
    }
});
