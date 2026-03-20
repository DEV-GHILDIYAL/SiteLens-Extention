// Main content script - coordinates all analysis
(function () {
	'use strict';
	try {
		console.log('Visual Contrast Checker: Content script loaded (SafeGuard Active)');

		// Inject highlight CSS
		const highlightCss = document.createElement('style');
		highlightCss.id = 'wcag-highlight-styles';
		highlightCss.textContent = `
		@keyframes wcag-pulse {
			0%, 100% {
				box-shadow: 0 0 0 2px #fca5a5, inset 0 0 20px rgba(239, 68, 68, 0.2);
			}
			50% {
				box-shadow: 0 0 0 5px #fca5a5, inset 0 0 20px rgba(239, 68, 68, 0.4);
			}
		}
		
		.wcag-button-highlight {
			position: fixed;
			border: 3px solid #ef4444 !important;
			background-color: rgba(239, 68, 68, 0.1) !important;
			pointer-events: none !important;
			z-index: 999999 !important;
			box-shadow: 0 0 0 2px #fca5a5, inset 0 0 20px rgba(239, 68, 68, 0.2) !important;
			border-radius: 4px !important;
			animation: wcag-pulse 2s ease-in-out infinite !important;
		}
	`;
		document.head.appendChild(highlightCss);

		// Listen for messages from popup
		chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
			console.log('📨 Content script received message:', request.action);
			if (request.action === 'ping') {
				sendResponse({ success: true, message: 'pong' });
				return true;
			}
			switch (request.action) {
				case 'analyze':
					handleAnalyze(request, sendResponse);
					return true; // Keep channel open for async response
				case 'analyzeFonts':
					handleFontAnalysis(sendResponse);
					return true;
				case 'analyzeButtons':
					handleButtonAnalysis(sendResponse);
					return true;
				case 'analyzeImages':
					handleImageAnalysis(sendResponse);
					return true;
				case 'analyzeSEO':
					handleSEOAnalysis(sendResponse);
					return true;
				case 'analyzeColors':
					handleColorAnalysis(sendResponse);
					return true;
				case 'analyzeContent':
					handleContentAnalysis(sendResponse);
					return true;
				case 'analyzeLinks':
					handleLinkAnalysis(sendResponse);
					return true;
				case 'highlightButton':
					handleHighlightButton(request, sendResponse);
					return true;
				case 'highlightButtons':
					handleHighlightButtons(request, sendResponse);
					return true;
				case 'clearButtonHighlight':
					handleClearButtonHighlight(sendResponse);
					return false;
				case 'showViolations':
					handleShowViolations(sendResponse);
					return true;
				case 'hideViolations':
					handleHideViolations(sendResponse);
					return false;
				case 'toggleViolations':
					handleToggleViolations(sendResponse);
					return false;
				case 'exportReport':
					handleExportReport(sendResponse);
					return false;
				case 'getStatus':
					handleGetStatus(sendResponse);
					return false;
				case 'getPageMeta':
					handleGetPageMeta(sendResponse);
					return false;
				case 'captureFullPage':
					handleCaptureFullPage(sendResponse);
					return true;
				case 'startSelection':
					handleStartSelection(sendResponse);
					return true;
				case 'getPageText':
					handleGetPageText(sendResponse);
					return true;
				case 'analyzeAll':
					handleAnalyzeAll(sendResponse);
					return true;
				case 'crawlNav':
					handleCrawlNav(sendResponse);
					return true;
				case 'highlightContentDiff':
					handleHighlightContentDiff(request);
					return false;
					return true;
				case 'highlightImage':
					handleHighlightImage(request, sendResponse);
					return true;
				case 'analyzeContentDiff':
					handleAnalyzeContentDiff(request, sendResponse);
					return true;
				case 'clearContentHighlights':
					handleClearContentHighlights(sendResponse);
					return true;
				case 'highlightButton':
					handleHighlightButton(request, sendResponse);
					return true;
				case 'highlightList':
					handleHighlightList(request, sendResponse);
					return true;
				default:
					sendResponse({ success: false, error: 'Unknown action' });
					return false;
			}
		});

		async function handleAnalyzeAll(sendResponse) {
			try {
				// Explicitly wrap each handler to unify the Promise interface
				// handleAnalyze expects (request, sendResponse)
				const contrastPromise = new Promise(resolve => {
					handleAnalyze({ options: { contrast: true, silent: true } }, (res) => resolve(res));
				});

				// Other handlers expect (sendResponse)
				const buttonPromise = new Promise(resolve => handleButtonAnalysis((res) => resolve(res)));
				const fontPromise = new Promise(resolve => handleFontAnalysis((res) => resolve(res)));
				const imagePromise = new Promise(resolve => handleImageAnalysis((res) => resolve(res)));
				const seoPromise = new Promise(resolve => handleSEOAnalysis((res) => resolve(res)));
				const contentPromise = new Promise(resolve => handleContentAnalysis((res) => resolve(res)));

				// Run all audits in parallel
				const [contrast, buttons, fonts, images, seo, content] = await Promise.all([
					contrastPromise,
					buttonPromise,
					fontPromise,
					imagePromise,
					seoPromise,
					contentPromise
				]);

				// Check Lorem (part of content/other checks)
				const loremPromise = new Promise(resolve => handleContentAnalysis((res) => resolve(res)));

				// Link Audit
				const linkPromise = new Promise(resolve => handleLinkAnalysis((res) => resolve(res)));

				const [lorem, linksData] = await Promise.all([loremPromise, linkPromise]);

				sendResponse({
					success: true,
					data: {
						contrast,
						buttons,
						fonts,
						images,
						seo,
						lorem,
						links: linksData // naming it 'links' for consistency
					}
				});

			} catch (error) {
				console.error('Analyze All Error:', error);
				sendResponse({ success: false, error: error.message });
			}
		}

		function handleGetPageText(sendResponse) {
			try {
				const bodyText = document.body.innerText;
				const cleanedText = bodyText.replace(/\s+/g, ' ').trim();
				sendResponse({ success: true, text: cleanedText });
			} catch (error) {
				sendResponse({ success: false, error: error.message });
			}
		}

		function handleStartSelection(sendResponse) {
			try {
				const overlay = document.createElement('div');
				overlay.style.position = 'fixed';
				overlay.style.top = '0';
				overlay.style.left = '0';
				overlay.style.width = '100vw';
				overlay.style.height = '100vh';
				overlay.style.zIndex = '999999';
				overlay.style.cursor = 'crosshair';
				overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';

				const selectionBox = document.createElement('div');
				selectionBox.style.border = '2px dashed #fff';
				selectionBox.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
				selectionBox.style.position = 'absolute';
				selectionBox.style.display = 'none';
				overlay.appendChild(selectionBox);

				document.body.appendChild(overlay);

				let startX, startY, isDragging = false;

				overlay.addEventListener('mousedown', (e) => {
					isDragging = true;
					startX = e.clientX;
					startY = e.clientY;
					selectionBox.style.left = startX + 'px';
					selectionBox.style.top = startY + 'px';
					selectionBox.style.width = '0';
					selectionBox.style.height = '0';
					selectionBox.style.display = 'block';
				});

				overlay.addEventListener('mousemove', (e) => {
					if (!isDragging) return;
					const currentX = e.clientX;
					const currentY = e.clientY;

					const left = Math.min(startX, currentX);
					const top = Math.min(startY, currentY);
					const width = Math.abs(currentX - startX);
					const height = Math.abs(currentY - startY);

					selectionBox.style.left = left + 'px';
					selectionBox.style.top = top + 'px';
					selectionBox.style.width = width + 'px';
					selectionBox.style.height = height + 'px';
				});

				overlay.addEventListener('mouseup', (e) => {
					isDragging = false;
					const rect = selectionBox.getBoundingClientRect();
					document.body.removeChild(overlay);
					if (rect.width > 5 && rect.height > 5) {
						sendResponse({
							success: true,
							rect: {
								x: rect.x,
								y: rect.y,
								width: rect.width,
								height: rect.height
							},
							devicePixelRatio: window.devicePixelRatio
						});
					} else {
						sendResponse({ success: false, error: 'Selection too small' });
					}
				});

				document.addEventListener('keydown', function escHandler(e) {
					if (e.key === 'Escape') {
						if (document.body.contains(overlay)) document.body.removeChild(overlay);
						document.removeEventListener('keydown', escHandler);
						sendResponse({ success: false, error: 'Cancelled' });
					}
				});

				return true;
			} catch (error) {
				sendResponse({ success: false, error: error.message });
			}
		}

		/**
		* Handle analyze request
		*/
		/**
		* Handle analyze request
		*/
		async function handleAnalyze(request, sendResponse) {
			console.log('handleAnalyze called. sendResponse Type:', typeof sendResponse);
			if (typeof sendResponse !== 'function') {
				console.error('CRITICAL: sendResponse is not a function!', sendResponse);
				return;
			}
			try {
				console.log('Starting page analysis with options:', request.options);
				const options = request.options || { contrast: true };
				let allViolations = [];
				let fullSummary = { byCategory: {} };

				// 1. Contrast Audit
				if (options.contrast) {
					ContrastAnalyzer.clearViolations();
					if (options.showHighlights !== false) ContrastOverlay.hide(); // Default to hiding unless specified

					const violations = await ContrastAnalyzer.analyzePage();
					allViolations = [...allViolations, ...violations];

					const summary = ContrastAnalyzer.getViolationsSummary();
					fullSummary.contrast = summary;
					fullSummary.byCategory = { ...summary.byCategory };
					fullSummary.worstContrast = summary.worstContrast;
				}

				// 2. Button Audit
				if (options.buttons) {
					const btnSummary = await ButtonAnalyzer.analyzePage();
					if (btnSummary.issues && btnSummary.issues.length > 0) {
						const btnViolations = btnSummary.issues.map(issue => ({
							type: 'button',
							message: issue.message,
							context: issue.text || 'Button',
							selector: issue.selector,
							element: issue.element
						}));
						allViolations = [...allViolations, ...btnViolations];
						fullSummary.byCategory.button = (fullSummary.byCategory.button || 0) + btnViolations.length;
					}
				}

				// 3. Image Audit
				if (options.images) {
					const imgResult = ImageAnalyzer.analyzePage();
					if (imgResult.issues && imgResult.issues.length > 0) {
						const imgViolations = imgResult.issues.map(issue => ({
							type: 'image',
							message: issue.message,
							context: issue.src || 'Image',
							selector: issue.selector,
							element: issue.element
						}));
						allViolations = [...allViolations, ...imgViolations];
						fullSummary.byCategory.image = (fullSummary.byCategory.image || 0) + imgViolations.length;
					}
				}

				// 4. SEO Audit
				if (options.seo) {
					const seoSummary = await SEOAnalyzer.analyzePage();
					// Convert critical SEO errors to violations
					if (seoSummary.title.status === 'missing' || seoSummary.title.length < 10) {
						allViolations.push({
							type: 'seo',
							message: seoSummary.title.status === 'missing' ? 'Missing Title' : 'Title too short',
							context: 'Page Title'
						});
					}
					if (seoSummary.description.status === 'missing' || seoSummary.description.length < 50) {
						allViolations.push({
							type: 'seo',
							message: seoSummary.description.status === 'missing' ? 'Missing Meta Description' : 'Description too short',
							context: 'Meta Description'
						});
					}
				}

				// Show contrast violations if it was the main/only check AND not silent
				if (options.contrast && !options.buttons && !options.images && !options.seo && !options.silent) {
					if (allViolations.length > 0) {
						ContrastOverlay.showViolations(allViolations.filter(v => v.type !== 'button' && v.type !== 'image' && v.type !== 'seo'));
					}
				}

				// Sanitize violations for message passing (remove DOM elements)
				const sanitizedViolations = allViolations.map(v => {
					const { element, ...safeV } = v;
					return safeV;
				});

				// Sanitize summary (specifically worstContrast which contains a DOM element)
				let sanitizedSummary = { ...fullSummary };
				if (sanitizedSummary.contrast && sanitizedSummary.contrast.worstContrast) {
					const { element, ...safeWorst } = sanitizedSummary.contrast.worstContrast;
					sanitizedSummary.contrast.worstContrast = safeWorst;
					sanitizedSummary.worstContrast = safeWorst;
				}

				// Just to be safe, ensure worstContrast is clean at the top level too if it was copied
				if (sanitizedSummary.worstContrast && sanitizedSummary.worstContrast.element) {
					const { element, ...safeWorst } = sanitizedSummary.worstContrast;
					sanitizedSummary.worstContrast = safeWorst;
				}

				sendResponse({
					success: true,
					violations: sanitizedViolations,
					summary: sanitizedSummary
				});
			} catch (error) {
				console.error('Analysis error:', error);
				sendResponse({
					success: false,
					error: error.message
				});
			}
		}

		/**
		* Handle font analysis request
		*/
		async function handleFontAnalysis(sendResponse) {
			try {
				console.log('Starting font audit...');
				const summary = await FontAnalyzer.analyzePage();
				sendResponse({
					success: true,
					summary: summary
				});
			} catch (error) {
				console.error('Font analysis error:', error);
				sendResponse({
					success: false,
					error: error.message
				});
			}
		}

		/**
		* Handle button analysis request
		*/
		async function handleButtonAnalysis(sendResponse) {
			try {
				console.log('Starting button audit...');
				const summary = await ButtonAnalyzer.analyzePage();
				sendResponse({
					success: true,
					summary: summary
				});
			} catch (error) {
				console.error('Button analysis error:', error);
				sendResponse({
					success: false,
					error: error.message
				});
			}
		}

		/**
		* Handle image analysis request
		*/
		async function handleImageAnalysis(sendResponse) {
			try {
				console.log('Starting image accessibility audit...');
				const result = ImageAnalyzer.analyzePage();
				sendResponse({
					success: true,
					totalImages: result.totalImages,
					issues: result.issues,
					totalImages: result.totalImages,
					issues: result.issues,
					summary: result.summary,
					allImages: result.allImages
				});
			} catch (error) {
				console.error('Image analysis error:', error);
				sendResponse({
					success: false,
					error: error.message
				});
			}
		}

		/**
		* Handle SEO analysis request
		*/
		async function handleSEOAnalysis(sendResponse) {
			try {
				console.log('Starting SEO audit...');
				const summary = await SEOAnalyzer.analyzePage();
				sendResponse({
					success: true,
					summary: summary
				});
			} catch (error) {
				console.error('SEO analysis error:', error);
				sendResponse({
					success: false,
					error: error.message
				});
			}
		}

		/**
		* Handle color analysis request
		*/
		async function handleColorAnalysis(sendResponse) {
			try {
				console.log('Starting color audit...');
				const result = ColorAnalyzer.analyzePage();
				sendResponse({
					success: true,
					total: result.total,
					details: result.details,
					allColors: result.allColors
				});
			} catch (error) {
				console.error('Color analysis error:', error);
				sendResponse({
					success: false,
					error: error.message
				});
			}
		}

		/**
		* Handle content analysis request (Layout, Duplicates, Lorem)
		*/
		async function handleContentAnalysis(sendResponse) {
			try {
				console.log('Starting content audit...');
				const result = await ContentAnalyzer.analyze();
				console.log('✅ Analysis complete. Sending response:', result);

				// Send explicit message to update UI (more robust than return)
				try {
					await chrome.runtime.sendMessage({
						action: 'contentAnalysisComplete',
						data: {
							loremIpsum: result.loremIpsum,
							layout: result.layout,
							duplicates: result.duplicates
						}
					});
				} catch (e) {
					console.warn('Could not send runtime message (sidepanel might be closed):', e);
				}

				// FALLBACK: Write to storage (Bypasses message channel issues)
				try {
					await chrome.storage.local.set({
						latestAnalysis: {
							loremIpsum: result.loremIpsum,
							layout: result.layout,
							duplicates: result.duplicates,
							timestamp: Date.now()
						}
					});
					console.log('💾 Stored analysis results in local storage.');
				} catch (e) {
					console.error('Storage write failed:', e);
				}

				sendResponse({
					success: true,
					layout: result.layout,
					duplicates: result.duplicates,
					loremIpsum: result.loremIpsum
				});
			} catch (error) {
				console.error('Content analysis error:', error);
				// Check if ContentAnalyzer is defined
				if (typeof ContentAnalyzer === 'undefined') {
					sendResponse({ success: false, error: 'ContentAnalyzer module not loaded' });
				} else {
					sendResponse({ success: false, error: error.message });
				}
			}
		}

		/**
		* Handle link analysis request
		*/
		async function handleLinkAnalysis(sendResponse) {
			try {
				console.log('Starting link audit...');
				const links = LinkAnalyzer.extractLinks();
				sendResponse({
					success: true,
					links: links
				});
			} catch (error) {
				console.error('Link analysis error:', error);
				if (typeof LinkAnalyzer === 'undefined') {
					sendResponse({ success: false, error: 'LinkAnalyzer module not loaded' });
				} else {
					sendResponse({ success: false, error: error.message });
				}
			}
		}

		/**
		* Handle button highlight request
		*/
		function handleHighlightButton(request, sendResponse) {
			try {
				clearButtonHighlight();
				let selector = request.selector;
				let element;

				try {
					element = document.querySelector(selector);
				} catch (e) {
					console.warn('Invalid selector, attempting to fix:', selector);
					// Fallback: If it looks like an ID but has strange chars, try escaping
					if (selector.startsWith('#')) {
						try {
							const idPart = selector.substring(1);
							element = document.getElementById(idPart); // Faster and handles some chars better
							if (!element) {
								// Try CSS escaping strictly
								element = document.querySelector('#' + CSS.escape(idPart));
							}
						} catch (e2) {
							console.error('Fallback selector failed:', e2);
						}
					}
				}

				if (!element) {
					console.warn('Button element not found for selector:', selector);
					sendResponse({ success: false, error: 'Button element not found' });
					return;
				}

				// Scroll into view first
				element.scrollIntoView({ behavior: 'smooth', block: 'center' });

				// Create highlight overlay
				const highlight = document.createElement('div');
				highlight.id = 'wcag-button-highlight';
				highlight.className = 'wcag-button-highlight';

				// Get element position and dimensions
				setTimeout(() => {
					const rect = element.getBoundingClientRect();
					highlight.style.position = 'absolute';
					highlight.style.top = (rect.top + window.scrollY) + 'px';
					highlight.style.left = (rect.left + window.scrollX) + 'px';
					highlight.style.width = rect.width + 'px';
					highlight.style.height = rect.height + 'px';
					highlight.style.border = '3px solid #ef4444';
					highlight.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
					highlight.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.4), 0 0 20px rgba(0,0,0,0.5)';
					highlight.style.pointerEvents = 'none';
					highlight.style.zIndex = '2147483647'; // Max z-index
					highlight.style.transition = 'all 0.3s ease';
					highlight.style.borderRadius = '4px';

					document.body.appendChild(highlight);

					// Pulse animation
					let scale = 1;
					const pulse = setInterval(() => {
						scale = scale === 1 ? 1.02 : 1;
						highlight.style.transform = `scale(${scale})`;
					}, 500);

					// Auto-remove after 3 seconds? Or clear on next click?
					// content.js usually clears on next click (line 556: clearButtonHighlight()). 
					// But let's attach the interval ID to the element so we can clear it.
					highlight.dataset.pulseId = pulse;
				}, 300); // Wait for scroll alignment.style.boxShadow = '0 0 0 2px #fca5a5, inset 0 0 20px rgba(239, 68, 68, 0.2)';
				highlight.style.borderRadius = '4px';
				highlight.style.animation = 'wcag-pulse 2s ease-in-out infinite';

				document.body.appendChild(highlight);

				// Scroll to element with offset
				const targetScroll = rect.top + window.scrollY - 100;
				window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });

				sendResponse({ success: true });
			} catch (error) {
				console.error('Button highlight error:', error);
				sendResponse({ success: false, error: error.message });
			}
		}


		/**
		 * Handle multiple element highlighting (for Lorem/Lists)
		 */
		function handleHighlightList(request, sendResponse) {
			const existing = document.querySelectorAll('.wcag-highlight-multi');
			existing.forEach(el => el.remove());

			const selectors = request.selectors || [];
			let count = 0;
			let firstElement = null;

			selectors.forEach(selector => {
				try {
					const el = document.querySelector(selector);
					if (el) {
						if (!firstElement) firstElement = el;

						const rect = el.getBoundingClientRect();
						if (rect.width > 0 && rect.height > 0) {
							const highlight = document.createElement('div');
							highlight.className = 'wcag-highlight-multi';
							highlight.style.position = 'absolute';
							highlight.style.top = (rect.top + window.scrollY) + 'px';
							highlight.style.left = (rect.left + window.scrollX) + 'px';
							highlight.style.width = rect.width + 'px';
							highlight.style.height = rect.height + 'px';

							// Style: Striped red
							highlight.style.backgroundColor = 'rgba(255, 80, 80, 0.4)';
							highlight.style.backgroundImage = 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)';
							highlight.style.backgroundSize = '20px 20px';
							highlight.style.border = '2px dashed #ff0000';
							highlight.style.zIndex = '10000';
							highlight.style.pointerEvents = 'none';
							highlight.style.borderRadius = '4px';

							document.body.appendChild(highlight);
							count++;
						}
					}
				} catch (e) {
					// Ignore
				}
			});

			if (firstElement) {
				firstElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}

			sendResponse({ success: true, count: count });
		}

		/**
		 * Handle highlight multiple buttons
		 */
		function handleHighlightButtons(request, sendResponse) {
			try {
				clearButtonHighlight();
				const selectors = request.selectors;
				let count = 0;

				if (selectors && Array.isArray(selectors)) {
					selectors.forEach(selector => {
						try {
							const element = document.querySelector(selector);
							if (element) {
								createHighlight(element);
								count++;
							}
						} catch (e) {
							console.warn('Failed to highlight selector:', selector);
						}
					});
				}

				if (count > 0) {
					sendResponse({ success: true, count: count });
				} else {
					sendResponse({ success: false, error: 'No buttons found to highlight' });
				}
			} catch (error) {
				console.error('Button highlight error:', error);
				sendResponse({ success: false, error: error.message });
			}
		}

		function createHighlight(element) {
			const highlight = document.createElement('div');
			highlight.className = 'wcag-button-highlight-multi';

			const rect = element.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) return;

			highlight.style.position = 'absolute';
			highlight.style.top = (rect.top + window.scrollY) + 'px';
			highlight.style.left = (rect.left + window.scrollX) + 'px';
			highlight.style.width = rect.width + 'px';
			highlight.style.height = rect.height + 'px';

			highlight.style.border = '3px solid #ef4444';
			highlight.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
			highlight.style.pointerEvents = 'none';
			highlight.style.zIndex = '999999';
			highlight.style.boxShadow = '0 0 0 2px #fca5a5, inset 0 0 20px rgba(239, 68, 68, 0.2)';
			highlight.style.borderRadius = '4px';
			highlight.style.animation = 'wcag-pulse 2s ease-in-out infinite';

			document.body.appendChild(highlight);
		}
		/**
		* Clear button highlight
		*/
		function clearButtonHighlight() {
			const existing = document.getElementById('wcag-button-highlight');
			if (existing) {
				if (existing.dataset.pulseId) clearInterval(Number(existing.dataset.pulseId));
				existing.remove();
			}
			// Also remove multi highlights
			const multiHighlights = document.querySelectorAll('.wcag-button-highlight-multi');
			multiHighlights.forEach(el => el.remove());
			document.querySelectorAll('.wcag-highlight-multi').forEach(el => el.remove());
		}

		/**
		* Handle clear button highlight request
		*/
		function handleClearButtonHighlight(sendResponse) {
			try {
				clearButtonHighlight();
				sendResponse({ success: true });
			} catch (error) {
				sendResponse({ success: false, error: error.message });
			}
		}

		/**
		* Handle show violations request
		*/
		function handleShowViolations(sendResponse) {
			try {
				if (ContrastAnalyzer.violations.length > 0) {
					ContrastOverlay.show();
					sendResponse({ success: true });
				} else {
					sendResponse({ success: false, error: 'No violations to show' });
				}
			} catch (error) {
				sendResponse({ success: false, error: error.message });
			}
		}
		/**
		* Handle hide violations request
		*/
		function handleHideViolations(sendResponse) {
			try {
				ContrastOverlay.hide();
				sendResponse({ success: true });
			} catch (error) {
				sendResponse({ success: false, error: error.message });
			}
		}
		/**
		* Handle toggle violations request
		*/
		function handleToggleViolations(sendResponse) {
			try {
				ContrastOverlay.toggle();
				sendResponse({
					success: true,
					visible: ContrastOverlay.isVisible
				});
			} catch (error) {
				sendResponse({ success: false, error: error.message });
			}
		}
		/**
		* Handle export report request
		*/
		function handleExportReport(sendResponse) {
			try {
				const report = ContrastAnalyzer.exportViolations();
				sendResponse({
					success: true,
					report: report
				});
			} catch (error) {
				sendResponse({ success: false, error: error.message });
			}
		}
		/**
		* Handle get status request
		*/
		function handleGetStatus(sendResponse) {
			try {
				sendResponse({
					success: true,
					isAnalyzing: ContrastAnalyzer.isAnalyzing,
					violationsCount: ContrastAnalyzer.violations.length,
					overlayVisible: ContrastOverlay.isVisible
				});
			} catch (error) {
				sendResponse({ success: false, error: error.message });
			}
		}
		/**
		* Handle get page meta request
		*/
		function handleGetPageMeta(sendResponse) {
			try {
				const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
					document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
					'';
				sendResponse({
					success: true,
					description: description || 'No description found'
				});
			} catch (error) {
				sendResponse({
					success: false,
					description: 'Error reading meta'
				});
			}
		}

		// Keyboard shortcut: Ctrl+Shift+C to toggle overlay
		document.addEventListener('keydown', (e) => {
			if (e.ctrlKey && e.shiftKey && e.key === 'C') {
				e.preventDefault();
				ContrastOverlay.toggle();
			}
		});
		// Clean up on page unload
		window.addEventListener('beforeunload', () => {
			ContrastOverlay.destroy();
		});

		/**
		 * Handle full page screenshot
		 */
		async function handleCaptureFullPage(sendResponse) {
			try {
				// Load html2canvas library dynamically
				if (!window.html2canvas) {
					const script = document.createElement('script');
					script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
					await new Promise((resolve, reject) => {
						script.onload = resolve;
						script.onerror = reject;
						document.head.appendChild(script);
					});
				}

				// Get full page dimensions
				const fullHeight = document.documentElement.scrollHeight;
				const fullWidth = document.documentElement.scrollWidth;
				const currentScrollY = window.scrollY;
				const currentScrollX = window.scrollX;

				// Scroll to top-left
				window.scrollTo(0, 0);
				await new Promise(resolve => setTimeout(resolve, 300)); // Wait for scroll

				// Capture full page using html2canvas
				const canvas = await html2canvas(document.documentElement, {
					allowTaint: true,
					useCORS: true,
					windowHeight: fullHeight,
					windowWidth: fullWidth,
					backgroundColor: '#ffffff'
				});

				// Restore original scroll position
				window.scrollTo(currentScrollX, currentScrollY);

				const screenshotData = canvas.toDataURL('image/png');
				sendResponse({ success: true, screenshot: screenshotData });
			} catch (error) {
				console.error('Full page screenshot failed:', error);
				sendResponse({ success: false, error: error.message });
			}
		}
		/**
		 * Handle Crawl Nav (Human-like)
		 */
		/**
		 * Handle Crawl Nav (Human-like)
		 */
		async function handleCrawlNav(sendResponse) {
			try {
				console.log('🤖 Starting Human-like Nav Crawl...');
				const collectedUrls = new Set();

				// Helper to merge links from LinkAnalyzer
				const mergeLinks = () => {
					if (typeof LinkAnalyzer !== 'undefined') {
						const richLinks = LinkAnalyzer.extractLinks();
						richLinks.forEach(l => {
							if (l.url) collectedUrls.add(l.url);
						});
					} else {
						// Fallback if LinkAnalyzer is missing
						const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
						links.forEach(l => collectedUrls.add(l));
					}
				};

				// 1. Initial Scan
				mergeLinks();

				// 2. Interactive Discovery (Mega Menus, Dropdowns)
				// Strategy: Look for specific menu indicators
				const menuItems = document.querySelectorAll(`
				nav li, 
				[role="navigation"] li, 
				.menu-item, 
				.nav-item, 
				header li,
				[aria-haspopup="true"],
				[aria-expanded="false"]
			`);

				// Limit interactions to avoid hanging on massive pages
				const maxInteractions = 50;
				let interactionCount = 0;

				for (const item of menuItems) {
					if (interactionCount >= maxInteractions) break;

					// Skip if it looks like a link we already have
					const childA = item.querySelector('a');
					if (childA && collectedUrls.has(childA.href)) {
						// It's a link we already found, but hovering might show MORE links (dropdowns)
						// So we proceed.
					}

					// Visualize scanner (optional debug)
					// item.style.outline = "1px solid pink";

					// Mouse Over
					const mouseOverEvent = new MouseEvent('mouseover', {
						bubbles: true,
						cancelable: true,
						view: window
					});
					item.dispatchEvent(mouseOverEvent);

					// For aria-expanded="false", we might need a click? 
					// Clicking is dangerous as it might navigate away. 
					// Safe Approach: Only click if it's NOT an anchor or form submit.
					if (item.getAttribute('aria-expanded') === 'false' && item.tagName !== 'A') {
						item.click(); // Potentially risky if it's a route change, but usually safe for dropdown toggles
					}

					interactionCount++;
				}

				// Wait a moment for animations/render
				await new Promise(r => setTimeout(r, 800));

				// 3. Rescan for new links
				mergeLinks();

				console.log(`✅ Crawl found ${collectedUrls.size} unique links.`);

				sendResponse({
					success: true,
					links: Array.from(collectedUrls).filter(l => l && l.startsWith('http'))
				});

			} catch (error) {
				console.error('Crawl Error:', error);
				// Fallback
				const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
				sendResponse({ success: true, links: links });
			}
		}

		/**
		 * Handle Image Highlight
		 */
		function handleHighlightImage(request, sendResponse) {
			try {
				// Find image by selector or index
				let img;
				if (request.selector) {
					img = document.querySelector(request.selector);
				}

				// Fallback to searching by src/index if selector fails or is generic
				if (!img && request.src) {
					const images = document.querySelectorAll('img');
					img = Array.from(images).find(i => i.src === request.src);
				}

				if (!img && typeof request.elementIndex === 'number') {
					img = document.querySelectorAll('img')[request.elementIndex];
				}

				if (!img) {
					sendResponse({ success: false, error: 'Image not found' });
					return;
				}

				// Remove existing highlights
				document.querySelectorAll('.wcag-image-highlight').forEach(el => el.remove());

				const rect = img.getBoundingClientRect();

				// Create overlay
				const overlay = document.createElement('div');
				overlay.className = 'wcag-image-highlight';
				overlay.style.position = 'absolute';
				overlay.style.top = (rect.top + window.scrollY) + 'px';
				overlay.style.left = (rect.left + window.scrollX) + 'px';
				overlay.style.width = rect.width + 'px';
				overlay.style.height = rect.height + 'px';
				overlay.style.border = '4px solid #ef4444';
				overlay.style.background = 'rgba(239, 68, 68, 0.2)';
				overlay.style.zIndex = '999999';
				overlay.style.pointerEvents = 'none';
				overlay.style.borderRadius = '4px';

				// Label
				const label = document.createElement('div');
				label.textContent = 'Missing Alt Text';
				label.style.position = 'absolute';
				label.style.top = '-24px';
				label.style.left = '0';
				label.style.background = '#ef4444';
				label.style.color = '#fff';
				label.style.padding = '2px 8px';
				label.style.borderRadius = '4px';
				label.style.fontSize = '12px';
				label.style.fontWeight = 'bold';
				overlay.appendChild(label);

				document.body.appendChild(overlay);

				// Scroll to view
				window.scrollTo({
					top: rect.top + window.scrollY - 150,
					behavior: 'smooth'
				});

				// Remove after 3 seconds
				setTimeout(() => {
					overlay.remove();
				}, 5000);

				sendResponse({ success: true });
			} catch (error) {
				sendResponse({ success: false, error: error.message });
			}
		}

		/**
		 * Handle Content Diff Analysis
		 */
		function handleAnalyzeContentDiff(request, sendResponse) {
			try {
				const refText = request.referenceText; // The uploaded/pasted text
				if (!refText) {
					sendResponse({ success: false, error: 'No reference text' });
					return;
				}

				// Normalize reference text roughly
				const cleanRef = refText.toLowerCase().replace(/\s+/g, ' ');

				// Walker to find text nodes
				const walker = document.createTreeWalker(
					document.body,
					NodeFilter.SHOW_TEXT,
					{
						acceptNode: function (node) {
							// Skip scripts, styles, hidden elements
							const parent = node.parentElement;
							if (!parent) return NodeFilter.FILTER_REJECT;
							if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
							if (getComputedStyle(parent).display === 'none') return NodeFilter.FILTER_REJECT;
							if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
							return NodeFilter.FILTER_ACCEPT;
						}
					}
				);

				const nodesToProcess = [];
				while (walker.nextNode()) {
					nodesToProcess.push(walker.currentNode);
				}

				let matches = 0;
				let mismatches = 0;

				nodesToProcess.forEach(node => {
					const nodeText = node.textContent.trim();
					if (nodeText.length < 3) return; // Skip tiny noise

					const cleanNodeText = nodeText.toLowerCase().replace(/\s+/g, ' ');

					// Check if this text roughly exists in the reference
					// This is a naive check. 
					// Enhanced check: Check if a significant portion of the sentence exists.

					let isMatch = false;
					if (cleanRef.includes(cleanNodeText)) {
						isMatch = true;
					} else if (cleanNodeText.length > 50) {
						// Try partial match for long blocks
						const mid = Math.floor(cleanNodeText.length / 2);
						if (cleanRef.includes(cleanNodeText.substring(0, mid)) || cleanRef.includes(cleanNodeText.substring(mid))) {
							isMatch = true;
						}
					}

					if (isMatch) {
						matches++;
						wrapTextNode(node, 'wcag-content-match'); // Green
					} else {
						// Only mark as mismatch if it's substantial text, not just UI elements like 'Menu'
						if (cleanNodeText.split(' ').length > 2) {
							mismatches++;
							wrapTextNode(node, 'wcag-content-mismatch'); // Red
						}
					}
				});

				// Add Styles
				if (!document.getElementById('wcag-diff-styles')) {
					const style = document.createElement('style');
					style.id = 'wcag-diff-styles';
					style.textContent = `
                    .wcag-content-match {
                        background-color: rgba(134, 239, 172, 0.4) !important; /* Green 300 */
                        outline: 1px dashed rgba(22, 163, 74, 0.5);
                        color: #000 !important;
                    }
                    .wcag-content-mismatch {
                        background-color: rgba(252, 165, 165, 0.4) !important; /* Red 300 */
                        outline: 1px dashed rgba(220, 38, 38, 0.5);
                    }
                `;
					document.head.appendChild(style);
				}

				sendResponse({ success: true, matches, mismatches });
			} catch (error) {
				console.error('Content Diff Error:', error);
				sendResponse({ success: false, error: error.message });
			}
		}

		function wrapTextNode(textNode, className) {
			const span = document.createElement('span');
			span.className = className;
			span.textContent = textNode.textContent;
			textNode.parentNode.replaceChild(span, textNode);
		}

		function handleClearContentHighlights(sendResponse) {
			try {
				// Remove styles
				const style = document.getElementById('wcag-diff-styles');
				if (style) style.remove();

				// Unwrap spans (Green)
				const matches = document.querySelectorAll('.wcag-content-match');
				matches.forEach(span => {
					const text = document.createTextNode(span.textContent);
					span.parentNode.replaceChild(text, span);
				});

				// Unwrap spans (Red)
				const mismatches = document.querySelectorAll('.wcag-content-mismatch');
				mismatches.forEach(span => {
					const text = document.createTextNode(span.textContent);
					span.parentNode.replaceChild(text, span);
				});

				sendResponse({ success: true });
			} catch (e) {
				sendResponse({ success: false, error: e.message });
			}
		}



		/**
		 * Handle Content Diff Highlighting
		 */
		function handleHighlightContentDiff(request) {
			// 1. Inject Styles
			if (!document.getElementById('wcag-diff-styles')) {
				const style = document.createElement('style');
				style.id = 'wcag-diff-styles';
				style.textContent = `
            .wcag-diff-found {
                outline: 2px solid #16a34a !important; /* Green 600 */
                background-color: rgba(22, 163, 74, 0.2) !important;
                position: relative;
            }
            .wcag-diff-found::after {
                content: "✅ " attr(data-wcag-label);
                position: absolute;
                top: -1.5em; /* Position above */
                right: 0;
                background: #16a34a;
                color: white;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 4px;
                white-space: nowrap;
                z-index: 1000;
                pointer-events: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .wcag-diff-extra {
                outline: 3px dashed #dc2626 !important; /* Red 600 */
                background-color: rgba(220, 38, 38, 0.15) !important;
                position: relative;
            }
            /* Adjustments for block elements */
            .wcag-diff-found, .wcag-diff-extra {
                box-decoration-break: clone;
                -webkit-box-decoration-break: clone;
            }
        `;
				document.head.appendChild(style);
			}

			// 2. Clear old highlights
			document.querySelectorAll('.wcag-diff-found, .wcag-diff-extra').forEach(el => {
				el.classList.remove('wcag-diff-found', 'wcag-diff-extra');
				el.removeAttribute('data-wcag-label');
			});

			if (!request.sourceLines || request.sourceLines.length === 0) return;

			// 3. Prepare Source Lines
			const sourceSet = new Set(request.sourceLines.map(l => l.toLowerCase().replace(/\s+/g, ' ').trim()));

			// 4. Element-Level Traversal
			const contentSelectors = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, span, a, label, div';
			const elements = document.querySelectorAll(contentSelectors);

			let matchCount = 0;

			elements.forEach(el => {
				// Filter out non-visible or structural mess
				if (el.offsetParent === null) return; // Hidden
				if (el.closest('.wcag-overlay')) return; // Ignore our own UI
				if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG', 'IFRAME'].includes(el.tagName)) return;

				// "Leaf-ish" check: Matches if it has text AND (no children OR children are inline only).
				const text = el.innerText.replace(/\s+/g, ' ').trim();
				if (text.length < 2) return;

				const textLower = text.toLowerCase();

				if (sourceSet.has(textLower)) {
					el.classList.add('wcag-diff-found');
					el.setAttribute('data-wcag-label', 'Match');
					matchCount++;
				} else {
					// IT IS EXTRA... maybe.
					// Refinement: Only mark LEAF nodes as Extra to avoid coloring the whole <body> red.
					const hasBlockChildren = Array.from(el.children).some(child => {
						const display = window.getComputedStyle(child).display;
						return display.includes('block') || display.includes('flex') || display.includes('grid') || display.includes('table');
					});

					if (!hasBlockChildren) {
						// It's a terminal block. If it didn't match sourceSet, it's Extra.
						// If a child is .wcag-diff-found, don't mark parent Extra?
						if (!el.querySelector('.wcag-diff-found')) {
							el.classList.add('wcag-diff-extra');
						}
					}
				}
			});

			console.log(`✅ Visual Diff Applied: ${matchCount} matches found.`);
		}

		// End of content script (SafeGuard)
	} catch (e) {
		console.error('CRITICAL CONTENT SCRIPT CRASH:', e);
	}


})();