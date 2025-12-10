// sidepanel.js

let selfieBase64 = null;
let garmentImageUrl = null;

const selfieFileInput = document.getElementById('selfieFileInput');
const selfiePreview = document.getElementById('selfiePreview');
const garmentDropZone = document.getElementById('garmentDropZone');
const garmentFileInput = document.getElementById('garmentFileInput');
const browseGarmentButton = document.getElementById('browseGarmentButton');
const captureGarmentButton = document.getElementById('captureGarmentButton');
const garmentPreview = document.getElementById('garmentPreview');
const garmentURLDisplay = document.getElementById('garmentURLDisplay');
const generateImageButton = document.getElementById('generateImageButton');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultImage = document.getElementById('resultImage');
const statusMessages = document.getElementById('status-messages');

function showStatus(message, isError = false) {
    statusMessages.textContent = message;
    statusMessages.style.color = isError ? 'red' : 'green';
    if (isError) {
        console.error(message);
    } else {
        console.log(message);
    }
}

// R1: Selfie Upload
selfieFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            selfiePreview.src = e.target.result;
            selfiePreview.style.display = 'block';
            selfieBase64 = e.target.result; // Store as base64
            showStatus('Selfie uploaded successfully!');
        };
        reader.onerror = () => {
            showStatus('Error reading selfie file.', true);
            selfieBase64 = null;
            selfiePreview.style.display = 'none';
        };
        reader.readAsDataURL(file);
    } else {
        selfieBase64 = null;
        selfiePreview.style.display = 'none';
        showStatus('No selfie file selected.');
    }
});

// R2: Garment Acquisition - Unified handler for file-based garment selection
function handleGarmentFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        garmentImageUrl = e.target.result; // Store as base64 data URL
        garmentPreview.src = garmentImageUrl;
        garmentPreview.style.display = 'block';
        garmentURLDisplay.textContent = `Loaded: ${file.name}`;
        showStatus('Garment image loaded successfully!');
    };
    reader.onerror = () => {
        showStatus('Error reading garment file.', true);
        garmentImageUrl = null;
        garmentPreview.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Browse button triggers file input
browseGarmentButton.addEventListener('click', () => {
    garmentFileInput.click();
});

// Handle file selection from browse
garmentFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        handleGarmentFile(file);
    }
});

// Drag and drop handlers
garmentDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    garmentDropZone.classList.add('drag-over');
});

garmentDropZone.addEventListener('dragleave', () => {
    garmentDropZone.classList.remove('drag-over');
});

garmentDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    garmentDropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        handleGarmentFile(files[0]);
    } else {
        showStatus('Please drop a valid image file.', true);
    }
});

// R2: Garment Acquisition - Auto-capture from page (fallback option)
captureGarmentButton.addEventListener('click', async () => {
    showStatus('Attempting to capture garment image...', false);
    garmentImageUrl = null;
    garmentPreview.style.display = 'none';
    garmentURLDisplay.textContent = '';

    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            showStatus('Could not get active tab information.', true);
            return;
        }

        const response = await browser.tabs.sendMessage(tab.id, { action: 'getGarmentImage' });
        
        if (response && response.garmentImageUrl) {
            garmentImageUrl = response.garmentImageUrl;
            garmentPreview.src = garmentImageUrl;
            garmentPreview.style.display = 'block';
            garmentURLDisplay.textContent = `Captured: ${garmentImageUrl.substring(0, 50)}...`;
            showStatus('Garment image captured!');
        } else {
            showStatus('Garment image not found on this page.', true);
        }
    } catch (error) {
        showStatus(`Error capturing garment: ${error.message}`, true);
        console.error('Error capturing garment:', error);
    }
});


// R4: AI Image Generation
generateImageButton.addEventListener('click', async () => {
    if (!selfieBase64) {
        showStatus('Please upload your selfie first.', true);
        return;
    }
    if (!garmentImageUrl) {
        showStatus('Please capture a garment image first.', true);
        return;
    }

    loadingIndicator.style.display = 'block';
    resultImage.style.display = 'none';
    showStatus('Processing request...', false);

    const selectedMode = document.querySelector('input[name="tryOnMode"]:checked').value; // R3: Mode Selection

    try {
        const response = await browser.runtime.sendMessage({
            action: 'generateImage',
            selfie: selfieBase64,
            garment: garmentImageUrl,
            mode: selectedMode
        });

        if (response && response.generatedImageUrl) {
            resultImage.src = response.generatedImageUrl;
            resultImage.style.display = 'block';
            showStatus('Image generated successfully!');
        } else if (response && response.error) {
            showStatus(`Error generating image: ${response.error}`, true);
        } else {
            showStatus('Failed to generate image: Unknown error.', true);
        }
    } catch (error) {
        showStatus(`Error communicating with background service: ${error.message}`, true);
        console.error('Error in generateImage:', error);
    } finally {
        loadingIndicator.style.display = 'none';
    }
});

// Listen for messages from the service worker (e.g., AI results)
browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'displayGeneratedImage' && message.generatedImageUrl) {
        resultImage.src = message.generatedImageUrl;
        resultImage.style.display = 'block';
        loadingIndicator.style.display = 'none';
        showStatus('Image generated successfully!');
    } else if (message.action === 'showError' && message.error) {
        showStatus(`Error: ${message.error}`, true);
        loadingIndicator.style.display = 'none';
    } else if (message.action === 'showStatus' && message.status) {
        showStatus(message.status, message.isError || false);
    }
});
