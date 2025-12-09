// offscreen.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'urlToBase64') {
        urlToBase64(request.url)
            .then(base64 => sendResponse({ base64: base64 }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Indicates an asynchronous response
    }
});

async function urlToBase64(url) {
    // 1. Fetch the image
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();

    // 2. Convert blob to base64 using FileReader
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Error converting blob to base64."));
        reader.readAsDataURL(blob);
    });
}
