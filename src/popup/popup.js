document.addEventListener('DOMContentLoaded', function() {
    const statusDisplay = document.getElementById('status');
    const toggleBtn = document.getElementById('toggle-btn');
    const skipBtn = document.getElementById('skip-btn');
    const muteBtn = document.getElementById('mute-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const muteLed = document.querySelector('.mute-led');
    
    let isEnabled = true;
    let isMuted = false;
    
    // Initialize display
    updateStatus();
    
    // Toggle extension on/off
    toggleBtn.addEventListener('click', function() {
        isEnabled = !isEnabled;
        toggleBtn.classList.toggle('active', isEnabled);
        updateStatus();
        
        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggle',
                enabled: isEnabled
            });
        });
    });
    
    // Skip current ad
    skipBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'skip'
            });
        });
        
        // Visual feedback
        skipBtn.style.background = 'linear-gradient(135deg, #ff6b35, #e55a2b)';
        setTimeout(() => {
            skipBtn.style.background = '';
        }, 200);
    });
    
    // Toggle mute
    muteBtn.addEventListener('click', function() {
        isMuted = !isMuted;
        muteLed.classList.toggle('active', isMuted);
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'mute',
                muted: isMuted
            });
        });
    });
    
    // Settings (placeholder)
    settingsBtn.addEventListener('click', function() {
        statusDisplay.textContent = 'NO SETTINGS';
        setTimeout(() => {
            updateStatus();
        }, 1500);
    });
    
    function updateStatus() {
        if (isEnabled) {
            statusDisplay.textContent = 'HUNTING ADS';
            toggleBtn.classList.add('active');
        } else {
            statusDisplay.textContent = 'DISABLED';
            toggleBtn.classList.remove('active');
        }
    }
    
    // Listen for status updates from content script
    chrome.runtime.onMessage.addListener(function(message) {
        if (message.action === 'adDetected') {
            statusDisplay.textContent = 'MUTING AD';
            muteLed.classList.add('active');
        } else if (message.action === 'adEnded') {
            statusDisplay.textContent = 'READY';
            muteLed.classList.remove('active');
        }
    });
});