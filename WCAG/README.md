# Visual Contrast Checker - Chrome Extension
A Chrome extension that detects color contrast violations based on **rendered visual
appearance**, not just DOM structure. Specifically designed to catch accessibility issues in
real-world CMS layouts where text and background colors are defined in different
elements.
##
🎯 Problem Solved
Most website builders and CMS platforms only check contrast at the component level,
which fails when:
- Text elements have no background color defined
- Background comes from parent containers or sections
- Hero blocks use background images
- Semi-transparent overlays are involved
- Text is absolutely positioned over other elements
This extension analyzes **what the user actually sees**, not what the CSS says.
✨ Features
- ✅ **Visual-based contrast detection** - Analyzes rendered appearance, not CSS
inheritance
- ✅ **WCAG 2.1/2.2 compliance** - Checks against AA and AAA standards
- ✅ **Complex background support** - Handles gradients, images, and layered
backgrounds
- ✅ **Real-time highlighting** - Visual overlay shows violations on the page
- ✅ **Detailed reports** - Export violations as JSON or HTML
- ✅ **Smart filtering** - Focuses on content text, not UI components
- ✅ **Keyboard shortcuts** - Press Ctrl+Shift+C to toggle highlights
## 📦 Installation
##
### Load as Unpacked Extension
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the extension directory### File Structure
```
visual-contrast-checker/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── popup.css
├── overlay.js
├── overlay.css
├── contrast-analyzer.js
├── text-detector.js
├── background-sampler.js
├── color-utils.js
├── wcag-calculator.js
├── dom-traverser.js
├── canvas-processor.js
├── report-generator.js
├── storage-manager.js
├── icon16.png (create or add)
├── icon48.png (create or add)
└── icon128.png (create or add)
```
##
🚀 Usage
### Basic Analysis
1. Navigate to any webpage
2. Click the extension icon
3. Click "Analyze Page"
4. View violations highlighted on the page
### Keyboard Shortcut
Press **Ctrl+Shift+C** anywhere on a page to toggle violation highlights.
### Export Reports1. After analysis, click "Export Report"
2. Download JSON file with detailed violation data
3. Use for documentation or further analysis
##
🔧 How It Works
### Analysis Pipeline
1. **Text Detection** - Finds all visible text elements on the page
2. **Background Sampling** - Determines effective background color through:
- DOM traversal and layer composition
- Canvas-based pixel sampling for images
- Multi-point sampling for gradients
3. **Contrast Calculation** - Uses WCAG 2.1 luminance formulas
4. **Compliance Check** - Evaluates against AA/AAA standards
5. **Visual Overlay** - Highlights violations with detailed tooltips
### Key Components
- **ColorUtils** - Color parsing and composition
- **WCAGCalculator** - Contrast ratio calculations
- **BackgroundSampler** - Effective background detection
- **TextDetector** - Intelligent text element filtering
- **ContrastAnalyzer** - Main analysis engine
- **ContrastOverlay** - Visual violation display
##
📊 What Gets Checked
### Included
- Paragraph text
- Headings (h1-h6)
- Hero text
- Overlay text
- Marketing content
- Any visible text content
### Excluded
- Buttons (usually simple to check)
- Hidden elements
- Script/style tags- Non-visible content
##
🎨 WCAG Standards
### WCAG AA Requirements
- **Normal text**: 4.5:1 minimum contrast
- **Large text** (18pt+ or 14pt+ bold): 3.0:1 minimum
### WCAG AAA Requirements
- **Normal text**: 7.0:1 minimum contrast
- **Large text**: 4.5:1 minimum
##
🛠️ Configuration
Settings are stored in Chrome's local storage and can be modified through the extension
(future enhancement) or manually:
```javascript
{
autoAnalyze: false,
wcagLevel: 'AA',
// Auto-analyze on page load
// 'AA' or 'AAA'
includeButtons: false,
// Include button elements
showOverlayOnAnalysis: true,
samplingPoints: 9
// Number of points to sample
}
```
##
📝 Report Format
### JSON Export
```json
{
"url": "https://example.com",
"timestamp": "2026-01-17T...",
"summary": {
"total": 5,
"byLevel": {
"failsAA": 5,
"failsAAA": 3
}
},"violations": [...]
}
```
##
🐛 Known Limitations
1. **CORS restrictions** - Cannot analyze cross-origin iframes
2. **Canvas limitations** - Background images may need CORS headers
3. **Performance** - Large pages (1000+ text elements) may take time
4. **Dynamic content** - Results reflect page state at analysis time
##
🔮 Future Enhancements
- [ ] Settings UI for configuration
- [ ] Historical report tracking
- [ ] Batch analysis across multiple pages
- [ ] Integration with CI/CD pipelines
- [ ] Alternative color suggestions
- [ ] PDF report generation
##
📄 License
MIT License - Feel free to use and modify
##
🤝 Contributing
Contributions welcome! This extension solves a real problem in web accessibility.
### Development Setup
1. Make changes to source files
2. Reload extension in `chrome://extensions/`
3. Test on various websites
4. Submit pull request
##
💡 Tips
- Use on CMS-generated pages for best results
- Check hero sections and marketing layouts
- Export reports for client documentation
- Combine with other accessibility tools for comprehensive audits##
🆘 Support
For issues or questions, please create a GitHub issue with:
- Chrome version
- Example URL (if public)
- Steps to reproduce
- Expected vs actual behavior
---
**Made with
❤️ for better web accessibility**