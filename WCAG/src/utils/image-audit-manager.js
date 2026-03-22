/**
 * ImageAuditManager v2.0
 * Orchestrates multi-page image auditing using the ultra image-analyzer.
 * Works with: image-analyzer.js (must be in manifest content_scripts OR injected)
 */
class ImageAuditManager {
    constructor() {
        this.queue = [];
        this.imageMap = new Map(); // key: normalizedPath → { src, normalizedKey, instances[] }
        this.visited = new Set();
        this.isRunning = false;
        this.activeTabId = null;

        this.bindElements();
        this.initialize();
    }

    // ─── Setup ──────────────────────────────────────────────────────────────

    bindElements() {
        this.startBtn = document.getElementById('startImageAuditBtn');
        this.stopBtn = document.getElementById('stopImageAuditBtn');
        this.urlInput = document.getElementById('imageAuditUrls');
        this.progressArea = document.getElementById('imageAuditProgress');
        this.progressBar = document.getElementById('imageAuditProgressBar');
        this.statusText = document.getElementById('imageAuditStatusText');
        this.resultsList = document.getElementById('imageAuditResultsList');
        this.resultsSection = document.getElementById('imageAuditResults');
    }

    initialize() {
        if (this.startBtn) this.startBtn.onclick = () => this.startAudit();
        if (this.stopBtn) this.stopBtn.onclick = () => this.stopAudit();
    }

    // ─── URL Helpers ─────────────────────────────────────────────────────────

    normalizePageUrl(url) {
        try {
            const u = new URL(url);
            return u.origin + u.pathname.replace(/\/$/, '');
        } catch { return url; }
    }

    /**
     * Dedup key = pathname only (strips host/query/hash).
     * cdn1.x.com/img/a.jpg  ===  cdn2.x.com/img/a.jpg
     * logo.png?v=1           ===  logo.png?v=2
     */
    normalizeImageKey(src) {
        try {
            const u = new URL(src);
            if (u.protocol === 'data:') return src;
            return u.pathname.toLowerCase().replace(/\/$/, '') || '/';
        } catch { return src; }
    }

    // ─── Audit Lifecycle ─────────────────────────────────────────────────────

    async startAudit() {
        const input = this.urlInput?.value?.trim();
        if (!input) { alert('Please enter at least one URL'); return; }

        const urls = input.split(/[\n,]/)
            .map(u => u.trim()).filter(Boolean)
            .map(u => u.startsWith('http') ? u : 'https://' + u);

        if (!urls.length) { alert('Please enter valid URLs'); return; }

        this.isRunning = true;
        this.queue = [...urls];
        this.visited = new Set();
        this.imageMap = new Map();

        if (this.resultsList) this.resultsList.innerHTML = '';
        if (this.resultsSection) this.resultsSection.style.display = 'block';
        if (this.progressArea) this.progressArea.style.display = 'block';
        if (this.startBtn) this.startBtn.disabled = true;
        if (this.stopBtn) this.stopBtn.style.display = 'inline-flex';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.activeTabId = tab.id;
        } catch {
            const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
            this.activeTabId = tab.id;
        }

