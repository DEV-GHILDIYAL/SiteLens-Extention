/**
 * SiteLens Content Bootstrapper
 * 
 * Injects the main ES module into the current page context.
 */
(async () => {
    try {
        const src = chrome.runtime.getURL('src/content/index.js');
        await import(src);
        console.log('✅ SiteLens Modules Loaded Successfully via ESM');
    } catch (error) {
        console.error('❌ SiteLens Bootstrapper Failed:', error);
    }
})();
