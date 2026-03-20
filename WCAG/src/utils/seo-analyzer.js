// SEO Audit - Meta Title and Description Analyzer
const SEOAnalyzer = {
    results: {
        title: null,
        description: null,
        ogTitle: null,
        ogDescription: null,
        issues: []
    },
    isAnalyzing: false,

    /**
     * Analyze page for SEO metadata
     */
    async analyzePage() {
        if (this.isAnalyzing) {
            console.log('SEO analysis already in progress');
            return this.getSummary();
        }

        this.isAnalyzing = true;
        this.results = {
            title: null,
            description: null,
            ogTitle: null,
            ogDescription: null,
            issues: []
        };

        try {
            console.log('🔍 Starting SEO audit...');

            // Get Meta Title
            this.results.title = this.getMetaTitle();

            // Get Meta Description
            this.results.description = this.getMetaDescription();

            // Get Open Graph Title
            this.results.ogTitle = this.getOpenGraphTitle();

            // Get Open Graph Description
            this.results.ogDescription = this.getOpenGraphDescription();

            // Validate all metadata
            this.validateMetadata();

            const summary = this.getSummary();
            console.log('✅ SEO audit complete!');
            console.log('📊 Results:', summary);

            return summary;

        } catch (error) {
            console.error('❌ SEO audit failed:', error);
            return this.getSummary();
        } finally {
            this.isAnalyzing = false;
        }
    },

    /**
     * Get meta title from <title> tag
     */
    getMetaTitle() {
        // Try standard tag specifically in HEAD to avoid SVG titles
        const titleTag = document.querySelector('head > title');
        let text = titleTag ? titleTag.textContent.trim() : '';

        // Fallback to document.title which works for SPAs/dynamic updates
        if (!text) {
            text = document.title.trim();
        }

        if (!text) {
            return null;
        }

        return {
            value: text,
            length: text.length,
            element: titleTag // Might be null if fallback used
        };
    },

    /**
     * Get meta description from <meta name="description">
     */
    getMetaDescription() {
        const metaTag = document.querySelector('meta[name="description"]');
        if (!metaTag) {
            return null;
        }

        const content = metaTag.getAttribute('content');
        if (!content) {
            return null;
        }

        const text = content.trim();
        return {
            value: text,
            length: text.length,
            element: metaTag
        };
    },

    /**
     * Get Open Graph title from <meta property="og:title">
     */
    getOpenGraphTitle() {
        const metaTag = document.querySelector('meta[property="og:title"]');
        if (!metaTag) {
            return null;
        }

        const content = metaTag.getAttribute('content');
        if (!content) {
            return null;
        }

        const text = content.trim();
        return {
            value: text,
            length: text.length,
            element: metaTag
        };
    },

    /**
     * Get Open Graph description from <meta property="og:description">
     */
    getOpenGraphDescription() {
        const metaTag = document.querySelector('meta[property="og:description"]');
        if (!metaTag) {
            return null;
        }

        const content = metaTag.getAttribute('content');
        if (!content) {
            return null;
        }

        const text = content.trim();
        return {
            value: text,
            length: text.length,
            element: metaTag
        };
    },

    /**
     * Validate metadata and collect issues
     */
    validateMetadata() {
        // Title validation
        if (!this.results.title) {
            this.addIssue('title-missing', 'critical', 'Meta title is missing');
        } else {
            const titleLength = this.results.title.length;

            // Check title length (50-60 characters optimal)
            if (titleLength < 30) {
                this.addIssue('title-short', 'warning', `Title is too short (${titleLength} chars). Recommended: 50-60 characters`);
            } else if (titleLength > 60) {
                this.addIssue('title-long', 'warning', `Title is too long (${titleLength} chars). Recommended: 50-60 characters`);
            }
        }

        // Description validation
        if (!this.results.description) {
            this.addIssue('description-missing', 'critical', 'Meta description is missing');
        } else {
            const descLength = this.results.description.length;

            // Check description length (150-160 characters optimal)
            if (descLength < 120) {
                this.addIssue('description-short', 'warning', `Description is too short (${descLength} chars). Recommended: 150-160 characters`);
            } else if (descLength > 160) {
                this.addIssue('description-long', 'warning', `Description is too long (${descLength} chars). Recommended: 150-160 characters`);
            }
        }

        // Open Graph validation
        if (!this.results.ogTitle && this.results.title) {
            this.addIssue('og-title-missing', 'info', 'Open Graph title is missing (recommended for social sharing)');
        }

        if (!this.results.ogDescription && this.results.description) {
            this.addIssue('og-description-missing', 'info', 'Open Graph description is missing (recommended for social sharing)');
        }

        // Duplicate content check
        if (this.results.title && this.results.description) {
            if (this.results.title.value === this.results.description.value) {
                this.addIssue('duplicate-content', 'warning', 'Title and description are identical');
            }
        }

        // Check for special characters
        if (this.results.title && !this.hasGoodCharacters(this.results.title.value)) {
            this.addIssue('title-special-chars', 'info', 'Title contains special characters (may affect display)');
        }

        if (this.results.description && !this.hasGoodCharacters(this.results.description.value)) {
            this.addIssue('description-special-chars', 'info', 'Description contains special characters');
        }
    },

    /**
     * Check if content has good readable characters
     */
    hasGoodCharacters(text) {
        // Check if text is mostly readable (not emoji heavy or symbol heavy)
        const specialCharCount = (text.match(/[^\w\s\-\.,']/g) || []).length;
        const ratio = specialCharCount / text.length;
        return ratio < 0.3; // Allow up to 30% special characters
    },

    /**
     * Add an issue to the list
     */
    addIssue(type, severity, message) {
        this.results.issues.push({
            type: type,
            severity: severity,
            message: message
        });
    },

    /**
     * Get analysis summary
     */
    getSummary() {
        const criticalCount = this.results.issues.filter(i => i.severity === 'critical').length;
        const warningCount = this.results.issues.filter(i => i.severity === 'warning').length;
        const infoCount = this.results.issues.filter(i => i.severity === 'info').length;

        return {
            title: this.results.title,
            description: this.results.description,
            ogTitle: this.results.ogTitle,
            ogDescription: this.results.ogDescription,
            issues: this.results.issues,
            stats: {
                critical: criticalCount,
                warning: warningCount,
                info: infoCount,
                total: this.results.issues.length
            },
            isValid: criticalCount === 0 && warningCount === 0
        };
    },

    /**
     * Clear results
     */
    clearResults() {
        this.results = {
            title: null,
            description: null,
            ogTitle: null,
            ogDescription: null,
            issues: []
        };
    }
};

console.log('✅ SEOAnalyzer loaded');
