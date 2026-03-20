// Button Audit - Destination and Capitalization Checker
const ButtonAnalyzer = {
    results: {
        buttons: [],
        capitalizationIssues: [],
        destinationIssues: []
    },
    isAnalyzing: false,

    /**
     * Analyze entire page for button issues
     */
    async analyzePage() {
        if (this.isAnalyzing) {
            console.log('Button analysis already in progress');
            return this.getSummary();
        }

        this.isAnalyzing = true;
        this.results = {
            buttons: [],
            capitalizationIssues: [],
            destinationIssues: []
        };

        try {
            console.log('🔘 Starting button audit...');

            // Find all buttons - Expanded selector
            const buttonElements = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a.btn, a.button, a[class*="btn"], a[class*="button"]');

            for (const element of buttonElements) {
                // Skip if not visible
                if (!this.isVisibleElement(element)) {
                    continue;
                }

                // Get button text
                const text = this.getButtonText(element);
                if (!text || text.length < 2) {
                    continue;
                }

                // Get destination
                const destination = this.getButtonDestination(element);

                // Get button type
                const buttonType = this.getButtonType(element);

                const button = {
                    element: element,
                    text: text,
                    destination: destination,
                    type: buttonType,
                    location: this.getElementLocation(element),
                    selector: this.generateSelector(element)
                };

                this.results.buttons.push(button);
            }

            // Validate buttons
            this.validateButtons();

            const summary = this.getSummary();
            console.log('✅ Button audit complete!');
            console.log('📊 Results:', summary);

            return summary;

        } catch (error) {
            console.error('❌ Button audit failed:', error);
            return this.getSummary();
        } finally {
            this.isAnalyzing = false;
        }
    },

    /**
     * Get button text from element
     */
    getButtonText(element) {
        let text = '';

        if (element.textContent) {
            text = element.textContent.trim();
        } else if (element.value) {
            text = element.value.trim();
        } else if (element.getAttribute('aria-label')) {
            text = element.getAttribute('aria-label').trim();
        }

        // Clean up text (remove extra whitespace)
        text = text.replace(/\s+/g, ' ').substring(0, 100);
        return text;
    },

    /**
     * Get button destination (href, onclick, form action, etc.)
     */
    getButtonDestination(element) {
        const tagName = element.tagName.toLowerCase();

        // For anchor tags
        if (tagName === 'a') {
            const href = element.getAttribute('href');
            return href ? href : '(no href)';
        }

        // For buttons with onclick
        if (element.getAttribute('onclick')) {
            return '(onclick handler)';
        }

        // For form submission
        if (tagName === 'button' && element.getAttribute('type') !== 'button') {
            const form = element.closest('form');
            if (form && form.getAttribute('action')) {
                return form.getAttribute('action');
            }
            return '(form submission)';
        }

        // For input buttons
        if (tagName === 'input' && element.getAttribute('type') === 'submit') {
            const form = element.closest('form');
            if (form && form.getAttribute('action')) {
                return form.getAttribute('action');
            }
            return '(form submission)';
        }

        return '(no destination)';
    },

    /**
     * Determine button type
     */
    getButtonType(element) {
        const tagName = element.tagName.toLowerCase();
        const type = element.getAttribute('type') || 'button';

        if (tagName === 'a') return 'link';
        if (tagName === 'button') return type;
        if (tagName === 'input') return type;
        return 'other';
    },

    /**
     * Check if element is visible
     */
    isVisibleElement(element) {
        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);

        // Check visibility
        if (computed.display === 'none' || computed.visibility === 'hidden') {
            return false;
        }

        // Check if in viewport or has dimensions
        if (rect.width === 0 || rect.height === 0) {
            return false;
        }

        // Check opacity
        if (parseFloat(computed.opacity) === 0) {
            return false;
        }

        return true;
    },

    /**
     * Validate all buttons
     */
    validateButtons() {
        if (this.results.buttons.length === 0) {
            return;
        }

        // Check capitalization consistency
        this.checkCapitalizationConsistency();

        // Check for destination mismatches
        this.checkDestinationMismatches();
    },

    /**
     * Check if all buttons follow same capitalization style
     */
    checkCapitalizationConsistency() {
        const buttons = this.results.buttons;
        const styles = {
            allCaps: [],
            camelCase: [],
            smallCase: [],
            titleCase: [],
            mixed: []
        };

        buttons.forEach(button => {
            const text = button.text;
            const style = this.getCapitalizationStyle(text);
            styles[style].push(button);
        });

        // Find the dominant style
        const sortedStyles = Object.entries(styles)
            .filter(([_, items]) => items.length > 0)
            .sort((a, b) => b[1].length - a[1].length);

        if (sortedStyles.length > 1) {
            // Multiple styles found - flag inconsistency
            sortedStyles.forEach(([style, items], index) => {
                if (index > 0 && items.length > 0) {
                    items.forEach(button => {
                        this.results.capitalizationIssues.push({
                            button: button,
                            style: style,
                            message: `Button uses "${style}" but dominant style is "${sortedStyles[0][0]}"`
                        });
                    });
                }
            });
        }
    },

    /**
     * Determine capitalization style
     */
    getCapitalizationStyle(text) {
        if (!text) return 'unknown';

        // Remove spaces and special chars for checking
        const cleaned = text.replace(/[^a-zA-Z0-9]/g, '');

        // All caps
        if (cleaned === cleaned.toUpperCase() && cleaned.length > 1) {
            return 'allCaps';
        }

        // All lowercase
        if (cleaned === cleaned.toLowerCase()) {
            return 'smallCase';
        }

        // camelCase (first letter lowercase, subsequent words capitalized)
        if (cleaned.charAt(0) === cleaned.charAt(0).toLowerCase() && /[A-Z]/.test(cleaned.slice(1))) {
            return 'camelCase';
        }

        // PascalCase / TitleCase (first letter uppercase)
        if (cleaned.charAt(0) === cleaned.charAt(0).toUpperCase()) {
            return 'titleCase';
        }

        return 'mixed';
    },

    /**
     * Check for destination mismatches
     */
    checkDestinationMismatches() {
        this.results.buttons.forEach(button => {
            const text = button.text.toLowerCase();
            const destination = button.destination.toLowerCase();

            // Check if button text matches destination
            // E.g., "Home" button pointing to "/contact" is a mismatch
            const commonMismatches = [
                { text: 'home', shouldContain: ['/', 'home', 'index'] },
                { text: 'about', shouldContain: ['about'] },
                { text: 'contact', shouldContain: ['contact'] },
                { text: 'products', shouldContain: ['product'] },
                { text: 'services', shouldContain: ['service'] },
                { text: 'blog', shouldContain: ['blog'] },
                { text: 'news', shouldContain: ['news'] },
                { text: 'gallery', shouldContain: ['gallery', 'image'] },
                { text: 'pricing', shouldContain: ['price', 'pricing'] },
                { text: 'login', shouldContain: ['login', 'signin', 'auth'] }
            ];

            for (const mismatch of commonMismatches) {
                if (text.includes(mismatch.text)) {
                    const matches = mismatch.shouldContain.some(word => destination.includes(word));
                    if (!matches && button.destination !== '(onclick handler)' && button.destination !== '(form submission)') {
                        this.results.destinationIssues.push({
                            button: button,
                            message: `Button text "${button.text}" doesn't match destination "${button.destination}"`
                        });
                    }
                }
            }
        });
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
            return `#${CSS.escape(element.id)}`;
        }

        let path = [];
        while (element.parentElement) {
            let tagName = element.tagName.toLowerCase();
            let siblingIndex = 1;
            let siblings = element.parentElement.children;

            for (let i = 0; i < siblings.length; i++) {
                const sibling = siblings[i];
                if (sibling === element) break;
                if (sibling.tagName.toLowerCase() === tagName) {
                    siblingIndex++;
                }
            }

            let selector = tagName;
            if (element.className) {
                // Use class names if available/clean, but index is safest
                const classes = element.className.trim().split(/\s+/).filter(c => c).join('.');
                if (classes) {
                    // selector += '.' + classes; 
                    // Classes can be duplicated, so we prefer nth-of-type for uniqueness in this context
                }
            }

            selector += `:nth-of-type(${siblingIndex})`;
            path.unshift(selector);

            if (element.id) {
                path.unshift(`#${CSS.escape(element.id)}`);
                break;
            }

            element = element.parentElement;
            // Limit depth but ensure uniqueness so we might need more path
            if (path.length > 5) break;
        }

        return path.join(' > ');
    },

    /**
     * Get analysis summary
     */
    getSummary() {
        return {
            totalButtons: this.results.buttons.length,
            buttons: this.results.buttons,
            capitalizationIssues: this.results.capitalizationIssues,
            destinationIssues: this.results.destinationIssues,
            stats: {
                total: this.results.buttons.length,
                capitalizationIssues: this.results.capitalizationIssues.length,
                destinationIssues: this.results.destinationIssues.length,
                totalIssues: this.results.capitalizationIssues.length + this.results.destinationIssues.length
            },
            isValid: (this.results.capitalizationIssues.length === 0 && this.results.destinationIssues.length === 0)
        };
    },

    /**
     * Clear results
     */
    clearResults() {
        this.results = {
            buttons: [],
            capitalizationIssues: [],
            destinationIssues: []
        };
    }
};

console.log('✅ ButtonAnalyzer loaded');
