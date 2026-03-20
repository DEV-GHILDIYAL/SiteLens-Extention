// Background service worker for the extension
console.log('Background service worker loading...');

// Single onInstalled listener - handles both install and context menu
chrome.runtime.onInstalled.addListener((details) => {
	console.log('Extension event:', details.reason);

	if (details.reason === 'install') {
		console.log('Visual Contrast Checker installed');
		// Set default settings
		chrome.storage.local.set({
			settings: {
				autoAnalyze: false,
				wcagLevel: 'AA',
				includeButtons: false
			}
		}, () => {
			console.log('Default settings saved');
		});
	} else if (details.reason === 'update') {
		console.log('Visual Contrast Checker updated to version',
			chrome.runtime.getManifest().version);
	}

	// Create context menu for quick analysis
	try {
		chrome.contextMenus.create({
			id: 'analyzeContrast',
			title: 'Analyze Contrast',
			contexts: ['page']
		}, () => {
			if (chrome.runtime.lastError) {

				console.log('Context menu error:', chrome.runtime.lastError.message);
			} else {
				console.log('Context menu created successfully');
			}
		});
	} catch (e) {
		console.error('Context menu creation failed:', e);
	}
});

// Listen for tab updates (optional - for auto-analysis)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === 'complete' && tab.url) {
		// Check if auto-analyze is enabled
		chrome.storage.local.get(['settings'], (result) => {
			if (result.settings?.autoAnalyze) {
				// Send analyze message to content script
				chrome.tabs.sendMessage(tabId, { action: 'analyze' }).catch(err => {
					console.log('Auto-analyze message send failed:', err);
				});
			}
		});
	}
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log('Background received message:', request.action);

	if (request.action === 'saveReport') {
		// Handle report saving
		chrome.storage.local.set({
			lastReport: request.report,
			lastReportTime: Date.now()
		}, () => {
			console.log('Report saved successfully');
			sendResponse({ success: true });
		});
		return true; // Keep channel open for async response
	}

	if (request.action === 'initiateAreaScreenshot') {
		// Find active tab and trigger selection
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs && tabs[0]) {
				chrome.tabs.sendMessage(tabs[0].id, { action: 'startSelection' }, (response) => {
					if (response && response.success && response.rect) {
						// Received direct response (if synchronous or handled immediately, likely async though)
						// Actually, startSelection is interactive, so it won't return immediately with rect.
						// It will return "selection started" or similar?
						// The content script I wrote returns the rect in sendResponse.
						// Implication: sendResponse needs to wait for user interaction?
						// My content script implementation for 'startSelection' returns `true` (async), and calls `sendResponse` after `mouseup`.
						// So yes, the callback HERE will receive the rect.
						handleAreaCapture(tabs[0], response.rect, response.devicePixelRatio);
					}
				});
			}
		});
		return false;
	}

	return false;
});

async function handleAreaCapture(tab, rect, devicePixelRatio) {
	try {
		const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

		// Crop image using Bitmap API (available in SW)
		const response = await fetch(dataUrl);
		const blob = await response.blob();
		const bitmap = await createImageBitmap(blob);

		const scale = devicePixelRatio || 1;
		const scaledX = rect.x * scale;
		const scaledY = rect.y * scale;
		const scaledW = rect.width * scale;
		const scaledH = rect.height * scale;

		// Use OffscreenCanvas to crop
		const canvas = new OffscreenCanvas(scaledW, scaledH);
		const ctx = canvas.getContext('2d');
		ctx.drawImage(bitmap, scaledX, scaledY, scaledW, scaledH, 0, 0, scaledW, scaledH);

		const blobResult = await canvas.convertToBlob({ type: 'image/png' });
		const reader = new FileReader();
		reader.onloadend = () => {
			const finalDataUrl = reader.result;
			chrome.downloads.download({
				url: finalDataUrl,
				filename: `screenshot-area-${Date.now()}.png`
			});
		};
		reader.readAsDataURL(blobResult);

	} catch (error) {
		console.error('Area capture failed:', error);
	}
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
	console.log('Context menu clicked:', info.menuItemId);

	if (info.menuItemId === 'analyzeContrast' && tab?.id) {
		chrome.tabs.sendMessage(tab.id, { action: 'analyze' }).catch(err => {
			console.error('Context menu analyze failed:', err);
		});
	}
});

console.log('Background service worker loaded successfully');

// Enable Side Panel opening on icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
	.catch((error) => console.error(error));