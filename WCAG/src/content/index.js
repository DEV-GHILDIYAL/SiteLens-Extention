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

class SiteLensController {
    constructor() {
        this.engine = new CoreEngine({ batchSize: 75 });
        this.setupAnalyzers();
        this.setupMessageListeners();
    }

    setupAnalyzers() {
        // Register analyzers following the interface
        this.engine.registerAnalyzer(ImageAnalyzer.name, ImageAnalyzer.analyze.bind(ImageAnalyzer));
        this.engine.registerAnalyzer(SEOAnalyzer.name, SEOAnalyzer.analyze.bind(SEOAnalyzer));
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
