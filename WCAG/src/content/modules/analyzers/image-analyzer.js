/**
 * SiteLens Image Accessibility Analyzer
 * 
 * Contract: analyze(node, context) => result | null
 */

export const ImageAnalyzer = {
    name: 'images',

    analyze(node) {
        // We only care about <img> tags
        if (node.tagName.toLowerCase() !== 'img') return null;

        const img = node;
        const altText = img.getAttribute('alt');
        const title = img.getAttribute('title');
        const ariaLabel = img.getAttribute('aria-label');
        const src = img.src || '';

        // 1. Missing alt text
        if (altText === null && !title && !ariaLabel) {
            return {
                type: 'missing-alt',
                severity: 'critical',
                message: 'Missing alt text (critical for accessibility)',
                src: this.truncate(src),
                element: this.truncate(node.outerHTML)
            };
        }

        // 2. Empty alt text
        if (altText !== null && altText.trim() === '') {
            return {
                type: 'empty-alt',
                severity: 'warning',
                message: 'Alt attribute is empty (should describe image if not decorative)',
                src: this.truncate(src)
            };
        }

        // 3. Redundant or poor alt text
        if (altText) {
            const lowerAlt = altText.toLowerCase();
            
            // Check for redundant words (WCAG success criterion 1.1.1)
            const redundantPatterns = ['image of', 'photo of', 'picture of', 'img of', 'screenshot of'];
            if (redundantPatterns.some(p => lowerAlt.startsWith(p))) {
                return {
                    type: 'redundant-alt',
                    severity: 'info',
                    message: `Alt text starts with redundant phrase: "${altText.substring(0, 20)}..."`,
                    altText
                };
            }

            if (altText.length > 150) {
                return {
                    type: 'long-alt',
                    severity: 'warning',
                    message: `Alt text too long (${altText.length} chars). Consider moving details to caption.`,
                    altText: this.truncate(altText)
                };
            }
        }

        return null;
    },

    truncate(str, length = 100) {
        if (!str) return '';
        return str.length > length ? str.substring(0, length) + '...' : str;
    }
};
