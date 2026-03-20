// Main contrast analysis engine - FIXED FOR ALL EDGE CASES
const ContrastAnalyzer = {
    violations: [],
    isAnalyzing: false,
    version: '2.1.0', // Version tracking for debugging

    /**
    * Analyze entire page for contrast violations
    */
    async analyzePage() {
        if (this.isAnalyzing) {
            console.log('Analysis already in progress');
            return this.violations;
        }

        this.isAnalyzing = true;
        this.violations = [];

        try {
            console.log('🔍 Starting contrast analysis...');

            const textElements = TextDetector.findTextElements();
            console.log(`📝 Found ${textElements.length} text elements to analyze`);

            for (let i = 0; i < textElements.length; i++) {
                const item = textElements[i];

                try {
                    const violation = await this.analyzeTextElement(item);
                    if (violation) {
                        this.violations.push(violation);
                        console.log(`⚠️ Violation ${this.violations.length}: [${violation.category}] ${violation.text.substring(0, 30)}... Ratio: ${violation.contrastRatio.toFixed(2)}:1`);
                    }

                    if ((i + 1) % 20 === 0) {
                        console.log(`📊 Progress: ${i + 1}/${textElements.length}`);
                    }
                } catch (error) {
                    console.warn('⚠️ Error analyzing element:', error);
                }
            }

            const summary = this.getCategorizedSummary();
            console.log(`✅ Analysis complete!`);
            console.log(`📊 Total violations: ${this.violations.length}`);
            console.log(`📂 By category:`, summary);

        } catch (error) {
            console.error('❌ Analysis failed:', error);
        } finally {
            this.isAnalyzing = false;
        }

        return this.violations;
    },

    /**
    * Analyze a single text element - FIXED FOR ALL CASES
    */
    /**
    * Analyze a single text element - FIXED FOR ALL CASES (Including Gradient Text)
    */
    /**
    * Analyze a single text element - STRICT GRADIENT CHECK (Worst Case)
    */
    async analyzeTextElement(item) {
        const { element, text } = item;
        const textProps = TextDetector.getTextProperties(element);
        const fontSize = parseFloat(textProps.fontSize);
        const fontWeight = textProps.fontWeight;

        let foregroundColors = [];
        let isGradientText = false;

        // 1. FOREGROUND COLOR EXTRACTION
        if (textProps.color.a === 0 && textProps.backgroundClip === 'text' && textProps.backgroundImage) {
            // Gradient Text
            isGradientText = true;
            const extracted = BackgroundSampler.extractGradientColors(textProps.backgroundImage);
            foregroundColors = extracted.length > 0 ? extracted : [{ r: 0, g: 0, b: 0, a: 1 }];
        } else if (textProps.color.a === 0) {
            return null; // Invisible
        } else {
            // Solid Text
            foregroundColors = [textProps.color];
        }

        // 2. BACKGROUND COLOR EXTRACTION
        let backgroundColors = [];
        let isGradientBg = false;
        let isImage = false;

        try {
            // Check layers for flags
            const layers = BackgroundSampler.collectBackgroundLayers(element);
            if (layers.some(l => l.type === 'gradient')) isGradientBg = true;
            if (layers.some(l => l.type === 'image')) isImage = true;

            // Get Colors (Async - supports images now!)
            backgroundColors = await BackgroundSampler.getBackgroundColorsAsync(element);

            if (!backgroundColors || backgroundColors.length === 0) {
                backgroundColors = [{ r: 255, g: 255, b: 255, a: 1 }];
            }
        } catch (e) {
            console.warn('Background detection error:', e);
            backgroundColors = [{ r: 255, g: 255, b: 255, a: 1 }];
        }

        // Composite transparent BGs
        backgroundColors = backgroundColors.map(bg => {
            if (bg.a < 1) {
                const parentBg = this.getParentBackground(element);
                return ColorUtils.compositeColors(bg, parentBg);
            }
            return bg;
        });

        // 3. COMBINATORIAL CHECK (The Core Requirement)
        // We must check EVERY FG color against EVERY BG color.
        // If ANY combination fails, the whole element fails (Worst Case Principle).

        let minContrast = Infinity;
        let maxContrast = -Infinity;
        let worstFgColor = foregroundColors[0];
        let worstBgColor = backgroundColors[0];

        const requiredRatioAA = WCAGCalculator.getComplianceDetails(0, fontSize, fontWeight).requiredAA;
        const requiredRatioAAA = WCAGCalculator.getComplianceDetails(0, fontSize, fontWeight).requiredAAA;

        let passCountAA = 0;
        let passCountAAA = 0;
        let failCount = 0;

        for (const fg of foregroundColors) {
            for (const bg of backgroundColors) {
                const ratio = WCAGCalculator.getContrastRatio(fg, bg);

                if (ratio < minContrast) {
                    minContrast = ratio;
                    worstFgColor = fg;
                    worstBgColor = bg;
                }
                if (ratio > maxContrast) {
                    maxContrast = ratio;
                }

                // Track statistics
                if (ratio >= requiredRatioAA) passCountAA++;
                if (ratio >= requiredRatioAAA) passCountAAA++;
                if (ratio < requiredRatioAA) failCount++;
            }
        }

        const contrastRatio = minContrast; // WORST CASE

        if (isNaN(contrastRatio) || !isFinite(contrastRatio)) return null;

        const compliance = WCAGCalculator.getComplianceDetails(contrastRatio, fontSize, fontWeight);
        const EPSILON = 0.01;

        if (contrastRatio < compliance.requiredAA - EPSILON) {
            const category = this.categorizeViolation(element, isGradientBg || isGradientText, isImage);

            const violation = {
                element: element,
                text: text.substring(0, 100),
                textColor: ColorUtils.rgbaToHex(worstFgColor),
                backgroundColor: ColorUtils.rgbaToHex(worstBgColor),
                contrastRatio: contrastRatio,
                compliance: compliance,
                location: this.getElementLocation(element),
                selector: this.generateSelector(element),
                fontSize: fontSize,
                fontWeight: fontWeight,
                category: category,
                isGradient: isGradientBg || isGradientText,
                isImage: isImage
            };

            // Add specific details for the 4 Scenarios
            if (isGradientText || isGradientBg) {
                let scenario = 'Unknown';
                if (!isGradientText && !isGradientBg) scenario = 'Solid vs Solid';
                else if (!isGradientText && isGradientBg) scenario = 'Solid Text vs Gradient BG';
                else if (isGradientText && !isGradientBg) scenario = 'Gradient Text vs Solid BG';
                else if (isGradientText && isGradientBg) scenario = 'Gradient vs Gradient';

                violation.gradientDetails = {
                    scenario: scenario,
                    checkedCombinations: foregroundColors.length * backgroundColors.length,
                    totalColors: foregroundColors.length * backgroundColors.length, // Required by Overlay
                    passCountAA: passCountAA,
                    passCountAAA: passCountAAA,
                    failCount: failCount, // Required by Overlay
                    worstRatio: minContrast.toFixed(2),
                    bestRatio: maxContrast.toFixed(2),
                    note: `Failed ${scenario} check. Worst pair: ${minContrast.toFixed(2)}:1`
                };
            }

            return violation;
        }

        return null;
    },

    /**
     * Get worst-case color for contrast calculation
     * For light text: return darkest background
     * For dark text: return lightest background
     */
    getWorstCaseColor(textColor, backgroundColors) {
        if (!backgroundColors || backgroundColors.length === 0) {
            return { r: 255, g: 255, b: 255, a: 1 };
        }

        if (backgroundColors.length === 1) {
            return backgroundColors[0];
        }

        // Calculate luminance of text
        const textLum = ColorUtils.getLuminance(textColor.r, textColor.g, textColor.b);

        let worstColor = backgroundColors[0];
        let worstContrast = WCAGCalculator.getContrastRatio(textColor, worstColor);

        // Find color with LOWEST contrast (worst case)
        for (let i = 1; i < backgroundColors.length; i++) {
            const contrast = WCAGCalculator.getContrastRatio(textColor, backgroundColors[i]);
            if (contrast < worstContrast) {
                worstContrast = contrast;
                worstColor = backgroundColors[i];
            }
        }

        return worstColor;
    },

    /**
     * Get parent background (for transparent elements)
     */
    getParentBackground(element) {
        let parent = element.parentElement;
        let depth = 0;
        const maxDepth = 20;

        while (parent && depth < maxDepth) {
            const computed = window.getComputedStyle(parent);
            const bgColor = computed.backgroundColor;

            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                const color = ColorUtils.parseColor(bgColor);
                if (color && color.a > 0) {
                    return color;
                }
            }

            parent = parent.parentElement;
            depth++;
        }

        // Ultimate fallback
        return { r: 255, g: 255, b: 255, a: 1 };
    },

    /**
    * Categorize violation type - IMPROVED
    */
    categorizeViolation(element, isGradient, isImage) {
        // Simplified categories: Only TEXT, BUTTON, GRADIENT

        if (isGradient) {
            return 'gradient';
        }

        const tagName = element.tagName.toLowerCase();
        if (tagName === 'button' || element.getAttribute('role') === 'button') {
            return 'button';
        }

        return 'text';
    },

    /**
    * Get element location
    */
    getElementLocation(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: Math.round(rect.top + window.scrollY),
            left: Math.round(rect.left + window.scrollX),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    },

    /**
    * Generate CSS selector
    */
    generateSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }

        const path = [];
        let current = element;

        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();

            if (current.className && typeof current.className === 'string') {
                const classes = current.className.trim().split(/\s+/).slice(0, 2);
                if (classes.length > 0 && classes[0]) {
                    selector += '.' + classes.join('.');
                }
            }

            path.unshift(selector);
            current = current.parentElement;

            if (path.length >= 4) break;
        }

        return path.join(' > ');
    },

    /**
    * Get categorized summary
    */
    getCategorizedSummary() {
        const categories = {
            text: 0,
            button: 0,
            gradient: 0,
            image: 0,
            'parent-background': 0,
            'complex-nesting': 0
        };

        this.violations.forEach(v => {
            const cat = v.category || 'text';
            if (categories.hasOwnProperty(cat)) {
                categories[cat]++;
            } else {
                categories.text++;
            }
        });

        return categories;
    },

    /**
    * Get violations summary
    */
    getViolationsSummary() {
        return {
            total: this.violations.length,
            byLevel: {
                failsAA: this.violations.filter(v => !v.compliance.wcagAA).length,
                failsAAA: this.violations.filter(v => !v.compliance.wcagAAA).length
            },
            byCategory: this.getCategorizedSummary(),
            worstContrast: this.violations.reduce((worst, v) => {
                return (!worst || v.contrastRatio < worst.contrastRatio) ? v : worst;
            }, null)
        };
    },

    /**
    * Clear violations
    */
    clearViolations() {
        this.violations = [];
        console.log('🗑️ Violations cleared');
    },

    /**
    * Export violations
    */
    exportViolations() {
        return {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            summary: this.getViolationsSummary(),
            violations: this.violations.map(v => ({
                text: v.text,
                textColor: v.textColor,
                backgroundColor: v.backgroundColor,
                contrastRatio: WCAGCalculator.formatRatio(v.contrastRatio),
                wcagAA: v.compliance.wcagAA,
                wcagAAA: v.compliance.wcagAAA,
                requiredAA: v.compliance.requiredAA,
                requiredAAA: v.compliance.requiredAAA,
                fontSize: v.fontSize,
                fontWeight: v.fontWeight,
                selector: v.selector,
                location: v.location,
                category: v.category,
                isGradient: v.isGradient,
                isImage: v.isImage
            }))
        };
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.ContrastAnalyzer = ContrastAnalyzer;
}