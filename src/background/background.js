const adSelectors = ['.video-ads', '.ytp-ad-player-overlay', '.ytp-ad-overlay-container'];

chrome.runtime.onInstalled.addListener(() => {
    console.log('YouTube Ad Muter Extension installed');
});