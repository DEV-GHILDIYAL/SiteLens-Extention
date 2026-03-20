// Storage manager for extension settings and reports
const StorageManager = {
    /**
    * Get extension settings
    */
    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['settings'], (result) => {
                resolve(result.settings || this.getDefaultSettings());
            });
        });
    },
    /**
    * Save extension settings
    */
    async saveSettings(settings) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ settings }, () => {
                resolve(true);
            });
        });
    },
    /**
    * Get default settings
    */
    getDefaultSettings() {
        return {
            autoAnalyze: false,
            wcagLevel: 'AA',
            includeButtons: false,
            showOverlayOnAnalysis: true,
            samplingPoints: 9
        };
    },
    /**
    * Save analysis report
    */
    async saveReport(report) {
        return new Promise((resolve) => {
            const reportData = {
                report: report,
                timestamp: Date.now(),
                url: report.url
            }; chrome.storage.local.get(['reports'], (result) => {
                const reports = result.reports || [];
                reports.unshift(reportData);
                // Keep only last 10 reports
                const limitedReports = reports.slice(0, 10);
                chrome.storage.local.set({ reports: limitedReports }, () => {
                    resolve(true);
                });
            });
        });
    },
    /**
    * Get saved reports
    */
    async getReports() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['reports'], (result) => {
                resolve(result.reports || []);
            });
        });
    },
    /**
    * Clear all saved reports
    */
    async clearReports() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ reports: [] }, () => {
                resolve(true);
            });
        });
    },
    /**
    * Get report by URL
    */
    async getReportByUrl(url) {
        const reports = await this.getReports();
        return reports.find(r => r.url === url);
    },
    /**
    * Export all reports
    */
    async exportAllReports() {
        const reports = await this.getReports(); return {
            exportDate: new Date().toISOString(),
            totalReports: reports.length,
            reports: reports
        };
    }
};
// Make available for background and content scripts
if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
}
if (typeof self !== 'undefined' && self.chrome) {
    self.StorageManager = StorageManager;
}