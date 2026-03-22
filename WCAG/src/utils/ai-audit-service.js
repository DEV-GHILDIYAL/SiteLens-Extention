/**
 * AIAuditService
 * Handles AI analysis of page data and comparison results.
 */
const AIAuditService = {
    apiKey: null,
    
    /**
     * Analyze aggregated page data using AI
     * @param {Object} data - Standardized audit data
     * @returns {Object} AI insights
     */
    async analyze(data) {
        const { url, title, technical, contentComparison } = data;
        
        // Prepare data for the prompt (Limit size for token efficiency)
        const promptData = {
            url,
            title,
            technicalIssues: {
                contrastCount: technical.contrast?.total || 0,
                buttonIssues: technical.buttons?.stats?.totalIssues || 0,
                imageIssues: technical.images?.issues?.length || 0,
                seoScore: technical.seo?.score || 'N/A',
                fontIssues: technical.fonts?.issues?.length || 0,
                linkIssues: technical.links?.length || 0,
                loremIpsumFound: technical.content?.loremIpsum?.count > 0
            },
            contentGaps: {
                matchPercentage: contentComparison?.matchPercentage || 0,
                missingSentences: (contentComparison?.missingContent || []).slice(0, 5)
            }
        };

        const prompt = this.constructPrompt(promptData);
        
        // MOCK AI CALL (Since we don't have a direct API key here, 
        // we'll provide a high-quality heuristic response that 
        // mimics the AI structure the user expects.)
        // In a real scenario, this would call Gemini/GPT.
        
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(this.generateHeuristicInsights(promptData));
            }, 1500);
        });
    },

    constructPrompt(data) {
        return `Analyze the following website audit data for ${data.url}:
        - Technical Issues: ${JSON.stringify(data.technicalIssues)}
        - Content Gaps: ${JSON.stringify(data.contentGaps)}
        
        Provide:
        1. Content Gaps (Compare with branding guidelines)
        2. Critical Issues (Must fix for accessibility)
        3. Priority Fixes (SEO/UX)
        4. Suggestions (Performance/Visual)`;
    },

    generateHeuristicInsights(data) {
        const insights = {
            contentGaps: [],
            criticalIssues: [],
            priorityFixes: [],
            suggestions: []
        };

        if (data.contentGaps.matchPercentage < 80) {
            insights.contentGaps.push(`Low content match (${data.contentGaps.matchPercentage}%). Missing critical branding sentences from reference doc.`);
        }

        if (data.technicalIssues.contrastCount > 0) {
            insights.criticalIssues.push(`${data.technicalIssues.contrastCount} WCAG Contrast violations found. Fix immediately for accessibility.`);
        }

        if (data.technicalIssues.buttonIssues > 0) {
            insights.priorityFixes.push(`Inconsistent button styles or incorrect labels found (${data.technicalIssues.buttonIssues} issues).`);
        }

        if (data.technicalIssues.imageIssues > 0) {
            insights.criticalIssues.push(`${data.technicalIssues.imageIssues} images missing ALT text or descriptive names.`);
        }

        if (data.technicalIssues.fontIssues > 0) {
            insights.priorityFixes.push(`Non-accessible font sizes or poor readability found (${data.technicalIssues.fontIssues} issues).`);
        }

        if (data.technicalIssues.loremIpsumFound) {
            insights.criticalIssues.push(`Placeholder "Lorem Ipsum" text detected. Replace with real content.`);
        }

        insights.suggestions.push("Consider implementing dark mode support and optimizing LCP images.");

        return insights;
    }
};

window.AIAuditService = AIAuditService;
