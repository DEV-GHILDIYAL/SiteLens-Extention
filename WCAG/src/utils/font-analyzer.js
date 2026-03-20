// Font Audit - Detect H1, H2, H3, H4, H5, H6, P tags
const FontAnalyzer = {
    results: {
        h1: [],
        h2: [],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
        p: []
    },
    isAnalyzing: false,

    /**
     * Analyze entire page for heading and paragraph structure
     */
    async analyzePage() {
        if (this.isAnalyzing) {
            console.log('Font analysis already in progress');
            return this.getSummary();
        }

        this.isAnalyzing = true;
        this.results = {
            h1: [],
            h2: [],
            h3: [],
            h4: [],
            h5: [],
            h6: [],
            p: []
        };

        try {
            console.log('🔤 Starting font audit...');

            // Find all headings and paragraphs
            const selectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);

                for (const element of elements) {

                    // SPECIAL H1 FIX: Do NOT check visibility for H1. 
                    // SEO bots read H1s even if hidden or nested in complex ways.
                    if (selector !== 'h1') {
                        if (!this.isVisibleElement(element)) {
                            continue;
                        }
                    }

                    // Skip if no text content, but be lenient
                    const text = element.textContent.trim();

                    // Special H1 handling for images/nested content
                    if (selector === 'h1' && !text) {
                        const hasContent = element.querySelector('img, svg, i, span') !== null || element.children.length > 0;
                        if (!hasContent) {
                            continue;
                        }
                    } else if (!text) {
                        continue;
                    }

                    // Only enforce length check for paragraphs
                    if (selector === 'p' && text.length < 3) {
                        continue;
                    }

                    // Get font properties
                    const props = this.getFontProperties(element);

                    const item = {
                        element: element,
                        text: text.substring(0, 100),
                        fontSize: props.fontSize,
                        fontWeight: props.fontWeight,
                        fontFamily: props.fontFamily,
                        color: props.color,
                        location: this.getElementLocation(element),
                        selector: this.generateSelector(element)
                    };

                    this.results[selector].push(item);
                }
            }

            const summary = this.getSummary();
            console.log('✅ Font audit complete!', summary);
            return summary;

        } catch (error) {
            console.error('❌ Font audit failed:', error);
            return this.getSummary();
        } finally {
            this.isAnalyzing = false;
        }
    },

    /**
     * Get font properties from element
     */
    getFontProperties(element) {
        const computed = window.getComputedStyle(element);
        return {
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            fontFamily: computed.fontFamily,
            color: ColorUtils.parseColor(computed.color)
        };
    },

    /**
     * Check if element is visible
     */
    isVisibleElement(element) {
        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);

        if (computed.display === 'none' || computed.visibility === 'hidden' || computed.visibility === 'collapse') {
            return false;
        }
        if (rect.width === 0 || rect.height === 0) {
            return false;
        }
        if (parseFloat(computed.opacity) === 0) {
            return false;
        }
        return true;
    },

    /**
     * Get element location
     */
    getElementLocation(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: Math.round(rect.top + window.scrollY),
            left: Math.round(rect.left + window.scrollX),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    },

    /**
     * Generate CSS selector for element
     */
    generateSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        let path = [];
        while (element.parentElement) {
            let selector = element.tagName.toLowerCase();
            if (element.className) {
                const classes = element.className.split(' ').filter(c => c).slice(0, 2).join('.');
                if (classes) selector += '.' + classes;
            }
            path.unshift(selector);
            if (element.id) {
                path.unshift(`#${element.id}`);
                break;
            }
            element = element.parentElement;
            if (path.length > 3) break;
        }
        return path.join(' > ');
    },

    /**
     * Get analysis summary
     */
    getSummary() {
        const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        const headingCount = headings.reduce((sum, tag) => sum + this.results[tag].length, 0);
        const pCount = this.results.p.length;
        const issues = [];

        // H1 check
        if (this.results.h1.length === 0) {
            issues.push({ type: 'h1-missing', severity: 'critical', message: 'Missing H1 heading' });
        } else if (this.results.h1.length > 1) {
            issues.push({ type: 'h1-multiple', severity: 'warning', message: `Found ${this.results.h1.length} H1 headings` });
        }

        // Hierarchy check
        if (this.results.h1.length === 0 && this.results.h2.length > 0) {
            issues.push({ type: 'hierarchy-broken', severity: 'warning', message: 'H2 found without H1' });
        }

        return {
            totalHeadings: headingCount,
            totalParagraphs: pCount,
            h1: { count: this.results.h1.length, items: this.results.h1 },
            h2: { count: this.results.h2.length, items: this.results.h2 },
            h3: { count: this.results.h3.length, items: this.results.h3 },
            h4: { count: this.results.h4.length, items: this.results.h4 },
            h5: { count: this.results.h5.length, items: this.results.h5 },
            h6: { count: this.results.h6.length, items: this.results.h6 },
            paragraphs: { count: pCount, items: this.results.p },
            issues: issues,
            hierarchyValid: issues.filter(i => i.severity === 'critical').length === 0
        };
    },

    clearResults() {
        this.results = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [], p: [] };
    }
};

console.log('✅ FontAnalyzer loaded');
