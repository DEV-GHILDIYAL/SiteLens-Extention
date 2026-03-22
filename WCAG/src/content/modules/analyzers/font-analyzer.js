export const FontAnalyzer = {
    name: 'fonts',

    analyze(node) {
        // Skip hidden or non-text elements
        if (node.offsetParent === null) return null;
        if (['SCRIPT', 'STYLE', 'SVG', 'IMG'].includes(node.tagName)) return null;

        const style = window.getComputedStyle(node);
        const fontSize = parseFloat(style.fontSize);

        // 1. Tiny Font Check
        if (fontSize < 10 && node.innerText?.trim().length > 0) {
            return {
                type: 'tiny-font',
                severity: 'warning',
                message: `Font size is too small (${fontSize}px). Minimum 12px recommended for readability.`,
                text: node.innerText.substring(0, 30)
            };
        }

        return null;
    }
};
