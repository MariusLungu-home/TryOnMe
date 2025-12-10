// service-worker.js
importScripts('browser-polyfill.min.js');

// --- Offscreen Document Management ---
let creating; // A promise that resolves when the offscreen document is created

async function hasOffscreenDocument(path) {
    const offscreenUrl = browser.runtime.getURL(path);
    const matchedClients = await clients.matchAll();
    return matchedClients.some(client => client.url === offscreenUrl);
}

async function setupOffscreenDocument(path) {
    //if we do not have a document, we are already creating one
    if (creating) {
        await creating;
    } else if (!(await hasOffscreenDocument(path))) {
        creating = browser.offscreen.createDocument({
            url: path,
            reasons: [browser.offscreen.Reason.BLOBS],
            justification: 'To convert an image URL to a base64 string.'
        });
        await creating;
        creating = null;
    }
}

// --- Main Service Worker Logic ---

browser.runtime.onInstalled.addListener(() => {
    console.log("TryOnMe extension installed.");
});

// Allow users to open the side panel by clicking the action icon
browser.action.onClicked.addListener((tab) => {
    browser.sidePanel.open({ windowId: tab.windowId });
});


// New helper function to convert URL to Base64 via offscreen document
async function urlToBase64(url) {
    await setupOffscreenDocument('offscreen.html');
    const response = await browser.runtime.sendMessage({
        action: 'urlToBase64',
        url: url
    });
    if (response.error) {
        throw new Error(response.error);
    }
    return response.base64;
}

// Helper to convert base64 (with prefix) to Gemini inlineData format
const toInlineData = (base64Data) => {
    const parts = base64Data.split(';base64,');
    if (parts.length !== 2) {
        throw new Error(`Invalid base64 data format for data starting with: ${base64Data.substring(0,30)}...`);
    }
    return {
        inlineData: {
            mimeType: parts[0].replace('data:', ''),
            data: parts[1]
        }
    };
};


browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateImage') {
        (async () => {
            try {
                const { selfie, garment: garmentUrl, mode } = request;

                // 1. Get API Key from storage
                const storage = await browser.storage.local.get(['geminiApiKey']);
                const API_KEY = storage.geminiApiKey;
                const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

                if (!API_KEY) {
                    throw new Error("Gemini API Key not set. Please set it in the extension options.");
                }
                
                // 2. Convert garment URL to Base64 (or use directly if already base64)
                let garmentBase64;
                if (garmentUrl.startsWith('data:image/')) {
                    // Already base64 data URL, use directly
                    garmentBase64 = garmentUrl;
                } else {
                    // URL, needs conversion via offscreen document
                    garmentBase64 = await urlToBase64(garmentUrl);
                }

                // 3. Construct prompt based on mode
                let promptText = "";
                if (mode === 'faceSwap') {
                    promptText = `Use the face from Image A and replace the face in Image B. Preserve all original lighting, shadows, pose, proportions, camera angle, wardrobe, background, and color conditions from Image B. Integrate the face from Image A with accurate skin-tone adaptation and consistent illumination so it appears naturally captured in the original scene. Do not alter any other attributes of Image B.

Assignment of Inputs:
Image A: the selfie.
Image B: the model wearing designer clothing.

Optional Precision Additions:
Match facial geometry to the model’s pose without altering the model’s body.
Blend edges and textures to remove all artifacts.
Maintain realism over stylization.`;
                } else if (mode === 'garmentOverlay') {
                    promptText = `Use the garment from Image B and place it onto the person in Image A. Preserve all original attributes of Image A, including the person's face, hair, body pose, background, and all original lighting, shadows, and color conditions. Integrate the garment from Image B with realistic draping, fit, and perspective, adapting it to the person's body shape and pose. Do not alter any other attributes of Image A.

Assignment of Inputs:
Image A: the selfie.
Image B: the model wearing the designer clothing.

Optional Precision Additions:
Match the garment's shape to the user's pose without altering the user's body.
Blend edges and textures to remove all artifacts.
Maintain realism over stylization.`;
                }
                
                const contents = [
                    { parts: [
                        { text: "Here is Image A (the selfie):" },
                        toInlineData(selfie)
                    ]},
                    { parts: [
                        { text: "Here is Image B (the model wearing designer clothing):" },
                        toInlineData(garmentBase64)
                    ]},
                    { parts: [
                        { text: promptText }
                    ]}
                ];

                // 4. Make fetch call to Gemini API
                const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
                }

                const responseData = await response.json();

                // Add detailed logging to help debug API responses
                console.log("Gemini API Response:", JSON.stringify(responseData, null, 2));

                let generatedImageUrl;
                if (responseData.candidates &&
                    responseData.candidates.length > 0 &&
                    responseData.candidates[0].content &&
                    responseData.candidates[0].content.parts &&
                    responseData.candidates[0].content.parts.length > 0 &&
                    responseData.candidates[0].content.parts[0].inlineData) {
                    const inlineData = responseData.candidates[0].content.parts[0].inlineData;
                    generatedImageUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
                } else {
                    // Provide more detailed error message about what's missing
                    const errorDetails = !responseData.candidates ? "No candidates in response" :
                                        responseData.candidates.length === 0 ? "Empty candidates array" :
                                        !responseData.candidates[0].content ? "No content in candidate" :
                                        !responseData.candidates[0].content.parts ? "No parts in content" :
                                        responseData.candidates[0].content.parts.length === 0 ? "Empty parts array" :
                                        "No inlineData in parts";
                    throw new Error(`Could not parse generated image from Gemini API response. ${errorDetails}. Full response: ${JSON.stringify(responseData)}`);
                }
                
                sendResponse({ generatedImageUrl: generatedImageUrl });

            } catch (error) {
                console.error("Error during image generation:", error);
                sendResponse({ error: error.message });
            }
        })();
        return true; // Keep message channel open for async response
    }
});