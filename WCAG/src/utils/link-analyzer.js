/**
 * Link Analyzer Module
 * Handles Button/Link Purpose Audit, Page Title Fetching, and Deep Link Extraction
 */
const LinkAnalyzer = {

    extractLinks(root = document) {
        // Handle case where root is passed as null/undefined
        root = root || document;

        console.log('🔗 Starting Deep Link Analysis...');
        const uniqueLinks = new Map();

        const addLink = (url, sourceElement, label = '', type = 'link') => {
            let cleanUrl = null;
            if (url && typeof url === 'string') {
                try {
                    // Try to make relative URLs absolute
                    cleanUrl = new URL(url.trim(), window.location.href).href;
                } catch (e) {
                    cleanUrl = url.trim();
                }

                // Filter out non-web interactions but keep anchors
                if (cleanUrl && (cleanUrl.includes('javascript:') || cleanUrl.includes('mailto:') || cleanUrl.includes('tel:'))) {
                    cleanUrl = null;
                }
            }

            // Skip if no URL and not a button/interactive element
            if (!cleanUrl && !['button', 'form', 'clickable'].includes(type) && !sourceElement) return;

            let key = cleanUrl;
            if (!key) {
                // Fallback key: Use element signature or random
                key = `no-url-${type}-${Math.random().toString(36).substr(2, 9)}`;
            }

            if (!uniqueLinks.has(key)) {
                // Determine label if missing
                let finalLabel = label;
                if (!finalLabel && sourceElement) {
                    // Check for image inside anchor
                    const img = sourceElement.querySelector('img');
                    if (img && !sourceElement.innerText.trim()) {
                        finalLabel = `[Image: ${img.alt || img.src.split('/').pop() || 'Unlabeled'}]`;
                    } else {
                        finalLabel = sourceElement.innerText?.trim() ||
                            sourceElement.getAttribute('aria-label') ||
                            sourceElement.getAttribute('title') ||
                            sourceElement.name ||
                            sourceElement.value ||
                            '[No Label]';
                    }
                }

                uniqueLinks.set(key, {
                    element: sourceElement ? sourceElement.tagName.toLowerCase() : type,
                    label: finalLabel.substring(0, 100),
                    url: cleanUrl || null,
                    shouldFetch: !!cleanUrl, // Only fetch if we have a URL
                    originalUrl: url,
                    path: this.getElementPath(sourceElement)
                });
            }

        };

        // 2. Recursive DOM Processor
        const processNode = (node) => {
            if (!node || !node.querySelectorAll) return;

            // A. Standard Elements
            const selectors = [
                'a[href]',
                'area[href]',
                'button',
                'form[action]',
                'iframe[src]',
                'input[type="submit"]',
                'input[type="button"]',
                '[role="link"]',
                '[role="button"]',
                '.btn',
                '.button'
            ];

            const elements = node.querySelectorAll(selectors.join(', '));
            elements.forEach(el => {
                const tag = el.tagName.toLowerCase();

                // Anchors & Areas
                if ((tag === 'a' || tag === 'area') && el.href) {
                    addLink(el.href, el, '', 'anchor');
                }

                // Forms
                else if (tag === 'form' && el.action) {
                    addLink(el.action, el, 'Form Submission', 'form');
                }

                // Iframes
                else if (tag === 'iframe' && el.src) {
                    addLink(el.src, el, 'Iframe Content', 'iframe');
                }

                // Buttons / Interactive Elements
                else {
                    // Check attributes for hidden URLs
                    const dataUrl = el.getAttribute('data-href') ||
                        el.getAttribute('data-url') ||
                        el.getAttribute('data-link');

                    if (dataUrl) {
                        addLink(dataUrl, el, '', 'data-attr');
                    } else if (tag === 'button' || el.getAttribute('role') === 'button' || tag === 'input') {
                        // Check if it wraps an anchor (common pattern)
                        const childA = el.querySelector('a');
                        if (childA && childA.href) {
                            addLink(childA.href, childA, '', 'wrapped-anchor');
                        } else {
                            // It's a button without a URL. CAPTURE IT.
                            addLink(null, el, '', 'button');
                        }
                    } else if (el.hasAttribute('onclick')) {
                        // Div/Span with onclick
                        addLink(null, el, '', 'clickable');
                    }
                }
            });

            // B. Traverse Shadow DOM
            const allElements = node.querySelectorAll('*');
            allElements.forEach(el => {
                if (el.shadowRoot) {
                    processNode(el.shadowRoot);
                }
            });
        };

        processNode(root);

        // 3. Heuristic Scan (Optional: could be slow on massive pages)
        // We scan for elements that look clickable but weren't caught above.
        // Optimization: Only scan 'div' and 'span' that have specific cursor styles?
        // This is skipped for now to keep performance high, relying on classes (.btn) and roles.

        return Array.from(uniqueLinks.values());
    },

    getElementPath(el) {
        if (!el) return '';
        if (el.id) return `#${el.id}`;
        let path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.tagName.toLowerCase();
            if (el.id) {
                selector += `#${el.id}`;
                path.unshift(selector);
                break;
            } else {
                let sib = el, nth = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.tagName.toLowerCase() == selector) nth++;
                }
                if (nth != 1) selector += `:nth-of-type(${nth})`;
            }
            path.unshift(selector);
            el = el.parentElement;
        }
        return path.join(' > ');
    }
};

if (typeof window !== 'undefined') {
    window.LinkAnalyzer = LinkAnalyzer;
}
