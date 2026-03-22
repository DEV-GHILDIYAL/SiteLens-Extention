class SelfAuditManager {
    constructor() {
        this.queue = [];
        this.visited = new Set();
        this.isRunning = false;
        this.fullReport = [];
        this.targetConfigs = []; // [{ url, fileText, fileName, rowElement }]
        this.currentConfig = {};
        this.cardMap = new Map();

        // UI Bindings
        this.bindElements();
        this.initialize();
    }

    bindElements() {
        this.startBtn = document.getElementById('startSelfAuditBtn');
        this.stopBtn = document.getElementById('stopSelfAuditBtn');
        this.progressArea = document.getElementById('auditProgressArea');
        this.progressBar = document.getElementById('auditProgressBar');
        this.queueCountDisplay = document.getElementById('auditQueueCount');
        this.statusBox = document.getElementById('auditStatusBox');
        this.resultsLog = document.getElementById('auditResultsLog');
        this.summaryPanel = document.getElementById('auditSummaryPanel');
        
        this.addTargetBtn = document.getElementById('addTargetBtn');
        this.targetsList = document.getElementById('auditTargetsList');

        this.dashboardView = document.getElementById('auditDashboard');
        this.detailView = document.getElementById('auditDetailView');
        this.detailContent = document.getElementById('auditDetailContent');
        this.detailTitle = document.getElementById('auditDetailTitle');
        this.detailLink = document.getElementById('auditDetailLink');
        this.detailBackBtn = document.getElementById('auditDetailBackBtn');
    }

    initialize() {
        if (this.startBtn) this.startBtn.onclick = () => this.startAudit();
        if (this.stopBtn) this.stopBtn.onclick = () => this.stopAudit();
        if (this.detailBackBtn) this.detailBackBtn.onclick = () => this.closeDetailView();
        
        if (this.addTargetBtn) {
            this.addTargetBtn.onclick = () => this.addTargetRow();
        }

        // Add first row by default if empty
        if (this.targetsList && this.targetsList.children.length === 0) {
            this.addTargetRow();
        }
    }

    resetUI() {
        if (this.dashboardView) this.dashboardView.classList.remove('hidden');
        if (this.detailView) this.detailView.classList.add('hidden');
        if (this.progressArea) this.progressArea.classList.add('hidden');
        if (this.startBtn) this.startBtn.disabled = false;
        this.isRunning = false;
    }

    addTargetRow() {
        if (!this.targetsList) {
            console.error('❌ addTargetRow: targetsList element not found');
            return;
        }
        
        const row = document.createElement('div');
        row.className = 'audit-target-row';
        row.style.cssText = 'display: flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; padding: 6px 10px; transition: all 0.2s;';
        row.innerHTML = `
            <input type="text" class="audit-row-url" placeholder="URL" 
                style="flex: 1; min-width: 0; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); font-size: 11px;">
            
            <label class="file-upload-btn btn-sm" style="margin: 0; padding: 4px 6px; font-size: 10px; cursor: pointer; white-space: nowrap; flex-shrink: 0;">
                <span class="btn-icon">📂</span>
                <input type="file" class="audit-row-file hidden-file-input" accept=".txt,.docx" style="display: none;">
            </label>
            
            <span class="audit-row-filename" style="font-size: 10px; color: var(--text-muted); max-width: 60px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0;">No doc</span>
            
            <button class="remove-row-btn" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px; padding: 0 4px; flex-shrink: 0;">×</button>
        `;
        this.targetsList.appendChild(row);

        // Scroll to bottom
        this.targetsList.scrollTop = this.targetsList.scrollHeight;

        this.bindRowEvents(row);
    }

    bindRowEvents(row) {
        const fileInput = row.querySelector('.audit-row-file');
        const fileNameDisplay = row.querySelector('.audit-row-filename');
        const removeBtn = row.querySelector('.remove-row-btn');

        if (fileInput) {
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                fileNameDisplay.textContent = 'Processing...';
                let text = '';
                try {
                    if (file.name.endsWith('.docx')) {
                        const arrayBuffer = await file.arrayBuffer();
                        const result = await window.mammoth.extractRawText({ arrayBuffer });
                        text = result.value;
                    } else {
                        text = await file.text();
                    }
                    fileNameDisplay.textContent = file.name;
                    row.dataset.fileText = text;
                    row.dataset.fileName = file.name;
                } catch (err) {
                    fileNameDisplay.textContent = 'Error loading file';
                    console.error(err);
                }
            };
        }

        if (removeBtn) {
            removeBtn.onclick = () => row.remove();
        }
    }

    async startAudit() {
        const rows = Array.from(this.targetsList.querySelectorAll('.audit-target-row'));
        const targets = rows.map(row => ({
            url: row.querySelector('.audit-row-url').value.trim(),
            fileText: row.dataset.fileText || '',
            fileName: row.dataset.fileName || ''
        })).filter(t => t.url);

        if (targets.length === 0) {
            this.logStatus('Error: Please enter at least one URL.');
            return;
        }

        this.isRunning = true;
        this.queue = targets.map(t => t.url);
        this.referenceDocs = new Map();
        
        // Load reference docs from rows
        targets.forEach(t => {
            if (t.fileText) {
                const slug = ContentComparisonEngine.getSlug(t.url);
                this.referenceDocs.set(slug, { name: t.fileName, text: t.fileText });
            }
        });

        this.visited = new Set();
        this.fullReport = [];
        this.cardMap.clear();
        this.resultsLog.innerHTML = '';
        this.progressArea.classList.remove('hidden');
        this.startBtn.disabled = true;

        this.currentConfig = {
            maxPages: targets.length, // Audit all provided targets
            delay: 1000
        };

        this.logStatus(`Audit Engine Started with ${targets.length} targets...`);
        await this.auditLoop();
    }

    stopAudit() {
        this.isRunning = false;
        this.logStatus('Audit Canceled by User.');
        this.startBtn.disabled = false;
    }

    async auditLoop() {
        while (this.isRunning && this.queue.length > 0 && this.visited.size < this.currentConfig.maxPages) {
            const url = this.queue.shift();
            const normalized = this.normalizeUrl(url);
            
            if (this.visited.has(normalized)) continue;
            this.visited.add(normalized);
            
            this.updateProgressBar();
            this.createPendingCard(url);

            try {
                this.logStatus(`Auditing: ${url}`);
                const result = await this.auditPage(url);
                this.fullReport.push(result);
                this.updateCardWithResult(url, result);
            } catch (err) {
                console.error('Page Audit error:', err);
                this.updateCardWithError(url, err.message);
            }
        }

        this.finalizeAudit();
    }

    async auditPage(url) {
        // 1. Navigate
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.update(tab.id, { url });
        
        // 2. Wait for load
        await this.waitForLoad(tab.id);
        
        // 2.5 Ensure Content Script is injected (Crucial for file:// URLs)
        await this.ensureContentScript(tab.id);

        // 3. Technical Audit
        this.logStatus(`[${url}] Scanning document structure...`);
        await new Promise(r => setTimeout(r, 600));
        
        const techResult = await this.sendMessage(tab.id, { action: 'analyzeAll' });
        const techData = (techResult && techResult.success) ? techResult.data : {
            contrast: { violations: [] },
            images: { issues: [] },
            buttons: { items: [], stats: { totalIssues: 0 } },
            seo: { score: 100 },
            fonts: { issues: [] },
            content: { loremIpsum: { count: 0, items: [] } },
            links: { issues: [] }
        };

        // 4. Crawl Nav
        const linksResult = await this.sendMessage(tab.id, { action: 'crawlNav' });
        this.addLinksToQueue(linksResult.links || [], url);

        // 5. Content Comparison
        const pageTextResult = await this.sendMessage(tab.id, { action: 'getPageText' });
        const pageText = pageTextResult.text || '';
        const slug = ContentComparisonEngine.getSlug(url);
        const refDoc = this.referenceDocs.get(slug) || this.referenceDocs.get('home') || null;
        const comparison = ContentComparisonEngine.compare(refDoc?.text || '', pageText);

        // 6. AI Insights
        const [updatedTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const aiInsights = await AIAuditService.analyze({
            url,
            title: updatedTab?.title || 'Page',
            technical: techData,
            contentComparison: comparison
        });

        // Calculate score
        const score = this.calculateScore(techData, comparison);

        return {
            url,
            title: updatedTab?.title || 'Page',
            score,
            technical: techData,
            comparison,
            aiInsights
        };
    }

    addLinksToQueue(links, currentUrl) {
        const origin = new URL(currentUrl).origin;
        links.forEach(link => {
            try {
                const fullUrl = new URL(link, currentUrl).href;
                if (fullUrl.startsWith(origin) && !this.visited.has(this.normalizeUrl(fullUrl))) {
                    if (!this.queue.includes(fullUrl)) {
                        this.queue.push(fullUrl);
                    }
                }
            } catch (e) {}
        });
    }

    normalizeUrl(url) {
        try {
            const u = new URL(url);
            return u.origin + u.pathname.replace(/\/$/, '');
        } catch (e) { return url; }
    }

    waitForLoad(tabId) {
        return new Promise(resolve => {
            const listener = (tid, change) => {
                if (tid === tabId && change.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    // Additional stabilization wait
                    setTimeout(resolve, 2000);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }

    async ensureContentScript(tabId) {
        try {
            const ping = await this.sendMessage(tabId, { action: 'ping' });
            if (ping.success) return; // Already injected
        } catch (e) {
            // Not injected, proceed to executeScript
        }

        this.logStatus('Injecting content engine...');
        const scripts = [
            'src/utils/color-utils.js',
            'src/utils/wcag-calculator.js',
            'src/utils/dom-traverser.js',
            'src/utils/canvas-processor.js',
            'src/utils/text-detector.js',
            'src/utils/background-sampler.js',
            'src/utils/contrast-analyzer.js',
            'src/utils/font-analyzer.js',
            'src/utils/button-analyzer.js',
            'src/utils/image-analyzer.js',
            'src/utils/seo-analyzer.js',
            'src/utils/color-analyzer.js',
            'src/utils/content-analyzer.js',
            'src/utils/link-analyzer.js',
            'src/content/overlay.js',
            'src/content/content.js'
        ];

        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: scripts
            });
        } catch (scriptErr) {
            console.error('Injection failed:', scriptErr);
            if (scriptErr.message.includes('must request permission')) {
                throw new Error('Permission Denied. Please RELOAD the extension in chrome://extensions and ensure "Allow access to file URLs" is ON.');
            }
            throw scriptErr;
        }
        
        // Brief pause for initialization
        await new Promise(r => setTimeout(r, 300));
    }

    sendMessage(tabId, message) {
        return new Promise(resolve => {
            chrome.tabs.sendMessage(tabId, message, res => {
                resolve(res || { success: false });
            });
        });
    }

    calculateScore(tech, comp) {
        if (!tech) return 0;
        let score = 100;
        
        // Technical Weights
        if (tech.contrast?.violations?.length > 0) score -= 15;
        if (tech.images?.issues?.length > 0) score -= 10;
        if (tech.buttons?.stats?.totalIssues > 0) score -= 10;
        if (tech.fonts?.issues?.length > 0) score -= 5;
        if (tech.content?.loremIpsum?.count > 0) score -= 15;
        if (tech.seo?.score < 80) score -= 10;
        
        // Content Gap Weights
        if (comp && comp.matchPercentage < 90) score -= (90 - comp.matchPercentage) / 2;
        
        return Math.max(0, Math.round(score));
    }

    // UI Renderers
    logStatus(msg) {
        if (this.statusBox) {
            const div = document.createElement('div');
            div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            this.statusBox.prepend(div);
        }
    }

    updateProgressBar() {
        const progress = (this.visited.size / this.currentConfig.maxPages) * 100;
        if (this.progressBar) this.progressBar.style.width = `${progress}%`;
        if (this.queueCountDisplay) this.queueCountDisplay.textContent = `${this.visited.size}/${this.currentConfig.maxPages}`;
    }

    createPendingCard(url) {
        const card = document.createElement('div');
        card.className = 'audit-result-card scanning';
        const displayPath = new URL(url).pathname === '/' ? 'Home' : new URL(url).pathname.split('/').pop() || 'Page';
        
        card.innerHTML = `
            <div class="audit-card-badge running"></div>
            <div class="audit-card-icon">⏳</div>
            <div class="audit-card-title">${displayPath}</div>
            <div class="audit-card-score">--</div>
            <div class="audit-card-meta">Analyzing...</div>
        `;
        this.resultsLog.prepend(card);
        this.cardMap.set(url, card);
    }

    updateCardWithResult(url, result) {
        const card = this.cardMap.get(url);
        if (!card) return;

        card.classList.remove('scanning');
        card.onclick = () => this.openDetailView(result);
        const statusClass = result.score >= 90 ? 'pass' : (result.score >= 70 ? 'warning' : 'fail');
        
        card.innerHTML = `
            <div class="audit-card-badge ${statusClass}"></div>
            <div class="audit-card-icon">📄</div>
            <div class="audit-card-title">${result.title || 'Page'}</div>
            <div class="audit-card-score">${result.score}</div>
            <div class="audit-card-meta">${new URL(result.url).pathname}</div>
        `;

        this.updateSummary();
    }

    updateSummary() {
        if (!this.summaryPanel) return;
        this.summaryPanel.classList.remove('hidden');
        
        const totalScore = this.fullReport.reduce((acc, r) => acc + r.score, 0);
        const avgScore = Math.round(totalScore / this.fullReport.length);
        const totalGaps = this.fullReport.reduce((acc, r) => acc + r.comparison.missingContent.length, 0);

        const avgEl = document.getElementById('summaryAvgScore');
        const gapsEl = document.getElementById('summaryTotalIssues');
        
        if (avgEl) avgEl.textContent = avgScore;
        if (gapsEl) gapsEl.textContent = totalGaps;
    }

    updateCardWithError(url, error) {
        const card = this.cardMap.get(url);
        if (card) {
            card.innerHTML = `<div class="audit-card-badge fail"></div><div class="audit-card-content"><div class="audit-card-title">Error</div><div class="audit-card-meta">${error}</div></div>`;
        }
    }

    openDetailView(result) {
        console.log('🤖 AI Audit: Opening Premium Detail View for', result?.url);
        if (!result) return;
        
        try {
            this.dashboardView.classList.add('hidden');
            this.detailView.classList.remove('hidden');
            this.detailTitle.textContent = result.title || 'Page Report';
            this.detailLink.href = result.url || '#';
            
            const tech = result.technical || {};
            const comp = result.comparison || { matchPercentage: 0, missingContent: [] };
            const insights = result.aiInsights || { criticalIssues: [], suggestions: [] };
            
            const getHealthStatus = (score) => {
                if (score >= 90) return { text: "Health is Excellent! ✨", color: "#10b981" };
                if (score >= 70) return { text: "Health is Good! 👍", color: "var(--primary)" };
                if (score >= 50) return { text: "Health is Fair ⚠️", color: "var(--warning)" };
                return { text: "Health is Poor 🚩", color: "var(--danger)" };
            };
            const health = getHealthStatus(result.score || 0);
            
            const getStatus = (val, type) => {
                if (type === 'seo' || type === 'match') return val >= 90 ? 'good' : (val >= 70 ? 'warning' : 'critical');
                return val === 0 ? 'good' : (val > 10 ? 'critical' : 'warning');
            };

            this.detailContent.innerHTML = `
                <div class="audit-report-container">
                    <!-- 1. Health Header (Compacted) -->
                    <div class="audit-health-header">
                        <div class="health-meter" style="border-color: ${health.color}44;">
                            <div class="health-score-value" style="color: ${health.color};">${result.score || 0}%</div>
                        </div>
                        <div class="health-label" style="color: ${health.color}; font-size: 11px;">${health.text}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Analysis for: ${result.title || 'Untitled Page'}</div>
                    </div>

                    <!-- 2. Technical Metrics -->
                    <div class="audit-metric-grid">
                        <div class="metric-card ${getStatus(tech.contrast?.violations?.length || 0)}">
                            <div class="metric-label">Contrast</div>
                            <div class="metric-value">${tech.contrast?.violations?.length || 0} Issues</div>
                            <div class="metric-status">
                                <span>${tech.contrast?.violations?.length === 0 ? '✅ optimal' : '⚠️ accessibility fix'}</span>
                            </div>
                        </div>
                        <div class="metric-card ${getStatus(tech.images?.issues?.length || 0)}">
                            <div class="metric-label">Images</div>
                            <div class="metric-value">${tech.images?.issues?.length || 0} Alt Issues</div>
                            <div class="metric-status">
                                <span>${tech.images?.issues?.length === 0 ? '✅ fully tagged' : '⚠️ descriptive alts needed'}</span>
                            </div>
                        </div>
                        <div class="metric-card ${getStatus(tech.buttons?.stats?.totalIssues || 0)}">
                            <div class="metric-label">Buttons</div>
                            <div class="metric-value">${tech.buttons?.stats?.totalIssues || 0} UI Fixes</div>
                            <div class="metric-status">
                                <span>${tech.buttons?.stats?.totalIssues === 0 ? '✅ interactive' : '⚠️ labeling/links'}</span>
                            </div>
                        </div>
                        <div class="metric-card ${getStatus(tech.content?.loremIpsum?.count || 0)}">
                            <div class="metric-label">Placeholders</div>
                            <div class="metric-value">${tech.content?.loremIpsum?.count || 0} Flagged</div>
                            <div class="metric-status">
                                <span>${tech.content?.loremIpsum?.count === 0 ? '✅ production' : '🚩 cleanup lorem'}</span>
                            </div>
                        </div>
                        <div class="metric-card ${getStatus(tech.seo?.score || 100, 'seo')}">
                            <div class="metric-label">SEO Performance</div>
                            <div class="metric-value">${tech.seo?.score || 100}/100</div>
                            <div class="metric-status">
                                <span>${tech.seo?.score >= 90 ? '✅ highly optimized' : '⚠️ title/meta needs work'}</span>
                            </div>
                        </div>
                        <div class="metric-card ${getStatus(tech.links?.issues?.length || 0)}">
                            <div class="metric-label">Navigation</div>
                            <div class="metric-value">${tech.links?.issues?.length || 0} Broken</div>
                            <div class="metric-status">
                                <span>${tech.links?.issues?.length === 0 ? '✅ clean paths' : '⚠️ verify links'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Content Gaps -->
                    <div class="gap-section">
                        <div class="gap-header">
                            <h4>📄 Content Comparison</h4>
                            <span class="badge ${getStatus(comp.matchPercentage, 'match')}">${comp.matchPercentage}% match</span>
                        </div>
                        <div class="gap-list">
                            ${comp.missingContent.length > 0 
                                ? comp.missingContent.slice(0, 15).map(s => `
                                    <div class="gap-item">
                                        <span class="gap-bullet">!</span>
                                        <span>Missing: ${s.substring(0, 50)}${s.length > 50 ? '...' : ''}</span>
                                    </div>
                                  `).join('')
                                : '<div class="empty-hint">All reference content present in live page! ✅</div>'
                            }
                            ${comp.missingContent.length > 15 ? `<div style="padding: 10px; font-size: 10px; text-align: center; color: var(--text-muted);">+ ${comp.missingContent.length - 15} more differences detected</div>` : ''}
                        </div>
                    </div>

                    <!-- 4. AI Insights -->
                    <div class="ai-insights-panel">
                        <div class="insight-group">
                            <div class="insight-title" style="color: var(--warning);">⚡ Critical Optimization</div>
                            ${(insights.criticalIssues || []).map(i => `<div class="insight-item">${i}</div>`).join('')}
                        </div>
                        <div class="insight-group">
                            <div class="insight-title" style="color: var(--primary);">💡 UI Suggestions</div>
                            ${(insights.suggestions || []).map(s => `<div class="insight-item">${s}</div>`).join('')}
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            console.error('❌ openDetailView failed:', err);
            this.closeDetailView();
        }
    }

    closeDetailView() {
        this.detailView.classList.add('hidden');
        this.dashboardView.classList.remove('hidden');
    }

    finalizeAudit() {
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.logStatus('AUDIT COMPLETE. View individual reports above.');
    }
}

// Global Export
window.SelfAuditManager = SelfAuditManager;
