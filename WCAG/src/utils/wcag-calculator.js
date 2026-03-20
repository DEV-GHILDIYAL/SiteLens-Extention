// WCAG contrast ratio calculations - STRICT AND ACCURATE
const WCAGCalculator = {
    /**
    * Calculate contrast ratio between two colors
    * Formula: (L1 + 0.05) / (L2 + 0.05) where L1 is lighter
    * RETURNS: Number between 1 and 21
    */
    getContrastRatio(color1, color2) {
        // Validate inputs
        if (!color1 || !color2 || 
            typeof color1.r === 'undefined' || 
            typeof color2.r === 'undefined') {
            console.warn('⚠️ Invalid colors for contrast calculation');
            return 1; // Minimum contrast
        }
        
        const lum1 = ColorUtils.getLuminance(color1.r, color1.g, color1.b);
        const lum2 = ColorUtils.getLuminance(color2.r, color2.g, color2.b);
        
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        
        const ratio = (lighter + 0.05) / (darker + 0.05);
        
        // Validate result
        if (isNaN(ratio) || !isFinite(ratio)) {
            console.warn('⚠️ Invalid contrast ratio calculated');
            return 1;
        }
        
        // Clamp between 1 and 21
        return Math.max(1, Math.min(21, ratio));
    },
    
    /**
    * Determine if text meets WCAG requirements
    * STRICT: Uses exact comparison with small epsilon for floating point
    */
    meetsWCAG(contrastRatio, fontSize, fontWeight, level = 'AA') {
        const isLargeText = this.isLargeText(fontSize, fontWeight);
        const requirements = {
            'AA': {
                normal: 4.5,
                large: 3.0
            },
            'AAA': {
                normal: 7.0,
                large: 4.5
            }
        };
        
        const threshold = requirements[level][isLargeText ? 'large' : 'normal'];
        
        // Use small epsilon for floating point comparison
        const EPSILON = 0.001;
        
        // Must be >= threshold (accounting for floating point precision)
        return contrastRatio >= (threshold - EPSILON);
    },
    
    /**
    * Determine if text is considered "large" by WCAG
    * Large text: 18pt (24px) or 14pt (18.66px) bold
    */
    isLargeText(fontSize, fontWeight) {
        const size = parseFloat(fontSize);
        const weight = this.normalizeFontWeight(fontWeight);
        
        // 18pt = 24px or larger
        if (size >= 24) return true;
        
        // 14pt = 18.66px or larger AND bold (700+)
        if (size >= 18.66 && weight >= 700) return true;
        
        return false;
    },
    
    /**
    * Normalize font weight to numeric value
    */
    normalizeFontWeight(fontWeight) {
        const weights = {
            'normal': 400,
            'bold': 700,
            'lighter': 300,
            'bolder': 700,
            '100': 100,
            '200': 200,
            '300': 300,
            '400': 400,
            '500': 500,
            '600': 600,
            '700': 700,
            '800': 800,
            '900': 900
        };
        
        if (typeof fontWeight === 'number') {
            return fontWeight;
        }
        
        if (typeof fontWeight === 'string') {
            const numeric = parseInt(fontWeight);
            if (!isNaN(numeric)) return numeric;
            return weights[fontWeight.toLowerCase()] || 400;
        }
        
        return 400;
    },
    
    /**
    * Get compliance details for a given contrast ratio
    * STRICT: Accurate pass/fail determination
    */
    getComplianceDetails(contrastRatio, fontSize, fontWeight) {
        const isLarge = this.isLargeText(fontSize, fontWeight);
        
        // STRICT comparison
        const passesAA = this.meetsWCAG(contrastRatio, fontSize, fontWeight, 'AA');
        const passesAAA = this.meetsWCAG(contrastRatio, fontSize, fontWeight, 'AAA');
        
        return {
            ratio: contrastRatio,
            isLargeText: isLarge,
            wcagAA: passesAA,
            wcagAAA: passesAAA,
            requiredAA: isLarge ? 3.0 : 4.5,
            requiredAAA: isLarge ? 4.5 : 7.0
        };
    },
    
    /**
    * Format contrast ratio for display
    */
    formatRatio(ratio) {
        return ratio.toFixed(2) + ':1';
    },
    
    /**
     * Check if ratio is borderline (within 0.5 of threshold)
     */
    isBorderline(contrastRatio, fontSize, fontWeight, level = 'AA') {
        const isLarge = this.isLargeText(fontSize, fontWeight);
        const threshold = level === 'AA' 
            ? (isLarge ? 3.0 : 4.5)
            : (isLarge ? 4.5 : 7.0);
        
        const diff = Math.abs(contrastRatio - threshold);
        return diff <= 0.5;
    }
};

// Make available globally for content scripts
if (typeof window !== 'undefined') {
    window.WCAGCalculator = WCAGCalculator;
}