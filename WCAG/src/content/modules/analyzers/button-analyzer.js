export const ButtonAnalyzer = {
    name: 'buttons',

    analyze(node) {
        const tagName = node.tagName.toLowerCase();
        const role = node.getAttribute('role');
        const isButton = tagName === 'button' || role === 'button' || (tagName === 'a' && node.classList.contains('btn'));

        if (!isButton) return null;

        const text = (node.innerText || node.textContent || '').trim();
        const ariaLabel = node.getAttribute('aria-label');
        const ariaLabelledBy = node.getAttribute('aria-labelledby');
        const title = node.getAttribute('title');

        // 1. Accessible Name Check
        if (!text && !ariaLabel && !ariaLabelledBy && !title) {
            return {
                type: 'empty-button',
                severity: 'critical',
                message: 'Button has no accessible name or label (unusable by screen readers)',
                element: node.tagName
            };
        }

        // 2. Button Linking Check
        if (tagName === 'a') {
            const href = node.getAttribute('href');
            if (!href || href === '#' || href === 'javascript:void(0)') {
                return {
                    type: 'broken-link-button',
                    severity: 'warning',
                    message: 'Button link has no valid destination (href is empty or "#")',
                    text: text || 'Unnamed Button'
                };
            }
        }

        return null;
    }
};
