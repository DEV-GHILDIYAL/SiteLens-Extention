// Color utility functions for parsing and converting colors
const ColorUtils = {
    _tempElement: null,
    
    /**
    * Parse any CSS color string to RGBA
    */
    parseColor(colorString) {
        if (!colorString || colorString === 'transparent') {
            return { r: 0, g: 0, b: 0, a: 0 };
        }
        
        // Create and cache temporary element for color parsing
        if (!this._tempElement) {
            this._tempElement = document.createElement('div');
            this._tempElement.style.display = 'none';
            document.body.appendChild(this._tempElement);
        }
        
        this._tempElement.style.color = colorString;
        const computed = window.getComputedStyle(this._tempElement).color;
        
        // Parse rgb/rgba format
        const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: match[4] ? parseFloat(match[4]) : 1
            };
        }
        return { r: 0, g: 0, b: 0, a: 1 };
    },
    
    /**
    * Convert RGB to relative luminance (WCAG formula)
    */
    getLuminance(r, g, b) {
        // Normalize to 0-1
        const [rs, gs, bs] = [r, g, b].map(val => {
            val = val / 255;
            return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    },
    
    /**
    * Composite two colors with alpha blending
    */
    compositeColors(foreground, background) {
        const alpha = foreground.a;
        if (alpha === 0) return background;
        if (alpha === 1) return foreground;
        return {
            r: Math.round(foreground.r * alpha + background.r * (1 - alpha)),
            g: Math.round(foreground.g * alpha + background.g * (1 - alpha)),
            b: Math.round(foreground.b * alpha + background.b * (1 - alpha)),
            a: 1
        };
    },
    
    /**
    * Get color from pixel data
    */
    getPixelColor(imageData, x, y) {
        const index = (y * imageData.width + x) * 4;
        return {
            r: imageData.data[index],
            g: imageData.data[index + 1],
            b: imageData.data[index + 2],
            a: imageData.data[index + 3] / 255
        };
    },
    
    /**
    * Convert RGBA to hex string
    */
    rgbaToHex(color) {
        const toHex = (val) => {
            const hex = Math.round(val).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
    }
};

// Make available globally for content scripts
if (typeof window !== 'undefined') {
    window.ColorUtils = ColorUtils;
}