// Text element detection - FIXED VERSION
const TextDetector = {
  /**
  * Find all text elements - DETECT ACTUAL VISIBLE TEXT
  */
  findTextElements() {
    const textElements = [];
    const processedElements = new Set();

    // Walk through ALL text nodes in the document
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip whitespace-only nodes
          if (!node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();

      // Skip empty or very short text
      if (!text || text.length < 3) continue;

      // Get parent element
      const element = node.parentElement;
      if (!element) continue;

      // Skip if already processed
      if (processedElements.has(element)) continue;

      // Skip invisible or excluded elements
      if (this.shouldSkipElement(element)) continue;
      if (!this.isVisibleElement(element)) continue;

      // Get computed text color
      const computed = window.getComputedStyle(element);
      const textColor = ColorUtils.parseColor(computed.color);

      // Skip if text color is transparent
      if (!textColor || textColor.a === 0) continue;

      // Add to results
      textElements.push({
        element: element,
        text: text
      });

      processedElements.add(element);
    }

    console.log(`✅ TextDetector: Found ${textElements.length} text elements`);
    return textElements;
  },

  /**
  * Get ONLY direct text content (not from child elements)
  */
  getDirectTextContent(element) {
    let text = '';

    // Only get text nodes that are direct children
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }

    return text.trim();
  },

  /**
  * Check if element should be skipped
  */
  shouldSkipElement(element) {
    const tagName = element.tagName.toLowerCase();

    // Skip these tags
    const skipTags = ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'svg', 'path', 'canvas'];
    if (skipTags.includes(tagName)) return true;

    // Skip hidden inputs
    if (tagName === 'input' && element.type === 'hidden') return true;

    // Check visibility
    const computed = window.getComputedStyle(element);
    if (computed.display === 'none' || computed.visibility === 'hidden') return true;

    // Skip if parent is contrast overlay
    if (element.closest('#contrast-checker-overlay')) return true;
    if (element.classList.contains('contrast-overlay-container')) return true;

    return false;
  },

  /**
  * Check if element is visible
  */
  isVisibleElement(element) {
    const computed = window.getComputedStyle(element);

    // Check CSS visibility
    if (computed.display === 'none' ||
      computed.visibility === 'hidden' ||
      parseFloat(computed.opacity) === 0) {
      return false;
    }

    // Check dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    // Check if text color is transparent or matches background exactly
    const textColor = ColorUtils.parseColor(computed.color);

    // SPECIAL CASE: Allow transparent text IF it has background-clip: text (Gradient Text)
    if (textColor.a === 0) {
      const bgClip = computed.webkitBackgroundClip || computed.backgroundClip;
      if (bgClip === 'text') {
        return true; // It IS visible because it uses background not color
      }
      return false; // Truly invisible
    }

    return true;
  },

  /**
  * Get computed text properties
  */
  getTextProperties(element) {
    const computed = window.getComputedStyle(element);
    return {
      color: ColorUtils.parseColor(computed.color),
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      fontFamily: computed.fontFamily,
      lineHeight: computed.lineHeight,
      // Added for Gradient Text support
      backgroundClip: computed.webkitBackgroundClip || computed.backgroundClip,
      backgroundImage: computed.backgroundImage,
      element: element
    };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.TextDetector = TextDetector;
}