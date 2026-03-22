/**
 * SiteLens Core Engine (Ultimate Production Grade)
 * 
 * Final Robustness Features:
 * 1. Strict Abort Signal Enforcement
 * 2. Shadow DOM Safety Depth (Max 10)
 * 3. Transparent Result Capping (truncated flag)
 * 4. Strictly Non-Blocking requestIdleCallback
 */

export class CoreEngine {
    constructor(options = {}) {
        this.batchLimit = options.batchLimit || 50;
        this.resultCap = options.resultCap || 500;
        this.maxShadowDepth = options.maxShadowDepth || 10;
        
        this.analyzers = [];
        this.results = new Map();
        this.truncationStatus = new Map(); // Track which analyzers were truncated
        
        this.isProcessing = false;
        this.abortController = null;
        
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

    cancel() {
        if (this.isProcessing && this.abortController) {
            this.abortController.abort();
            this.isProcessing = false;
            console.log('🛑 SiteLens: Audit execution terminated by user.');
        }
    }

    reset() {
        this.results.clear();
        this.truncationStatus.forEach((_, name) => this.truncationStatus.set(name, false));
        this.perfMetrics.nodesProcessed = 0;
        this.perfMetrics.analyzerTimes.forEach((_, name) => this.perfMetrics.analyzerTimes.set(name, 0));
        this.abortController = new AbortController();
    }

    async runAudit(root = document.documentElement) {
        if (this.isProcessing) this.cancel();
        
        this.isProcessing = true;
        this.reset();
        this.perfMetrics.startTime = performance.now();

        try {
            await this.processStreaming(root, this.abortController.signal);
        } catch (error) {
            if (error.name === 'AbortError') return { cancelled: true };
            throw error;
        } finally {
            this.isProcessing = false;
        }

        this.perfMetrics.endTime = performance.now();
        return this.getFinalResults();
    }

    async processStreaming(root, signal) {
        const walkerStack = [this.createWalker(root)];
        const context = { h1Count: 0, lastHeadingLevel: 0 };

        return new Promise((resolve, reject) => {
            const process = (deadline) => {
                // 1. Check signal BEFORE batch
                if (signal.aborted) {
                    reject(new DOMException('Aborted by user', 'AbortError'));
                    return;
                }

                let processedInBatch = 0;

                while (deadline.timeRemaining() > 0 && processedInBatch < this.batchLimit) {
                    // 2. Check signal INSIDE batch loop
                    if (signal.aborted) {
                        reject(new DOMException('Aborted by user', 'AbortError'));
                        return;
                    }

                    let currentWalker = walkerStack[walkerStack.length - 1];
                    let node = currentWalker.nextNode();

                    if (!node) {
                        walkerStack.pop();
                        if (walkerStack.length === 0) {
                            resolve();
                            return;
                        }
                        continue;
                    }

                    this.processNode(node, context);
                    this.perfMetrics.nodesProcessed++;
                    processedInBatch++;

                    // 3. Shadow DOM Piercing (with depth limit)
                    if (node.shadowRoot && walkerStack.length < this.maxShadowDepth) {
                        walkerStack.push(this.createWalker(node.shadowRoot));
                    }
                }

                // 4. Check signal BEFORE scheduling next batch
                if (signal.aborted) {
                    reject(new DOMException('Aborted by user', 'AbortError'));
                } else {
                    this.scheduleNextBatch(process);
                }
            };

            this.scheduleNextBatch(process);
        });
    }

    createWalker(root) {
        return document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
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
            
            // Result Capping Transparency
            if (currentResults.length >= this.resultCap) {
                this.truncationStatus.set(name, true);
                continue;
            }

            const start = performance.now();
            const result = analyze(node, context);
            const duration = performance.now() - start;

            this.perfMetrics.analyzerTimes.set(name, this.perfMetrics.analyzerTimes.get(name) + duration);

            if (result) {
                if (!this.results.has(name)) this.results.set(name, []);
                this.results.get(name).push(result);
            }
        }
    }

    getFinalResults() {
        const output = {};
        this.results.forEach((val, key) => {
            output[key] = {
                items: val,
                truncated: this.truncationStatus.get(key) || false
            };
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

    logPerformance() {
        const m = this.getFinalResults().metrics;
        console.group('🚀 SiteLens [Ultimate] Performance Report');
        console.log(`Nodes: ${m.nodesProcessed}`);
        console.log(`Time: ${m.totalTime.toFixed(2)}ms`);
        console.groupEnd();
    }
}
