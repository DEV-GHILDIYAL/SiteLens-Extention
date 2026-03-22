/**
 * ContentComparisonEngine
 * Compares reference documents with live page content to identify gaps.
 */
const ContentComparisonEngine = {
    /**
     * Compare reference text with actual page text
     * @param {string} referenceText - Text from the uploaded doc
     * @param {string} pageContent - Text extracted from the live page
     * @returns {Object} Comparison results
     */
    compare(referenceText, pageContent) {
        if (!referenceText || !pageContent) {
            return {
                matchPercentage: 0,
                missingContent: [],
                extraContent: [],
                status: 'Error: Missing inputs'
            };
        }

        // 1. Normalize both strings
        const refWords = this.tokenize(referenceText);
        const pageWords = this.tokenize(pageContent);

        // 2. Simple n-gram or sentence matching for "missing content"
        const refSentences = this.toSentences(referenceText);
        const pageSentences = this.toSentences(pageContent);

        const missingSentences = refSentences.filter(s => !this.isSimilarInList(s, pageSentences));
        const extraSentences = pageSentences.filter(s => !this.isSimilarInList(s, refSentences));

        // 3. Calculate match percentage (based on unique tokens)
        const refSet = new Set(refWords);
        const pageSet = new Set(pageWords);
        
        let matches = 0;
        refSet.forEach(word => {
            if (pageSet.has(word)) matches++;
        });

        const matchPercentage = refSet.size > 0 ? (matches / refSet.size) * 100 : 0;

        return {
            matchPercentage: Math.round(matchPercentage),
            missingContent: missingSentences.slice(0, 10), // Limit results
            extraContent: extraSentences.slice(0, 10),
            summary: `Found ${missingSentences.length} missing elements and ${extraSentences.length} extra elements.`
        };
    },

    tokenize(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3); // Ignore small common words
    },

    toSentences(text) {
        return text.split(/[.!?\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 20); // Only care about meaningful sentences
    },

    isSimilarInList(sentence, list) {
        const sNorm = sentence.toLowerCase().replace(/\s+/g, '');
        return list.some(item => {
            const iNorm = item.toLowerCase().replace(/\s+/g, '');
            return iNorm.includes(sNorm) || sNorm.includes(iNorm);
        });
    },

    /**
     * Map a URL to a reference document using slugify logic
     */
    getSlug(url) {
        try {
            const path = new URL(url).pathname;
            if (path === '/' || path === '') return 'home';
            return path.split('/').filter(p => p).pop() || 'home';
        } catch (e) {
            return 'home';
        }
    }
};

window.ContentComparisonEngine = ContentComparisonEngine;
