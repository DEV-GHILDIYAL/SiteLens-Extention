/**
 * SiteLens SEO Analyzer
 * 
 * Contract: analyze(node, context) => result | null
 */

export const SEOAnalyzer = {
    name: 'seo',

    analyze(node, context) {
        const tag = node.tagName.toLowerCase();

        // 1. Heading Hierarchy (H1-H6)
        if (/^h[1-6]$/.test(tag)) {
            const level = parseInt(tag[1]);
            let issue = null;

            if (level === 1) {
                context.h1Count++;
                if (context.h1Count > 1) {
                    issue = {
                        type: 'multiple-h1',
                        severity: 'warning',
                        message: 'Multiple H1 headings detected (only one is recommended)'
                    };
                }
            } else {
                // Check for skipped levels
                if (context.lastHeadingLevel > 0 && level > context.lastHeadingLevel + 1) {
                    issue = {
                        type: 'skipped-heading',
                        severity: 'info',
                        message: `Heading level skipped: H${context.lastHeadingLevel} to H${level}`,
                        path: this.getSelector(node)
                    };
                }
            }
            context.lastHeadingLevel = level;
            return issue;
        }

        // 2. Meta Tags (Search only in <head> elements if they reach here)
        // Note: CoreEngine traverses the whole document, including <meta> tags.
        if (tag === 'meta') {
            const name = node.getAttribute('name')?.toLowerCase();
            const property = node.getAttribute('property')?.toLowerCase();

            if (name === 'description') {
                const desc = node.getAttribute('content');
                if (!desc || desc.length < 50) {
                    return { type: 'short-description', severity: 'warning', message: 'Meta description is too short or missing' };
                }
            }

            if (name === 'robots') {
                context.robotsFound = true;
                const content = node.getAttribute('content');
                if (content?.includes('noindex')) {
                    return { type: 'noindex', severity: 'info', message: 'Page is set to noindex' };
                }
            }
        }

        // 3. Canonical Link
        if (tag === 'link' && node.getAttribute('rel') === 'canonical') {
            context.canonicalFound = true;
            return null; // Just tracking for later? No, analyzer returns results per node.
        }

        return null;
    },

    /**
     * Post-process can be handled by the engine or a special final node.
     * For now, we return individual node results.
     */
    getSelector(node) {
        if (node.id) return `#${node.id}`;
        if (node.className) return `.${node.className.split(' ')[0]}`;
        return node.tagName.toLowerCase();
    }
};
