// Visual overlay for highlighting contrast violations
const ContrastOverlay = {
	overlayContainer: null,
	highlightElements: [],
	isVisible: false,

	/**
	* Initialize the overlay system
	*/
	init() {
		if (this.overlayContainer) {
			return; // Already initialized
		}
		// Create overlay container
		this.overlayContainer = document.createElement('div');
		this.overlayContainer.id = 'contrast-checker-overlay';
		this.overlayContainer.className = 'contrast-overlay-container';
		document.body.appendChild(this.overlayContainer);
	},

	/**
	* Show violations on page
	*/
	showViolations(violations) {
		this.init();
		this.clearHighlights();
		console.log(`Showing ${violations.length} violations`);

		for (const violation of violations) {
			this.highlightElement(violation);
		}

		this.isVisible = true;
		this.overlayContainer.style.display = 'block';
	},

	/**
	* Highlight a single violation
	*/
	highlightElement(violation) {
		const element = violation.element;
		if (!element || !document.body.contains(element)) {
			return;
		}

		const rect = element.getBoundingClientRect();
		const scrollX = window.scrollX;
		const scrollY = window.scrollY;

		// Create highlight box
		const highlight = document.createElement('div');
		highlight.className = 'contrast-highlight';
		highlight.style.position = 'absolute';
		highlight.style.left = (rect.left + scrollX) + 'px';
		highlight.style.top = (rect.top + scrollY) + 'px';
		highlight.style.width = rect.width + 'px';
		highlight.style.height = rect.height + 'px';

		// Create tooltip
		const tooltip = document.createElement('div');
		tooltip.className = 'contrast-tooltip';
		tooltip.innerHTML = this.createTooltipContent(violation);
		highlight.appendChild(tooltip);

		// Click to show/hide tooltip
		highlight.addEventListener('click', (e) => {
			e.stopPropagation();
			tooltip.classList.toggle('visible');
		});

		this.overlayContainer.appendChild(highlight);
		this.highlightElements.push({
			highlight: highlight,
			element: element,
			violation: violation
		});
	},

	/**
	* Create tooltip content
	*/
	createTooltipContent(violation) {
		const ratio = WCAGCalculator.formatRatio(violation.contrastRatio);
		const required = violation.compliance.requiredAA.toFixed(1);

		let gradientNote = '';
		if (violation.isGradient && violation.gradientDetails) {
			const details = violation.gradientDetails;
			gradientNote = `
	<div class="tooltip-row" style="border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;">
		<strong style="width: 100%;">🎨 Gradient Info</strong>
	</div>
	<div class="tooltip-row">
		<span>Total Combinations:</span>
		<span class="value">${details.totalColors || '?'}</span>
	</div>
	<div class="tooltip-row">
		<span>AA Passed:</span>
		<span class="value" style="color: #4CAF50;">${details.passCountAA !== undefined ? details.passCountAA : '?'} / ${details.totalColors}</span>
	</div>
	<div class="tooltip-row">
		<span>AAA Passed:</span>
		<span class="value" style="color: #2E7D32;">${details.passCountAAA !== undefined ? details.passCountAAA : '?'} / ${details.totalColors}</span>
	</div>
	<div class="tooltip-row">
		<span>Failing Combinations:</span>
		<span class="value" style="color: #F44336;">${details.failCount !== undefined ? details.failCount : '?'}</span>
	</div>
	<div class="tooltip-row" style="font-size: 11px; color: #666;">
		<em>${details.note || 'Gradient analysis details unavailable'}</em>
	</div>
			`;
		}

		return `
<div class="tooltip-header">
	<strong>${violation.isGradient ? '⚠️ Gradient Contrast Issue' : 'Contrast Violation'}</strong>
</div>
<div class="tooltip-body">
	<div class="tooltip-row">
		<span>Contrast:</span>
		<span class="value fail">${ratio}</span>
	</div>
	<div class="tooltip-row">
		<span>Required:</span>
		<span class="value">${required}:1</span>
	</div>
	<div class="tooltip-row">
		<span>Text:</span>
		<span class="value">${violation.textColor}</span>
	</div>
	<div class="tooltip-row">
		<span>Background:</span>
		<span class="value">${violation.backgroundColor}</span>
	</div>
	${violation.compliance.isLargeText ? '<div class="large-text-badge">Large Text</div>' : ''}
	${gradientNote}
</div>
<div class="tooltip-text">${violation.text}</div>
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

	/**
	* Hide overlay
	*/
	hide() {
		if (this.overlayContainer) {
			this.overlayContainer.style.display = 'none';
			this.isVisible = false;
		}
	},

	/**
	* Show overlay
	*/
	show() {
		if (this.overlayContainer) {
			this.overlayContainer.style.display = 'block';
			this.isVisible = true;
		}
	},

	/**
	* Toggle overlay visibility
	*/
	toggle() {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	},

	/**
	* Remove overlay completely
	*/
	destroy() {
		this.clearHighlights();
		if (this.overlayContainer && this.overlayContainer.parentNode) {
			this.overlayContainer.parentNode.removeChild(this.overlayContainer);
		}
		this.overlayContainer = null;
		this.isVisible = false;
	},

	/**
	* Update highlights on scroll/resize
	*/
	updatePositions() {
		this.highlightElements.forEach(item => {
			if (!document.body.contains(item.element)) {
				// Element removed from DOM
				if (item.highlight.parentNode) {
					item.highlight.parentNode.removeChild(item.highlight);
				}
				return;
			}

			const rect = item.element.getBoundingClientRect();
			const scrollX = window.scrollX;
			const scrollY = window.scrollY;

			item.highlight.style.left = (rect.left + scrollX) + 'px';
			item.highlight.style.top = (rect.top + scrollY) + 'px';
			item.highlight.style.width = rect.width + 'px';
			item.highlight.style.height = rect.height + 'px';
		});
	}
};

// Update positions on scroll and resize
// FIXED: Declare updateTimeout variable
let updateTimeout;

window.addEventListener('scroll', () => {
	clearTimeout(updateTimeout);
	updateTimeout = setTimeout(() => {
		if (ContrastOverlay.isVisible) {
			ContrastOverlay.updatePositions();
		}
	}, 100);
}, { passive: true });

window.addEventListener('resize', () => {
	clearTimeout(updateTimeout);
	updateTimeout = setTimeout(() => {
		if (ContrastOverlay.isVisible) {
			ContrastOverlay.updatePositions();
		}
	}, 100);
});

// Make available globally for content scripts
if (typeof window !== 'undefined') {
	window.ContrastOverlay = ContrastOverlay;
}