        await this.auditLoop(urls.length);
    }

    stopAudit() {
        this.isRunning = false;
        this.setStatus('Audit stopped by user.');
        if (this.startBtn) this.startBtn.disabled = false;
        if (this.stopBtn) this.stopBtn.style.display = 'none';
    }

    async auditLoop(initialTotal) {
        let scanned = 0;
        while (this.isRunning && this.queue.length > 0) {
            const url = this.queue.shift();
            const normalized = this.normalizePageUrl(url);
            if (this.visited.has(normalized)) continue;
            this.visited.add(normalized);

            scanned++;
            const total = Math.max(initialTotal, scanned + this.queue.length);
            this.updateProgress(url, scanned, total);

            try {
                const images = await this.scanPage(url);
                this.mergeImages(images, url);
            } catch (err) {
                console.error(`[ImageAudit] Failed: ${url}`, err);
            }
        }
        this.finalize();
    }

    // ─── Page Scanning ────────────────────────────────────────────────────────

    async scanPage(pageUrl) {
        await chrome.tabs.update(this.activeTabId, { url: pageUrl });
        await this.waitForTabLoad(this.activeTabId);

        this.setStatus(`Scrolling: ${pageUrl.substring(0, 45)}...`);

        await chrome.scripting.executeScript({
            target: { tabId: this.activeTabId },
            func: () => new Promise(resolve => {
                let scrolled = 0;
                const STEP = 400, MAX = 18000;
                const timer = setInterval(() => {
                    window.scrollBy(0, STEP);
                    scrolled += STEP;
                    if (scrolled >= document.body.scrollHeight || scrolled >= MAX) {
                        clearInterval(timer);
                        window.scrollTo(0, 0);
                        setTimeout(resolve, 900);
                    }
                }, 80);
            })
        });

        await this.sleep(400);

        // Inject ultra image-analyzer (idempotent guard inside the script)
        await chrome.scripting.executeScript({
            target: { tabId: this.activeTabId },
            files: ['src/utils/image-analyzer.js']
        });

        const response = await this.sendTabMessage(this.activeTabId, { action: 'extractAllImages' });
        return response?.images || [];
    }

    // ─── Image Merging ────────────────────────────────────────────────────────

    mergeImages(images, pageUrl) {
        images.forEach(img => {
            if (!img.src || img.src.startsWith('data:')) return;

            const key = this.normalizeImageKey(img.src);
            if (!key) return;

            if (!this.imageMap.has(key)) {
                this.imageMap.set(key, { src: img.src, normalizedKey: key, instances: [] });
            }

            const entry = this.imageMap.get(key);
            const pgNorm = this.normalizePageUrl(pageUrl);
            const existing = entry.instances.find(i => this.normalizePageUrl(i.pageUrl) === pgNorm);
            const newTypes = Array.isArray(img.types) ? img.types : [img.type].filter(Boolean);

            if (existing) {
                newTypes.forEach(t => { if (!existing.types.includes(t)) existing.types.push(t); });
            } else {
                entry.instances.push({ pageUrl, types: newTypes });
            }
        });
    }

    // ─── Tab / Async Utilities ────────────────────────────────────────────────

    waitForTabLoad(tabId) {
        return new Promise(resolve => {
            const h = (tid, info) => {
                if (tid === tabId && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(h);
                    setTimeout(resolve, 1200);
                }
            };
            chrome.tabs.onUpdated.addListener(h);
        });
    }

    sendTabMessage(tabId, msg) {
        return new Promise(resolve => {
            chrome.tabs.sendMessage(tabId, msg, resp => {
                if (chrome.runtime.lastError) {
                    console.warn('[ImageAudit]', chrome.runtime.lastError.message);
                    resolve(null);
                } else resolve(resp);
            });
        });
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ─── UI ───────────────────────────────────────────────────────────────────

    setStatus(text) { if (this.statusText) this.statusText.innerText = text; }

    updateProgress(url, current, total) {
        if (this.progressBar) this.progressBar.style.width = `${Math.round((current / total) * 100)}%`;
        const d = url.length > 48 ? url.substring(0, 45) + '...' : url;
        this.setStatus(`Scanning (${current}/${total}): ${d}`);
    }

    finalize() {
        this.isRunning = false;
        this.activeTabId = null;
        if (this.startBtn) this.startBtn.disabled = false;
        if (this.stopBtn) this.stopBtn.style.display = 'none';
        if (this.progressArea) this.progressArea.style.display = 'none';
        this.setStatus(`✅ Done — ${this.visited.size} pages · ${this.imageMap.size} unique assets`);
        this.renderResults();
    }

    // ─── Results ─────────────────────────────────────────────────────────────

    renderResults() {
        if (!this.resultsList) return;

        const duplicates = Array.from(this.imageMap.values())
            .filter(data => {
                const unique = new Set(data.instances.map(i => this.normalizePageUrl(i.pageUrl)));
                return unique.size > 1;
            })
            .sort((a, b) => b.instances.length - a.instances.length);

        if (!duplicates.length) {
            this.resultsList.innerHTML = `
                <div style="text-align:center;padding:40px 20px;background:rgba(16,185,129,0.05);
                            border:1px dashed rgba(16,185,129,0.2);border-radius:12px;">
                    <div style="font-size:32px;margin-bottom:12px;">✨</div>
                    <div style="color:var(--success);font-weight:700;font-size:14px;margin-bottom:4px;">
                        NO CROSS-PAGE DUPLICATES
                    </div>
                    <div style="color:var(--text-muted);font-size:12px;">
                        All ${this.imageMap.size} assets are unique across ${this.visited.size} pages.
                    </div>
                </div>`;
            return;
        }

        this.resultsList.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 15px;
                        background:rgba(239,68,68,0.1);border-radius:8px;border-left:4px solid var(--danger);">
                <span style="font-size:16px;">🚩</span>
                <span style="color:var(--text-main);font-weight:600;font-size:13px;">
                    ${duplicates.length} repeated image${duplicates.length > 1 ? 's' : ''} across pages
                    <span style="color:var(--text-muted);font-weight:400;font-size:11px;margin-left:6px;">
                        (${this.imageMap.size} total assets · ${this.visited.size} pages)
                    </span>
                </span>
            </div>`;

        duplicates.forEach(data => {
            const pageMap = new Map();
            data.instances.forEach(inst => {
                const pg = this.normalizePageUrl(inst.pageUrl);
                if (!pageMap.has(pg)) pageMap.set(pg, { url: inst.pageUrl, types: new Set() });
                (inst.types || []).forEach(t => pageMap.get(pg).types.add(t));
            });

            const pageChips = Array.from(pageMap.values()).map(info => {
                let path;
                try { path = new URL(info.url).pathname || '/'; } catch { path = info.url; }
                const display = path === '/' ? 'Home' : path;
                const typeBadges = [...info.types].map(t => this.typeBadge(t)).join('');
                return `
                    <div style="display:flex;align-items:center;gap:5px;padding:5px 10px;
                                background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
                                border-radius:8px;font-size:10px;color:var(--text-muted);" title="${info.url}">
                        <span style="opacity:.5">🔗</span>
                        <span>${display}</span>
                        ${typeBadges}
                    </div>`;
            }).join('');

            const allTypes = [...new Set(data.instances.flatMap(i => i.types || []))];
            const keyDisplay = data.normalizedKey.length > 80
                ? data.normalizedKey.substring(0, 77) + '...'
                : data.normalizedKey;

            const item = document.createElement('div');
            item.style.cssText = `
                background:rgba(30,41,59,0.4);border:1px solid rgba(255,255,255,0.05);
                border-radius:12px;padding:15px;margin-bottom:12px;`;
            item.innerHTML = `
                <div style="display:flex;gap:15px;align-items:flex-start;">
                    <div style="width:70px;height:70px;background:#0c0f1d;border-radius:8px;overflow:hidden;
                                display:flex;align-items:center;justify-content:center;flex-shrink:0;
                                border:1px solid rgba(255,255,255,0.1);cursor:pointer;"
                         onclick="window.open('${data.src}','_blank')" title="Open image">
                        <img src="${data.src}" style="max-width:100%;max-height:100%;object-fit:contain;"
                             onerror="this.parentElement.innerHTML='<span style=\'font-size:20px\'>🖼️</span>'">
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;
                                    margin-bottom:6px;flex-wrap:wrap;gap:4px;">
                            <div style="display:flex;gap:4px;flex-wrap:wrap;">
                                ${allTypes.map(t => this.typeBadge(t)).join('')}
                            </div>
                            <span style="font-size:10px;color:var(--danger);font-weight:700;">
                                ${pageMap.size} PAGES
                            </span>
                        </div>
                        <div style="font-size:9px;color:var(--text-dim);margin-bottom:10px;
                                    word-break:break-all;font-family:monospace;opacity:.7;" title="${data.src}">
                            ${keyDisplay}
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">${pageChips}</div>
                    </div>
                </div>`;
            this.resultsList.appendChild(item);
        });
    }

    typeBadge(type) {
        if (!type) return '';
        const exact = {
            'img': ['rgba(16,185,129,.2)', '#10b981', 'IMG'],
            'img-current': ['rgba(16,185,129,.2)', '#10b981', 'IMG-LIVE'],
            'srcset': ['rgba(245,158,11,.2)', '#f59e0b', 'SRCSET'],
            'picture': ['rgba(245,158,11,.2)', '#f59e0b', 'PICTURE'],
            'css-bg': ['rgba(99,102,241,.2)', '#818cf8', 'CSS-BG'],
            'inline-style': ['rgba(99,102,241,.2)', '#818cf8', 'INLINE-BG'],
            'style-tag': ['rgba(99,102,241,.2)', '#818cf8', 'STYLE-TAG'],
            'video-poster': ['rgba(239,68,68,.2)', '#ef4444', 'VIDEO'],
            'input-image': ['rgba(239,68,68,.2)', '#ef4444', 'INPUT-IMG'],
            'svg-image': ['rgba(236,72,153,.2)', '#ec4899', 'SVG'],
            'preload': ['rgba(6,182,212,.2)', '#06b6d4', 'PRELOAD'],
            'keyframe': ['rgba(139,92,246,.2)', '#a78bfa', 'KEYFRAME'],
            'css-content': ['rgba(139,92,246,.2)', '#a78bfa', 'CSS-CONTENT'],
        };
        let cfg = exact[type];
        if (!cfg) {
            if (type.startsWith('lazy')) cfg = ['rgba(168,85,247,.2)', '#c084fc', 'LAZY'];
            else if (type.startsWith('css-pseudo')) cfg = ['rgba(99,102,241,.2)', '#818cf8', 'PSEUDO'];
            else if (type.startsWith('stylesheet')) cfg = ['rgba(99,102,241,.2)', '#818cf8', 'CSS'];
            else if (type.startsWith('jsonld')) cfg = ['rgba(251,146,60,.2)', '#fb923c', 'JSON-LD'];
            else if (type.startsWith('meta')) cfg = ['rgba(251,146,60,.2)', '#fb923c', 'META'];
            else cfg = ['rgba(100,100,100,.2)', '#aaa', type.toUpperCase().substring(0, 10)];
        }
        return `<span style="background:${cfg[0]};color:${cfg[1]};padding:2px 6px;border-radius:4px;
                              font-size:9px;font-weight:700;white-space:nowrap;">${cfg[2]}</span>`;
    }
}

window.ImageAuditManager = ImageAuditManager;