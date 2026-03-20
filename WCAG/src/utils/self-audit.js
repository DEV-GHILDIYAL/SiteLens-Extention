/**
 * Self Audit Manager - Phase 3: Premium Grid UI & Deep Fixes
 */
class SelfAuditManager {
    constructor() {
        this.queue = [];
        this.visited = new Set();
        this.isRunning = false;
        this.referenceContent = '';
        this.fullReport = [];
        this.maxPages = 50;
        this.cardMap = new Map(); // Store card elements by URL
        this.processedTitles = new Set(); // Store titles to deduplicate


        // UI Elements
        this.startBtn = document.getElementById('startSelfAuditBtn');
        this.stopBtn = document.getElementById('stopSelfAuditBtn');
        this.progressArea = document.getElementById('auditProgressArea');
        this.progressBar = document.getElementById('auditProgressBar');
        this.queueCountDisplay = document.getElementById('auditQueueCount');
        this.logArea = document.getElementById('auditResultsLog'); // The Grid Container

        this.fileInput = document.getElementById('auditContentFile');
        this.urlInput = document.getElementById('auditStartUrl');
        this.ignoreInput = document.getElementById('auditIgnorePatterns');

        // Detail View Elements
        this.dashboardView = document.getElementById('auditDashboard');
        this.detailView = document.getElementById('auditDetailView');
        this.detailContent = document.getElementById('auditDetailContent');
        this.detailBackBtn = document.getElementById('auditDetailBackBtn');
        this.detailTitle = document.getElementById('auditDetailTitle');
        this.detailLink = document.getElementById('auditDetailLink');

        this.ensureStatusBox();
        this.statusBox = document.getElementById('auditStatusBox');

        this.initialize();
    }

    ensureStatusBox() {
        if (!document.getElementById('auditStatusBox') && this.progressArea) {
            const box = document.createElement('div');
            box.id = 'auditStatusBox';
            box.className = 'audit-status-box';
            this.progressArea.insertBefore(box, this.progressArea.firstChild);
        }
    }

    initialize() {
        if (this.startBtn) this.startBtn.addEventListener('click', () => this.startAudit());
        if (this.stopBtn) this.stopBtn.addEventListener('click', () => this.stopAudit());

        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (this.detailBackBtn) {
            this.detailBackBtn.addEventListener('click', () => this.closeDetailView());
        }
    }

    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('auditFileName').textContent = file.name;

