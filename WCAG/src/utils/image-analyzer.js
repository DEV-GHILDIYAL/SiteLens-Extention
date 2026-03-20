// Image Accessibility Analyzer
const ImageAnalyzer = {

    /**
     * Analyze all images on the page for accessibility issues
     */
    analyzePage() {
        console.log('🖼️ Starting image accessibility analysis...');

        const images = document.querySelectorAll('img');
        const issues = [];

        images.forEach((img, index) => {
            const analysis = this.analyzeImage(img, index);
            if (analysis) {
                issues.push(analysis);
            }
        });

        console.log(`🖼️ Found ${images.length} images, ${issues.length} issues`);
        return {
            success: true,
            totalImages: images.length,
            issues: issues,
            summary: {
                missingAlt: issues.filter(i => i.type === 'missing-alt').length,
                emptyAlt: issues.filter(i => i.type === 'empty-alt').length,
                poorAltText: issues.filter(i => i.type === 'poor-alt').length
            },
            allImages: Array.from(images).map(img => ({
                src: img.src,
                alt: img.alt || '',
                width: img.naturalWidth,
                height: img.naturalHeight
            })).filter(img => img.src && !img.src.startsWith('data:')) // Filter out inline base64 if needed, or keep
        };
    },

    /**
     * Analyze individual image
     */
    analyzeImage(img, index) {
        const issues = [];
        const altText = img.getAttribute('alt');
        const title = img.getAttribute('title');
        const src = img.src || ''; // Use absolute URL property
        const ariaLabel = img.getAttribute('aria-label');

        // Check for missing alt attribute
        if (!altText && !title && !ariaLabel) {
            console.log(`🖼️ Image ${index}: ❌ Missing alt text`);
            return {
                type: 'missing-alt',
                severity: 'critical',
                index: index,
                src: src,
                message: 'Missing alt text (critical for accessibility)',
                selector: this.getSelector(img),
                element: {
                    tag: img.tagName,
                    src: src.substring(0, 100),
                    visible: img.offsetHeight > 0 && img.offsetWidth > 0
                }
            };
        }

        // Check for empty alt attribute
        if (altText !== null && altText.trim() === '') {
            console.log(`🖼️ Image ${index}: ⚠️ Empty alt attribute`);
            return {
                type: 'empty-alt',
                severity: 'warning',
                index: index,
                src: src,
                message: 'Alt attribute is empty (should describe image)',
                selector: this.getSelector(img),
                element: {
                    tag: img.tagName,
                    src: src.substring(0, 100),
                    visible: img.offsetHeight > 0 && img.offsetWidth > 0
                }
            };
        }

        // Check for poor alt text (too short or too long)
        if (altText) {
            if (altText.length < 5) {
                console.log(`🖼️ Image ${index}: ⚠️ Alt text too short: "${altText}"`);
                return {
                    type: 'poor-alt',
                    severity: 'warning',
                    index: index,
                    src: src,
                    message: `Alt text too short (${altText.length} chars). Should be more descriptive.`,
                    altText: altText,
                    selector: this.getSelector(img),
                    element: {
                        tag: img.tagName,
                        src: src.substring(0, 100),
                        visible: img.offsetHeight > 0 && img.offsetWidth > 0
                    }
                };
            }

            if (altText.length > 150) {
                console.log(`🖼️ Image ${index}: ⚠️ Alt text too long: "${altText.substring(0, 50)}..."`);
                return {
                    type: 'poor-alt',
                    severity: 'warning',
                    index: index,
                    src: src,
                    message: `Alt text too long (${altText.length} chars). Keep under 150 characters.`,
                    altText: altText.substring(0, 100),
                    selector: this.getSelector(img),
                    element: {
                        tag: img.tagName,
                        src: src.substring(0, 100),
                        visible: img.offsetHeight > 0 && img.offsetWidth > 0
                    }
                };
            }

            // Check for redundant alt text (e.g., "image", "picture", "photo")
            const redundantPatterns = ['image', 'picture', 'photo', 'img', 'screenshot', 'graphic'];
            const lowerAlt = altText.toLowerCase();
            if (redundantPatterns.some(pattern => lowerAlt === pattern)) {
                console.log(`🖼️ Image ${index}: ⚠️ Redundant alt text: "${altText}"`);
                return {
                    type: 'poor-alt',
                    severity: 'warning',
                    index: index,
                    src: src,
                    message: `Alt text is redundant ("${altText}"). Describe what the image shows instead.`,
                    altText: altText,
                    selector: this.getSelector(img),
                    element: {
                        tag: img.tagName,
                        src: src.substring(0, 100),
                        visible: img.offsetHeight > 0 && img.offsetWidth > 0
                    }
                };
            }
        }

        return null;
    },

    /**
     * Get CSS selector for element
     */
    getSelector(element) {
        if (element.id) return `#${element.id}`;

        let path = [];
        while (element.parentElement) {
            let selector = element.tagName.toLowerCase();
            if (element.id) {
                selector += `#${element.id}`;
                path.unshift(selector);
                break;
            } else {
                let sibling = element;
                let nth = 1;
                while ((sibling = sibling.previousElementSibling)) {
                    if (sibling.tagName.toLowerCase() === selector) nth++;
                }
                if (nth > 1) selector += `:nth-of-type(${nth})`;
                path.unshift(selector);
            }
            element = element.parentElement;
        }
        return path.join(' > ');
    },

    /**
     * Highlight image on page
     */
    highlightImage(selector) {
        try {
            const img = document.querySelector(selector);
            if (img) {
                img.style.border = '3px solid #ef4444';
                img.style.borderRadius = '4px';
                img.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (e) {
            console.error('Failed to highlight image:', e);
        }
    },

    /**
     * Clear highlight from image
     */
    clearImageHighlight(selector) {
        try {
            const img = document.querySelector(selector);
            if (img) {
                img.style.border = '';
                img.style.borderRadius = '';
            }
        } catch (e) {
            console.error('Failed to clear highlight:', e);
        }
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.ImageAnalyzer = ImageAnalyzer;
}
