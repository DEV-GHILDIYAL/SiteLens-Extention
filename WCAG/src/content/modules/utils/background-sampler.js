import { ColorUtils } from './color-utils.js';

export const BackgroundSampler = {
    async getBackgroundColorsAsync(element) {
        const layers = this.collectBackgroundLayers(element);
        const colors = [];

        for (const layer of layers) {
            if (layer.type === 'color') {
                colors.push(layer.color);
            } else if (layer.type === 'gradient') {
                const gradientColors = this.extractGradientColors(layer.value);
                colors.push(...gradientColors);
            }
        }

        if (colors.length === 0) {
            return [this.getParentBackground(element)];
        }
        return colors;
    },

    collectBackgroundLayers(element) {
        const layers = [];
        let current = element;
        while (current && current !== document.documentElement) {
            const style = window.getComputedStyle(current);
            const bgColor = style.backgroundColor;
            const bgImage = style.backgroundImage;

            if (bgImage && bgImage !== 'none') {
                if (bgImage.includes('gradient')) {
                    layers.push({ type: 'gradient', value: bgImage });
                } else if (bgImage.includes('url')) {
                    layers.push({ type: 'image', value: bgImage });
                }
            }

            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                layers.push({ type: 'color', color: ColorUtils.parseColor(bgColor) });
                break; // Found solid base
            }
            current = current.parentElement;
        }
        return layers;
    },

    extractGradientColors(gradientStr) {
        const colors = [];
        const rgbaRegex = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g;
        let match;
        while ((match = rgbaRegex.exec(gradientStr)) !== null) {
            colors.push({
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: match[4] ? parseFloat(match[4]) : 1
            });
        }
        return colors;
    },

    getParentBackground(element) {
        let parent = element.parentElement;
        while (parent && parent !== document.documentElement) {
            const style = window.getComputedStyle(parent);
            const bgColor = style.backgroundColor;
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                return ColorUtils.parseColor(bgColor);
            }
            parent = parent.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
    }
};
