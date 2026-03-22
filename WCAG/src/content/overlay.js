const ContrastOverlay = {
	overlayContainer: null,
	highlightElements: [],
	isVisible: false,

	/**
	* Initialize the overlay system
	*/
	init() {
		if (this.overlayContainer && document.body.contains(this.overlayContainer)) return;
		
		// Inject CSS if missing
		if (!document.getElementById('wcag-overlay-styles')) {
			const link = document.createElement('link');
			link.id = 'wcag-overlay-styles';
			link.rel = 'stylesheet';
			link.href = chrome.runtime.getURL('src/content/overlay.css');
			document.head.appendChild(link);
		}

		this.overlayContainer = document.createElement('div');
		this.overlayContainer.id = 'contrast-checker-overlay';
		this.overlayContainer.className = 'contrast-overlay-container';
		
		// Ensure it covers full document height if body is shorter
		const bodyHeight = Math.max(
			document.body.scrollHeight, 
			document.body.offsetHeight, 
			document.documentElement.clientHeight, 
			document.documentElement.scrollHeight, 
			document.documentElement.offsetHeight
		);
		this.overlayContainer.style.height = bodyHeight + 'px';
		
		document.body.appendChild(this.overlayContainer);
	},

	/**
	* Show violations on page with grouping
	*/
	showViolations(violations) {
		this.init();
		this.clearHighlights();
		
		// Group violations by element
		const groupedByElement = new Map();
		violations.forEach(v => {
			if (!v.element) return;
			if (!groupedByElement.has(v.element)) {
				groupedByElement.set(v.element, []);
			}
			groupedByElement.get(v.element).push(v);
		});

		console.log(`Showing violations on ${groupedByElement.size} unique elements`);

		for (const [element, elementViolations] of groupedByElement) {
			this.highlightElement(element, elementViolations);
		}

		this.isVisible = true;
		this.overlayContainer.style.display = 'block';
	},

	/**
	* Highlight a single element with its violations
	*/
	highlightElement(element, violations) {
		if (!element || !document.body.contains(element)) return;

		const rect = element.getBoundingClientRect();
		const scrollX = window.scrollX;
		const scrollY = window.scrollY;

		// Create highlight box
		const highlight = document.createElement('div');
		highlight.className = 'contrast-highlight new';
		highlight.style.left = (rect.left + scrollX) + 'px';
		highlight.style.top = (rect.top + scrollY) + 'px';
		highlight.style.width = rect.width + 'px';
		highlight.style.height = rect.height + 'px';

		// Create tooltip
		const tooltip = document.createElement('div');
		const isNearTop = rect.top < 350; // Enough space for ~300px tooltip + buffer
		tooltip.className = `contrast-tooltip ${isNearTop ? 'position-bottom' : 'position-top'}`;
		tooltip.innerHTML = this.createTooltipContent(violations);
		highlight.appendChild(tooltip);

		// Premium interactions
		highlight.addEventListener('mouseenter', () => tooltip.classList.add('visible'));
		highlight.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
		
		// Click to pin/unpin maybe? For now just keep it simple but pretty.
		highlight.addEventListener('click', (e) => {
			e.stopPropagation();
			tooltip.classList.toggle('pinned');
		});

		this.overlayContainer.appendChild(highlight);
		this.highlightElements.push({
			highlight: highlight,
			element: element,
			violations: violations
		});
	},

	/**
	* Create tooltip content for one or more violations
	*/
	createTooltipContent(violations) {
		const isMultiple = violations.length > 1;
		const mainViolation = violations[0];
		
		let violationsHtml = violations.map((v, idx) => {
			const ratio = WCAGCalculator.formatRatio(v.contrastRatio);
			const required = v.compliance.requiredAA.toFixed(1);
			return `
				<div class="violation-item ${idx > 0 ? 'bordered' : ''}">
					<div class="tooltip-row">
						<strong>${v.isGradient ? '🎨 Gradient' : 'Issue ' + (idx + 1)}</strong>
						<span class="value fail">${ratio}</span>
					</div>
					<div class="tooltip-meta">Req: ${required}:1 | ${v.textColor} on ${v.backgroundColor}</div>
					<div class="tooltip-meta">Size: ${v.fontSize}px | Weight: ${v.fontWeight}</div>
				</div>
			`;
		}).join('');

		return `
			<div class="tooltip-header">
				<strong>${isMultiple ? '⚠️ Multiple Issues' : (mainViolation.isGradient ? '⚠️ Gradient Issue' : 'Contrast Violation')}</strong>
				<span class="issue-count">${violations.length}</span>
			</div>
			<div class="tooltip-body">
				${violationsHtml}
			</div>
			<div class="tooltip-footer">
				${mainViolation.text.substring(0, 50)}${mainViolation.text.length > 50 ? '...' : ''}
			</div>
		`;
	},

	/**
	* Clear all highlights
	*/
	clearHighlights() {
		this.highlightElements.forEach(item => {
			if (item.highlight && item.highlight.parentNode) {
				item.highlight.parentNode.removeChild(item.highlight);
			}
		});
		this.highlightElements = [];
	},

	hide() {
		if (this.overlayContainer) {
			this.overlayContainer.style.display = 'none';
			this.isVisible = false;
		}
	},

	show() {
		if (this.overlayContainer) {
			this.overlayContainer.style.display = 'block';
			this.isVisible = true;
		}
	},

	toggle() {
		this.isVisible ? this.hide() : this.show();
	},

	destroy() {
		this.clearHighlights();
		if (this.overlayContainer && this.overlayContainer.parentNode) {
			this.overlayContainer.parentNode.removeChild(this.overlayContainer);
		}
		this.overlayContainer = null;
		this.isVisible = false;
	},

	updatePositions() {
		this.highlightElements.forEach(item => {
			if (!document.body.contains(item.element)) {
				if (item.highlight.parentNode) item.highlight.parentNode.removeChild(item.highlight);
				return;
			}
			const rect = item.element.getBoundingClientRect();
			item.highlight.style.left = (rect.left + window.scrollX) + 'px';
			item.highlight.style.top = (rect.top + window.scrollY) + 'px';
			item.highlight.style.width = rect.width + 'px';
			item.highlight.style.height = rect.height + 'px';
		});
	}
};

let updateTimeout;
window.addEventListener('scroll', () => {
	clearTimeout(updateTimeout);
	updateTimeout = setTimeout(() => {
		if (ContrastOverlay.isVisible) ContrastOverlay.updatePositions();
	}, 100);
}, { passive: true });

window.addEventListener('resize', () => {
	clearTimeout(updateTimeout);
	updateTimeout = setTimeout(() => {
		if (ContrastOverlay.isVisible) ContrastOverlay.updatePositions();
	}, 100);
});

if (typeof window !== 'undefined') {
	window.ContrastOverlay = ContrastOverlay;
}