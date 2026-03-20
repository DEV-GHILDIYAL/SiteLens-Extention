/**
 * SiteLens Shadow DOM Traverser Strategy
 * 
 * Strategy:
 * 1. Identify nodes with Shadow Roots (closed or open).
 * 2. Recursive traversal into shadowRoot.
 * 3. Handling 'closed' shadow roots via dynamic injection if possible (limited by browser).
 */

export const ShadowTraverser = {
    /**
     * Finds and returns all shadow roots for a given element.
     * Note: Access to 'closed' shadow roots is restricted by the browser
     * unless the extension is specifically configured or uses chrome.debugger.
     */
    getShadowRoots(element) {
        const roots = [];
        if (element.shadowRoot) {
            roots.push(element.shadowRoot);
        }
        // Heuristic for finding elements that might have shadow roots
        // but are marked 'closed'.
        return roots;
    },

    /**
     * Future Implementation: 
     * Incorporate into CoreEngine.processStreaming to pierce roots.
     */
    pierceShadow(walker, callback) {
        // Implementation would involve a recursive walker that stacks
        // current walker state and switches to a new walker for the shadowRoot.
    }
};
