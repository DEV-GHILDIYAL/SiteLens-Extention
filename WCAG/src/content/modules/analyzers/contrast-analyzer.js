import { TextDetector } from '../utils/text-detector.js';
import { BackgroundSampler } from '../utils/background-sampler.js';
import { WCAGCalculator } from '../utils/wcag-calculator.js';
import { ColorUtils } from '../utils/color-utils.js';

export const ContrastAnalyzer = {
    name: 'contrast',

    async analyze(node) {
        // Only analyze nodes that might have text
        if (TextDetector.shouldSkipElement(node)) return null;
        if (!TextDetector.isVisibleElement(node)) return null;

        const text = TextDetector.getDirectTextContent(node);
        if (text.length < 3) return null;

        const props = TextDetector.getTextProperties(node);
        const fontSize = parseFloat(props.fontSize);
        const fontWeight = props.fontWeight;

        // Foreground
        let foregroundColors = [props.color];
        if (props.color.a === 0 && props.backgroundClip === 'text' && props.backgroundImage) {
            foregroundColors = BackgroundSampler.extractGradientColors(props.backgroundImage);
        }

        if (foregroundColors.length === 0) return null;

        // Background
        const backgroundColors = await BackgroundSampler.getBackgroundColorsAsync(node);

        // Calculate Worst Case
        const compliance = WCAGCalculator.getComplianceDetails(0, fontSize, fontWeight);
        let minRatio = Infinity;
        let worstPair = { fg: null, bg: null };

        for (const fg of foregroundColors) {
            for (const bg of backgroundColors) {
                const ratio = WCAGCalculator.getContrastRatio(fg, bg);
                if (ratio < minRatio) {
                    minRatio = ratio;
                    worstPair = { fg, bg };
                }
            }
        }

        if (minRatio < compliance.requiredAA) {
            return {
                type: 'contrast-violation',
                severity: 'critical',
                message: `Low contrast ratio (${minRatio.toFixed(2)}:1). Required: ${compliance.requiredAA}:1`,
                text: text.substring(0, 50),
                ratio: minRatio.toFixed(2),
                fg: ColorUtils.rgbaToHex(worstPair.fg),
                bg: ColorUtils.rgbaToHex(worstPair.bg)
            };
        }

        return null;
    }
};
