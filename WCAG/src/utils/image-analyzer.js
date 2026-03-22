/**
 * ═══════════════════════════════════════════════════════════════
 *  ULTRA IMAGE ANALYZER v3.0
 *  Extracts EVERY possible image reference from a page:
 *  - <img> src, srcset, currentSrc
 *  - <picture> <source> srcset
 *  - CSS background-image (computed + inline + stylesheets)
 *  - CSS content: url() on pseudo-elements
 *  - CSS @keyframes with image URLs
 *  - CSS custom properties (--var) containing URLs
 *  - SVG <image> href / xlink:href
 *  - <video> poster
 *  - <input type=image> src
 *  - Lazy-load data attributes (data-src, data-lazy, data-bg, etc.)
 *  - Shadow DOM (open roots)
 *  - Inline <style> tags parsed
 *  - <link rel=preload as=image>
 *  - Meta og:image, twitter:image
 *  - JSON-LD image references
 *  - Perceptual deduplication (path-only key ignoring CDN host variants)
 * ═══════════════════════════════════════════════════════════════
 */

const ImageAnalyzer = (() => {

    // ─── Constants ────────────────────────────────────────────────────────────

    const LAZY_ATTRS = [
        'data-src', 'data-lazy', 'data-lazy-src', 'data-original',
        'data-bg', 'data-background', 'data-background-image',
        'data-image', 'data-img', 'data-url', 'data-thumb',
        'data-hi-res', 'data-retina', 'data-srcset', 'data-lazy-srcset'
    ];

    const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?|ico|heic|heif)(\?|#|$)/i;

    const REDUNDANT_ALT = new Set([
        'image', 'picture', 'photo', 'img', 'screenshot',
        'graphic', 'icon', 'logo', 'banner', 'thumbnail'
    ]);

    // ─── URL Normalization ─────────────────────────────────────────────────────

    /**
     * Returns a dedup key: strips query+hash, lowercases path.
     * Two CDN variants of the same path → same key.
     */
    function normalizeForDedup(rawUrl, base) {
        try {
            const u = new URL(rawUrl, base || window.location.href);
            if (u.protocol === 'data:') return rawUrl; // keep data URIs as-is
            // Key = pathname only (ignores CDN host differences like cdn1.x.com vs cdn2.x.com)
            return u.pathname.toLowerCase().replace(/\/$/, '') || '/';
        } catch {
            return rawUrl;
        }
    }

    /** Resolve to absolute URL */
    function resolve(url, base) {
        if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url || '';
        try { return new URL(url, base || window.location.href).href; } catch { return url; }
    }

    /** Extract all url(...) values from a CSS string */
    function extractUrlsFromCss(cssText) {
        const urls = [];
        // Handles: url("..."), url('...'), url(...)
        const re = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
        let m;
        while ((m = re.exec(cssText)) !== null) {
            const val = m[2].trim();
            if (val && !val.startsWith('data:')) urls.push(val);
        }
        return urls;
    }

    /** Parse srcset string → array of URLs */
    function parseSrcset(srcset) {
        if (!srcset) return [];
        return srcset.split(',')
            .map(s => s.trim().split(/\s+/)[0])
            .filter(Boolean);
    }

    // ─── Core Collector ───────────────────────────────────────────────────────

    /**
     * Collects images from a given document root (handles Shadow DOM recursion).
     * Returns raw entries: { src (absolute), type, element (optional) }
     */
    function collectFromRoot(root, baseUrl) {
        const entries = [];
        const doc = root.ownerDocument || root;

        function add(rawSrc, type, el) {
            const abs = resolve(rawSrc, baseUrl);
            if (!abs) return;
            entries.push({ src: abs, type, el: el || null });
        }

        // ── 1. <img> ──────────────────────────────────────────────────────────
        root.querySelectorAll('img').forEach(img => {
            if (img.src) add(img.src, 'img', img);
            if (img.currentSrc && img.currentSrc !== img.src) add(img.currentSrc, 'img-current', img);
            parseSrcset(img.getAttribute('srcset')).forEach(u => add(u, 'srcset', img));
        });

        // ── 2. <picture> <source> ─────────────────────────────────────────────
        root.querySelectorAll('picture source').forEach(src => {
            parseSrcset(src.getAttribute('srcset')).forEach(u => add(u, 'picture', src));
        });

        // ── 3. <video poster> ────────────────────────────────────────────────
        root.querySelectorAll('video[poster]').forEach(v => add(v.poster, 'video-poster', v));

        // ── 4. <input type=image> ─────────────────────────────────────────────
        root.querySelectorAll('input[type="image"][src]').forEach(i => add(i.src, 'input-image', i));

        // ── 5. <link rel=preload as=image> ────────────────────────────────────
        root.querySelectorAll('link[rel~="preload"][as="image"]').forEach(l => {
            if (l.href) add(l.href, 'preload', l);
            parseSrcset(l.getAttribute('imagesrcset')).forEach(u => add(u, 'preload-srcset', l));
        });

        // ── 6. SVG <image> ────────────────────────────────────────────────────
        root.querySelectorAll('image').forEach(img => {
            const href = img.getAttribute('href') || img.getAttribute('xlink:href');
            if (href) add(href, 'svg-image', img);
        });

        // ── 7. Lazy-load data attributes ──────────────────────────────────────
        LAZY_ATTRS.forEach(attr => {
            root.querySelectorAll(`[${attr}]`).forEach(el => {
                const val = el.getAttribute(attr);
                if (!val) return;
                // Could be a srcset string or plain URL
                if (val.includes(',') || val.includes(' ')) {
                    parseSrcset(val).forEach(u => add(u, `lazy(${attr})`, el));
                } else if (IMAGE_EXTENSIONS.test(val) || val.startsWith('http') || val.startsWith('/')) {
                    add(val, `lazy(${attr})`, el);
                }
            });
        });

        // ── 8. Computed CSS background-image (all elements) ───────────────────
        root.querySelectorAll('*').forEach(el => {
            // Element itself
            try {
                const cs = window.getComputedStyle(el);
                extractUrlsFromCss(cs.backgroundImage || '').forEach(u => add(u, 'css-bg', el));
                // content property (used in ::before/::after sometimes directly on el)
                extractUrlsFromCss(cs.content || '').forEach(u => add(u, 'css-content', el));
            } catch { /* cross-origin frames */ }

            // ::before and ::after pseudo-elements
            ['::before', '::after'].forEach(pseudo => {
                try {
                    const ps = window.getComputedStyle(el, pseudo);
                    extractUrlsFromCss(ps.backgroundImage || '').forEach(u => add(u, `css-pseudo${pseudo}`, el));
                    extractUrlsFromCss(ps.content || '').forEach(u => add(u, `css-pseudo${pseudo}-content`, el));
                } catch { }
            });
        });

        // ── 9. Inline style attribute ─────────────────────────────────────────
        root.querySelectorAll('[style]').forEach(el => {
            extractUrlsFromCss(el.getAttribute('style') || '').forEach(u => add(u, 'inline-style', el));
        });

        // ── 10. Inline <style> blocks (parse text) ────────────────────────────
        root.querySelectorAll('style').forEach(s => {
            extractUrlsFromCss(s.textContent || '').forEach(u => add(u, 'style-tag', s));
        });

        // ── 11. Shadow DOM (open roots) ───────────────────────────────────────
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                collectFromRoot(el.shadowRoot, baseUrl).forEach(e => entries.push(e));
            }
        });

        return entries;
    }

    // ─── Stylesheet Parser ────────────────────────────────────────────────────

    /**
     * Parse document.styleSheets → extract image URLs from:
     * - CSSStyleRule backgroundImage
     * - @keyframes rules
     * - CSS custom properties (--var: url(...))
     */
    function collectFromStylesheets() {
        const entries = [];

        Array.from(document.styleSheets).forEach(sheet => {
            let rules;
            try { rules = sheet.cssRules || sheet.rules; } catch { return; } // CORS blocked

            const sheetBase = sheet.href || window.location.href;

            Array.from(rules || []).forEach(rule => processRule(rule, sheetBase));
        });

        function processRule(rule, base) {
            if (!rule) return;

            // Regular style rule
            if (rule.style) {
                const style = rule.style;
                // Iterate all properties looking for url()
                Array.from(style).forEach(prop => {
                    const val = style.getPropertyValue(prop);
                    extractUrlsFromCss(val).forEach(u => {
                        entries.push({ src: resolve(u, base), type: `stylesheet(${prop})`, el: null });
                    });
                });
            }

            // @keyframes
            if (rule.type === CSSRule.KEYFRAMES_RULE) {
                Array.from(rule.cssRules || []).forEach(kf => {
                    if (kf.style) {
                        Array.from(kf.style).forEach(prop => {
                            const val = kf.style.getPropertyValue(prop);
                            extractUrlsFromCss(val).forEach(u => {
                                entries.push({ src: resolve(u, base), type: 'keyframe', el: null });
                            });
                        });
                    }
                });
            }

            // @media, @supports, @layer — recurse
            if (rule.cssRules) {
                Array.from(rule.cssRules).forEach(r => processRule(r, base));
            }
        }

        return entries;
    }

    // ─── Meta & Structured Data ───────────────────────────────────────────────

    function collectFromMeta() {
        const entries = [];

        // og:image, twitter:image
        ['og:image', 'twitter:image', 'og:image:url'].forEach(name => {
            const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
            if (el?.content) entries.push({ src: resolve(el.content), type: `meta(${name})`, el });
        });

        // JSON-LD
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
            try {
                const walk = (obj) => {
                    if (!obj || typeof obj !== 'object') return;
                    ['image', 'logo', 'thumbnail', 'thumbnailUrl', 'contentUrl'].forEach(key => {
                        const val = obj[key];
                        if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('/'))) {
                            entries.push({ src: resolve(val), type: `jsonld(${key})`, el: s });
                        } else if (typeof val === 'object' && val?.url) {
                            entries.push({ src: resolve(val.url), type: `jsonld(${key}.url)`, el: s });
                        }
                    });
                    Object.values(obj).forEach(v => {
                        if (Array.isArray(v)) v.forEach(walk);
                        else if (typeof v === 'object') walk(v);
                    });
                };
                walk(JSON.parse(s.textContent));
            } catch { }
        });

        return entries;
    }

    // ─── Deduplication Engine ─────────────────────────────────────────────────

    /**
     * Merge all raw entries → deduplicated map keyed by normalized path.
     * If same path found multiple times, merge types array.
     */
    function deduplicateEntries(rawEntries) {
        // key → { src, normalizedKey, types: Set, el }
        const map = new Map();

        rawEntries.forEach(({ src, type, el }) => {
            if (!src) return;

            // Skip truly empty / bad
            if (src === window.location.href && !IMAGE_EXTENSIONS.test(src)) return;

            const key = normalizeForDedup(src);
            if (!key) return;

            if (!map.has(key)) {
                map.set(key, { src, normalizedKey: key, types: new Set(), el });
            }
            map.get(key).types.add(type);
        });

        return Array.from(map.values()).map(e => ({
            src: e.src,
            normalized: e.normalizedKey,
            type: [...e.types].join(' | '),
            types: [...e.types],
            el: e.el,
            width: e.el?.naturalWidth || e.el?.offsetWidth || 0,
            height: e.el?.naturalHeight || e.el?.offsetHeight || 0
        }));
    }

    // ─── Accessibility Analyzer ───────────────────────────────────────────────

    function analyzeImage(img, index) {
        const altText = img.getAttribute('alt');
        const title = img.getAttribute('title');
        const ariaLabel = img.getAttribute('aria-label');
        const src = img.src || '';

        if (altText == null && !title && !ariaLabel) {
            return {
                type: 'missing-alt', severity: 'critical', index, src,
                message: 'Missing alt attribute (critical for accessibility)',
                selector: getSelector(img),
                element: { tag: img.tagName, src: src.substring(0, 100), visible: img.offsetHeight > 0 }
            };
        }

        if (altText !== null && altText.trim() === '') {
            return {
                type: 'empty-alt', severity: 'warning', index, src,
                message: 'Empty alt="" — intentional? Only use if image is purely decorative.',
                selector: getSelector(img),
                element: { tag: img.tagName, src: src.substring(0, 100), visible: img.offsetHeight > 0 }
            };
        }

        if (altText) {
            if (altText.length < 5) {
                return {
                    type: 'poor-alt', severity: 'warning', index, src, altText,
                    message: `Alt text too short (${altText.length} chars). Describe the image.`,
                    selector: getSelector(img),
                    element: { tag: img.tagName, src: src.substring(0, 100), visible: img.offsetHeight > 0 }
                };
            }
            if (altText.length > 150) {
                return {
                    type: 'poor-alt', severity: 'warning', index, src, altText,
                    message: `Alt text too long (${altText.length} chars). Keep under 150.`,
                    selector: getSelector(img),
                    element: { tag: img.tagName, src: src.substring(0, 100), visible: img.offsetHeight > 0 }
                };
            }
            if (REDUNDANT_ALT.has(altText.trim().toLowerCase())) {
                return {
                    type: 'poor-alt', severity: 'warning', index, src, altText,
                    message: `Alt text "${altText}" is generic. Describe what the image actually shows.`,
                    selector: getSelector(img),
                    element: { tag: img.tagName, src: src.substring(0, 100), visible: img.offsetHeight > 0 }
                };
            }
        }
        return null;
    }

    function getSelector(el) {
        if (el.id) return `#${el.id}`;
        const path = [];
        let node = el;
        while (node.parentElement) {
            let sel = node.tagName.toLowerCase();
            if (node.id) { sel += `#${node.id}`; path.unshift(sel); break; }
            let nth = 1, sib = node;
            while ((sib = sib.previousElementSibling)) { if (sib.tagName === node.tagName) nth++; }
            if (nth > 1) sel += `:nth-of-type(${nth})`;
            path.unshift(sel);
            node = node.parentElement;
        }
        return path.join(' > ');
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    return {

        /**
         * Extract EVERY image from the page — the master function.
         * Used by ImageAuditManager.
         */
        extractAllImages() {
            const raw = [
                ...collectFromRoot(document, window.location.href),
                ...collectFromStylesheets(),
                ...collectFromMeta()
            ];
            return deduplicateEntries(raw);
        },

        /**
         * Accessibility analysis pass.
         */
        analyzePage() {
            const images = document.querySelectorAll('img');
            const issues = [];

            images.forEach((img, i) => {
                const result = analyzeImage(img, i);
                if (result) issues.push(result);
            });

            return {
                success: true,
                totalImages: images.length,
                issues,
                summary: {
                    missingAlt: issues.filter(i => i.type === 'missing-alt').length,
                    emptyAlt: issues.filter(i => i.type === 'empty-alt').length,
                    poorAltText: issues.filter(i => i.type === 'poor-alt').length
                },
                allImages: this.extractAllImages()
            };
        },

        highlightImage(selector) {
            try {
                const el = document.querySelector(selector);
                if (el) {
                    el.style.outline = '3px solid #ef4444';
                    el.style.outlineOffset = '2px';
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } catch { }
        },

        clearImageHighlight(selector) {
            try {
                const el = document.querySelector(selector);
                if (el) { el.style.outline = ''; el.style.outlineOffset = ''; }
            } catch { }
        }
    };

})();

// ─── Message Listener (for chrome.tabs.sendMessage) ──────────────────────────

if (typeof window !== 'undefined') {
    window.ImageAnalyzer = ImageAnalyzer;

    // Allow ImageAuditManager to call extractAllImages via message
    if (!window.__imageAnalyzerListenerAttached) {
        window.__imageAnalyzerListenerAttached = true;

        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === 'extractAllImages') {
                try {
                    const images = ImageAnalyzer.extractAllImages();
                    sendResponse({ success: true, images });
                } catch (err) {
                    sendResponse({ success: false, images: [], error: err.message });
                }
                return true; // async
            }

            if (msg.action === 'analyzePage') {
                try {
                    sendResponse(ImageAnalyzer.analyzePage());
                } catch (err) {
                    sendResponse({ success: false, error: err.message });
                }
                return true;
            }

            if (msg.action === 'highlightImage') {
                ImageAnalyzer.highlightImage(msg.selector);
                sendResponse({ success: true });
            }

            if (msg.action === 'clearImageHighlight') {
                ImageAnalyzer.clearImageHighlight(msg.selector);
                sendResponse({ success: true });
            }
        });
    }
}