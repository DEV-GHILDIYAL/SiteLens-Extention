/**
 * SiteLens Content Script - Main Entry Point
 * 
 * Architecture:
 * - Zero global window pollution
 * - HandlerMap for clean message routing
 * - CoreEngine orchestrator
 */

import { CoreEngine } from './modules/core-engine.js';
import { ImageAnalyzer } from './modules/analyzers/image-analyzer.js';
import { SEOAnalyzer } from './modules/analyzers/seo-analyzer.js';
import { ContrastAnalyzer } from './modules/analyzers/contrast-analyzer.js';
import { ButtonAnalyzer } from './modules/analyzers/button-analyzer.js';
import { FontAnalyzer } from './modules/analyzers/font-analyzer.js';
import { ContentAnalyzer } from './modules/analyzers/content-analyzer.js';
import { LinkAnalyzer } from './modules/analyzers/link-analyzer.js';

class SiteLensController {
    constructor() {
        this.engine = new CoreEngine({ batchSize: 75 });
        this.setupAnalyzers();
        this.setupMessageListeners();
    }

    setupAnalyzers() {
        // Register all analyzers following the interface
        this.engine.registerAnalyzer(ImageAnalyzer.name, ImageAnalyzer.analyze.bind(ImageAnalyzer));
        this.engine.registerAnalyzer(SEOAnalyzer.name, SEOAnalyzer.analyze.bind(SEOAnalyzer));
        this.engine.registerAnalyzer(ContrastAnalyzer.name, ContrastAnalyzer.analyze.bind(ContrastAnalyzer));
        this.engine.registerAnalyzer(ButtonAnalyzer.name, ButtonAnalyzer.analyze.bind(ButtonAnalyzer));
        this.engine.registerAnalyzer(FontAnalyzer.name, FontAnalyzer.analyze.bind(FontAnalyzer));
        this.engine.registerAnalyzer(ContentAnalyzer.name, ContentAnalyzer.analyze.bind(ContentAnalyzer));
        this.engine.registerAnalyzer(LinkAnalyzer.name, LinkAnalyzer.analyze.bind(LinkAnalyzer));
    }

    setupMessageListeners() {
        // HANDLER MAP: Clean separation of concerns
        const handlers = {
            'ping': (request, sendResponse) => {
                sendResponse({ success: true, message: 'pong' });
            },
            'analyze': async (request, sendResponse) => {
                try {
                    // CANCELLATION: Ensure only one audit runs at a time
                    if (this.engine.isProcessing) {
                        this.engine.cancel();
                    }
                    console.log('🔍 Starting robust audit...');
                    const results = await this.engine.runAudit();
                    if (results.cancelled) {
                        sendResponse({ success: true, cancelled: true });
                        return;
                    }
                    sendResponse({ success: true, ...results });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            },
            'analyzeAll': async (request, sendResponse) => {
                try {
                    console.log('🏁 Starting analyzeAll (Self Audit Mode)...');
                    const results = await this.engine.runAudit();
                    
                    // Format for SelfAuditManager ensuring correct key mapping
                    const data = {
                        contrast: { total: results.results.contrast?.items?.length || 0, violations: results.results.contrast?.items || [] },
                        images: { issues: results.results.images?.items || [] },
                        buttons: { stats: { totalIssues: results.results.buttons?.items?.length || 0 }, items: results.results.buttons?.items || [] },
                        seo: { score: results.results.seo?.items?.[0]?.score || 100 },
                        fonts: { issues: results.results.fonts?.items || [] },
                        content: { loremIpsum: { count: results.results.content?.items?.length || 0, items: results.results.content?.items || [] } },
                        links: { issues: results.results.links?.items || [] }
                    };
                    
                    console.log('📊 analyzeAll results ready:', data);
                    sendResponse({ success: true, data });
                } catch (error) {
                    console.error('❌ analyzeAll failed:', error);
                    sendResponse({ success: false, error: error.message });
                }
            },
            'crawlNav': (request, sendResponse) => {
                const links = Array.from(document.querySelectorAll('a[href]'))
                    .map(a => a.getAttribute('href'))
                    .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));
                sendResponse({ success: true, links });
            },
            'getPageText': (request, sendResponse) => {
                // Focus on main content text
                const text = document.body.innerText || '';
                sendResponse({ success: true, text });
            },
            'clearResults': (request, sendResponse) => {
                this.engine.reset();
                sendResponse({ success: true });
            }
        };

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            const handler = handlers[request.action];
            if (handler) {
                handler(request, sendResponse);
                return true; // Keep channel open for async handlers
            }
            return false;
        });
    }
}

// Initialize without polluting the global window object
new SiteLensController();