        if (file.name.endsWith('.docx')) {
            if (window.mammoth) {
                const arrayBuffer = await readFileAsArrayBuffer(file);
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                this.referenceContent = result.value.toLowerCase();
            } else {
                alert('Mammoth library not ready.');
            }
        } else {
            const text = await readFileAsText(file);
            this.referenceContent = text.toLowerCase();
        }
    }

    async startAudit() {
        const startUrl = this.urlInput.value.trim();
        if (!startUrl || !startUrl.startsWith('http')) {
            alert('Please enter a valid HTTP/HTTPS URL');
            return;
        }

        this.isRunning = true;
        this.queue = [startUrl];
        this.visited = new Set();
        this.fullReport = [];
        this.cardMap.clear();
        this.logArea.innerHTML = '';
        this.progressArea.style.display = 'block';
        if (this.statusBox) this.statusBox.innerHTML = '';
        this.startBtn.disabled = true;

        this.logStatus('🚀 Starting Premium Audit...');
        await this.wait(1000);

        // Add start URL title tracking placeholder
        this.processedTitles.clear();

        this.auditLoop();
    }

    stopAudit() {
        this.isRunning = false;
        this.logStatus('🛑 Stopping audit...');
        // Finalize will be called by loop exit
    }

    async auditLoop() {
        while (this.isRunning && this.queue.length > 0 && this.visited.size < this.maxPages) {
            const url = this.queue.shift();

            // Deduplication (Stricter)
            const normalizedUrl = new URL(url).href.split('#')[0].replace(/\/$/, "").toLowerCase();
            const isVisited = [...this.visited].some(v => {
                const vNorm = new URL(v).href.split('#')[0].replace(/\/$/, "").toLowerCase();
                return vNorm === normalizedUrl;
            });

            if (isVisited) {
                continue;
            }
            this.visited.add(url);

            // Create Pending Card
            this.createPendingCard(url);

            // --- STEP 1: NAVIGATION ---
            this.logStatus(`🌐 Navigating to: ${url}`);
            this.updateProgress();

            try {
                await this.navigateTo(url);
                this.logStatus('⏳ Waiting for network idle...');
                await this.wait(2000);

                // --- STEP 2: HUMAN INTERACTION & CRAWL ---
                this.logStatus('🤖 AI Agent: Analyzing structure...');

                // Get Page Title (Fallback)
                const pageMeta = await this.getPageMeta();
                let pageTitle = pageMeta.title || new URL(url).pathname;

                const newLinks = await this.crawlLinks();
                this.logStatus(`🔗 Discovery: Found ${newLinks.length} new links.`);

                this.addNewLinks(newLinks, url);
                await this.wait(1000);

                // --- STEP 3: ANALYSIS ---
                this.logStatus('🧠 Evaluating content & accessibility...');
                await this.scrollPage();

                // Silent analysis
                const result = await this.analyzeCurrentPage();

                // --- STEP 4: REPORTING ---
                // Prioritize SEO Analyzer Title if available
                if (result.seo?.summary?.title?.value) {
                    pageTitle = result.seo.summary.title.value;
                }

                // --- TITLE DEDUPLICATION CHECK ---
                // If we have seen this title before, and it's not a generic title, mark as duplicate
                if (pageTitle && pageTitle.length > 2 && this.processedTitles.has(pageTitle)) {
                    this.logStatus(`⚠️ Duplicate content detected: "${pageTitle}". Skipping.`);
                    this.updateCardWithDuplicate(url, pageTitle);
                    this.removeCard(url);
                    continue;
                }
                this.processedTitles.add(pageTitle);

                result.pageTitle = pageTitle;
                result.linkCount = newLinks.length;

                this.updateCardWithResult(url, result);
                this.fullReport.push({ url, result });

                await this.wait(1000);

            } catch (err) {
                console.error(`Error visiting ${url}:`, err);
                this.logStatus(`❌ Error: ${err.message}`);
                this.updateCardWithError(url, err.message);
            }
        }

        if (this.isRunning) {
            this.logStatus('🏁 Audit Completed!');
        }
        this.finalizeAudit();
    }

    // --- CARD MANAGEMENT ---

    createPendingCard(url) {
        const card = document.createElement('div');
        card.className = 'audit-result-card';

        // Initial "Running" State
        card.innerHTML = `
            <div class="audit-card-badge running"></div>
            <div class="audit-card-icon">⏳</div>
            <div class="audit-card-title">${new URL(url).pathname}</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">Scanning...</div>
        `;

        // Append to Grid (logArea is now grid container)
        this.logArea.appendChild(card);
        this.cardMap.set(url, card);
    }

    updateCardWithResult(url, data) {
        const card = this.cardMap.get(url);
        if (!card) return;

        const contrastIssues = data.contrast?.summary?.issues || [];
        const buttonIssues = data.buttons?.summary?.issues || [];
        // FIX: H1 count comes from fonts analysis, NOT seo
        const h1Count = data.fonts?.h1?.count || 0;
        const loremFound = data.lorem?.loremIpsum?.found;

        const totalIssues = contrastIssues.length + buttonIssues.length + (loremFound ? 1 : 0) + (h1Count !== 1 ? 1 : 0);
        const isPass = totalIssues === 0;

        let displayTitle = data.pageTitle && data.pageTitle.length < 50 ? data.pageTitle : new URL(url).pathname;
        if (displayTitle === '/') displayTitle = 'Home';

        card.innerHTML = `
            <div class="audit-card-badge ${isPass ? 'pass' : 'fail'}"></div>
            <div class="audit-card-icon">${isPass ? '✨' : '⚠️'}</div>
            <div class="audit-card-title">${displayTitle}</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">${data.linkCount || 0} Links</div>
        `;

        // Store data for click handler (handler attached in finalize)
        card.dataset.resultData = JSON.stringify(data);
        card.dataset.resultUrl = url;
    }

    updateCardWithError(url, errorMsg) {
        const card = this.cardMap.get(url);
        if (!card) return;

        card.innerHTML = `
            <div class="audit-card-badge fail"></div>
            <div class="audit-card-icon">❌</div>
            <div class="audit-card-title">Failed</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">Error</div>
        `;

        // Store minimal error data
        card.dataset.resultData = JSON.stringify({ error: errorMsg, pageTitle: 'Analysis Failed' });
        card.dataset.resultUrl = url;
    }

    updateCardWithDuplicate(url, title) {
        const card = this.cardMap.get(url);
        if (!card) return;
        card.innerHTML = `
            <div class="audit-card-badge warning"></div>
            <div class="audit-card-icon">📁</div>
            <div class="audit-card-title">Duplicate</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">${title}</div>
        `;
    }

    removeCard(url) {
        const card = this.cardMap.get(url);
        if (card) {
            card.remove();
            this.cardMap.delete(url);
        }
    }

    finalizeAudit() {
        this.isRunning = false;
        this.startBtn.disabled = false;

        // Enable Interactions
        this.logStatus('🔓 Audit Complete. Cards are now clickable.');

        const allCards = this.logArea.querySelectorAll('.audit-result-card');
        allCards.forEach(card => {
            card.classList.add('clickable');
            card.addEventListener('click', () => {
                if (!card.classList.contains('clickable')) return;

                try {
                    const data = JSON.parse(card.dataset.resultData);
                    const url = card.dataset.resultUrl;
                    this.openDetailView(url, data);
                } catch (e) { console.error('Error parsing card data', e); }
            });
        });
    }

    // --- NAVIGATION & LOGIC ---

    async navigateTo(url) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.update(tab.id, { url: url });
        return new Promise(resolve => {
            const listener = (tabId, info) => {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    setTimeout(resolve, 1000);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }

    async getPageMeta() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return new Promise(resolve => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.title
            }, (results) => {
                resolve({ title: results?.[0]?.result || '' });
            });
        });
    }

    async scrollPage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async () => {
                const totalHeight = document.body.scrollHeight;
                window.scrollTo({ top: totalHeight * 0.3, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 500));
                window.scrollTo({ top: totalHeight * 0.6, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 500));
                window.scrollTo({ top: 0, behavior: 'auto' });
            }
        });
    }

    async analyzeCurrentPage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return new Promise(resolve => {
            chrome.tabs.sendMessage(tab.id, { action: 'analyzeAll' }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ error: chrome.runtime.lastError.message });
                    return;
                }
                resolve(response.data || {});
            });
        });
    }

    async crawlLinks() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return new Promise(resolve => {
            chrome.tabs.sendMessage(tab.id, { action: 'crawlNav' }, (response) => {
                resolve(response && response.links ? response.links : []);
            });
        });
    }

    addNewLinks(links, currentUrl) {
        const base = new URL(currentUrl).origin;
        const ignoreText = this.ignoreInput ? this.ignoreInput.value.toLowerCase() : '';
        const ignorePatterns = ignoreText.split('\n').map(s => s.trim()).filter(s => s);

        links.forEach(link => {
            try {
                if (link.startsWith(base)) {
                    const isIgnored = ignorePatterns.some(pattern => link.toLowerCase().includes(pattern));
                    if (isIgnored) return;

                    const cleanLink = link.split('#')[0].split('?')[0];
                    if (!this.visited.has(cleanLink) && !this.queue.includes(cleanLink)) {
                        this.queue.push(cleanLink);
                    }
                }
            } catch (e) { }
        });
    }

    logStatus(msg) {
        if (!this.statusBox) return;
        const prev = this.statusBox.querySelector('.active');
        if (prev) prev.classList.remove('active');

        const line = document.createElement('div');
        line.className = 'audit-status-line active';
        const time = new Date().toLocaleTimeString().split(' ')[0];
        line.textContent = `[${time}] ${msg}`;

        this.statusBox.appendChild(line);
        this.statusBox.scrollTop = this.statusBox.scrollHeight;
    }

    updateProgress() {
        this.queueCountDisplay.textContent = `${this.queue.length} in queue`;
        const percentage = Math.min(100, (this.visited.size / this.maxPages) * 100);
        this.progressBar.style.width = percentage + '%';
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- DETAIL VIEW & INTERACTION ---

    async highlightElement(selector) {
        if (!selector) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Ensure we are on the right page? 
        // Note: The user clicks this in detail view. 
        // Assuming they are still on that page or will navigate. 
        // Ideally we should check if current tab URL matches, but for now we just try.

        chrome.tabs.sendMessage(tab.id, {
            action: 'highlightButton', // Re-using existing highlight logic which scrolls!
            selector: selector
        });
    }

    openDetailView(url, data) {
        this.dashboardView.style.display = 'none';
        this.detailView.style.display = 'block';

        const title = data.pageTitle || new URL(url).pathname;
        this.detailTitle.textContent = title;
        this.detailTitle.title = title;
        this.detailLink.href = url;

        // Render Report
        const contrastIssues = data.contrast?.summary?.issues || [];
        const fontSummary = data.fonts?.summary || {};
        const seoSummary = data.seo?.summary || {};
        const buttonIssues = data.buttons?.summary?.issues || [];
        const loremInstances = data.lorem?.loremIpsum?.instances || [];
        const linkData = data.links?.links || [];

        // Check SEO Health
        const seoCritical = seoSummary.stats?.critical || 0;
        const seoTitle = seoSummary.title?.value || 'Missing';
        const seoDesc = seoSummary.description?.value || 'Missing';

        let html = '';

        // -- HEADER STATUS --
        const totalErrors = contrastIssues.length + buttonIssues.length + loremInstances.length + seoCritical;
        const statusColor = totalErrors === 0 ? 'var(--success)' : totalErrors < 5 ? 'var(--warning)' : 'var(--danger)';
        const statusBg = totalErrors === 0 ? 'var(--success-bg)' : totalErrors < 5 ? 'var(--warning-bg)' : 'var(--danger-bg)';
        const statusIcon = totalErrors === 0 ? '✨' : totalErrors < 5 ? '⚠️' : '❌';
        const statusText = totalErrors === 0 ? 'Audit Passed' : `${totalErrors} Issues Found`;

        html += `
            <div style="background:${statusBg}; padding:20px; border-radius:12px; margin-bottom:24px; text-align:center; border:1px solid ${statusColor}40;">
                <div style="font-size:32px; margin-bottom:8px;">${statusIcon}</div>
                <div style="font-size:18px; font-weight:700; color:${statusColor}; margin-bottom:4px;">${statusText}</div>
                <div style="font-size:12px; color:var(--text-muted); opacity:0.8;">${url}</div>
            </div>
        `;

        if (data.error) {
            html += `<div style="color:var(--danger); padding:20px; text-align:center; background:var(--bg-surface); border-radius:8px;">${data.error}</div>`;
            this.detailContent.innerHTML = html;
            return;
        }

        // -- 1. SEO AUDIT --
        html += `<div class="detail-section">
            <h4 class="section-title">🔍 SEO & Meta</h4>
            <div class="info-grid">
                <div class="info-item ${!seoSummary.title ? 'error' : ''}">
                    <label>Meta Title</label>
                    <div class="value">${seoTitle}</div>
                    ${seoSummary.title ? `<div class="sub-value">${seoSummary.title.length} chars</div>` : ''}
                </div>
                <div class="info-item ${!seoSummary.description ? 'error' : ''}">
                    <label>Meta Description</label>
                    <div class="value">${seoDesc}</div>
                     ${seoSummary.description ? `<div class="sub-value">${seoSummary.description.length} chars</div>` : ''}
                </div>
                <div class="info-item">
                    <label>Open Graph</label>
                    <div class="value">
                        <span class="badge ${seoSummary.ogTitle ? 'pass' : 'fail'}">OG:Title</span>
                        <span class="badge ${seoSummary.ogDescription ? 'pass' : 'fail'}">OG:Desc</span>
                    </div>
                </div>
            </div>
        </div>`;

        // -- 2. FONT & HIERARCHY --
        const h1Count = fontSummary.h1?.count || 0;
        const hierarchyIssues = fontSummary.issues || [];

        html += `<div class="detail-section">
            <h4 class="section-title">🔤 Typography & Structure</h4>
            <div class="hierarchy-tree">
                <div class="h-level h1-level ${h1Count === 1 ? 'good' : 'bad'}">
                    <span class="tag">H1</span> 
                    <span class="count">${h1Count} Found</span>
                    ${h1Count !== 1 ? '<span class="warning-icon">⚠️</span>' : '✅'}
                </div>
                <div class="h-grid">
                    <div class="h-stat"><span>H2</span> <strong>${fontSummary.h2?.count || 0}</strong></div>
                    <div class="h-stat"><span>H3</span> <strong>${fontSummary.h3?.count || 0}</strong></div>
                    <div class="h-stat"><span>H4</span> <strong>${fontSummary.h4?.count || 0}</strong></div>
                    <div class="h-stat"><span>H5</span> <strong>${fontSummary.h5?.count || 0}</strong></div>
                    <div class="h-stat"><span>H6</span> <strong>${fontSummary.h6?.count || 0}</strong></div>
                    <div class="h-stat"><span>P</span> <strong>${fontSummary.paragraphs?.count || 0}</strong></div>
                </div>
            </div>
            ${hierarchyIssues.length > 0 ? `
                <div class="issue-list">
                    ${hierarchyIssues.map(i => `<div class="issue-item warning">${i.message}</div>`).join('')}
                </div>
            ` : ''}
        </div>`;

        // -- 3. COLOR CONTRAST --
        if (contrastIssues.length > 0) {
            html += `<div class="detail-section">
                <h4 class="section-title error-text">🎨 Color Contrast (${contrastIssues.length})</h4>
                <div class="issue-list">
                    ${contrastIssues.slice(0, 10).map(c => `
                        <div class="issue-item fail">
                            <div class="issue-header">
                                <strong>${c.text.substring(0, 30)}${c.text.length > 30 ? '...' : ''}</strong>
                                <span class="score-badge fail">${c.contrastRatio.toFixed(2)}</span>
                            </div>
                            <div class="issue-desc">Expected ${c.requiredRatio}:1</div>
                        </div>
                    `).join('')}
                    ${contrastIssues.length > 10 ? `<div style="text-align:center; font-size:11px; padding:4px;">+ ${contrastIssues.length - 10} more issues</div>` : ''}
                </div>
            </div>`;
        } else {
            html += `<div class="detail-section"><h4 class="section-title success-text">🎨 Color Contrast</h4><div class="success-banner">No contrast issues found</div></div>`;
        }

        // -- 4. BUTTONS & LINKS --
        const brokenButtons = buttonIssues.filter(b => b.message.includes('text') || b.message.includes('name'));
        const allButtons = data.buttons?.summary?.buttons || [];

        html += `<div class="detail-section">
            <h4 class="section-title">🖱️ Interactive Elements</h4>
             <div class="info-grid half">
                <div class="info-item">
                    <label>Total Links</label>
                    <div class="value">${data.linkCount || 0}</div>
                </div>
                 <div class="info-item">
                    <label>Buttons Analyzed</label>
                    <div class="value">${data.buttons?.summary?.totalButtons || 0}</div>
                </div>
            </div>
            
            ${brokenButtons.length > 0 ? `
                <div class="issue-list" style="margin-top:12px;">
                    <div style="font-size:11px; font-weight:700; color:var(--danger); margin-bottom:4px; text-transform:uppercase;">Issues Found</div>
                    ${brokenButtons.map(b => `
                        <div class="issue-item fail">
                            <div class="issue-header"><strong>Wait found</strong></div>
                            <div class="issue-desc">${b.message}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

           ${allButtons.length > 0 ? `
                <div class="button-list-container" style="margin-top:16px;">
                    <div style="font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; border-bottom:1px solid var(--border-color); padding-bottom:4px;">Button Details</div>
                    <div style="display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto; padding-right:4px;">
                        ${allButtons.map(btn => {
            // Casing detection
            let casing = 'Unknown';
            if (btn.text) {
                const t = btn.text.replace(/[^a-zA-Z]/g, '');
                if (t === t.toUpperCase() && t.length > 1) casing = 'UPPERCASE';
                else if (t === t.toLowerCase()) casing = 'lowercase';
                else if (t.charAt(0) === t.charAt(0).toUpperCase() && t.slice(1) === t.slice(1).toLowerCase()) casing = 'Title Case';
                else casing = 'Camel/Mixed';
            }

            return `
                            <div style="background:var(--bg-acc-2); padding:8px; border-radius:6px; font-size:11px; border:1px solid var(--border-color);">
                                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                                    <strong style="color:var(--primary);">${btn.text}</strong>
                                    <span style="font-size:9px; background:rgba(255,255,255,0.1); padding:1px 4px; border-radius:3px;">${casing}</span>
                                </div>
                                <div style="color:var(--text-muted); display:flex; gap:6px; align-items:center;">
                                    <span>🔗 ${btn.destination}</span>
                                </div>
                            </div>
                            `;
        }).join('')}
                     </div>
                </div>
            ` : ''}

            ${brokenButtons.length === 0 && allButtons.length === 0 ? '<div class="success-banner" style="margin-top:8px;">No interactive issues found</div>' : ''}
        </div>`;

        // -- 5. LOREM IPSUM --
        if (loremInstances.length > 0) {
            html += `<div class="detail-section">
                <h4 class="section-title error-text">📝 Placeholder Text Detected</h4>
                 <div class="issue-list">
                    ${loremInstances.map((l) => `
                        <button class="lorem-issue-btn" data-selector="${l.path.replace(/"/g, '&quot;')}" 
                            style="width:100%; text-align:left; cursor:pointer;" title="Click to highlight">
                            <div class="issue-item fail clickable-issue">
                                <div class="issue-header"><strong>Lorem Ipsum</strong></div>
                                <div class="issue-desc">"${l.text.substring(0, 50)}..."</div>
                                <div class="click-hint">Click to show</div>
                            </div>
                        </button>
                    `).join('')}
                </div>
            </div>`;
        }

        this.detailContent.innerHTML = html;

        // Bind Click Listeners for Lorem
        const loremBtns = this.detailContent.querySelectorAll('.lorem-issue-btn');
        loremBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const selector = btn.getAttribute('data-selector');
                this.highlightElement(selector);
            });
        });
    }

    closeDetailView() {
        this.detailView.style.display = 'none';
        this.dashboardView.style.display = 'block';
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Initialize Robustly
function initSelfAudit() {
    console.log('🔄 Initializing SelfAuditManager...');
    if (document.getElementById('startSelfAuditBtn')) {
        window.selfAuditManager = new SelfAuditManager();
        console.log('✅ SelfAuditManager initialized successfully.');
    } else {
        console.warn('⚠️ startSelfAuditBtn not found, retrying...');
        setTimeout(initSelfAudit, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSelfAudit);
} else {
    initSelfAudit();
}
