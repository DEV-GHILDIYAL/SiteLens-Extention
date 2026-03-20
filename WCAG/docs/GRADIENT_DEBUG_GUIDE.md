# Gradient Detection Debug Guide

## Files Involved in Gradient Detection

### 1. **text-detector.js** (Lines 1-50)
- **Function**: `findTextElements()`
- **What it does**: Finds all text nodes in the document and their parent elements
- **For gradient-bg-2 test**: Should find `<h3>`, `<p>` tags inside `.test-item.gradient-bg-2`

### 2. **background-sampler.js** (Lines 18-100)
- **Function**: `collectBackgroundLayers(element)`
- **What it does**: Traverses UP from element to parent chain looking for backgrounds
- **Key logging**: Added detailed logs at each depth level
- **For gradient-bg-2 test**: Should traverse from `<h3>` → `.test-item` → `.gradient-bg-2` and find the gradient

### 3. **background-sampler.js** (Lines 166-230)
- **Function**: `extractGradientColors(gradientString)`
- **What it does**: Parses the gradient CSS string and extracts hex/rgba/named colors
- **Key logging**: Logs the full input gradient string and each color found
- **For gradient-bg-2 test**: Should extract `#000000` and `#ffffff` from the gradient string

### 4. **contrast-analyzer.js** (Lines 80-165)
- **Function**: `analyzeTextElement(item)` 
- **What it does**: Calls collectBackgroundLayers(), checks if gradient exists, extracts colors
- **Key logging**: Logs when gradient is detected and when colors are extracted
- **For gradient-bg-2 test**: Should detect hasGradient=true and find 2 gradient colors

## How to Debug

### Step 1: Run Extension and Open DevTools
1. Open `index.html` in Chrome
2. Open DevTools → Console
3. Click extension icon → "Analyze Page"
4. Look for logs starting with 🎨 and 🔍

### Step 2: Follow the Logs

You should see output like:
```
✅ TextDetector: Found X text elements
🔍 ============= START BACKGROUND LAYER COLLECTION =============
Starting from: H3 class: 
  Depth 0: H3
    bgImage: none
    bgColor: rgba(0, 0, 0, 0)
  Depth 1: DIV.test-item gradient-bg-2
    bgImage: linear-gradient(135deg, rgb(0, 0, 0) 0%, rgb(255, 255, 255) 100%)
    bgColor: rgba(0, 0, 0, 0)
  ✅ Gradient found at depth 1: DIV
```

### Step 3: Look for Gradient Color Extraction

If gradient is found, you should see:
```
🎨 ============= GRADIENT COLOR EXTRACTION =============
🎨 Input gradient string: linear-gradient(135deg, rgb(0, 0, 0) 0%, rgb(255, 255, 255) 100%)
🎨 Hex matches: null
```

**KEY ISSUE**: The `getComputedStyle(element).backgroundImage` returns the gradient as **rgb() format, NOT hex!**

## The Problem

When you write in CSS:
```css
background: linear-gradient(135deg, #000000 0%, #ffffff 100%);
```

The browser's `getComputedStyle()` converts it to:
```
linear-gradient(135deg, rgb(0, 0, 0) 0%, rgb(255, 255, 255) 100%)
```

**Our regex for hex colors `/#[0-9a-fA-F]{3,6}/g` won't find anything because there are no # symbols!**

We're finding rgba() instead, which our regex should handle... but let me check the regex pattern.

## The Real Issue

Our regex is:
```javascript
/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/g
```

This should match `rgb(0, 0, 0)` but it's not being added to the colors array.

Check if `ColorUtils.parseColor(rgb)` is working correctly with rgb() strings.
