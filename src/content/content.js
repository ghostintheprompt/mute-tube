const adSelectors = [
    '.video-ads',
    '.ytp-ad-player-overlay', 
    '.ytp-ad-overlay-container',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '[class*="ad-showing"]'
];

let originalVolume = 1;
let isAdPlaying = false;

function detectAndMuteAds() {
    const video = document.querySelector('video');
    const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, [aria-label*="Skip"]');
    
    // Check if ad is playing
    const adOverlay = document.querySelector('.ytp-ad-player-overlay, .video-ads');
    
    if (adOverlay && video) {
        if (!isAdPlaying) {
            originalVolume = video.volume;
            isAdPlaying = true;
        }
        video.muted = true;
        
        // Auto-click skip button if available
        if (skipButton && skipButton.offsetParent !== null) {
            skipButton.click();
        }
    } else if (isAdPlaying && video) {
        // Ad finished, restore volume
        video.muted = false;
        video.volume = originalVolume;
        isAdPlaying = false;
    }
}

// Run checks every 500ms
setInterval(detectAndMuteAds, 500);

// Also monitor DOM changes
const observer = new MutationObserver(detectAndMuteAds);
observer.observe(document.body, { childList: true, subtree: true });