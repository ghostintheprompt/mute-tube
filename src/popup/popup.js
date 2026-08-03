document.addEventListener('DOMContentLoaded', () => {
    const statusDisplay = document.getElementById('status');
    const toggleBtn = document.getElementById('toggle-btn');
    const skipBtn = document.getElementById('skip-btn');
    const muteBtn = document.getElementById('mute-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const enabledState = document.getElementById('enabled-state');
    const auditCount = document.getElementById('audit-count');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const muteLed = document.querySelector('.mute-led');

    let isEnabled = true;
    let isMuted = false;

    chrome.storage.local.get({ enabled: true }, ({ enabled }) => {
        isEnabled = Boolean(enabled);
        updateStatus();
        refreshAuditLog();
        sendToActiveTab({ action: 'getState' }, response => {
            if (response?.ok) {
                isEnabled = Boolean(response.enabled);
                updateStatus();
            }
        });
    });

    toggleBtn.addEventListener('click', () => {
        isEnabled = !isEnabled;
        chrome.storage.local.set({ enabled: isEnabled });
        updateStatus();
        sendToActiveTab({ action: 'toggle', enabled: isEnabled });
    });

    skipBtn.addEventListener('click', () => {
        sendToActiveTab({ action: 'skip' });
        flashButton(skipBtn);
    });

    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        muteLed.classList.toggle('active', isMuted);
        sendToActiveTab({ action: 'mute', muted: isMuted });
    });

    settingsBtn.addEventListener('click', () => {
        settingsPanel.hidden = !settingsPanel.hidden;
        refreshAuditLog();
    });

    clearLogBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'CLEAR_AUDIT_LOG' }, () => {
            auditCount.textContent = '0';
            statusDisplay.textContent = 'LOG CLEARED';
            window.setTimeout(updateStatus, 1200);
        });
    });

    function sendToActiveTab(message, callback = () => {}) {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            const activeTab = tabs?.[0];
            if (!activeTab?.id) {
                statusDisplay.textContent = 'NO ACTIVE TAB';
                callback(null);
                return;
            }

            chrome.tabs.sendMessage(activeTab.id, message, response => {
                if (chrome.runtime.lastError) {
                    statusDisplay.textContent = 'OPEN YOUTUBE';
                    callback(null);
                    return;
                }
                callback(response);
            });
        });
    }

    function refreshAuditLog() {
        chrome.runtime.sendMessage({ type: 'GET_AUDIT_LOG' }, response => {
            const log = response?.log || [];
            auditCount.textContent = String(log.length);
        });
    }

    function flashButton(button) {
        button.classList.add('active');
        window.setTimeout(() => {
            if (button !== toggleBtn || !isEnabled) button.classList.remove('active');
        }, 200);
    }

    function updateStatus() {
        if (isEnabled) {
            statusDisplay.textContent = 'HUNTING ADS';
            toggleBtn.classList.add('active');
            enabledState.textContent = 'ON';
        } else {
            statusDisplay.textContent = 'DISABLED';
            toggleBtn.classList.remove('active');
            enabledState.textContent = 'OFF';
        }
    }

    chrome.runtime.onMessage.addListener(message => {
        if (message.action === 'adDetected') {
            statusDisplay.textContent = 'MUTING AD';
            muteLed.classList.add('active');
            refreshAuditLog();
        } else if (message.action === 'adEnded') {
            statusDisplay.textContent = 'READY';
            muteLed.classList.remove('active');
            refreshAuditLog();
        }
    });
});
