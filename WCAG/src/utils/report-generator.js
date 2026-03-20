// Report generation utilities
const ReportGenerator = {
	/**
	* Generate HTML report from violations
	*/
	generateHTML(violations, summary, url) {
		const date = new Date().toLocaleDateString();
		const time = new Date().toLocaleTimeString();
		
		return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Contrast Analysis Report - ${url}</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			background: #f5f5f5;
			padding: 20px;
		}
		.container { 
			max-width: 1200px; 
			margin: 0 auto; 
			background: white; 
			padding: 40px; 
			border-radius: 8px; 
		}
		h1 { color: #667eea; margin-bottom: 10px; }
		.meta { color: #666; margin-bottom: 30px; font-size: 14px; }
		.summary {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 20px;
			margin-bottom: 40px;
		}
		.summary-card {
			background: #f8f9fa;
			padding: 20px;
			border-radius: 6px;
			text-align: center;
			border: 2px solid #e0e0e0;
		}
		.summary-value { font-size: 36px; font-weight: 700; color: #667eea; margin-bottom: 5px; }
		.summary-label { font-size: 14px; color: #666; }
		.violations-list { list-style: none; }
		.violation-item {
			background: #fff;
			border: 2px solid #ff4444;
			border-radius: 6px;
			padding: 20px;
			margin-bottom: 20px;
		}
		.violation-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 15px;
			padding-bottom: 15px;
			border-bottom: 1px solid #eee;
		}
		.contrast-ratio {
			font-size: 24px;
			font-weight: 700;
			color: #ff4444;
		}
		.violation-details { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
		.detail-row { display: flex; justify-content: space-between; padding: 8px 0; }
		.detail-label { font-weight: 600; color: #666; }
		.detail-value { font-family: monospace; }
		.color-preview {
			display: flex;
			gap: 10px;
			align-items: center;
			margin-top: 15px;
		}
		.color-swatch {
			width: 40px;
			height: 40px;
			border-radius: 4px;
			border: 2px solid #333;
			display: inline-block;
		}
		.violation-text {
			background: #f8f9fa;
			padding: 15px;
			border-radius: 4px;
			margin-top: 15px;
			font-size: 14px;
			color: #555;
		}
		.badge {
			display: inline-block;
			padding: 4px 12px;
			border-radius: 12px;
			font-size: 12px;
			font-weight: 600;
		}
		.badge-fail { background: #ffebee; color: #c62828; }
		.badge-large { background: #e8f5e9; color: #2e7d32; }
	</style>
</head>
<body>
	<div class="container">
		<h1>Contrast Analysis Report</h1>
		<div class="meta">
			<div><strong>URL:</strong> ${url}</div>
			<div><strong>Date:</strong> ${date} at ${time}</div>
		</div>
		
		<div class="summary">
			<div class="summary-card">
				<div class="summary-value">${summary.total}</div>
				<div class="summary-label">Total Violations</div>
			</div>
			<div class="summary-card">
				<div class="summary-value">${summary.byLevel.failsAA}</div>
				<div class="summary-label">Fails WCAG AA</div>
			</div>
			<div class="summary-card">
				<div class="summary-value">${summary.byLevel.failsAAA}</div>
				<div class="summary-label">Fails WCAG AAA</div>
			</div>
		</div>
		
		<h2>Violations</h2>
		<ul class="violations-list">
			${violations.map((v, i) => this.generateViolationHTML(v, i + 1)).join('')}
		</ul>
	</div>
</body>
</html>
		`;
	},
	
	/**
	* Generate HTML for single violation
	*/
	generateViolationHTML(violation, index) {
		return `
<li class="violation-item">
	<div class="violation-header">
		<div>
			<strong>Violation #${index}</strong>
			${violation.compliance.isLargeText ? '<span class="badge badge-large">Large Text</span>' : ''}
		</div>
		<div class="contrast-ratio">${violation.contrastRatio.toFixed(2)}:1</div>
	</div>
	<div class="violation-details">
		<div>
			<div class="detail-row">
				<span class="detail-label">Required (AA):</span>
				<span class="detail-value">${violation.compliance.requiredAA}:1</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Required (AAA):</span>
				<span class="detail-value">${violation.compliance.requiredAAA}:1</span>
			</div>
		</div>
		<div>
			<div class="detail-row">
				<span class="detail-label">Text Color:</span>
				<span class="detail-value">${violation.textColor}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Background:</span>
				<span class="detail-value">${violation.backgroundColor}</span>
			</div>
		</div>
	</div>
	<div class="color-preview">
		<span class="color-swatch" style="background-color: ${violation.textColor}"></span>
		<span class="color-swatch" style="background-color: ${violation.backgroundColor}"></span>
	</div>
	<div class="violation-text">
		<strong>Text:</strong> ${violation.text}
	</div>
	<div class="detail-row" style="margin-top: 10px; font-size: 12px; color: #999;">
		<span class="detail-label">Selector:</span>
		<span class="detail-value">${violation.selector}</span>
	</div>
</li>
		`;
	},
	
	/**
	* Generate CSV report
	*/
	generateCSV(violations) {
		const headers = [
			'Index',
			'Text',
			'Contrast Ratio',
			'Text Color',
			'Background Color',
			'WCAG AA',
			'WCAG AAA',
			'Required AA',
			'Required AAA',
			'Is Large Text',
			'Selector'
		];
		
		const rows = violations.map((v, i) => [
			i + 1,
			`"${v.text.replace(/"/g, '""')}"`,
			v.contrastRatio.toFixed(2),
			v.textColor,
			v.backgroundColor,
			v.compliance.wcagAA ? 'Pass' : 'Fail',
			v.compliance.wcagAAA ? 'Pass' : 'Fail',
			v.compliance.requiredAA,
			v.compliance.requiredAAA,
			v.compliance.isLargeText ? 'Yes' : 'No',
			`"${v.selector.replace(/"/g, '""')}"`
		]);
		
		return [headers, ...rows].map(row => row.join(',')).join('\n');
	}
};

// Make available globally
if (typeof window !== 'undefined') {
	window.ReportGenerator = ReportGenerator;
}