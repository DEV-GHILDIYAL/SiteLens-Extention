// Color Scheme Analyzer
const ColorAnalyzer = {
    /**
     * Analyze all colors on the page
     */
    analyzePage() {
        console.log('🎨 Starting color analysis...');

        const colorCounts = new Map();
        const colorMap = {
            text: new Set(),
            background: new Set(),
            border: new Set()
        };

        const elements = document.querySelectorAll('*');
        let processed = 0;

        elements.forEach(el => {
            // Optimization: skip hidden elements quickly
            if (el.offsetParent === null) return;

            const style = window.getComputedStyle(el);
            processed++;

            // Helper to track color
            const track = (c, type) => {
                if (!c) return;
                colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
                colorMap[type].add(c);
            };

            track(this.parseColor(style.color), 'text');
            track(this.parseColor(style.backgroundColor), 'background');

            if (style.borderWidth !== '0px') {
                track(this.parseColor(style.borderColor), 'border');
            }
        });

        // Filter: Keep colors that appear at least 2 times (unless total colors is small)
        // Sort by frequency
        let sortedColors = Array.from(colorCounts.entries())
            .sort((a, b) => b[1] - a[1]) // High freq first
            .map(e => e[0]);

        // Smart Filtering: If > 50 colors, cut off those with < 2 occurrences
        if (sortedColors.length > 50) {
            sortedColors = Array.from(colorCounts.entries())
                .filter(e => e[1] > 1)
                .sort((a, b) => b[1] - a[1])
                .map(e => e[0]);
        }

        console.log(`🎨 Found ${sortedColors.length} unique colors (scanned ${processed} visible elements)`);

        return {
            success: true,
            total: sortedColors.length,
            allColors: sortedColors,
            details: {
                text: Array.from(colorMap.text).filter(c => colorCounts.get(c) > 0).sort(),
                background: Array.from(colorMap.background).filter(c => colorCounts.get(c) > 0).sort(),
                border: Array.from(colorMap.border).filter(c => colorCounts.get(c) > 0).sort()
            }
        };
    },

    /**
     * Parse color to consistent HEX format
     */
    parseColor(colorStr) {
        if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
            return null;
        }

        try {
            // Handle RGB/RGBA
            if (colorStr.startsWith('rgb')) {
                const rgb = colorStr.match(/\d+/g);
                if (!rgb || rgb.length < 3) return null;

                // Ignore fully transparent colors
                if (rgb.length === 4 && parseInt(rgb[3]) === 0) return null;

                return this.rgbToHex(parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2]));
            }
            return null; // Ignore non-rgb for now (rare in getComputedStyle)
        } catch (e) {
            return null;
        }
    },

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.ColorAnalyzer = ColorAnalyzer;
}
