/**
 * SiteLens - Consolidated Production Content Script
 * 
 * Features:
 * 1. Viewport-First Priority Traversal (2-pass streaming)
 * 2. Pause / Resume state machine
 * 3. Shadow DOM support (Walker Stack)
 * 4. Zero Global Scope pollution
 */

(function() {
    'use strict';

    // --- ANALYZERS (Inlined for Bundling) ---

    const ImageAnalyzer = {
        name: 'images',
        analyze(node) {
            if (node.tagName?.toLowerCase() !== 'img') return null;
            const alt = node.getAttribute('alt');
            if (alt === null) return { type: 'missing-alt', text: 'Image missing alt attribute' };
            if (alt.trim() === '') return { type: 'empty-alt', text: 'Decorative image (empty alt)' };
            const redundant = ['image of', 'photo of', 'picture of'];
            if (redundant.some(word => alt.toLowerCase().includes(word))) {
                return { type: 'redundant-alt', text: 'Alt text contains redundant words' };
            }
            return null;
        }
    };

    const SEOAnalyzer = {
        name: 'seo',
        analyze(node, context) {
            const tag = node.tagName?.toLowerCase();
            if (tag?.startsWith('h')) {
                const level = parseInt(tag[1]);
                if (level === 1) context.h1Count++;
                if (context.lastHeadingLevel > 0 && level > context.lastHeadingLevel + 1) {
                    const res = { type: 'heading-skip', text: `Heading skip: H${context.lastHeadingLevel} to H${level}` };
                    context.lastHeadingLevel = level;
                    return res;
                }
                context.lastHeadingLevel = level;
            }
            if (tag === 'link' && node.rel === 'canonical') {
                if (context.canonicalFound) return { type: 'duplicate-canonical', text: 'Multiple canonical tags found' };
                context.canonicalFound = true;
            }
            if (tag === 'meta' && node.name === 'robots' && node.content.includes('noindex')) {
                return { type: 'seo-warning', text: 'Page is set to noindex via meta tag' };
            }
            return null;
        }
    };

    // --- CORE ENGINE ---

    class CoreEngine {
        constructor(options = {}) {
            this.batchLimit = options.batchLimit || 50;
            this.resultCap = options.resultCap || 500;
            this.maxShadowDepth = options.maxShadowDepth || 10;
            this.analyzers = [];
            this.results = new Map();
            this.truncationStatus = new Map();
            this.isProcessing = false;
            this.isPaused = false;
            this.abortController = null;
            this.processedNodes = new Set(); // For 2-pass priority tracking
            
            this.perfMetrics = {
                startTime: 0,
                endTime: 0,
                nodesProcessed: 0,
                analyzerTimes: new Map()
            };
        }

        registerAnalyzer(name, analyzerFn) {
            this.analyzers.push({ name, analyze: analyzerFn });
            this.perfMetrics.analyzerTimes.set(name, 0);
            this.truncationStatus.set(name, false);
        }

        pause() { this.isPaused = true; console.log('🟢 SiteLens: Paused'); }
        resume() { this.isPaused = false; console.log('▶️ SiteLens: Resumed'); }
        cancel() {
            if (this.isProcessing && this.abortController) {
                this.abortController.abort();
                this.isProcessing = false;
                console.log('🛑 SiteLens: Terminated');
            }
        }

        reset() {
            this.results.clear();
            this.processedNodes.clear();
            this.truncationStatus.forEach((_, name) => this.truncationStatus.set(name, false));
            this.perfMetrics.nodesProcessed = 0;
            this.perfMetrics.analyzerTimes.forEach((_, name) => this.perfMetrics.analyzerTimes.set(name, 0));
            this.abortController = new AbortController();
        }

        async runAudit(root = document.body) {
            if (this.isProcessing) this.cancel();
            this.isProcessing = true;
            this.reset();
            this.perfMetrics.startTime = performance.now();

            const context = { h1Count: 0, lastHeadingLevel: 0, canonicalFound: false };

            try {
                // PASS 1: Viewport Priority
                await this.processPriority(root, context, true);
                // PASS 2: Background
                await this.processPriority(root, context, false);
            } catch (error) {
                if (error.name === 'AbortError') return { cancelled: true };
                throw error;
            } finally {
                this.isProcessing = false;
            }

            this.perfMetrics.endTime = performance.now();
            return this.getFinalResults();
        }

        async processPriority(root, context, onlyVisible) {
            const signal = this.abortController.signal;
            const walkerStack = [document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)];
            
            return new Promise((resolve, reject) => {
                const process = (deadline) => {
                    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
                    if (this.isPaused) { this.scheduleNextBatch(process); return; }

                    let processedInBatch = 0;
                    while (deadline.timeRemaining() > 0 && processedInBatch < this.batchLimit) {
                        if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }

                        let currentWalker = walkerStack[walkerStack.length - 1];
                        let node = currentWalker.nextNode();

                        if (!node) {
                            walkerStack.pop();
                            if (walkerStack.length === 0) { resolve(); return; }
                            continue;
                        }

                        // Optimization: Ignore already processed in Pass 1
                        if (!onlyVisible && this.processedNodes.has(node)) continue;

                        if (onlyVisible) {
                            if (!this.isInViewport(node)) continue;
                            this.processedNodes.add(node);
                        }

                        this.processNode(node, context);
                        this.perfMetrics.nodesProcessed++;
                        processedInBatch++;

                        if (node.shadowRoot && walkerStack.length < this.maxShadowDepth) {
                            walkerStack.push(document.createTreeWalker(node.shadowRoot, NodeFilter.SHOW_ELEMENT));
                        }
                    }
                    this.scheduleNextBatch(process);
                };
                this.scheduleNextBatch(process);
            });
        }

        isInViewport(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const rect = node.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        }

        scheduleNextBatch(callback) {
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(callback, { timeout: 1000 });
            } else {
                setTimeout(() => callback({ timeRemaining: () => 10 }), 1);
            }
        }

        processNode(node, context) {
            for (const { name, analyze } of this.analyzers) {
                const currentResults = this.results.get(name) || [];
                if (currentResults.length >= this.resultCap) {
                    this.truncationStatus.set(name, true);
                    continue;
                }
                const start = performance.now();
                const result = analyze(node, context);
                this.perfMetrics.analyzerTimes.set(name, (this.perfMetrics.analyzerTimes.get(name) || 0) + (performance.now() - start));
                if (result) {
                    if (!this.results.has(name)) this.results.set(name, []);
                    this.results.get(name).push(result);
                }
            }
        }

        getFinalResults() {
            const output = {};
            this.results.forEach((val, key) => {
                output[key] = { items: val, truncated: this.truncationStatus.get(key) };
            });
            return {
                results: output,
                metrics: {
                    totalTime: this.perfMetrics.endTime - this.perfMetrics.startTime,
                    nodesProcessed: this.perfMetrics.nodesProcessed,
                    analyzerBreakdown: Object.fromEntries(this.perfMetrics.analyzerTimes)
                }
            };
        }
    }

    // --- CONTROLLER ---

    const engine = new CoreEngine({ batchLimit: 40 });
    engine.registerAnalyzer(ImageAnalyzer.name, ImageAnalyzer.analyze.bind(ImageAnalyzer));
    engine.registerAnalyzer(SEOAnalyzer.name, SEOAnalyzer.analyze.bind(SEOAnalyzer));

    const HandlerMap = {
        'analyze': async (request, sendResponse) => {
            try {
                const results = await engine.runAudit();
                sendResponse({ success: true, ...results });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
            return true;
        },
        'pause': (request, sendResponse) => {
            engine.pause();
            sendResponse({ success: true });
        },
        'resume': (request, sendResponse) => {
            engine.resume();
            sendResponse({ success: true });
        },
        'cancel': (request, sendResponse) => {
            engine.cancel();
            sendResponse({ success: true });
        }
    };

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        const handler = HandlerMap[request.action];
        if (handler) {
            handler(request, sendResponse);
            return true; // Keep channel open for async
        }
    });

    console.log('🛡️ SiteLens: Consolidated content script injected.');

})();
