export const ContentAnalyzer = {
    name: 'content',

    analyze(node) {
        if (node.children.length > 0) return null; // Only check leaf text nodes
        const text = (node.innerText || node.textContent || '').toLowerCase();
        
        if (text.length < 10) return null;

        // 1. Lorem Ipsum Detection
        const loremPatterns = ['lorem ipsum', 'dolor sit amet', 'consectetur adipiscing', 'sed do eiusmod'];
        if (loremPatterns.some(p => text.includes(p))) {
            return {
                type: 'lorem-ipsum',
                severity: 'critical',
                message: 'Placeholder "Lorem Ipsum" text detected in production content',
                preview: text.substring(0, 50)
            };
        }

        return null;
    }
};
