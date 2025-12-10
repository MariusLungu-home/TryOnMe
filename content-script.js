// content-script.js

// Listen for messages from the service worker
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getGarmentImage') {
        console.log("Content script received request to get garment image.");
        let garmentImageUrl = null;

        // R2: Garment Acquisition - Attempt to find a suitable image URL
        // This is a simplified example. Real-world implementation would require
        // more sophisticated logic to identify the main product image,
        // possibly using common class names, data attributes, or schema.org data.

        // Strategy 1: Look for images with common product-related class names
        const possibleImageSelectors = [
            'img.product-image',
            'img.main-image',
            'img[alt*="product"]',
            'img[src*="/products/"]',
            'meta[property="og:image"]' // Open Graph image often points to product image
        ];

        for (const selector of possibleImageSelectors) {
            let element;
            if (selector.startsWith('meta')) {
                element = document.querySelector(selector);
                if (element && element.content) {
                    garmentImageUrl = element.content;
                    break;
                }
            } else {
                element = document.querySelector(selector);
                if (element && element.src) {
                    garmentImageUrl = element.src;
                    // Basic check to avoid small icons or decorative images
                    if (element.naturalWidth > 100 && element.naturalHeight > 100) {
                        break;
                    }
                }
            }
        }
        
        // If not found yet, try to find the largest image on the page
        if (!garmentImageUrl) {
            const allImages = Array.from(document.querySelectorAll('img'));
            let largestImage = null;
            let maxArea = 0;

            for (const img of allImages) {
                // Ensure the image has a source and isn't too small
                if (img.src && img.naturalWidth && img.naturalHeight && img.naturalWidth > 100 && img.naturalHeight > 100) {
                    const area = img.naturalWidth * img.naturalHeight;
                    if (area > maxArea) {
                        maxArea = area;
                        largestImage = img;
                    }
                }
            }

            if (largestImage) {
                garmentImageUrl = largestImage.src;
            }
        }


        if (garmentImageUrl) {
            console.log("Garment image found:", garmentImageUrl);
            sendResponse({ garmentImageUrl: garmentImageUrl });
        } else {
            console.log("No suitable garment image found on this page.");
            sendResponse({ garmentImageUrl: null, error: "No garment image found." });
        }
        return true; // Indicates an asynchronous response
    }
});
