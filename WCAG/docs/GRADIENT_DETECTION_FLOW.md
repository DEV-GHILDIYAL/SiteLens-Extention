# Gradient Detection Flow - Step by Step

## The Detection Pipeline

```
User clicks "Analyze Page"
        ↓
popup.js: analyzeContrast()
        ↓
content.js: handleAnalyze()
        ↓
contrast-analyzer.js: analyzePage()
        ↓
TextDetector.findTextElements()  ← Finds <h3>, <p> inside .gradient-bg-2
        ↓
FOR EACH TEXT ELEMENT:
        ↓
contrast-analyzer.js: analyzeTextElement(item)
        ↓
BackgroundSampler.collectBackgroundLayers(element)
        ↓
TRAVERSE UP THE DOM TREE:
  Depth 0: <h3> → no background
  Depth 1: <p> → no background  
  Depth 2: <div class="test-item gradient-bg-2"> → HAS GRADIENT! ✅
        ↓
GRADIENT FOUND → layers.some(l => l.type === 'gradient') = TRUE
        ↓
BackgroundSampler.extractGradientColors(gradientString)
        ↓
Parse: linear-gradient(135deg, rgb(0,0,0) 0%, rgb(255,255,255) 100%)
        ↓
Find: rgb(0, 0, 0) → #000000 ✅
Find: rgb(255, 255, 255) → #ffffff ✅
        ↓
Check contrast for EACH color:
  - White text (#ffffff) on Black (#000000): 21:1 ✅ PASS
  - White text (#ffffff) on White (#ffffff): 1:1 ❌ FAIL
        ↓
anyFails = true → MARK AS VIOLATION ✅
```

## Key Files and Line Numbers

### 1. **popup.js** - UI Entry Point
- Line ~650: `analyzeContrast()` function
  - Sends message to content script: `{ action: 'analyze' }`

### 2. **content.js** - Message Router
- Line ~8: `chrome.runtime.onMessage.addListener()`
- Line ~13: `case 'analyze': handleAnalyze(sendResponse)`
- Calls `ContrastAnalyzer.analyzePage()`

### 3. **contrast-analyzer.js** - Main Detection Engine  
- Line ~20: `analyzePage()` function
  - Calls `TextDetector.findTextElements()`
  - Line ~30: For each element, calls `analyzeTextElement(item)`
  
- Line ~60: `analyzeTextElement(item)` function
  - Line ~80: Calls `BackgroundSampler.collectBackgroundLayers(element)`
  - Line ~87: Checks `hasGradient = layers.some(l => l.type === 'gradient')`
  - Line ~91: If gradient found, calls `BackgroundSampler.extractGradientColors()`
  - Line ~148: Stores `item.gradientContrastResults = contrastResults`
  - Line ~188: Checks `anyFails` and marks as violation if ANY color fails

### 4. **background-sampler.js** - Background Detection
- Line ~18: `collectBackgroundLayers(element)` function
  - Line ~22-58: Traverses UP the DOM tree looking for gradient
  - Line ~38: When gradient found: `console.log('✅ Gradient found at depth', depth)`

- Line ~166: `extractGradientColors(gradientString)` function ⭐ **KEY FUNCTION**
  - Line ~175: Extracts rgb() values manually
  - Line ~180-200: Parses each rgb(r, g, b) → { r, g, b, a }
  - Line ~227: Returns array of color objects

### 5. **text-detector.js** - Text Finding
- Line ~8: `findTextElements()` function
  - Creates TreeWalker to find all text nodes
  - Line ~30-55: Adds parent element to results

## The Critical Fix

**Before (v0.2.0):**
```javascript
// In extractGradientColors()
const rgbaMatches = gradientString.match(/rgba?\s*\(...\)/g);
if (rgbaMatches) {
  rgbaMatches.forEach(rgb => {
    const color = ColorUtils.parseColor(rgb); // ❌ FAILED FOR rgb()
    if (color) colors.push(color);
  });
}
// Result: rgb() strings weren't parsed, NO COLORS FOUND!
```

**After (v0.2.1):**
```javascript
// In extractGradientColors()
const rgbMatches = gradientString.match(/rgba?\s*\(...\)/g);
if (rgbMatches) {
  rgbMatches.forEach(rgb => {
    const rgbRegex = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/;
    const match = rgb.match(rgbRegex);
    if (match) {
      const color = {
        r: parseInt(match[1]), // ✅ Manually extract
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? parseFloat(match[4]) : 1
      };
      colors.push(color); // ✅ NOW IT WORKS
    }
  });
}
```

## Testing Steps

1. **Add Console Logging:**
   - Open DevTools (F12)
   - Go to Console tab
   - Keep it visible

2. **Run Analysis:**
   - Click extension icon
   - Click "Analyze Page"
   - Watch console for logs

3. **Look for Success Indicators:**
   ```
   ✅ TextDetector: Found X text elements
   ✅ Gradient found at depth X
   🎨 RGB matches found: 2
   ✅ Final: Extracted 2 unique colors from gradient
   🎨 Gradient colors found: 2
   📊 Contrast ratios: 21.00, 1.00
   ❌ Gradient FAIL: At least one color fails WCAG AA
   ```

If you see these logs, **gradient detection is working!** ✅
