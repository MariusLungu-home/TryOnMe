// options.js

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('geminiApiKey');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    // Load saved API key
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            showStatus('API Key loaded.', 'success');
        }
    });

    // Save API key
    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
                showStatus('API Key saved successfully!', 'success');
            });
        } else {
            showStatus('API Key cannot be empty.', 'error');
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = type; // 'success' or 'error'
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = '';
        }, 3000);
    }
});