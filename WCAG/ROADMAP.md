# SiteLens Extension - Issues & Roadmap

This document outlines the current technical challenges, bugs, and a detailed list of proposed features for future development.

## 🔴 Current Issues & Technical Debt

### High Priority (Critical)

1.  **Monolithic Architecture (`sidepanel.js`)**:
    *   **Issue**: `src/sidepanel/sidepanel.js` is ~3,500 lines long and handles everything from UI interaction to content analysis orchestration.
    *   **Impact**: Extremely difficult to maintain or add new features without breaking existing ones. Hard to test.
    *   **Recommendation**: Split into modular files (e.g., `features/lorem-audit.js`, `features/contrast-checker.js`, `ui/tabs.js`). Use ES Modules in the side panel.

2.  **Content Security Policy (CSP) Violations**:
    *   **Issue**: Features relying on external scripts (like `html2canvas` from CDN) or inline styles/scripts may break on strict sites (e.g., GitHub, Twitter).
    *   **Impact**: Screenshot tool and potentially some visualizations fail silently on high-security domains.
    *   **Recommendation**: Bundle all libraries locally (partially done for PDF.js/Mammoth). remove all inline event handlers in favor of `addEventListener`.

3.  **Performance on Large DOMs**:
    *   **Issue**: `content-analyzer.js` scans up to 50,000 nodes. Even with chunking, on very heavy pages (SPA with virtual DOM), this can cause sluggishness.
    *   **Impact**: Extension feels slow on complex sites.
    *   **Recommendation**: Move heavy processing to Web Workers or use `requestIdleCallback` more aggressively.

### Medium Priority (Enhancement)

4.  **Error Feedback Visibility**:
    *   **Issue**: Many errors are logged to `console.error` but not shown to the user (e.g., failed network requests in link checker).
    *   **Impact**: User thinks the extension is "doing nothing" when it actually failed.
    *   **Recommendation**: Implement a global toast/notification system in the UI for errors.

5.  **Hardcoded Strings & Localization**:
    *   **Issue**: User-facing text is hardcoded in English.
    *   **Impact**: Cannot support other languages easily.
    *   **Recommendation**: Move strings to `_locales` (i18n API).

### Low Priority (Polish)

6.  **Inconsistent Scrollbars**:
    *   **Issue**: Some inner containers have default scrollbars that clash with the dark theme.
    *   **Recommendation**: Apply custom scrollbar CSS globally to all scrollable containers.

---

## 🚀 Proposed Features Roadmap

These features are designed to enhance the "SiteLens" brand as a comprehensive audit tool.

### 1. Accessibility & Compliance (WCAG)

*   **Keyboard Navigation Visualizer**:
    *   **Concept**: Draw lines connecting focusable elements in tab order (1 -> 2 -> 3).
    *   **Why**: Detecting "focus traps" and illogical tab order is critical for accessibility but hard to see manually.
*   **Color Blindness Simulator**:
    *   **Concept**: Apply SVG filters to the entire page to simulate Protanopia, Deuteranopia, Tritanopia, and Achromatopsia.
    *   **Why**: Allows designers to check if their color choices are valid for color-blind users instantly.
*   **Touch Target Size Checker**:
    *   **Concept**: Highlight interactive elements (buttons, links) that are smaller than 44x44px (WCAG AAA standard).
    *   **Why**: Essential for mobile web accessibility.
*   **Aria-Label Auditor**:
    *   **Concept**: Specifically flag interactive elements (buttons, inputs) that rely on icons but lack `aria-label` or visible text.
    *   **Why**: Common failure point for screen readers.

### 2. Design & QA

*   **Layout Grid Overlay**:
    *   **Concept**: Overlay a customizable 12-column grid or baseline grid on the page.
    *   **Why**: Helps designers check alignment and spacing consistency.
*   **Responsive View Simulator**:
    *   **Concept**: Force the viewport to standard mobile/tablet sizes (iPhone SE, iPad, etc.) within the current window or a popup.
    *   **Why**: Quick responsive testing without opening DevTools.
*   **Broken Link Checker (Batch)**:
    *   **Concept**: Crawl all links on the page and verify if they return 200 OK or 404.
    *   **Why**: "Link Rot" is bad for SEO and UX.

### 3. Content & SEO

*   **Readability Analysis**:
    *   **Concept**: Calculate Flesch-Kincaid reading ease score for the page content.
    *   **Why**: Ensures copy is accessible to a broad audience.
*   **Heading Map (Visual)**:
    *   **Concept**: Generate a visual tree diagram of the H1-H6 structure in the Side Panel, allowing users to jump to sections.
    *   **Why**: Visualizing document structure helps spot "skipped levels" (e.g., H2 -> H4).

### 4. Workflow & Export

*   **PDF Report Generation**:
    *   **Concept**: Compile all active audit results (Contrast, SEO, Lorem, etc.) into a downloadable PDF report.
    *   **Why**: Professionals need to send reports to clients/managers.
*   **History / Snapshot Comparison**:
    *   **Concept**: Save the audit state of a URL. Later, compare the current audit against the saved snapshot to see improvements/regressions.
    *   **Why**: Tracks progress over time.

---

### Suggested Implementation Order

1.  **Phase 1 (Stabilization)**: Modules Split (`sidepanel.js` refactor), Error Toast System.
2.  **Phase 2 (Accessibility Power)**: Color Blindness Simulator, Keyboard Visualizer.
3.  **Phase 3 (Professional Tools)**: PDF Export, Broken Link Checker.
