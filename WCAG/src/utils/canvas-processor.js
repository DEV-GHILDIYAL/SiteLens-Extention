// Canvas-based background sampling for gradients and images
const CanvasProcessor = {
    canvas: null,
    ctx: null,
    failedImages: new Set(),

    /**
     * Split gradient string by comma, but respect parentheses in rgb/rgba
     */
    splitGradientStops(str) {
        const stops = [];
        let current = '';
        let parenDepth = 0;

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === '(') {
                parenDepth++;
            } else if (char === ')') {
                parenDepth--;
            } else if (char === ',' && parenDepth === 0) {
                if (current.trim()) stops.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }

        if (current.trim()) stops.push(current.trim());
        return stops;
    },

    /**
     * Initialize canvas for sampling
     */
    init() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        }
    },

    /**
     * Extract colors directly from gradient CSS string
     * Returns array of RGB color objects
     */
    extractGradientColorsFromCSS(gradientString) {
        console.log('🎨 Extracting colors directly from CSS:', gradientString);

        // Regex to match various color formats
        const colorRegex = /(rgba?\([^)]+\)|#[a-fA-F0-9]{3,8}|\b(?:red|blue|green|yellow|black|white|gray|grey|purple|pink|orange|cyan|magenta|brown|navy|teal|olive|maroon|silver|lime|aqua|fuchsia)\b)/gi;

        const matches = gradientString.match(colorRegex);
        console.log('🎨 Color matches found:', matches);

        if (!matches || matches.length === 0) {
            console.log('❌ No colors found in gradient');
            return [];
        }

        const colors = [];
        const seen = new Set();

        matches.forEach(colorStr => {
            if (seen.has(colorStr.toLowerCase())) return; // Skip duplicates
            seen.add(colorStr.toLowerCase());

            console.log(`   Processing color: "${colorStr}"`);

            // Parse the color string to RGB
            let rgb = null;

            if (colorStr.startsWith('rgb')) {
                // rgb(r, g, b) or rgba(r, g, b, a)
                const match = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
                if (match) {
                    rgb = {
                        r: parseInt(match[1]),
                        g: parseInt(match[2]),
                        b: parseInt(match[3]),
                        a: match[4] ? parseFloat(match[4]) : 1
                    };
                }
            } else if (colorStr.startsWith('#')) {
                // Hex color
                const hex = colorStr.toLowerCase();
                rgb = this.hexToRgb(hex);
            } else {
                // Named color
                rgb = this.namedColorToRgb(colorStr.toLowerCase());
            }

            if (rgb) {
                console.log(`   ✅ Converted to RGB:`, rgb);
                colors.push(rgb);
            }
        });

        console.log(`🎨 Extracted ${colors.length} unique colors from gradient`);
        return colors;
    },

    /**
     * Convert hex to RGB
     */
    hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { r, g, b, a: 1 };
    },

    /**
     * Convert named color to RGB
     */
    namedColorToRgb(name) {
        const colors = {
            'red': { r: 255, g: 0, b: 0, a: 1 },
            'blue': { r: 0, g: 0, b: 255, a: 1 },
            'green': { r: 0, g: 128, b: 0, a: 1 },
            'yellow': { r: 255, g: 255, b: 0, a: 1 },
            'black': { r: 0, g: 0, b: 0, a: 1 },
            'white': { r: 255, g: 255, b: 255, a: 1 },
            'gray': { r: 128, g: 128, b: 128, a: 1 },
            'grey': { r: 128, g: 128, b: 128, a: 1 }
        };
        return colors[name] || null;
    },

    /**
     * Sample background colors from element
     * Returns array of RGB colors sampled from different points
     */
    /**
     * Sample background colors from element (Async for Images)
     * Returns Promise resolving to array of RGB colors
     */
    async sampleBackgroundColorsAsync(element, numPoints = 9) {
        this.init();

        try {
            const computed = window.getComputedStyle(element);
            const bgImage = computed.backgroundImage;

            console.log(`🎨 Background image: ${bgImage}`);

            // 1. Handle Gradients (Sync)
            if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
                console.log('🎨 Gradient detected - extracting colors from CSS...');
                const colors = this.extractGradientColorsFromCSS(bgImage);
                // ... (reuse existing logic or helper)
                return this.processGradientColors(colors, numPoints, computed.backgroundColor);
            }
            // 2. Handle Images (Async)
            else if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
                console.log('🎨 Image detected - attempting to sample...');
                const colors = await this.sampleImageFromUrl(bgImage, element, numPoints);
                if (colors) return colors;
            }

            // 3. Fallback to Solid
            console.log('🎨 No complex background - using solid background color');
            const bgColor = this.colorStringToRgb(computed.backgroundColor || '#ffffff');
            return Array(numPoints).fill(bgColor);

        } catch (error) {
            console.warn('Canvas sampling failed:', error);
            return null;
        }
    },

    /**
     * Process gradient colors (helper)
     */
    processGradientColors(colors, numPoints, fallbackBg) {
        if (colors && colors.length > 0) {
            if (colors.length === 2) {
                return this.interpolateColors(colors[0], colors[1], numPoints);
            } else {
                const result = [];
                for (let i = 0; i < numPoints; i++) {
                    result.push(colors[i % colors.length]);
                }
                return result;
            }
        } else {
            const bgColor = this.colorStringToRgb(fallbackBg || '#ffffff');
            return Array(numPoints).fill(bgColor);
        }
    },

    /**
     * Sample from Image URL
     */
    sampleImageFromUrl(bgImageStr, element, numPoints) {
        return new Promise((resolve) => {
            const match = bgImageStr.match(/url\(['"]?(.*?)['"]?\)/);
            if (!match) { resolve(null); return; }

            const url = match[1];
            if (this.failedImages.has(url)) { resolve(null); return; }

            const img = new Image();
            img.crossOrigin = "Anonymous";
            let resolved = false;

            const safeResolve = (val) => {
                if (!resolved) {
                    resolved = true;
                    resolve(val);
                }
            };

            img.onload = () => {
                try {
                    // Resize canvas to element size for accurate sampling
                    const rect = element.getBoundingClientRect();
                    // Limit size for performance
                    const w = Math.min(rect.width || 100, 500);
                    const h = Math.min(rect.height || 100, 500);

                    this.canvas.width = w;
                    this.canvas.height = h;

                    this.ctx.drawImage(img, 0, 0, w, h);

                    // Sample points
                    const samples = [];
                    // Grid sampling
                    const stepX = w / 3;
                    const stepY = h / 3;

                    for (let x = stepX / 2; x < w; x += stepX) {
                        for (let y = stepY / 2; y < h; y += stepY) {
                            const p = this.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
                            samples.push({ r: p[0], g: p[1], b: p[2], a: p[3] / 255 });
                        }
                    }

                    // Fill remaining if needed
                    while (samples.length < numPoints) samples.push(samples[0]);

                    safeResolve(samples.slice(0, numPoints));
                } catch (e) {
                    console.warn('🎨 Canvas error during sampling:', e);
                    safeResolve(null);
                }
            };

            img.onerror = () => {
                console.log('🎨 Skip background image (load failed):', url);
                this.failedImages.add(url);
                safeResolve(null);
            };

            img.src = url;
            // Timeout to prevent hanging
            setTimeout(() => safeResolve(null), 1500);
        });
    },

    /**
     * Interpolate between two RGB colors
     */
    interpolateColors(color1, color2, steps) {
        const result = [];
        for (let i = 0; i < steps; i++) {
            const t = steps === 1 ? 0 : i / (steps - 1);
            result.push({
                r: Math.round(color1.r + (color2.r - color1.r) * t),
                g: Math.round(color1.g + (color2.g - color1.g) * t),
                b: Math.round(color1.b + (color2.b - color1.b) * t),
                a: color1.a + (color2.a - color1.a) * t
            });
        }
        return result;
    },

    /**
     * Convert CSS color string to RGB object
     */
    colorStringToRgb(colorStr) {
        if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
            if (match) {
                return {
                    r: parseInt(match[1]),
                    g: parseInt(match[2]),
                    b: parseInt(match[3]),
                    a: match[4] ? parseFloat(match[4]) : 1
                };
            }
        } else if (colorStr.startsWith('#')) {
            return this.hexToRgb(colorStr);
        }
        return { r: 255, g: 255, b: 255, a: 1 };
    },

    /**
     * Parse CSS gradient string and create canvas gradient
     */
    parseGradient(gradientString, width, height) {
        try {
            // Linear gradient
            if (gradientString.includes('linear-gradient')) {
                return this.parseLinearGradient(gradientString, width, height);
            }

            // Radial gradient
            if (gradientString.includes('radial-gradient')) {
                return this.parseRadialGradient(gradientString, width, height);
            }

            return null;
        } catch (e) {
            console.warn('Gradient parsing error:', e);
            return null;
        }
    },

    /**
     * Extract content from gradient function (handles nested parentheses)
     */
    extractGradientContent(str, type) {
        const startStr = `${type}(`;
        const startIdx = str.indexOf(startStr);
        if (startIdx === -1) return null;

        let parenCount = 0;
        let contentStart = startIdx + startStr.length;
        let contentEnd = contentStart;

        for (let i = contentStart; i < str.length; i++) {
            if (str[i] === '(') parenCount++;
            if (str[i] === ')') {
                if (parenCount === 0) {
                    contentEnd = i;
                    break;
                }
                parenCount--;
            }
        }

        return str.substring(contentStart, contentEnd);
    },

    /**
     * Parse linear gradient
     */
    parseLinearGradient(str, width, height) {
        // Extract direction and color stops using parenthesis counting
        const content = this.extractGradientContent(str, 'linear-gradient');
        if (!content) {
            console.log('🎨 Failed to extract linear-gradient content');
            return null;
        }

        console.log(`🎨 Extracted gradient content: "${content}"`);
        const parts = this.splitGradientStops(content);

        // Default direction: to bottom (0deg)
        let angle = 180; // degrees
        let colorStops = parts;

        // Check if first part is direction
        if (parts[0].includes('deg') || parts[0].includes('to ')) {
            if (parts[0].includes('deg')) {
                angle = parseFloat(parts[0]);
                console.log(`🎨 Direction detected: ${parts[0]} → Angle: ${angle}°`);
            } else if (parts[0].includes('to bottom')) {
                angle = 180;
                console.log('🎨 Direction: to bottom');
            } else if (parts[0].includes('to top')) {
                angle = 0;
                console.log('🎨 Direction: to top');
            } else if (parts[0].includes('to right')) {
                angle = 90;
                console.log('🎨 Direction: to right');
            } else if (parts[0].includes('to left')) {
                angle = 270;
                console.log('🎨 Direction: to left');
            }
            colorStops = parts.slice(1);
        } else {
            console.log(`🎨 No direction detected in first part: "${parts[0]}" - using default angle 180`);
        }

        // Convert angle to radians
        const rad = (angle - 90) * Math.PI / 180;

        // Calculate gradient line
        const centerX = width / 2;
        const centerY = height / 2;
        const lineLength = Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad));

        const x0 = centerX - (lineLength / 2) * Math.cos(rad);
        const y0 = centerY - (lineLength / 2) * Math.sin(rad);
        const x1 = centerX + (lineLength / 2) * Math.cos(rad);
        const y1 = centerY + (lineLength / 2) * Math.sin(rad);

        console.log(`🎨 Gradient setup - Angle: ${angle}° Canvas: ${width}x${height}`);
        console.log(`   Line: (${x0.toFixed(0)}, ${y0.toFixed(0)}) → (${x1.toFixed(0)}, ${y1.toFixed(0)})`);
        console.log(`🎨 Processing ${colorStops.length} color stops`);

        const gradient = this.ctx.createLinearGradient(x0, y0, x1, y1);

        // Add color stops
        console.log('🎨 Parsing linear gradient - Color stops:', colorStops);
        colorStops.forEach((stop, i) => {
            // Match color followed by optional percentage
            // Handles: #fff, #ffffff, rgb(0,0,0), rgba(0,0,0,1), red, etc.
            const colorStopMatch = stop.match(/^((?:#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|\w+))(?:\s+([\d.]+)%)?/);
            if (colorStopMatch) {
                const color = colorStopMatch[1].trim();
                const position = colorStopMatch[2] ? parseFloat(colorStopMatch[2]) / 100 : i / (colorStops.length - 1);
                console.log(`   Stop ${i}: Color="${color}" at position ${position}`);
                gradient.addColorStop(position, color);
            } else {
                console.log(`   Stop ${i}: Failed to parse "${stop}"`);
            }
        });

        console.log('✅ Linear gradient created successfully');
        return gradient;
    },

    /**
     * Parse radial gradient
     */
    parseRadialGradient(str, width, height) {
        // Extract direction and color stops using parenthesis counting
        const content = this.extractGradientContent(str, 'radial-gradient');
        if (!content) {
            console.log('🎨 Failed to extract radial-gradient content');
            return null;
        }

        console.log(`🎨 Extracted radial gradient content: "${content}"`);
        const parts = this.splitGradientStops(content);
        const colorStops = parts.filter(p => !p.includes('circle') && !p.includes('at '));

        const gradient = this.ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) / 2
        );

        console.log('🎨 Parsing radial gradient - Color stops:', colorStops);
        colorStops.forEach((stop, i) => {
            // Match color followed by optional percentage
            // Handles: #fff, #ffffff, rgb(0,0,0), rgba(0,0,0,1), red, etc.
            const colorStopMatch = stop.match(/^((?:#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|\w+))(?:\s+([\d.]+)%)?/);
            if (colorStopMatch) {
                const color = colorStopMatch[1].trim();
                const position = colorStopMatch[2] ? parseFloat(colorStopMatch[2]) / 100 : i / (colorStops.length - 1);
                console.log(`   Stop ${i}: Color="${color}" at position ${position}`);
                gradient.addColorStop(position, color);
            } else {
                console.log(`   Stop ${i}: Failed to parse "${stop}"`);
            }
        });

        return gradient;
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.CanvasProcessor = CanvasProcessor;
}