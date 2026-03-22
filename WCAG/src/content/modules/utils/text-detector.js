import { ColorUtils } from './color-utils.js';

export const TextDetector = {
    shouldSkipElement(element) {
        const tagName = element.tagName.toLowerCase();
        const skipTags = ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'svg', 'path', 'canvas'];
        if (skipTags.includes(tagName)) return true;
        
        const computed = window.getComputedStyle(element);
        if (computed.display === 'none' || computed.visibility === 'hidden') return true;
        
        return false;
    },

    isVisibleElement(element) {
        const computed = window.getComputedStyle(element);
        if (computed.display === 'none' || computed.visibility === 'hidden' || parseFloat(computed.opacity) === 0) return false;
        
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const textColor = ColorUtils.parseColor(computed.color);
        if (textColor.a === 0) {
            const bgClip = computed.webkitBackgroundClip || computed.backgroundClip;
            if (bgClip === 'text') return true;
            return false;
        }
        return true;
    },

    getTextProperties(element) {
        const computed = window.getComputedStyle(element);
        return {
            color: ColorUtils.parseColor(computed.color),
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            fontFamily: computed.fontFamily,
            lineHeight: computed.lineHeight,
            backgroundClip: computed.webkitBackgroundClip || computed.backgroundClip,
            backgroundImage: computed.backgroundImage,
            element: element
        };
    }
};
