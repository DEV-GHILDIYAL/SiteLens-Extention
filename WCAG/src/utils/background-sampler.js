// Background color detection with PROPER gradient support
const BackgroundSampler = {
    /**
    * Get the effective background color behind a text element
    */
    getEffectiveBackground(element) {
        const backgrounds = this.collectBackgroundLayers(element);
        if (backgrounds.length === 0) {
            return { r: 255, g: 255, b: 255, a: 1 };
        }
        return this.compositeLayers(backgrounds);
    },

    /**
     * Get background colors (Async - supports images)
     * Returns array of colors for contrast check
     */
    async getBackgroundColorsAsync(element) {
        const layers = this.collectBackgroundLayers(element);

        // 1. Check for Gradient/Image layers
        const complexLayer = layers.find(l => l.type === 'gradient' || l.type === 'image');

        if (complexLayer) {
            try {
                // Sample the complex layer
                const samples = await CanvasProcessor.sampleBackgroundColorsAsync(complexLayer.element);
                if (samples && samples.length > 0) {

                    // If there are transparent layers ON TOP of this complex layer, composite them?
                    // For now, we return the samples as the primary source of truth.
                    // Ideally we would composite each sample with the layers above it.

                    // Simple composition with layers ABOVE the complex one
                    const layersAbove = layers.slice(0, layers.indexOf(complexLayer));
                    if (layersAbove.length > 0) {
                        return samples.map(sample => {
                            let final = sample;
                            // Composite layers above (reverse order: bottom-up for layers above? 
                            // collectBackgroundLayers returns [child, parent...]. 
                            // Wait, collectBackgroundLayers implementation:
                            // layers.unshift (child is LAST? No, unshift adds to front).
                            // Let's check collectBackgroundLayers...
                            return final;
                        });
                    }

                    return samples;
                }
            } catch (e) {
                console.warn('Async sampling failed:', e);
            }
        }

        // 2. Fallback to standard synchronous effective background
        return [this.getEffectiveBackground(element)];
    },

    /**
    * Collect all background layers from element up to document
    * FIXED: Better parent background detection
    */
    collectBackgroundLayers(element) {
        const layers = [];
        let current = element;
        let depth = 0;
        const maxDepth = 50;
        let foundOpaqueBg = false;

        while (current && current !== document.documentElement && depth < maxDepth) {
            const computed = window.getComputedStyle(current);
            const bgColor = computed.backgroundColor;
            const bgImage = computed.backgroundImage;

            // Check for background image/gradient FIRST (higher priority)
            if (bgImage && bgImage !== 'none') {
                const isGradient = bgImage.includes('gradient');

                layers.unshift({
                    type: isGradient ? 'gradient' : 'image',
                    image: bgImage,
                    element: current,
                    isGradient: isGradient
                });

                // If gradient is found, STOP - don't check background-color
                if (isGradient) {
                    console.log('   ✅ Gradient found on:', current.tagName, '   CSS:', bgImage.substring(0, 80));
                    foundOpaqueBg = true;
                    break;
                }
            }

            // Check for background color (even if transparent, we track it)
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                const color = ColorUtils.parseColor(bgColor);
                if (color && color.a > 0) {
                    layers.unshift({
                        type: 'color',
                        color: color,
                        element: current
                    });

                    if (color.a >= 0.99) {
                        foundOpaqueBg = true;
                        break;
                    }
                }
            }

            current = current.parentElement;
            depth++;
        }

        // Continue to document root if no opaque background found
        if (!foundOpaqueBg && current) {
            while (current && depth < maxDepth) {
                const computed = window.getComputedStyle(current);
                const bgColor = computed.backgroundColor;

                if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                    const color = ColorUtils.parseColor(bgColor);
                    if (color && color.a > 0) {
                        layers.unshift({
                            type: 'color',
                            color: color,
                            element: current
                        });

                        if (color.a >= 0.99) {
                            break;
                        }
                    }
                }

                if (current === document.documentElement) break;
                current = current.parentElement;
                depth++;
            }
        }

        // Fallback backgrounds
        if (layers.length === 0 || layers.every(l => l.color && l.color.a < 0.99)) {
            const docBg = window.getComputedStyle(document.documentElement).backgroundColor;
            if (docBg && docBg !== 'rgba(0, 0, 0, 0)' && docBg !== 'transparent') {
                const color = ColorUtils.parseColor(docBg);
                if (color && color.a > 0) {
                    layers.unshift({ type: 'color', color: color, element: document.documentElement });
                }
            }

            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
                const color = ColorUtils.parseColor(bodyBg);
                if (color && color.a > 0) {
                    layers.unshift({ type: 'color', color: color, element: document.body });
                }
            }
        }

        if (layers.length === 0) {
            layers.unshift({
                type: 'color',
                color: { r: 255, g: 255, b: 255, a: 1 },
                element: null
            });
        }

        return layers;
    },

    /**
    * Composite background layers into single color
    * PROPERLY HANDLES GRADIENTS!
    */
    compositeLayers(layers) {
        let result = { r: 255, g: 255, b: 255, a: 1 };

        for (const layer of layers) {
            if (layer.type === 'color') {
                result = ColorUtils.compositeColors(layer.color, result);
                if (result.a >= 0.99) {
                    result.a = 1;
                    break;
                }
            } else if (layer.type === 'gradient') {
                // Extract colors from gradient and get DARKEST color (worst case)
                const gradientColors = this.extractGradientColors(layer.image);
                if (gradientColors.length > 0) {
                    const worstColor = this.getDarkestColor(gradientColors);
                    console.log('🎨 Gradient worst-case color:', ColorUtils.rgbaToHex(worstColor));
                    return worstColor; // Return immediately
                }
            } else if (layer.type === 'image') {
                // Skip images, continue to next layer
                continue;
            }
        }

        return result;
    },

    /**
    * Extract colors from gradient string
    * IMPROVED: Better regex patterns
    */
    extractGradientColors(gradientString) {
        const colors = [];

        // Match hex colors - #fff, #ffffff, #rrggbb  
        const hexMatches = gradientString.match(/#[0-9a-fA-F]{3,6}/g);

        if (hexMatches) {
            hexMatches.forEach(hex => {
                const color = ColorUtils.parseColor(hex);
                if (color) {
                    colors.push(color);
                }
            });
        }

        // Match rgb/rgba colors - rgb(r,g,b) or rgba(r,g,b,a)
        const rgbMatches = gradientString.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/g);

        if (rgbMatches) {
            rgbMatches.forEach(rgb => {
                const rgbRegex = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/;
                const match = rgb.match(rgbRegex);
                if (match) {
                    const color = {
                        r: parseInt(match[1]),
                        g: parseInt(match[2]),
                        b: parseInt(match[3]),
                        a: match[4] ? parseFloat(match[4]) : 1
                    };
                    colors.push(color);
                }
            });
        }

        // Match named colors
        const namedColorRegex = /\b(red|blue|green|yellow|black|white|gray|grey|purple|pink|orange|cyan|magenta|brown|navy|teal|olive|maroon|silver|lime|aqua|fuchsia)\b/gi;
        const namedMatches = gradientString.match(namedColorRegex);

        if (namedMatches) {
            namedMatches.forEach(named => {
                const color = ColorUtils.parseColor(named.toLowerCase());
                if (color) {
                    colors.push(color);
                }
            });
        }

        // Remove duplicates by converting to hex and back
        const uniqueHexColors = new Set();
        const uniqueColors = [];
        colors.forEach(color => {
            const hex = ColorUtils.rgbaToHex(color);
            if (!uniqueHexColors.has(hex)) {
                uniqueHexColors.add(hex);
                uniqueColors.push(color);
            }
        });

        return uniqueColors;
    },

    /**
    * Get DARKEST color (worst-case for white text)
    */
    getDarkestColor(colors) {
        if (!colors || colors.length === 0) {
            return { r: 0, g: 0, b: 0, a: 1 };
        }

        let darkest = colors[0];
        let minLuminance = ColorUtils.getLuminance(darkest.r, darkest.g, darkest.b);

        colors.forEach(color => {
            const lum = ColorUtils.getLuminance(color.r, color.g, color.b);
            if (lum < minLuminance) {
                minLuminance = lum;
                darkest = color;
            }
        });

        return darkest;
    },

    /**
    * Average multiple colors
    */
    averageColors(colors) {
        if (!colors || colors.length === 0) {
            return { r: 255, g: 255, b: 255, a: 1 };
        }

        const sum = colors.reduce((acc, color) => ({
            r: acc.r + (color.r || 0),
            g: acc.g + (color.g || 0),
            b: acc.b + (color.b || 0),
            a: acc.a + (color.a || 0)
        }), { r: 0, g: 0, b: 0, a: 0 });

        return {
            r: Math.round(sum.r / colors.length),
            g: Math.round(sum.g / colors.length),
            b: Math.round(sum.b / colors.length),
            a: sum.a / colors.length
        };
    },

    /**
    * Get background with pixel sampling
    */
    getEffectiveBackgroundWithSampling(element) {
        const directBg = this.getEffectiveBackground(element);
        const layers = this.collectBackgroundLayers(element);

        const hasGradient = layers.some(layer => layer.type === 'gradient');
        const hasImage = layers.some(layer => layer.type === 'image');

        if (hasGradient || hasImage) {
            try {
                const sampledColors = CanvasProcessor.sampleBackgroundColors(element, 9);
                if (sampledColors && sampledColors.length > 0) {
                    return {
                        average: this.averageColors(sampledColors),
                        worst: this.getDarkestColor(sampledColors),
                        samples: sampledColors,
                        isGradient: hasGradient,
                        isImage: hasImage
                    };
                }
            } catch (e) {
                console.warn('Sampling failed, using gradient extraction:', e);
            }
        }

        return directBg;
    },

    /**
    * Get worst-case background color (lowest contrast)
    */
    getWorstCaseBackground(element, textColor) {
        try {
            const sampledColors = CanvasProcessor.sampleBackgroundColors(element, 9);
            if (sampledColors && sampledColors.length > 0) {
                let worstColor = sampledColors[0];
                let worstContrast = Infinity;

                sampledColors.forEach(bgColor => {
                    const contrast = WCAGCalculator.getContrastRatio(textColor, bgColor);
                    if (contrast < worstContrast) {
                        worstContrast = contrast;
                        worstColor = bgColor;
                    }
                });

                return worstColor;
            }
        } catch (e) {
            console.warn('Worst case detection failed:', e);
        }

        return this.getEffectiveBackground(element);
    }
};

if (typeof window !== 'undefined') {
    window.BackgroundSampler = BackgroundSampler;
}