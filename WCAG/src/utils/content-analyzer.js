/**
 * Content Analyzer Module
 * Handles Layout Consistency, Duplicate Content, and Lorem Ipsum detection
 */
const ContentAnalyzer = {

    async analyze(type = 'all') {
        console.log(`📝 Starting Content Analysis (${type}) - v5...`);

        try {
            const results = {
                layout: null,
                duplicates: null,
                loremIpsum: null
            };

            if (type === 'all' || type === 'layout') {
                console.log('1. Checking Layout Consistency... (start)');
                results.layout = await this.checkLayoutConsistency();
                console.log('✅ Layout Consistency Check Complete');
            }

            if (type === 'all' || type === 'duplicate') {
                console.log('2. Checking Duplicate Content... (start)');
                results.duplicates = await this.checkDuplicateContent();
                console.log('✅ Duplicate Content Check Complete');
            }

            if (type === 'all' || type === 'lorem' || type === 'loremIpsum') {
                console.log('3. Checking Lorem Ipsum... (start)');
                results.loremIpsum = await this.checkLoremIpsum();
                console.log('✅ Lorem Ipsum Check Complete');
            }

            return results;
        } catch (error) {
            console.error('❌ Error during Content Analysis step:', error);
            throw error;
        }
    },

    /**
     * Check Layout Consistency (Spacing)
     * Finds unique margin/padding values to detect inconsistent spacing systems
     */
    async checkLayoutConsistency() {
        const spacings = new Map(); // value -> count
        const elements = document.querySelectorAll('div, section, article, p, h1, h2, h3, h4, h5, h6, ul, ol, li');

        // Chunk processing to avoid freezing UI
        const CHUNK_SIZE = 500;
        for (let i = 0; i < elements.length; i += CHUNK_SIZE) {
            const chunk = Array.from(elements).slice(i, i + CHUNK_SIZE);

            chunk.forEach(el => {
                if (el.offsetParent === null) return; // Skip hidden
                const style = window.getComputedStyle(el);

                // Check vertical spacings (top/bottom margins & paddings)
                const props = ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'];
                props.forEach(p => {
                    const val = style[p];
                    if (val && val !== '0px' && val !== '0') {
                        spacings.set(val, (spacings.get(val) || 0) + 1);
                    }
                });
            });

            // Yield to main thread every chunk
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Convert to array and sort by occurrence
        const sortedSpacings = Array.from(spacings.entries())
            .sort((a, b) => b[1] - a[1]);

        return {
            totalElementsScanned: elements.length,
            uniqueSpacings: sortedSpacings.length,
            mostCommon: sortedSpacings.slice(0, 5).map(s => ({ value: s[0], count: s[1] })),
            allSpacings: sortedSpacings.map(s => s[0])
        };
    },

    /**
     * Check Duplicate Content
     * Finds repeated text blocks (> 50 chars)
     */
    async checkDuplicateContent() {
        const textNodes = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        let count = 0;

        while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (text.length > 50) { // Only check substantial content
                textNodes.push({ text, node });
            }

            count++;
            if (count % 500 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const counts = new Map();
        textNodes.forEach(item => {
            counts.set(item.text, (counts.get(item.text) || 0) + 1);
        });

        // Filter for duplicates
        const duplicates = Array.from(counts.entries())
            .filter(entry => entry[1] > 1)
            .map(entry => ({
                content: entry[0],
                count: entry[1],
                preview: entry[0].substring(0, 60) + (entry[0].length > 60 ? '...' : '')
            }));

        return {
            found: duplicates.length > 0,
            count: duplicates.length,
            items: duplicates
        };
    },

    /**
     * Check Lorem Ipsum
     * Finds placeholder text
     */
    async checkLoremIpsum() {
        // Expanded regex to catch more variations of placement text
        const loremRegex = /\b(lorem\s+ipsum|dolor\s+sit\s+amet|consectetur\s+adipiscing|sed\s+do\s+eiusmod|tempor\s+incididunt|ut\s+labore\s+et\s+dolore|magna\s+aliqua|quis\s+nostrud\s+exercitation|ullamco\s+laboris|nisi\s+ut\s+aliquip|ex\s+ea\s+commodo|consequat\s+duis\s+aute|irure\s+dolor\s+in\s+reprehenderit|voluptate\s+velit\s+esse|cillum\s+dolore\s+eu\s+fugiat|nulla\s+pariatur|excepteur\s+sint\s+occaecat|cupidatat\s+non\s+proident|sunt\s+in\s+culpa|qui\s+officia\s+deserunt|mollit\s+anim\s+id\s+est\s+laborum)\b/i;

        const loremWords = new Set(['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt']);

        const skippedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'CODE', 'PRE', 'SVG', 'META', 'LINK']);

        const found = [];

        // Improved Visibility Check
        const isVisible = (el) => {
            if (!el) return false;
            // Get computed style
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
            // Check dimensions
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                // Allow if it has visible overflow children, but generally 0x0 is hidden
                // For text nodes wrapper, 0x0 might happen if line-height is 0, but valid text usually has size.
                return false;
            }
            return true;
        };

        const scanNode = async (root) => {
            if (!root) return;

            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (skippedTags.has(node.tagName)) return NodeFilter.FILTER_REJECT;
                            // Accept elements to check for Shadow DOM
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                },
                false
            );

            let node;
            let count = 0;

            // Limit loop to prevent infinite hang
            const MAX_NODES = 50000;
            let totalNodes = 0;

            while (node = walker.nextNode()) {
                count++;
                totalNodes++;
                if (totalNodes > MAX_NODES) {
                    console.warn('⚠️ Content Analysis Check limit reached inside scanNode, stopping early.');
                    break;
                }

                if (count % 200 === 0) {
                    // console.log(`Scanning... ${totalNodes} nodes checked`);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                // Shadow DOM Recursion
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.shadowRoot) {
                        // preventing infinite recursion if shadowRoot is somehow its own parent (unlikely but safe)
                        await scanNode(node.shadowRoot);
                    }
                    continue;
                }

                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    if (!text || text.trim().length < 5) continue;

                    // 1. Regex Match (Cheap)
                    const isMatch = loremRegex.test(text);
                    let isDensityMatch = false;

                    // 2. Density Match (Medium)
                    if (!isMatch) {
                        const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
                        const loremCount = words.filter(w => loremWords.has(w)).length;
                        if (words.length >= 3 && (loremCount / words.length) > 0.4) {
                            isDensityMatch = true;
                        }
                    }

                    // 3. Visibility Check (Expensive - only run if matched)
                    if ((isMatch || isDensityMatch) && isVisible(node.parentElement)) {
                        found.push({
                            text: text.trim().substring(0, 100),
                            path: this.getElementPath(node.parentElement || root),
                            isSuspicious: true
                        });
                    }
                }
            }
        };

        // Start scan from body
        if (document.body) await scanNode(document.body);

        return {
            found: found.length > 0,
            count: found.length,
            instances: found
        };
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
    window.ContentAnalyzer = ContentAnalyzer;
}
