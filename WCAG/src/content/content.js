// Main content script - coordinates all analysis
(function () {
	'use strict';
	try {
		console.log('Visual Contrast Checker: Content script loaded (SafeGuard Active)');

		// Inject premium highlight CSS
		const highlightCss = document.createElement('style');
		highlightCss.id = 'wcag-highlight-styles';
		highlightCss.textContent = `
		@keyframes wcag-glow {
			0%, 100% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.4), inset 0 0 10px rgba(239, 68, 68, 0.1); }
			50% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.6), inset 0 0 20px rgba(239, 68, 68, 0.2); }
		}
		
		.wcag-button-highlight, .wcag-button-highlight-multi, .wcag-image-highlight {
			position: absolute !important;
			border: 2px solid #ef4444 !important;
			background-color: rgba(239, 68, 68, 0.05) !important;
			pointer-events: none !important;
			z-index: 2147483647 !important;
			border-radius: 6px !important;
			animation: wcag-glow 2s ease-in-out infinite !important;
			box-sizing: border-box !important;
			transition: all 0.3s ease !important;
		}

		.wcag-highlight-label {
			position: absolute;
			top: -28px;
			left: 0;
			background: linear-gradient(135deg, #ef4444, #dc2626);
			color: white;
			padding: 4px 10px;
			border-radius: 6px;
			font-size: 11px;
			font-weight: 700;
			font-family: 'Inter', sans-serif;
			box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);
			white-space: nowrap;
			z-index: 2147483647;
		}
		
		.wcag-highlight-multi {
			position: absolute !important;
			border: 2px dashed #f59e0b !important;
			background-color: rgba(245, 158, 11, 0.1) !important;
			pointer-events: none !important;
			z-index: 10000 !important;
			border-radius: 4px !important;
		}
	`;
		document.head.appendChild(highlightCss);

		chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
			console.log('📨 Content script received message:', request.action);
			
			if (request.action === 'ping') {
				sendResponse({ success: true, message: 'pong' });
				return true;
			}

			switch (request.action) {
				case 'analyze':
					handleAnalyze(request, sendResponse);
					return true;
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
					return true;
				case 'showViolations':
					handleShowViolations(sendResponse);
					return true;
				case 'hideViolations':
					handleHideViolations(sendResponse);
					return true;
				case 'toggleViolations':
					handleToggleViolations(sendResponse);
					return true;
				case 'exportReport':
					handleExportReport(sendResponse);
					return true;
				case 'getStatus':
					handleGetStatus(sendResponse);
					return true;
				case 'getPageMeta':
					handleGetPageMeta(sendResponse);
					return true;
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
					handleHighlightContentDiff(request).then(results => {
						sendResponse(results);
					});
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
				case 'highlightList':
					handleHighlightList(request, sendResponse);
					return true;
				default:
					sendResponse({ success: false, error: 'Unknown action: ' + request.action });
					return false;
			}
		});

		async function handleAnalyzeAll(sendResponse) {
			try {
				console.log('🚀 Standardizing analysis for SiteLens Engine...');
				
				// Run all core analyzers
				const [contrast, buttons, fonts, images, seo, content, links] = await Promise.all([
					ContrastAnalyzer.analyzePage().then(v => ({ summary: ContrastAnalyzer.getViolationsSummary(), violations: v })),
					ButtonAnalyzer.analyzePage(),
					FontAnalyzer.analyzePage(),
					ImageAnalyzer.analyzePage(),
					SEOAnalyzer.analyzePage(),
					ContentAnalyzer.analyze(),
					LinkAnalyzer.extractLinks ? { links: LinkAnalyzer.extractLinks() } : { links: [] }
				]);

				sendResponse({
					success: true,
					data: {
						contrast,
						buttons,
						fonts,
						images,
						seo,
						content,
						links: links.links
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
					// Only hide if we aren't planning to show highlights immediately
					if (options.silent || (options.buttons || options.images || options.seo)) {
						ContrastOverlay.hide();
					}

					const violations = await ContrastAnalyzer.analyzePage();
					// Add type to each violation
					const contrastViolations = violations.map(v => ({ ...v, type: 'contrast' }));
					allViolations = [...allViolations, ...contrastViolations];

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
							category: 'button',
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
							category: 'image',
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
							category: 'seo',
							message: seoSummary.title.status === 'missing' ? 'Missing Title' : 'Title too short',
							context: 'Page Title'
						});
					}
					if (seoSummary.description.status === 'missing' || seoSummary.description.length < 50) {
						allViolations.push({
							type: 'seo',
							category: 'seo',
							message: seoSummary.description.status === 'missing' ? 'Missing Meta Description' : 'Description too short',
							context: 'Meta Description'
						});
					}
				}

				// Show contrast violations if it was requested (and not silent)
				if (options.contrast && !options.silent) {
					const violationsToShow = allViolations.filter(v => v.type === 'contrast');
					if (violationsToShow.length > 0) {
						ContrastOverlay.showViolations(violationsToShow);
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
					console.warn('Invalid selector, attempting fallback:', selector);
					if (selector.startsWith('#')) {
						const idPart = selector.substring(1);
						element = document.getElementById(idPart) || document.querySelector('#' + CSS.escape(idPart));
					}
				}

				if (!element) {
					sendResponse({ success: false, error: 'Element not found' });
					return;
				}

				element.scrollIntoView({ behavior: 'smooth', block: 'center' });

				setTimeout(() => {
					const rect = element.getBoundingClientRect();
					const highlight = document.createElement('div');
					highlight.id = 'wcag-button-highlight';
					highlight.className = 'wcag-button-highlight';
					
					highlight.style.top = (rect.top + window.scrollY) + 'px';
					highlight.style.left = (rect.left + window.scrollX) + 'px';
					highlight.style.width = rect.width + 'px';
					highlight.style.height = rect.height + 'px';

					// Add Label
					const label = document.createElement('div');
					label.className = 'wcag-highlight-label';
					label.textContent = request.message || 'Button Issue';
					highlight.appendChild(label);

					document.body.appendChild(highlight);
					sendResponse({ success: true });
				}, 300);
			} catch (error) {
				console.error('Highlight error:', error);
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
							highlight.style.top = (rect.top + window.scrollY) + 'px';
							highlight.style.left = (rect.left + window.scrollX) + 'px';
							highlight.style.width = rect.width + 'px';
							highlight.style.height = rect.height + 'px';

							// Add Label
							const label = document.createElement('div');
							label.className = 'wcag-highlight-label';
							label.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)'; // Amber for content
							label.textContent = request.label || 'Content Issue';
							highlight.appendChild(label);

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

			// Add Label
			const label = document.createElement('div');
			label.className = 'wcag-highlight-label';
			label.textContent = 'Button Issue';
			highlight.appendChild(label);

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
				overlay.style.top = (rect.top + window.scrollY) + 'px';
				overlay.style.left = (rect.left + window.scrollX) + 'px';
				overlay.style.width = rect.width + 'px';
				overlay.style.height = rect.height + 'px';

				// Premium Label
				const label = document.createElement('div');
				label.className = 'wcag-highlight-label';
				label.textContent = request.message || 'Missing Alt Text';
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
		async function handleHighlightContentDiff(request) {
			console.log('🏁 Starting handleHighlightContentDiff', request.sourceLines?.length);

			// Helper for unified normalization
			const normalize = (str) => str.toLowerCase().replace(/[\u00a0\s]+/g, ' ').trim();

			// 0. Auto-Scroll to trigger lazy loading (Optimized Speed)
			const originalScrollY = window.scrollY;
			let lastHeight = 0;
			let currentHeight = document.documentElement.scrollHeight;
			let scrollAttempts = 0;
			const maxAttempts = 15; // Balanced limit

			console.log('📜 Fast Aggressive Scrolling Started...');
			const scrollNotice = document.createElement('div');
			scrollNotice.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.9); color:white; padding:12px 24px; border-radius:30px; z-index:2147483647; font-family:sans-serif; font-size:13px; pointer-events:none; border:2px solid #6366f1; box-shadow: 0 10px 30px rgba(0,0,0,0.5);';
			scrollNotice.innerHTML = '🔄 <span style="font-weight:700; color:#6366f1;">SiteLens:</span> Scanning for new content...';
			document.body.appendChild(scrollNotice);

			try {
				while (lastHeight < currentHeight && scrollAttempts < maxAttempts) {
					lastHeight = currentHeight;
					window.scrollTo(0, currentHeight);
					
					// Faster check
					await new Promise(r => setTimeout(r, 600)); 
					
					currentHeight = document.documentElement.scrollHeight;
					scrollAttempts++;
				}
				window.scrollTo({ top: originalScrollY, behavior: 'instant' });
				await new Promise(r => setTimeout(r, 200));
			} finally {
				if (scrollNotice.parentNode) scrollNotice.remove();
			}

			// 1. Inject Styles...
			if (!document.getElementById('wcag-diff-styles')) {
				const style = document.createElement('style');
				style.id = 'wcag-diff-styles';
				style.textContent = `
                    .wcag-diff-found { outline: 2px solid #10b981 !important; background-color: rgba(16, 185, 129, 0.1) !important; position: relative; border-radius: 4px; z-index: 100 !important; }
                    .wcag-diff-found::after { content: "✓ Match"; position: absolute; top: -24px; right: 0; background: #10b981; color: white; font-size: 10px; padding: 2px 8px; border-radius: 6px; z-index: 1000; font-weight: 700; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); }
                    .wcag-diff-extra { outline: 2px dashed #ef4444 !important; background-color: rgba(239, 68, 68, 0.03) !important; position: relative; border-radius: 4px; }
                    .wcag-diff-extra::after { content: "× Extra"; position: absolute; top: -24px; right: 0; background: #ef4444; color: white; font-size: 10px; padding: 2px 8px; border-radius: 6px; z-index: 1000; font-weight: 700; opacity: 0.8; }
                `;
				document.head.appendChild(style);
			}

			// 2. Clear old highlights
			document.querySelectorAll('.wcag-diff-found, .wcag-diff-extra').forEach(el => {
				el.classList.remove('wcag-diff-found', 'wcag-diff-extra');
			});

			if (!request.sourceLines || request.sourceLines.length === 0) return { success: true, matchCount: 0, totalLines: 0, missingLines: [] };

			// 3. Prepare Source Lines
			const sourceLines = request.sourceLines.map(l => l.trim()).filter(l => l.length > 0);
			const sourceSet = new Set(sourceLines.map(normalize));
			const foundSet = new Set();

			// 4. Analysis Phase 1: Identify Matches (Bottom-Up)
			const contentSelectors = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, span, a, label, div';
			const elements = Array.from(document.querySelectorAll(contentSelectors)).reverse();

			elements.forEach(el => {
				if (el.offsetParent === null || el.closest('.wcag-overlay')) return;
				if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG', 'IFRAME'].includes(el.tagName)) return;
				
				// Case A: Descendant already found? skip container to avoid double highlight
				if (el.querySelector('.wcag-diff-found')) return;

				const text = el.innerText || el.textContent || '';
				
				// LINE MATCHING: Split by newline to respect the "jaha se new line start ho" requirement
				const rawLinesOnPage = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
				let elementHasMatch = false;

				rawLinesOnPage.forEach(pLine => {
					const normPLine = normalize(pLine);
					if (sourceSet.has(normPLine)) {
						foundSet.add(normPLine);
						elementHasMatch = true;
					}
				});

				// Also check the WHOLE text normalized (for cases where user input is a multi-line block)
				const normWhole = normalize(text);
				if (sourceSet.has(normWhole)) {
					foundSet.add(normWhole);
					elementHasMatch = true;
				}

				if (elementHasMatch) {
					el.classList.add('wcag-diff-found');
				}
			});

			// 5. Analysis Phase 2: Identify Extras (Top-Down)
			// Only mark elements that:
			// 1. Are not already marked as found
			// 2. Don't have any 'found' descendants (fixes the nested extra bug)
			// 3. Don't have any 'found' ancestors (avoid coloring the whole page red)
			document.querySelectorAll(contentSelectors).forEach(el => {
				if (el.offsetParent === null || el.closest('.wcag-overlay')) return;
				if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG', 'IFRAME'].includes(el.tagName)) return;
				if (el.classList.contains('wcag-diff-found')) return;
				
				const normText = normalize(el.innerText || el.textContent);
				if (normText.length < 3) return;

				// Skip if any child is a match
				if (el.querySelector('.wcag-diff-found')) return;
				
				// Skip if any parent is a match
				if (el.closest('.wcag-diff-found')) return;

				// Skip if it's a large container
				const display = window.getComputedStyle(el).display;
				const isBlock = display.includes('block') || display.includes('flex') || display.includes('grid');
				const hasTextChildrenOnly = Array.from(el.childNodes).every(n => n.nodeType === 3 || !(['DIV','P','H1','H2','H3','H4','LI','SECTION','MAIN'].includes(n.tagName)));

				if (!isBlock || hasTextChildrenOnly) {
					el.classList.add('wcag-diff-extra');
				}
			});

			// 6. Final Stats
			const missingLines = sourceLines.filter(l => !foundSet.has(normalize(l)));

			console.log(`✅ Analysis Complete. Matches: ${foundSet.size}, Total Unique Source: ${sourceSet.size}`);
			
			return {
				success: true,
				matchCount: foundSet.size,
				totalLines: sourceSet.size,
				missingLines: missingLines
			};
		}

		// End of content script (SafeGuard)
		// Auto-check for pending tasks on load (Persistence Flow)
		(async function checkPending() {
			try {
				const data = await new Promise(resolve => chrome.storage.local.get(['pendingContentCheck', 'sourceLines'], resolve));
				if (data && data.pendingContentCheck && data.sourceLines) {
					console.log('🚀 Resuming pending content check post-reload...');
					// Small buffer to let the page settle
					await new Promise(r => setTimeout(r, 1000));
					const results = await handleHighlightContentDiff({ sourceLines: data.sourceLines });
					chrome.runtime.sendMessage({ action: 'contentCheckResults', results });
					chrome.storage.local.remove(['pendingContentCheck', 'sourceLines']);
				}
			} catch (e) {
				console.error('Pending check failed:', e);
			}
		})();

	} catch (e) {
		console.error('CRITICAL CONTENT SCRIPT CRASH:', e);
	}


})();