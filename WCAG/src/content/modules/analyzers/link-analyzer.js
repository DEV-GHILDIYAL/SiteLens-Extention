export const LinkAnalyzer = {
    name: 'links',

    analyze(node) {
        if (node.tagName.toLowerCase() !== 'a') return null;

        const href = node.getAttribute('href');
        const target = node.getAttribute('target');
        const rel = node.getAttribute('rel');
        const text = (node.innerText || node.textContent || '').trim();

        // 1. Relative/Absolute External Link Security
        if (target === '_blank' && (!rel || !rel.includes('noopener'))) {
            return {
                type: 'insecure-external-link',
                severity: 'info',
                message: 'External link opens in new tab without rel="noopener" (security risk)',
                text: text || 'Link'
            };
        }

        // 2. Ambiguous Link Text
        const ambiguousWords = ['click here', 'read more', 'learn more', 'more info', 'here'];
        if (ambiguousWords.includes(text.toLowerCase())) {
            return {
                type: 'ambiguous-link',
                severity: 'warning',
                message: `Ambiguous link text: "${text}". Link text should be descriptive out of context.`,
                href: href
            };
        }

        return null;
    }
};
