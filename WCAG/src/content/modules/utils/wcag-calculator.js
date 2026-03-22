import { ColorUtils } from './color-utils.js';

export const WCAGCalculator = {
    getContrastRatio(color1, color2) {
        const lum1 = ColorUtils.getLuminance(color1.r, color1.g, color1.b);
        const lum2 = ColorUtils.getLuminance(color2.r, color2.g, color2.b);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
    },

    getComplianceDetails(ratio, fontSize, fontWeight) {
        const isLargeText = this.isLargeText(fontSize, fontWeight);
        const requiredAA = isLargeText ? 3.0 : 4.5;
        const requiredAAA = isLargeText ? 4.5 : 7.0;

        return {
            wcagAA: ratio >= requiredAA,
            wcagAAA: ratio >= requiredAAA,
            requiredAA,
            requiredAAA,
            isLargeText
        };
    },

    isLargeText(fontSize, fontWeight) {
        const size = parseFloat(fontSize);
        const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 700;
        if (size >= 18.66) return true; // 14pt (18.66px) bold
        if (size >= 24) return true;   // 18pt (24px) regular
        return false;
    }
};
