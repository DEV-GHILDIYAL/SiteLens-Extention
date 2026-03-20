// DOM traversal and element analysis utilities
const DOMTraverser = {
    /**
    * Get all ancestors of an element up to document
    */
    getAncestors(element) {
        const ancestors = [];
        let current = element.parentElement;
        while (current && current !== document.documentElement) {
            ancestors.push(current);
            current = current.parentElement;
        }
        if (document.documentElement) {
            ancestors.push(document.documentElement);
        }
        return ancestors;
    },
    /**
    * Check if element has any positioned ancestors (for layering context)
    */
    hasPositionedAncestor(element) {
        const ancestors = this.getAncestors(element);
        for (const ancestor of ancestors) {
            const computed = window.getComputedStyle(ancestor);
            const position = computed.position;
            if (position === 'relative' || position === 'absolute' || position === 'fixed' || position
                === 'sticky') {
                return true;
            }
        }
        return false;
    },
    /**
    * Get stacking context for element
    */
    getStackingContext(element) {
        let current = element;
        while (current && current !== document.documentElement) {
            const computed = window.getComputedStyle(current);
            // Check if this creates a stacking context
            if (this.createsStackingContext(current, computed)) {
                return current;
            }
            current = current.parentElement;
        }
        return document.documentElement;
    },
    /**
    * Check if element creates a stacking context
    */
    createsStackingContext(element, computed) {
        // Root element
        if (element === document.documentElement) {
            return true;
        }
        // Position with z-index
        const position = computed.position;
        if ((position === 'absolute' || position === 'relative' || position === 'fixed' || position
            === 'sticky') &&
            computed.zIndex !== 'auto') {
            return true;
        }
        // Opacity less than 1
        if (parseFloat(computed.opacity) < 1) {
            return true;
        }
        // Transform
        if (computed.transform !== 'none') {
            return true;
        }
        // Filter
        if (computed.filter !== 'none') {
            return true;
        }
        // Flex/grid with z-index
        const parent = element.parentElement;
        if (parent) {
            const parentComputed = window.getComputedStyle(parent);
            if ((parentComputed.display === 'flex' || parentComputed.display === 'grid') && computed.zIndex !== 'auto') {
                return true;
            }
        }
        return false;
    },
    /**
    * Get z-index chain for element
    */
    getZIndexChain(element) {
        const chain = [];
        let current = element;
        while (current && current !== document.documentElement) {
            const computed = window.getComputedStyle(current);
            const zIndex = computed.zIndex;
            if (zIndex !== 'auto') {
                chain.push({
                    element: current,
                    zIndex: parseInt(zIndex) || 0
                });
            }
            current = current.parentElement;
        }
        return chain;
    },
    /**
    * Check if two elements overlap visually
    */
    doElementsOverlap(element1, element2) {
        const rect1 = element1.getBoundingClientRect();
        const rect2 = element2.getBoundingClientRect();
        return !(
            rect1.right < rect2.left ||
            rect1.left > rect2.right ||
            rect1.bottom < rect2.top ||
            rect1.top > rect2.bottom
        );
    },
    /**
    * Get element's effective z-index considering stacking context
    */getEffectiveZIndex(element) {
        const stackingContext = this.getStackingContext(element);
        const computed = window.getComputedStyle(element);
        let zIndex = 0;
        if (computed.zIndex !== 'auto') {
            zIndex = parseInt(computed.zIndex) || 0;
        }
        return {
            zIndex: zIndex,
            stackingContext: stackingContext
        };
    },
    /**
    * Find all elements that could be behind a given element
    */
    findElementsBehind(element) {
        const rect = element.getBoundingClientRect();
        const behind = [];
        // Get all elements in the document
        const allElements = document.querySelectorAll('*');
        for (const other of allElements) {
            if (other === element) continue;
            if (!this.doElementsOverlap(element, other)) continue;
            // Check if this element is actually behind
            if (this.isElementBehind(other, element)) {
                behind.push(other);
            }
        }
        return behind;
    },
    /**
    * Check if element1 is visually behind element2
    */
    isElementBehind(element1, element2) {
        const z1 = this.getEffectiveZIndex(element1);
        const z2 = this.getEffectiveZIndex(element2);
        // Different stacking contexts
        if (z1.stackingContext !== z2.stackingContext) {
            // Would need more complex comparison
            return false;
        }// Same stacking context - compare z-index
        if (z1.zIndex < z2.zIndex) {
            return true;
        }
        if (z1.zIndex === z2.zIndex) {
            // If same z-index, DOM order matters
            return element1.compareDocumentPosition(element2) & Node.DOCUMENT_POSITION_FOLLOWING;
        }
        return false;
    }
};
// Make available globally for content scripts
if (typeof window !== 'undefined') {
    window.DOMTraverser = DOMTraverser;
}