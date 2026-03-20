// Ultimate Contrast Checker - FULL FEATURED VERSION
document.addEventListener('DOMContentLoaded', function () {

  // START: Fresh Screen / Reset State Logic
  // (Moved to global scope to fix navigation bug)
  // END: Reset State Logic

  console.log('🚀 Popup loaded');

  // Listen for async messages from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'contentAnalysisComplete') {
      console.log('📨 Sidepanel received contentAnalysisComplete:', request.data);
      if (request.data.loremIpsum) {
        displayLoremOnly(request.data.loremIpsum);

        // Also reset button state if needed
        const btn = document.getElementById('runLoremAuditBtn');
        if (btn) {
          btn.innerHTML = '<span class="btn-icon">▶️</span> Scan for Lorem Ipsum';
          btn.disabled = false;
        }
        const resultsArea = document.getElementById('loremResultsOnly');
        if (resultsArea) resultsArea.style.display = 'block';
      }
      // Can add handlers for layout/duplicates here too if needed
    }
  });

  // Listen for storage changes as fallback (Robustness Fix)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.latestAnalysis) {
      const data = changes.latestAnalysis.newValue;
      if (data && data.timestamp && (Date.now() - data.timestamp < 5000)) { // Only react to fresh updates (< 5s)
        console.log('💾 Storage update received:', data);

        if (data.loremIpsum) {
          displayLoremOnly(data.loremIpsum);

          // Also reset button state
          const btn = document.getElementById('runLoremAuditBtn');
          if (btn) {
            btn.innerHTML = '<span class="btn-icon">▶️</span> Scan for Lorem Ipsum';
            btn.disabled = false;
          }
          const resultsArea = document.getElementById('loremResultsOnly');
          if (resultsArea) resultsArea.style.display = 'block';
        }
      }
    }
  });

  // ========== TAB SWITCHING ==========
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const feature = btn.dataset.feature; // Use feature data attribute
      navigateToFeature(feature);
    });
  });

  // ========== TAB 1: ANALYZE ==========
  const analyzeBtn = document.getElementById('analyzeBtn');
  const toggleBtn = document.getElementById('toggleBtn');
  const exportBtn = document.getElementById('exportBtn');
  const pageScreenshotBtn = document.getElementById('pageScreenshotBtn');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const resultsSection = document.getElementById('resultsSection');
  const secondaryActions = document.getElementById('secondaryActions');

  let isAnalyzing = false;

  // ========== SCREENSHOT & CONTENT CHECKER ==========
  const screenshotVisibleBtn = document.getElementById('screenshotVisibleBtn');
  const screenshotFullBtn = document.getElementById('screenshotFullBtn');
  const screenshotAreaBtn = document.getElementById('screenshotAreaBtn');
  const checkContentBtn = document.getElementById('checkContentBtn');
  const clearContentBtn = document.getElementById('clearContentBtn');
  const contentInput = document.getElementById('contentInput');

  if (screenshotVisibleBtn) screenshotVisibleBtn.addEventListener('click', handleVisibleScreenshot);
  if (screenshotFullBtn) screenshotFullBtn.addEventListener('click', handleFullPageScreenshot);
  if (screenshotAreaBtn) screenshotAreaBtn.addEventListener('click', handleAreaScreenshot);
  if (checkContentBtn) checkContentBtn.addEventListener('click', handleContentCheck);

  // State for Content Checker
  let contentCheckFiles = [];

  if (clearContentBtn) {
    clearContentBtn.addEventListener('click', () => {
      if (contentInput) contentInput.value = '';
      const fileInput = document.getElementById('contentFileUpload');
      if (fileInput) fileInput.value = '';

      // Clear file list state
      contentCheckFiles = [];
      renderContentFileList();

      document.getElementById('contentResults').style.display = 'none';
    });
  }

  const contentFileUpload = document.getElementById('contentFileUpload');
  const contentFileList = document.getElementById('contentFileList');

  if (contentFileUpload) {
    contentFileUpload.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      // Add new files to our list
      contentCheckFiles = [...contentCheckFiles, ...files];
      renderContentFileList();

      // Clear input so same file can be selected again if needed
      contentFileUpload.value = '';
    });
  }

  function renderContentFileList() {
    if (!contentFileList) return;

    if (contentCheckFiles.length === 0) {
      contentFileList.style.display = 'none';
      contentFileList.innerHTML = '';
      return;
    }

    contentFileList.style.display = 'flex';
    contentFileList.innerHTML = '';
    contentFileList.style.flexDirection = 'column';
    contentFileList.style.gap = '8px';

    contentCheckFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.style.padding = '8px 12px';
      item.style.alignItems = 'center';

      // File Info
      const info = document.createElement('div');
      info.className = 'result-content';
      info.innerHTML = `
        <div class="result-msg" style="font-size:12px;">${file.name}</div>
        <div class="result-detail" style="font-size:10px;">${(file.size / 1024).toFixed(1)} KB</div>
      `;

      // Check Button
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.style.padding = '4px 8px';
      btn.style.fontSize = '11px';
      btn.innerHTML = 'Check';
      btn.addEventListener('click', () => loadAndCheckFile(file));

      // Remove Button
      const removeBtn = document.createElement('button');
      removeBtn.innerHTML = '×';
      removeBtn.style.background = 'none';
      removeBtn.style.border = 'none';
      removeBtn.style.color = 'var(--text-muted)';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.fontSize = '16px';
      removeBtn.style.marginLeft = '8px';
      removeBtn.style.padding = '0 4px';
      removeBtn.addEventListener('click', () => {
        contentCheckFiles.splice(index, 1);
        renderContentFileList();
      });

      item.appendChild(info);
      item.appendChild(btn);
      item.appendChild(removeBtn);
      contentFileList.appendChild(item);
    });
  }

  function loadAndCheckFile(file) {
    // Show loading state or feedback
    contentInput.value = "Loading " + file.name + "...";

    if (file.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = function (event) {
        if (window.mammoth) {
          mammoth.extractRawText({ arrayBuffer: event.target.result })
            .then(function (result) {
              contentInput.value = result.value;
              handleContentCheck();
            })
            .catch(function (err) {
              console.error(err);
              alert('Error reading DOCX');
              contentInput.value = "";
            });
        } else { alert('Mammoth not loaded'); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = function (event) {
        contentInput.value = event.target.result;
        handleContentCheck();
      };
      reader.readAsText(file);
    }
  }

  // Screenshot Functions
  async function handleVisibleScreenshot() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      downloadImage(dataUrl, 'visible-screenshot.png');
    } catch (err) {
      console.error('Screenshot error:', err);
    }
  }

  async function handleFullPageScreenshot() {
    // Reuse existing function or simple wrapper
    captureScreenshot();
  }

  function handleAreaScreenshot() {
    chrome.runtime.sendMessage({ action: 'initiateAreaScreenshot' });
    // Side panel stays open!
  }

  // Content Checker Logic
  async function handleContentCheck() {
    console.log('🔍 handleContentCheck triggered');
    const text = contentInput.value.trim();
    if (!text) {
      console.warn('⚠️ No text content to check');
      alert('Please enter text or upload a file');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'getPageText' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        alert('Could not get page text'); return;
      }
      // Parse Input into Lines (Strict Matching)
      const sourceLines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const totalLines = sourceLines.length;

      // We will rely on content script to return match stats (async) or just show "Analysis Sent"
      // For now, let's reset the results to a "Processing" state or rely on the visual feedback.
      // BUT, to keep the UI useful, we can do a quick comprehensive check here ONLY for stats.
      // However, exact match stats on just text content (without DOM context) are inaccurate.
      // Let's simplified: Pass lines to content script.

      document.getElementById('contentResults').style.display = 'block';
      document.getElementById('contentMatchPercent').textContent = '...';
      document.getElementById('contentMissingCount').textContent = totalLines + ' Lines Checked';
      document.getElementById('contentResultDetails').innerHTML = '<div style="color:var(--text-muted)">Check page for Highlights...</div>';

      // Trigger Visual Diff on Page with Lines
      chrome.tabs.sendMessage(tab.id, {
        action: 'highlightContentDiff',
        sourceLines: sourceLines
      });
    });
  }

  function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }


  if (analyzeBtn) analyzeBtn.addEventListener('click', analyzePage);
  if (toggleBtn) toggleBtn.addEventListener('click', toggleHighlights);
  if (exportBtn) exportBtn.addEventListener('click', exportReport);
  if (pageScreenshotBtn) {
    pageScreenshotBtn.addEventListener('click', captureScreenshot);
  }

  async function analyzePage() {
    if (isAnalyzing) {
      console.log('⚠️ Already analyzing...');
      return;
    }

    try {
      isAnalyzing = true;
      console.log('🔍 Starting analysis...');

      setStatus('analyzing', 'Analyzing page...');
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = '⏳ Analyzing...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error('No active tab found');
      }

      // Check for restricted URLs
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
        setStatus('error', 'Cannot analyze system pages. Please navigate to a valid website.');
        resetAnalyzeButton();
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'analyze' }, (response) => {
        console.log('📩 Response received:', response);

        if (chrome.runtime.lastError) {
          console.error('❌ Error:', chrome.runtime.lastError.message);
          let errorMsg = chrome.runtime.lastError.message;
          if (errorMsg.includes('Could not establish connection') || errorMsg.includes('Receiving end does not exist')) {
            errorMsg = 'Connection failed. Please refresh the page and try again.';
          }
          setStatus('error', errorMsg);
          resetAnalyzeButton();
          return;
        }

        if (response && response.success) {
          console.log('✅ Analysis successful!');
          displayResults(response);
          setStatus('ready', `Found ${response.violations.length} violations`);
        } else {
          console.error('❌ Analysis failed:', response?.error);
          setStatus('error', response?.error || 'Analysis failed');
        }

        resetAnalyzeButton();
      });
    } catch (error) {
      console.error('❌ Error:', error);
      setStatus('error', 'Error: ' + error.message);
      resetAnalyzeButton();
    }
  }

  function resetAnalyzeButton() {
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<span class="btn-icon">🔍</span>Analyze Page';
  }

  function displayResults(response) {
    const { violations, summary } = response;

    console.log('📊 Displaying results:', summary);

    resultsSection.style.display = 'block';
    secondaryActions.style.display = 'block';

    document.getElementById('totalViolations').textContent = violations ? violations.length : 0;

    const criticalCount = summary.byCategory ?
      Object.values(summary.byCategory).reduce((sum, val) => sum + val, 0) : 0;
    document.getElementById('criticalCount').textContent =
      Math.min(criticalCount, violations ? violations.length : 0);

    const categories = summary.byCategory || {
      text: 0,
      button: 0,
      gradient: 0
    };

    console.log('📂 Categories:', categories);

    document.getElementById('textCount').textContent = categories.text || 0;
    document.getElementById('buttonCount').textContent = categories.button || 0;
    document.getElementById('gradientCount').textContent = categories.gradient || 0;

    if (summary.worstContrast) {
      const worstCase = document.getElementById('worstCase');
      worstCase.style.display = 'block';

      document.getElementById('worstRatioDisplay').textContent =
        summary.worstContrast.contrastRatio.toFixed(2) + ':1';
      document.getElementById('worstTextColor').style.backgroundColor =
        summary.worstContrast.textColor;
      document.getElementById('worstBgColor').style.backgroundColor =
        summary.worstContrast.backgroundColor;
    }
  }

  async function toggleHighlights() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: 'toggleViolations' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }
        if (response && response.success) {
          const icon = response.visible ? '🙈' : '👁️';
          const text = response.visible ? 'Hide' : 'Show';
          toggleBtn.innerHTML = `<span class="btn-icon">${icon}</span>${text} Highlights`;
        }
      });
    } catch (error) {
      console.error('Toggle error:', error);
    }
  }



  async function exportReport() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: 'exportReport' }, (response) => {
        if (response && response.success) {
          downloadJSON(response.report, 'contrast-report.json');
        }
      });
    } catch (error) {
      console.error('Export error:', error);
    }
  }

  async function captureScreenshot() {
    try {
      if (pageScreenshotBtn) {
        pageScreenshotBtn.disabled = true;
        pageScreenshotBtn.textContent = '📸 Capturing (Scrolling)...';
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Send message to background/content to help or just do it here via scripting
      // For full page with scrolling, we need to execute a script

      // 1. Get dimensions
      const dimensions = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return {
            width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, document.body.clientWidth),
            height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, document.body.clientHeight),
            windowHeight: window.innerHeight
          };
        }
      });

      const { width, height, windowHeight } = dimensions[0].result;

      // 2. Setup Canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      let currentScroll = 0;

      while (currentScroll < height) {
        // Scroll to position
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (y) => window.scrollTo(0, y),
          args: [currentScroll]
        });

        // Wait for render
        await new Promise(r => setTimeout(r, 400));

        // Capture
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

        // Draw to canvas
        const img = new Image();
        img.onload = () => {
          // Calculate where to draw
          // We need to account for the fact that the last scroll might wrap
          // For MVP we just draw at currentScroll
        };
        await new Promise(r => {
          img.onload = r;
          img.src = dataUrl;
        });

        // Don't draw past height
        const drawHeight = Math.min(windowHeight, height - currentScroll);
        // sourceY is usually 0 unless we are at bottom and doing partial?
        // simple approach: draw the full window capture at the scroll offset
        // but carefully clip if we are at bottom?
        // Easiest: just draw.

        ctx.drawImage(img, 0, currentScroll);

        currentScroll += windowHeight;
      }

      // Restore scroll
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo(0, 0)
      });

      // Download
      const finalUrl = canvas.toDataURL('image/png');
      chrome.downloads.download({
        url: finalUrl,
        filename: `screenshot-${Date.now()}.png`
      });

      if (pageScreenshotBtn) {
        pageScreenshotBtn.disabled = false;
        pageScreenshotBtn.textContent = '📸 Take Full Page Screenshot';
      }
      setStatus('ready', 'Screenshot downloaded!');

    } catch (error) {
      console.error('Screenshot error:', error);
      if (pageScreenshotBtn) {
        pageScreenshotBtn.disabled = false;
        pageScreenshotBtn.textContent = '📸 Capture Failed';
      }
      setStatus('error', 'Screenshot failed: ' + error.message);
    }
  }

  function setStatus(type, message) {
    statusBadge.className = `status-badge ${type}`;
    statusText.textContent = message;
  }
});

// ========== TAB 2: MANUAL CHECKER ==========
function initializeManualChecker() {
  const textColorPicker = document.getElementById('textColorPicker');
  const bgColorPicker = document.getElementById('bgColorPicker');
  const textColor = document.getElementById('textColor');
  const bgColor = document.getElementById('bgColor');
  const textPreview = document.getElementById('textPreview');
  const bgPreview = document.getElementById('bgPreview');
  const checkContrastBtn = document.getElementById('checkContrastBtn');
  const manualResults = document.getElementById('manualResults');

  textColorPicker.addEventListener('input', (e) => {
    textColor.value = e.target.value;
    textPreview.style.backgroundColor = e.target.value;
  });

  bgColorPicker.addEventListener('input', (e) => {
    bgColor.value = e.target.value;
    bgPreview.style.backgroundColor = e.target.value;
  });

  textColor.addEventListener('input', (e) => {
    if (isValidHex(e.target.value)) {
      textColorPicker.value = e.target.value;
      textPreview.style.backgroundColor = e.target.value;
    }
  });

  bgColor.addEventListener('input', (e) => {
    if (isValidHex(e.target.value)) {
      bgColorPicker.value = e.target.value;
      bgPreview.style.backgroundColor = e.target.value;
    }
  });

  checkContrastBtn.addEventListener('click', checkManualContrast);

  textPreview.style.backgroundColor = '#000000';
  bgPreview.style.backgroundColor = '#ffffff';

  function checkManualContrast() {
    const text = textColor.value;
    const bg = bgColor.value;

    if (!isValidHex(text) || !isValidHex(bg)) {
      alert('Please enter valid hex colors (e.g., #000000)');
      return;
    }

    const textRgb = hexToRgb(text);
    const bgRgb = hexToRgb(bg);
    const ratio = calculateContrast(textRgb, bgRgb);

    manualResults.style.display = 'block';
    document.getElementById('manualRatio').textContent = ratio.toFixed(2) + ':1';

    updateCompliance('normalAA', ratio >= 4.5);
    updateCompliance('normalAAA', ratio >= 7);
    updateCompliance('largeAA', ratio >= 3);
    updateCompliance('largeAAA', ratio >= 4.5);

    document.getElementById('sampleNormal').style.color = text;
    document.getElementById('sampleNormal').style.backgroundColor = bg;
    document.getElementById('sampleLarge').style.color = text;
    document.getElementById('sampleLarge').style.backgroundColor = bg;
  }

  function updateCompliance(id, passes) {
    const box = document.getElementById(id);
    const icon = box.querySelector('.compliance-icon');

    if (passes) {
      box.classList.add('pass');
      box.classList.remove('fail');
      icon.textContent = 'Pass';
      icon.style.fontSize = '11px'; // Adjust for text
    } else {
      box.classList.add('fail');
      box.classList.remove('pass');
      icon.textContent = 'Fail';
      icon.style.fontSize = '11px'; // Adjust for text
    }
  }
}

// ========== TAB 3: ADVANCED THEME GENERATOR ==========
function initializeThemeGenerator() {
  const brandColors = [];
  const generateThemeBtn = document.getElementById('generateThemeBtn');
  const themeResults = document.getElementById('themeResults');
  const paletteDisplay = document.getElementById('paletteDisplay');
  const primaryButtonPreview = document.getElementById('primaryButtonPreview');
  const secondaryButtonPreview = document.getElementById('secondaryButtonPreview');
  const primarySpecs = document.getElementById('primarySpecs');
  const secondarySpecs = document.getElementById('secondarySpecs');
  const exportThemeBtn = document.getElementById('exportThemeBtn');

  const brandColorPicker = document.getElementById('brandColorPicker');
  const brandColor = document.getElementById('brandColor');

  brandColorPicker.addEventListener('input', (e) => {
    brandColor.value = e.target.value;
  });

  brandColor.addEventListener('input', (e) => {
    if (isValidHex(e.target.value)) {
      brandColorPicker.value = e.target.value;
    }
  });

  // Setup brand color management
  const themeInputs = document.querySelector('.theme-inputs');

  // Remove color count selector
  const colorCountGroup = document.querySelector('.input-group:has(#colorCount)');
  if (colorCountGroup) colorCountGroup.remove();

  const addBrandBtn = document.createElement('button');
  addBrandBtn.className = 'btn btn-secondary';
  addBrandBtn.style.marginTop = '16px';
  addBrandBtn.style.width = '100%';
  addBrandBtn.innerHTML = '<span class="btn-icon">➕</span>Add Brand Color';
  addBrandBtn.onclick = addBrandColor;
  themeInputs.appendChild(addBrandBtn);

  const brandColorsList = document.createElement('div');
  brandColorsList.id = 'brandColorsList';
  brandColorsList.style.cssText = 'margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px; min-height: 40px;';
  themeInputs.appendChild(brandColorsList);

  function addBrandColor() {
    const color = brandColor.value.toUpperCase();
    if (!isValidHex(color)) {
      alert('Please enter a valid brand color');
      return;
    }

    if (brandColors.includes(color)) {
      alert('This color is already added');
      return;
    }

    if (brandColors.length >= 3) {
      alert('Maximum 3 brand colors allowed');
      return;
    }

    brandColors.push(color);
    renderBrandColorChips();
  }

  function removeBrandColor(color) {
    const index = brandColors.indexOf(color);
    if (index > -1) {
      brandColors.splice(index, 1);
      renderBrandColorChips();
    }
  }

  function renderBrandColorChips() {
    const container = document.getElementById('brandColorsList');
    container.innerHTML = '';

    brandColors.forEach(color => {
      const chip = document.createElement('div');
      const textColor = getLuminance(...Object.values(hexToRgb(color))) > 0.5 ? '#000' : '#fff';

      chip.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: ${color};
        color: ${textColor};
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;

      chip.innerHTML = `
        ${color}
        <span style="cursor: pointer; margin-left: 4px; font-size: 16px;" data-color="${color}">×</span>
      `;

      chip.querySelector('span').addEventListener('click', () => removeBrandColor(color));
      container.appendChild(chip);
    });
  }

  generateThemeBtn.addEventListener('click', generateTheme);
  exportThemeBtn.addEventListener('click', exportTheme);

  function generateTheme() {
    if (brandColors.length === 0) {
      alert('Please add at least one brand color');
      return;
    }

    console.log('🎨 Generating theme with:', brandColors);

    // Generate complete palette
    const palette = createAdvancedPalette(brandColors);

    // Display palette as grid
    paletteDisplay.innerHTML = '';
    palette.forEach(color => {
      const item = document.createElement('div');
      item.className = 'palette-item';

      const rgb = hexToRgb(color.hex);
      const contrastWithWhite = calculateContrast(rgb, { r: 255, g: 255, b: 255 });
      const textColor = contrastWithWhite >= 4.5 ? '#FFFFFF' : '#000000';

      item.style.backgroundColor = color.hex;
      item.style.color = textColor;

      item.innerHTML = `
        <div class="palette-swatch-info">
            <span class="palette-name">${color.name}</span>
            <span class="palette-hex">${color.hex}</span>
        </div>
      `;
      paletteDisplay.appendChild(item);
    });

    // Generate advanced button designs
    const buttons = generateAdvancedButtons(brandColors[0]);

    // Update Primary Preview
    primaryButtonPreview.style.background = buttons.primary.bg;
    primaryButtonPreview.style.color = buttons.primary.text;
    primaryButtonPreview.style.border = 'none';

    // Update Secondary Preview
    secondaryButtonPreview.style.background = buttons.secondary.bg;
    secondaryButtonPreview.style.color = buttons.secondary.text;
    secondaryButtonPreview.style.border = `2px solid ${buttons.secondary.border}`;

    // Render Clean Specs
    const renderSpecs = (btnData, type) => {
      const isPass = btnData.ratio >= 4.5;
      return `
            <div class="spec-row">
                <span class="spec-label">Background</span>
                <span class="spec-value">
                    <span class="color-dot" style="background: ${btnData.bg}"></span>${btnData.bg}
                </span>
            </div>
            <div class="spec-row">
                <span class="spec-label">Text</span>
                <span class="spec-value">
                    <span class="color-dot" style="background: ${btnData.text}"></span>${btnData.text}
                </span>
            </div>
            ${type === 'secondary' ? `
            <div class="spec-row">
                <span class="spec-label">Border</span>
                <span class="spec-value">
                    <span class="color-dot" style="background: ${btnData.border}"></span>${btnData.border}
                </span>
            </div>` : ''}
            <div class="spec-row">
                <span class="spec-label">Contrast</span>
                <span class="spec-value contrast-badge ${isPass ? 'pass' : 'fail'}">
                    ${btnData.ratio.toFixed(2)}:1 ${isPass ? 'AA' : 'Fail'}
                </span>
            </div>
            <div class="spec-row">
                <span class="spec-label">Hover</span>
                <span class="spec-value">
                    <span class="color-dot" style="background: ${type === 'primary' ? btnData.hover : btnData.hoverBg}"></span>
                    ${type === 'primary' ? btnData.hover : btnData.hoverBg}
                </span>
            </div>
        `;
    };

    primarySpecs.innerHTML = renderSpecs(buttons.primary, 'primary');
    secondarySpecs.innerHTML = renderSpecs(buttons.secondary, 'secondary');

    themeResults.style.display = 'block';
  }

  /**
   * CREATE ADVANCED PALETTE
   * Format: Black, White, Grey + All Brand Colors + Hover variants
   */
  function createAdvancedPalette(brands) {
    const palette = [];

    // Core neutrals
    palette.push({ name: 'Black', hex: '#000000', role: 'text' });
    palette.push({ name: 'White', hex: '#FFFFFF', role: 'background' });
    palette.push({ name: 'Light Grey', hex: '#F5F5F5', role: 'surface' });

    // Add all brand colors
    brands.forEach((brand, i) => {
      palette.push({
        name: `Brand ${i + 1}`,
        hex: brand,
        role: i === 0 ? 'primary' : 'accent'
      });
    });

    // Generate hover colors for PRIMARY brand
    const primaryBrand = brands[0];
    const primaryHsl = rgbToHsl(...Object.values(hexToRgb(primaryBrand)));

    // Dark hover (darken by 10%)
    const darkHoverHsl = {
      h: primaryHsl.h,
      s: Math.min(1, primaryHsl.s + 0.05),
      l: Math.max(0.15, primaryHsl.l - 0.1)
    };
    const darkHover = rgbToHex(hslToRgb(darkHoverHsl.h, darkHoverHsl.s, darkHoverHsl.l));
    palette.push({ name: 'Primary Hover', hex: darkHover, role: 'hover-dark' });

    // Light hover (for outline buttons)
    const lightHoverHsl = {
      h: primaryHsl.h,
      s: Math.max(0.3, primaryHsl.s - 0.3),
      l: Math.min(0.95, primaryHsl.l + 0.4)
    };
    const lightHover = rgbToHex(hslToRgb(lightHoverHsl.h, lightHoverHsl.s, lightHoverHsl.l));
    palette.push({ name: 'Secondary Hover', hex: lightHover, role: 'hover-light' });

    return palette;
  }

  /**
   * GENERATE ADVANCED BUTTON DESIGNS
   * Primary: Solid with hover effect
   * Secondary: Outline with hover fill
   */
  function generateAdvancedButtons(brandHex) {
    const brandRgb = hexToRgb(brandHex);
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };

    // === PRIMARY BUTTON (Solid) ===
    const contrastWithWhite = calculateContrast(brandRgb, white);
    const contrastWithBlack = calculateContrast(brandRgb, black);

    const primaryText = contrastWithWhite >= 4.5 ? '#FFFFFF' : '#000000';
    const primaryRatio = contrastWithWhite >= 4.5 ? contrastWithWhite : contrastWithBlack;

    // Hover: Darken by 10%
    const brandHsl = rgbToHsl(brandRgb.r, brandRgb.g, brandRgb.b);
    const hoverHsl = {
      h: brandHsl.h,
      s: Math.min(1, brandHsl.s + 0.05),
      l: Math.max(0.15, brandHsl.l - 0.1)
    };
    const hoverRgb = hslToRgb(hoverHsl.h, hoverHsl.s, hoverHsl.l);
    const hoverHex = rgbToHex(hoverRgb);

    // === SECONDARY BUTTON (Outline) ===
    // Background: transparent/white
    // Text & Border: brand color (or darker version if brand fails contrast)

    let secondaryText = brandHex;
    let secondaryRatio = calculateContrast(brandRgb, white);
    let adjustedHsl = { ...brandHsl };

    // Smart Fix: If contrast < 4.5, darken the color until it passes
    if (secondaryRatio < 4.5) {
      let safety = 0;
      while (secondaryRatio < 4.5 && safety < 20) {
        adjustedHsl.l = Math.max(0, adjustedHsl.l - 0.05); // Darken by 5%
        const newRgb = hslToRgb(adjustedHsl.h, adjustedHsl.s, adjustedHsl.l);
        secondaryText = rgbToHex(newRgb);
        secondaryRatio = calculateContrast(newRgb, white);
        safety++;
      }
      console.log(`🔧 Smart adjusted secondary color from ${brandHex} to ${secondaryText} (Ratio: ${secondaryRatio.toFixed(2)})`);
    }

    const secondaryBg = '#FFFFFF';
    const secondaryBorder = secondaryText; // Match text for outline style

    // Hover: Light tint of brand color
    const secHoverHsl = {
      h: brandHsl.h,
      s: Math.max(0.3, brandHsl.s - 0.3),
      l: Math.min(0.95, brandHsl.l + 0.4)
    };
    const secHoverRgb = hslToRgb(secHoverHsl.h, secHoverHsl.s, secHoverHsl.l);
    const secHoverHex = rgbToHex(secHoverRgb);

    return {
      primary: {
        bg: brandHex,
        text: primaryText,
        ratio: primaryRatio,
        hover: hoverHex
      },
      secondary: {
        bg: secondaryBg,
        text: secondaryText,
        border: secondaryBorder,
        ratio: secondaryRatio,
        hoverBg: secHoverHex,
        hoverText: contrastWithBlack >= 4.5 ? '#000000' : '#FFFFFF'
      }
    };
  }

  function exportTheme() {
    const palette = createAdvancedPalette(brandColors);
    const buttons = generateAdvancedButtons(brandColors[0]);

    const css = `/* WCAG AA Compliant Theme - Generated */
:root {
  /* === COLOR PALETTE === */
${palette.map((c, i) => `  --color-${c.role}: ${c.hex}; /* ${c.name} */`).join('\n')}
  
  /* === PRIMARY BUTTON (Solid) === */
  --btn-primary-bg: ${buttons.primary.bg};
  --btn-primary-text: ${buttons.primary.text};
  --btn-primary-hover-bg: ${buttons.primary.hover};
  --btn-primary-hover-text: ${buttons.primary.text};
  
  /* === SECONDARY BUTTON (Outline) === */
  --btn-secondary-bg: ${buttons.secondary.bg};
  --btn-secondary-text: ${buttons.secondary.text};
  --btn-secondary-border: ${buttons.secondary.border};
  --btn-secondary-hover-bg: ${buttons.secondary.hoverBg};
  --btn-secondary-hover-text: ${buttons.secondary.hoverText};
  --btn-secondary-hover-border: ${buttons.secondary.border};
}

/* === BUTTON STYLES === */
.btn-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s ease;
}

.btn-primary:hover {
  background: var(--btn-primary-hover-bg);
  color: var(--btn-primary-hover-text);
}

.btn-secondary {
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-text);
  border: 2px solid var(--btn-secondary-border);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: var(--btn-secondary-hover-bg);
  color: var(--btn-secondary-hover-text);
  border-color: var(--btn-secondary-hover-border);
}

/* === USAGE NOTES === */
/* 
Contrast Ratios:
- Primary Button: ${buttons.primary.ratio.toFixed(2)}:1 ${buttons.primary.ratio >= 4.5 ? '✓ WCAG AA Pass' : '✗ Needs adjustment'}
- Secondary Button: ${buttons.secondary.ratio.toFixed(2)}:1 ${buttons.secondary.ratio >= 4.5 ? '✓ WCAG AA Pass' : '✗ Needs adjustment'}
*/
`;

    downloadText(css, 'wcag-theme.css');
  }
}

// ========== UTILITY FUNCTIONS ==========
function isValidHex(hex) {
  return /^#[0-9A-F]{6}$/i.test(hex);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(rgb) {
  const toHex = (n) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h, s, l };
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r: r * 255, g: g * 255, b: b * 255 };
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function calculateContrast(rgb1, rgb2) {
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ========== TAB 2: BUTTON AUDIT ==========
// Logic moved to initializeButtonAudit() to ensure proper loading order
// and prevent null reference errors on startup.

function displayButtonResults(summary) {
  const buttonResults = document.getElementById('buttonResults');
  if (!buttonResults) return;

  buttonResults.style.display = 'block';

  // Store summary for Highlight All
  lastButtonSummary = summary;

  // Show/Hide Actions based on issues
  const buttonActions = document.getElementById('buttonActions');
  const highlightAllBtn = document.getElementById('highlightAllButtonsBtn');
  const clearHighlightsBtn = document.getElementById('clearButtonHighlightsBtn');

  if (buttonActions) {
    const hasIssues = (summary.capitalizationIssues.length + summary.destinationIssues.length) > 0;
    buttonActions.style.display = hasIssues ? 'block' : 'none';

    // Reset buttons state
    if (highlightAllBtn) highlightAllBtn.style.display = 'block';
    if (clearHighlightsBtn) clearHighlightsBtn.style.display = 'none';
  }

  let html = `
      <div class="button-status">
        <div class="status-indicator ${summary.stats.total === 0 ? 'warning' : (summary.isValid ? 'pass' : 'fail')}">
          ${summary.stats.total === 0 ? '⚠️ No Buttons Found' : (summary.isValid ? '✅ All Buttons Valid' : '⚠️ Button Issues Found')}
        </div>
      </div>

      <div class="button-stats">
        <div class="stat-box">
          <span class="stat-icon">🔘</span>
          <span class="stat-label">Total Buttons</span>
          <span class="stat-value">${summary.stats.total}</span>
        </div>
        <div class="stat-box">
          <span class="stat-icon">📝</span>
          <span class="stat-label">Capitalization</span>
          <span class="stat-value" style="color: #f59e0b;">${summary.stats.capitalizationIssues}</span>
        </div>
        <div class="stat-box">
          <span class="stat-icon">🔗</span>
          <span class="stat-label">Destination</span>
          <span class="stat-value" style="color: #ef4444;">${summary.stats.destinationIssues}</span>
        </div>
      </div>
    `;

  // Show capitalization issues
  if (summary.capitalizationIssues.length > 0) {
    html += `
        <div class="button-issue-section">
          <h3 class="section-title">📝 Capitalization Issues</h3>
          <div class="issue-list">
      `;

    summary.capitalizationIssues.forEach(issue => {
      html += `
          <div class="button-issue" data-selector="${escapeHtml(issue.button.selector)}" data-issue-type="capitalization">
            <div class="issue-header">
              <span class="issue-text">"${escapeHtml(issue.button.text)}"</span>
              <span class="issue-style">${issue.style}</span>
            </div>
            <div class="issue-message">⚠️ ${issue.message}</div>
            <div class="highlight-hint">👆 Click to highlight on page</div>
          </div>
        `;
    });

    html += `</div></div>`;
  }

  // Show destination issues
  if (summary.destinationIssues.length > 0) {
    html += `
        <div class="button-issue-section">
          <h3 class="section-title">🔗 Destination Mismatches</h3>
          <div class="issue-list">
      `;

    summary.destinationIssues.forEach(issue => {
      html += `
          <div class="button-issue" data-selector="${escapeHtml(issue.button.selector)}" data-issue-type="destination">
            <div class="issue-header">
              <span class="issue-text">"${escapeHtml(issue.button.text)}"</span>
              <span class="issue-badge">Mismatch</span>
            </div>
            <div class="issue-message">⚠️ ${issue.message}</div>
            <div class="issue-dest">Destination: <code>${escapeHtml(issue.button.destination)}</code></div>
            <div class="highlight-hint">👆 Click to highlight on page</div>
          </div>
        `;
    });

    html += `</div></div>`;
  }

  if (summary.buttons.length > 0) {
    html += `
        <div class="button-list-section">
          <h3 class="section-title">📋 All Buttons (${summary.buttons.length})</h3>
          <div class="button-grid" style="display: grid; gap: 8px; margin-top: 12px;">
      `;

    summary.buttons.slice(0, 50).forEach(button => {
      html += `
          <div class="button-card-item" style="
            background: var(--bg-acc-2);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          ">
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
                <span class="button-text" style="font-weight: 600; color: var(--text-main); font-size: 13px;">"${escapeHtml(button.text)}"</span>
                <span style="font-size: 10px; padding: 2px 6px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-radius: 4px; white-space: nowrap;">${button.tagName}</span>
            </div>
            <div class="button-dest" style="font-family: monospace; font-size: 11px; color: var(--text-muted); word-break: break-all;">
                ${escapeHtml(button.destination || 'No destination')}
            </div>
          </div>
        `;
    });

    if (summary.buttons.length > 50) {
      html += `<div class="button-row more" style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 8px;">+ ${summary.buttons.length - 50} more buttons</div>`;
    }

    html += `</div></div>`;
  }

  buttonResults.innerHTML = html;

  // Add click handlers to button issues
  setTimeout(() => {
    const buttonIssues = buttonResults.querySelectorAll('.button-issue[data-selector]');
    buttonIssues.forEach(issueElement => {
      issueElement.style.cursor = 'pointer';
      issueElement.addEventListener('click', (e) => {
        e.stopPropagation();
        const selector = issueElement.getAttribute('data-selector');
        const issueType = issueElement.getAttribute('data-issue-type');

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(
              tabs[0].id,
              { action: 'highlightButton', selector: selector },
              (response) => {
                if (response && response.success) {
                  console.log('Button highlighted:', selector);
                } else {
                  console.error('Failed to highlight button');
                }
              }
            );
          }
        });
      });
    });
  }, 0);
}

// Global variable to store last results for Highlight All
let lastButtonSummary = null;

function toggleHighlightAllButtons() {
  const btn = document.getElementById('highlightAllButtonsBtn');
  const clearBtn = document.getElementById('clearButtonHighlightsBtn');

  if (!lastButtonSummary) return;

  const issues = [
    ...lastButtonSummary.capitalizationIssues,
    ...lastButtonSummary.destinationIssues
  ];

  if (issues.length === 0) return;

  // Extract all selectors
  const selectors = issues.map(issue => issue.button.selector);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'highlightButtons',
        selectors: selectors
      });

      // Toggle buttons
      if (btn) btn.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'block';
    }
  });
}

function clearButtonHighlights() {
  const btn = document.getElementById('highlightAllButtonsBtn');
  const clearBtn = document.getElementById('clearButtonHighlightsBtn');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'clearButtonHighlight' });

      // Toggle buttons
      if (btn) btn.style.display = 'block';
      if (clearBtn) clearBtn.style.display = 'none';
    }
  });
}

// Initialize button action listeners
document.addEventListener('DOMContentLoaded', () => {
  const highlightAllBtn = document.getElementById('highlightAllButtonsBtn');
  const clearHighlightsBtn = document.getElementById('clearButtonHighlightsBtn');

  if (highlightAllBtn) highlightAllBtn.addEventListener('click', toggleHighlightAllButtons);
  if (clearHighlightsBtn) clearHighlightsBtn.addEventListener('click', clearButtonHighlights);
});

// ========== TAB 3: FONT AUDIT ==========
const fontAnalyzeBtn = document.getElementById('fontAnalyzeBtn');
const fontResults = document.getElementById('fontResults');
let isFontAnalyzing = false;

if (fontAnalyzeBtn) {
  fontAnalyzeBtn.addEventListener('click', analyzeFonts);
}

async function analyzeFonts() {
  if (isFontAnalyzing) {
    console.log('⚠️ Already analyzing fonts...');
    return;
  }

  try {
    isFontAnalyzing = true;
    console.log('🔤 Starting font audit...');

    fontAnalyzeBtn.disabled = true;
    fontAnalyzeBtn.textContent = '⏳ Analyzing...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    chrome.tabs.sendMessage(tab.id, { action: 'analyzeFonts' }, (response) => {
      console.log('📩 Font analysis response:', response);

      if (chrome.runtime.lastError) {
        console.error('❌ Error:', chrome.runtime.lastError.message);
        fontAnalyzeBtn.textContent = '🔤 Analyze Fonts';
        fontAnalyzeBtn.disabled = false;
        alert('Error: ' + chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success) {
        console.log('✅ Font audit successful!');
        displayFontResults(response.summary);
        fontAnalyzeBtn.textContent = '✅ Analysis Complete';
      } else {
        console.error('❌ Font audit failed:', response?.error);
        alert('Error: ' + (response?.error || 'Analysis failed'));
        fontAnalyzeBtn.textContent = '🔤 Analyze Fonts';
      }

      fontAnalyzeBtn.disabled = false;
      isFontAnalyzing = false;
    });
  } catch (error) {
    console.error('❌ Error:', error);
    fontAnalyzeBtn.textContent = '🔤 Analyze Fonts';
    fontAnalyzeBtn.disabled = false;
    isFontAnalyzing = false;
    alert('Error: ' + error.message);
  }
}

function displayFontResults(summary) {
  if (!fontResults) return;

  fontResults.style.display = 'block';
  const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  let html = `
      <div class="font-summary">
        <div class="summary-row">
          <span>Total Headings:</span>
          <span class="value">${summary.totalHeadings}</span>
        </div>
        <div class="summary-row">
          <span>Total Paragraphs:</span>
          <span class="value">${summary.totalParagraphs}</span>
        </div>
      </div>

      <div class="heading-breakdown">
        <h3 class="section-title">📊 Heading Breakdown</h3>
        <div class="heading-grid">
    `;

  headings.forEach(tag => {
    const data = summary[tag];
    html += `
        <div class="heading-card">
          <div class="heading-tag">${tag.toUpperCase()}</div>
          <div class="heading-count">${data.count}</div>
        </div>
      `;
  });

  html += `
        </div>
      </div>
    `;

  // Add issues if any
  if (summary.issues && summary.issues.length > 0) {
    html += `<div class="font-issues">
        <h3 class="section-title" style="color: #f59e0b;">⚠️ Issues Found</h3>
      `;

    summary.issues.forEach(issue => {
      const iconMap = {
        'critical': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
      };

      html += `
          <div class="issue-item issue-${issue.severity}">
            <span class="issue-icon">${iconMap[issue.severity]}</span>
            <span class="issue-message">${issue.message}</span>
          </div>
        `;
    });

    html += `</div>`;
  }

  // Add validation status
  if (summary.hierarchyValid) {
    html += `<div class="validation-pass">✅ Heading hierarchy is valid</div>`;
  } else {
    html += `<div class="validation-fail">❌ Heading hierarchy has issues</div>`;
  }

  fontResults.innerHTML = html;
}

// ============================================
// TAB 7: LINKS, CONTENT SPLITTER, LOREM AUDITS
// ============================================

function initializeContentSplitter() {
  // Links
  const linkBtn = document.getElementById('runLinkAuditBtnOnly');
  if (linkBtn) linkBtn.addEventListener('click', analyzeLinksOnly);

  // Content Splitter
  // Content Splitter
  const splitBtn = document.getElementById('processContentBtn');
  const clearSplitBtn = document.getElementById('clearSplitterBtn'); // Updated ID
  const fileInput = document.getElementById('contentFileInput');
  const dropZone = document.getElementById('dropZone');
  const splitterFileList = document.getElementById('splitterFileList');

  // State for Splitter
  // State for Splitter
  window.splitterFiles = [];

  // Handler for multiple files
  const handleSplitterFiles = (filesList) => {
    if (!filesList || filesList.length === 0) return;

    const newFiles = Array.from(filesList).filter(f => {
      // Basic validation
      if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
        return false; // Skip PDF silently or could warn
      }
      return true;
    });

    if (newFiles.length < filesList.length) {
      alert('⚠️ Some files were skipped (PDF not supported). Please use .txt or .docx.');
    }

    window.splitterFiles = [...window.splitterFiles, ...newFiles];
    renderSplitterFileList();
  };

  function renderSplitterFileList() {
    if (!splitterFileList) return;

    if (window.splitterFiles.length === 0) {
      splitterFileList.style.display = 'none';
      splitterFileList.innerHTML = '';
      document.getElementById('splitterFileNameDisplay').textContent = '(No files selected)';
      // Disable main button if it exists, though we use individual buttons now
      if (splitBtn) splitBtn.disabled = true;
      return;
    }

    splitterFileList.style.display = 'flex';
    splitterFileList.innerHTML = '';
    splitterFileList.style.flexDirection = 'column';
    splitterFileList.style.gap = '8px';

    document.getElementById('splitterFileNameDisplay').textContent = `${window.splitterFiles.length} file(s) ready`;

    window.splitterFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.style.padding = '10px';
      item.style.alignItems = 'center';
      item.style.cursor = 'pointer'; // Make whole card clickable for "Open"

      // Hover effect
      item.onmouseover = () => item.style.borderColor = 'var(--primary)';
      item.onmouseout = () => item.style.borderColor = 'var(--border-color)';

      // File Info
      const info = document.createElement('div');
      info.className = 'result-content';
      info.innerHTML = `
           <div class="result-msg" style="font-size:13px;">${file.name}</div>
           <div class="result-detail">${(file.size / 1024).toFixed(1)} KB</div>
         `;

      // Open/Split Button (Visual indicator)
      const actionIcon = document.createElement('div');
      actionIcon.innerHTML = '➡️';
      actionIcon.style.fontSize = '16px';

      // Click handler -> Open file
      item.onclick = (e) => {
        // Avoid triggering if remove button clicked (handled below)
        if (e.target.closest('.remove-file-btn')) return;
        // Process this file
        processContentSplit(file);
      };

      // Remove Button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-file-btn';
      removeBtn.innerHTML = '×';
      removeBtn.style.background = 'none';
      removeBtn.style.border = 'none';
      removeBtn.style.color = 'var(--text-muted)';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.fontSize = '18px';
      removeBtn.style.marginLeft = '10px';
      removeBtn.style.padding = '4px';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        window.splitterFiles.splice(index, 1);
        renderSplitterFileList();
      };

      item.appendChild(info);
      item.appendChild(actionIcon);
      item.appendChild(removeBtn);
      splitterFileList.appendChild(item);
    });

    if (splitBtn) splitBtn.disabled = false;
  }

  // Drag & Drop Listeners
  if (dropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    dropZone.addEventListener('dragover', () => {
      dropZone.style.background = 'var(--bg-acc-2)';
      dropZone.style.borderColor = 'var(--primary)';
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.style.background = 'var(--bg-main)';
      dropZone.style.borderColor = 'var(--border-color)';
    });

    dropZone.addEventListener('drop', (e) => {
      dropZone.style.background = 'var(--bg-main)';
      dropZone.style.borderColor = 'var(--border-color)';
      const dt = e.dataTransfer;
      const files = dt.files;
      handleSplitterFiles(files);
    });
  }

  // File Input Listener
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      handleSplitterFiles(e.target.files);
      fileInput.value = ''; // Reset
    });
  }

  // Main Split Button (processes first file or logic?)
  // If user clicks main button, maybe process all? or first?
  // User interaction is "Open any of the file", so likely they click the list.
  // But let's make the main button process the first file if generic click.
  if (splitBtn) splitBtn.addEventListener('click', () => {
    if (window.splitterFiles.length > 0) processContentSplit(window.splitterFiles[0]);
  });

  if (clearSplitBtn) clearSplitBtn.addEventListener('click', () => {
    if (fileInput) fileInput.value = '';
    window.splitterFiles = [];
    renderSplitterFileList();

    document.getElementById('contentBlocks').innerHTML = '';
    document.getElementById('contentSplitResults').style.display = 'none';
    if (splitBtn) splitBtn.disabled = true;
  });

  // Lorem
  const loremBtn = document.getElementById('runLoremAuditBtn');
  if (loremBtn) loremBtn.addEventListener('click', () => runSpecificContentAudit('lorem'));
}

// Content Splitter Logic
async function processContentSplit(specificFile) {
  const resultsArea = document.getElementById('contentSplitResults');
  const container = document.getElementById('contentBlocks');

  // Use passed file OR first in list (legacy fallback)
  const file = (specificFile instanceof File) ? specificFile : (window.splitterFiles && window.splitterFiles[0]);

  if (!file) {
    alert('Please select a file first.');
    return;
  }

  try {
    let text = '';

    // Check for DOCX
    if (file.name.endsWith('.docx')) {
      if (typeof mammoth === 'undefined') {
        throw new Error('Mammoth library not loaded. Please reload the extension.');
      }
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      text = result.value;
      if (result.messages.length > 0) {
        console.log('Mammoth messages:', result.messages);
      }
    } else if (file.name.endsWith('.pdf')) {
      // Check for PDF.js
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library not loaded. Please reload the extension.');
      }

      // Configure worker (CRITICAL)
      // We must set this before calling getDocument
      // Use absolute URL relative to the extension
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('src/libs/pdfjs/pdf.worker.min.js');

      text = await readFileAsPdfText(file);

    } else {
      // Standard Text File
      text = await readFileAsText(file);
    }

    container.innerHTML = '';
    const sections = splitTextIntoSections(text);

    sections.forEach((section, index) => {
      // Render Heading
      if (section.heading) {
        const hDiv = document.createElement('div');
        // New class-based structure
        hDiv.className = 'splitter-card heading-card';
        hDiv.innerHTML = `
                    <div class="card-chip">Heading</div>
                    <div class="card-body">${escapeHtml(section.heading)}</div>
                    <div class="splitter-actions">
                        <button class="splitter-btn copy-btn" data-text="${escapeHtml(section.heading)}">
                           <span class="btn-icon">📋</span> Copy
                        </button>
                        <button class="splitter-btn delete-btn">
                           <span class="btn-icon">🗑️</span> Delete
                        </button>
                    </div>
                `;
        container.appendChild(hDiv);
      }

      // Render Content
      if (section.content) {
        const cDiv = document.createElement('div');
        cDiv.className = 'splitter-card content-card';
        cDiv.innerHTML = `
                    <div class="card-chip">Content</div>
                    <div class="card-body text-content">${escapeHtml(section.content)}</div>
                    <div class="splitter-actions">
                        <button class="splitter-btn copy-btn" data-text="${escapeHtml(section.content)}">
                             <span class="btn-icon">📋</span> Copy
                        </button>
                        <button class="splitter-btn delete-btn">
                             <span class="btn-icon">🗑️</span> Delete
                        </button>
                    </div>
                `;
        container.appendChild(cDiv);
      }
    });

    resultsArea.style.display = 'block';

    // Add Copy Listeners
    container.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Find the text in the sibling element
        const contentDiv = btn.closest('.splitter-card').querySelector('.card-body');
        const textToCopy = contentDiv ? contentDiv.innerText : btn.dataset.text;
        const appOriginalText = btn.innerHTML; // Save full HTML (icon + text)


        navigator.clipboard.writeText(textToCopy).then(() => {
          btn.innerHTML = '<span class="btn-icon">✅</span> Copied!';
          btn.classList.add('success');

          setTimeout(() => {
            btn.innerHTML = appOriginalText;
            btn.classList.remove('success');
          }, 1500);
        });
      });
    });

    // Add Delete Listeners
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.splitter-card');
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';

        setTimeout(() => {
          card.remove();
          // If empty, maybe hide results?
          if (container.children.length === 0) {
            resultsArea.style.display = 'none';
          }
        }, 300);
      });
    });

  } catch (err) {
    alert('Error reading file: ' + err.message);
  }
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsPdfText(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let fullText = '';

      // Iterate over all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }

      resolve(fullText);
    } catch (error) {
      reject(new Error('Failed to parse PDF: ' + error.message));
    }
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function splitTextIntoSections(text) {
  // Simple heuristic:
  // - Split by double newline to get blocks.
  // - If block is short (< 80 chars) and no punctuation at end? -> Heading.
  // - Else -> Content.
  // OR simpler: User usually pastes Heading\nContent\n\nHeading...

  // Algorithm:
  // Normalize newlines
  const lines = text.split(/\n+/);
  const sections = [];

  let currentHeading = null;
  let currentContent = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Is it a heading? 
    // Heuristic: Short line (optional), or just alternate?
    // User said: "Heaading, Content, Heading, Content"
    // Let's assume alternate if possible, or Length check.
    // Let's use Length check. If < 60 chars -> Heading. > 60 -> Content.
    // This is imperfect but a good start.

    if (trimmed.length < 80) {
      // It could be a heading. 
      // If we have accumulated content, push previous section
      if (currentContent.length > 0) {
        sections.push({ heading: currentHeading, content: currentContent.join('\n') });
        currentContent = [];
        currentHeading = trimmed;
      } else if (!currentHeading) {
        currentHeading = trimmed; // First heading
      } else {
        // We have a heading but no content yet. 
        // Maybe it was a multi-line heading? Or sub-heading?
        // Treat as content if we already have a heading?
        // Or just replace heading?
        // Let's assume it's part of content if we have a heading?
        // No, user said "Heading, Content".
        // Let's play it safe: If we have a heading, and this is ALSO short, maybe it's the start of content?
        // Let's assume everything else is content until next explict break?
        // Actually, let's try strict alternation if possible? No.

        // Better heuristic:
        // Everything is content unless it looks like a heading.
        // If currentHeading is set, append this to content?
        // Wait, if I have `Heading 1` (set as currentHeading)
        // Next line `Short text`. Is it heading 2? No, probably content.

        // Let's use the USER's input style as guide.
        // "Heading"
        // "Content..."

        // Explicit split logic:
        // A line is a heading if it is surrounded by blank lines?
        // Let's rely on the double newline split I did initially?
        // `text.split(/\n\s*\n`)` splits paragraphs.

        // Re-doing with Paragraph Split
      }
    }
  });

  // RE-PLANNING SPLIT LOGIC
  // Consolidate into blocks by \n\n
  const blocks = text.split(/\n\s*\n/);
  const result = [];

  blocks.forEach(block => {
    const lines = block.split('\n');
    // If first line is short, make it heading. Rest is content.
    let heading = null;
    let content = block;

    if (lines[0].length < 100) {
      heading = lines[0].trim();
      content = lines.slice(1).join('\n').trim();
    }

    // If content is empty, maybe the whole block was just a heading?
    if (!content && heading) {
      // Check next block?
      // Just push what we have.
    }

    result.push({ heading, content });
  });

  return result;
}

function escapeHtml(text) {
  if (!text || typeof text !== 'string') return text || '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}


// Generic runner for Lorem (Layout/Duplicate removed)
async function runSpecificContentAudit(type) {
  let btn, resultsArea;

  if (type === 'lorem') {
    btn = document.getElementById('runLoremAuditBtn');
    resultsArea = document.getElementById('loremResultsOnly');
  }

  if (!btn) return;

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Analyzing...';

  // Hide results initially
  // if (resultsArea) resultsArea.style.display = 'none';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }

    // Check if we can communicate with the tab
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' }).catch(() => {
        // If ping fails, try injecting the script? Or just warn.
        console.warn("Content script might be missing. Attempting scan anyway.");
      });
    } catch (e) { /* Ignore ping error */ }


    console.log(`🔍 Content Audit (${type}): Sending message...`);
    chrome.tabs.sendMessage(tab.id, { action: 'analyzeContent' }, (response) => {
      console.log(`🔍 Content Audit (${type}): Response received`, response);
      // Handle runtime errors (connection lost, etc.)
      // Handle runtime errors (connection lost, etc.)
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message;
        console.error('Analysis failed runtime error:', msg);

        if (type === 'lorem') {
          const container = document.getElementById('loremStatsOnly');
          const wrapper = document.getElementById('loremResultsOnly');
          if (wrapper) wrapper.style.display = 'block';
          if (container) {

            container.innerHTML = `
                    <div class="result-item critical" style="text-align:center; padding: 20px;">
                        <div style="font-size: 24px; margin-bottom: 10px;">🔌</div>
                        <div style="font-weight:bold; color:var(--danger); margin-bottom:5px;">Connection Lost</div>
                        <div style="font-size:12px; opacity:0.8;">The extension cannot reach the page.</div>
                        <div style="margin-top:10px;">
                            <button class="btn btn-sm btn-secondary" onclick="location.reload()" style="display:inline-block; margin-right:5px;">Reload Extension</button>
                        </div>
                    </div>
                 `;
            console.log(container.innerHTML);
          }
        } else {
          // Fallback for other types if needed, or just log
          console.error(`Connection lost. Please refresh the page.\nError: ${msg}`);
        }

        resetBtn();
        return;
      }

      if (!response || !response.success) {
        const errorMsg = response?.error || 'Unknown error from content script';
        console.error('Analysis failed response:', errorMsg);

        if (type === 'lorem') {
          const container = document.getElementById('loremStatsOnly');
          const wrapper = document.getElementById('loremResultsOnly');
          if (wrapper) wrapper.style.display = 'block';
          if (container) {
            container.innerHTML = `
                    <div class="result-item warning" style="text-align:center; padding: 20px;">
                        <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                        <div style="font-weight:bold; color:var(--warning); margin-bottom:5px;">Analysis Failed</div>
                        <div style="font-size:12px; opacity:0.8;">${errorMsg}</div>
                    </div>
                 `;
          }
        }

        resetBtn();
        return;
      }

      try {
        // Route results to specific container
        if (type === 'layout') {
          displayLayoutOnly(response.layout);
        } else if (type === 'duplicate') {
          displayDuplicateOnly(response.duplicates);
        } else if (type === 'lorem') {
          displayLoremOnly(response.loremIpsum);
        }

        if (resultsArea) {
          resultsArea.style.display = 'block';
          // Scroll to results
          resultsArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch (renderError) {
        console.error("Error rendering results:", renderError);
        if (type === 'lorem') {
          const container = document.getElementById('loremStatsOnly');
          if (container) {
            container.innerHTML = `<div class="result-item warning"><strong>Render Error:</strong> ${renderError.message}</div>`;
          }
        }
      }

      resetBtn();
    });

    // Safety Timeout for Lorem
    if (type === 'lorem') {
      setTimeout(() => {
        if (btn && btn.disabled) {
          console.warn('📝 Lorem Audit: Timeout reached.');
          const container = document.getElementById('loremStatsOnly');
          const wrapper = document.getElementById('loremResultsOnly');
          if (wrapper) wrapper.style.display = 'block';

          if (container && (!container.hasChildNodes() || container.innerHTML.includes('Analyzing'))) {
            container.innerHTML = `
                        <div class="result-item warning" style="text-align:center; padding: 20px;">
                            <div style="font-size: 24px; margin-bottom: 10px;">⏱️</div>
                            <div style="font-weight:bold; color:var(--warning); margin-bottom:5px;">Timeout</div>
                            <div style="font-size:12px; opacity:0.8;">The analysis took too long. Try reloading the page.</div>
                        </div>`;
            resetBtn();
          }
        }
      }, 5000);
    }

  } catch (e) {
    console.error("Top level error:", e);
    if (type === 'lorem') {
      const container = document.getElementById('loremStatsOnly');
      const wrapper = document.getElementById('loremResultsOnly');
      if (wrapper) wrapper.style.display = 'block';
      if (container) {
        container.innerHTML = `<div class="result-item fail"><strong>System Error:</strong> ${e.message}</div>`;
      }
    }
    resetBtn();
  }

  function resetBtn() {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

function displayLayoutOnly(data) {
  const container = document.getElementById('layoutStatsOnly');
  if (!container) return;

  if (data.uniqueSpacings > 10) {
    container.innerHTML = `
            <div class="result-item warning">
                <div class="result-icon">⚠️</div>
                <div class="result-content">
                    <div class="result-msg">Inconsistent Spacing Detected</div>
                    <div class="result-detail">Found ${data.uniqueSpacings} unique spacing values. Most common: ${data.mostCommon.map(s => s.value).join(', ')}</div>
                </div>
            </div>`;
  } else {
    container.innerHTML = `
            <div class="result-item info">
                <div class="result-icon">✅</div>
                <div class="result-content">
                    <div class="result-msg">Consistent Layout</div>
                    <div class="result-detail">Spacing system seems consistent.</div>
                </div>
            </div>`;
  }
}

function displayDuplicateOnly(data) {
  const container = document.getElementById('duplicateStatsOnly');
  if (!container) return;

  if (data.found) {
    container.innerHTML = data.items.map(item => `
            <div class="result-item warning">
                <div class="result-icon">📝</div>
                <div class="result-content">
                    <div class="result-msg">Duplicate Content (${item.count}x)</div>
                    <div class="result-detail">"${item.preview}"</div>
                </div>
            </div>
        `).join('');
  } else {
    container.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center;">No significant duplicates found.</div>';
  }
}

function displayLoremOnly(data) {
  console.log('📊 displayLoremOnly called with:', data);
  // Defensive default
  data = data || { found: false, instances: [] };

  const container = document.getElementById('loremStatsOnly');
  const wrapper = document.getElementById('loremResultsOnly');

  if (!container) {
    console.error('❌ Element #loremStatsOnly not found in DOM!');
    return;
  }

  // FORCE VISIBILITY of the wrapper with explicit style
  if (wrapper) {
    wrapper.style.display = 'block';
  }

  container.innerHTML = '';
  container.style.display = 'block';

  if (data.found && data.instances.length > 0) {
    console.log('Rendering', data.instances.length, 'items');
    // Summary Header
    const summaryHeader = document.createElement('div');
    summaryHeader.className = 'validation-fail';
    summaryHeader.style.marginBottom = '15px';
    summaryHeader.innerHTML = `🚨 Found ${data.instances.length} instance${data.instances.length > 1 ? 's' : ''} of placeholder text.`;
    container.appendChild(summaryHeader);

    // HIGHLIGHT ALL BUTTON
    if (data.instances.length > 0) {
      const highlightAllBtn = document.createElement('button');
      highlightAllBtn.className = 'btn btn-primary';
      highlightAllBtn.style.width = '100%';
      highlightAllBtn.style.marginBottom = '15px';
      highlightAllBtn.innerHTML = '<span class="btn-icon">🔦</span> Highlight All On Page';

      highlightAllBtn.onclick = () => {
        const originalText = highlightAllBtn.innerHTML;
        highlightAllBtn.innerHTML = '🔦 Processing...';
        highlightAllBtn.disabled = true;

        const selectors = data.instances.map(i => i.path).filter(p => p);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightList', selectors: selectors }, (response) => {
              if (chrome.runtime.lastError) {
                console.warn('Connection failed:', chrome.runtime.lastError);
                highlightAllBtn.innerHTML = '⚠️ Reload Page Required';
                highlightAllBtn.title = 'Extension updated or connection lost. Please reload the page.';
                highlightAllBtn.classList.remove('btn-primary');
                highlightAllBtn.classList.add('btn-secondary'); // Use secondary to look disabled/warning
                highlightAllBtn.style.border = '1px solid #ef4444';
                highlightAllBtn.style.color = '#ef4444';
                return; // Stay disabled
              }

              // Success
              setTimeout(() => {
                highlightAllBtn.innerHTML = originalText;
                highlightAllBtn.disabled = false;
              }, 800);
            });
          }
        });
      };
      container.appendChild(highlightAllBtn);
    }

    // List Items
    data.instances.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'result-item critical';
      div.style.cssText = 'display: flex; flex-direction: column; gap: 8px; cursor: default;';

      const snippet = item.text || 'Lorem ipsum text...';
      const selector = item.path || 'Unknown location';

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
            <div style="display: flex; gap: 10px; align-items: center;">
                <div class="result-icon" style="font-size: 18px;">📝</div>
                <div>
                   <div class="result-msg" style="font-weight: 600; color: var(--danger);">Lorem Ipsum Detected</div>
                   <div class="result-detail" style="font-size: 11px; margin-top: 2px; color: var(--text-muted);">"${escapeHtml(snippet)}"</div>
                </div>
            </div>
            <span style="font-size: 10px; background: var(--bg-main); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">#${index + 1}</span>
        </div>
        
        <div style="background: var(--bg-main); padding: 8px; border-radius: 4px; font-size: 11px; font-family: monospace; color: var(--text-muted); border: 1px solid var(--border-color); overflow-x: auto;">
            ${escapeHtml(selector)}
        </div>

        <button class="btn btn-sm btn-secondary highlight-lorem-btn" data-selector="${escapeHtml(selector)}" style="width: 100%; margin-top: 5px; font-size: 11px; height: 28px;">
            <span class="btn-icon">👁️</span> Highlight on Page
        </button>
      `;
      container.appendChild(div);
    });
  } else {
    container.innerHTML = `
        <div class="result-item info">
            <div class="result-icon">✅</div>
            <div class="result-content">
                <div class="result-msg">Clean Content</div>
                <div class="result-detail">No placeholder text detected.</div>
            </div>
        </div>
    `;
  }


  // Add event listeners for new highlight buttons
  container.querySelectorAll('.highlight-lorem-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selector = btn.getAttribute('data-selector');
      // Disable temporarily to show feedback
      const originalText = btn.innerHTML;
      btn.innerHTML = '👀 Higgins...';

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightButton', selector: selector }, () => {
            // Reset button
            setTimeout(() => btn.innerHTML = originalText, 1000);
          });
        }
      });
    });
  });


}

async function analyzeLinksOnly() {
  const btn = document.getElementById('runLinkAuditBtnOnly');
  const resultsArea = document.getElementById('linkResultsOnly');
  const grid = document.getElementById('linkGridOnly');

  // Reuse existing link logic but targeted to new elements
  analyzeLinksGeneric(btn, resultsArea, grid);
}

// Reusing your existing link logic refactored
async function analyzeLinksGeneric(btn, resultsArea, grid) {
  if (!btn || !resultsArea || !grid) {
    console.error("Critical Error: Missing UI elements for Link Analyzer");
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Scanning...';
  grid.innerHTML = '<div style="padding:20px; text-align:center;">Scanning buttons & links...</div>';
  resultsArea.style.display = 'block';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) throw new Error("No active tab");

    chrome.tabs.sendMessage(tab.id, { action: 'analyzeLinks' }, async (response) => {
      // Check for errors
      if (chrome.runtime.lastError || !response || !response.success) {
        const errorMsg = chrome.runtime.lastError?.message || response?.error || 'No response';
        grid.innerHTML = `<div style="padding:20px; text-align:center; color:var(--danger);">Analysis failed: ${errorMsg}</div>`;
        resetBtn();
        return;
      }

      console.log('🔗 Link Audit: Response received', response);
      const links = response.links;
      console.log('🔗 Link Audit: Links count:', links ? links.length : 'null');

      if (!links || links.length === 0) {
        console.warn('🔗 Link Audit: No links found.');
        if (resultsArea) resultsArea.style.display = 'block'; // Force visibility
        grid.innerHTML = `
            <div class="result-item info" style="display:block; text-align:center; padding:20px;">
                <div style="font-size: 24px;">📭</div>
                <strong>No Links Found</strong>
                <div style="font-size: 12px; margin-top:5px; opacity:0.8">No buttons or links were detected on this page.</div>
            </div>`;
        resetBtn();
        return;
      }

      grid.innerHTML = `<div style="padding:10px; color:var(--text-muted);">Found ${links.length} items. Fetching page titles...</div>`;

      // Batch fetch titles
      // Batch fetch titles
      const BATCH_SIZE = 5;
      for (let i = 0; i < links.length; i += BATCH_SIZE) {
        if (!btn) break; // Safety check if UI closed
        const batch = links.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (link) => {
          if (link.shouldFetch) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

              const res = await fetch(link.url, { signal: controller.signal });
              clearTimeout(timeoutId);

              const text = await res.text();
              const doc = new DOMParser().parseFromString(text, 'text/html');
              const title = doc.querySelector('title')?.innerText.trim() || 'No Title Found';
              link.destinationTitle = title;
            } catch (e) {
              link.destinationTitle = '❌ Connector Error (Timeout/CORS)';
            }
          } else {
            // Logic for internal/anchor links
            if (link.url && link.url.startsWith('#')) {
              link.destinationTitle = '(Anchor: ' + link.url + ')';
            } else if (link.url && link.url.startsWith('javascript:')) {
              link.destinationTitle = '(JavaScript Action)';
            } else {
              link.destinationTitle = '(No URL / Interaction)';
            }
          }
        }));
        if (btn) btn.innerHTML = `⏳ ${Math.min(i + BATCH_SIZE, links.length)}/${links.length}`;
      }

      // Render
      grid.innerHTML = '';

      // Ensure visibility
      resultsArea.style.display = 'block';
      grid.style.display = 'block';

      // Setup Filters
      const chips = resultsArea.querySelectorAll('.filter-chip');
      if (chips.length > 0) {
        // Update counts
        const allChip = resultsArea.querySelector('[data-filter="all"]');
        if (allChip) allChip.textContent = `All Items (${links.length})`;
      }

      try {
        Array.from(links).forEach((link, index) => {
          try {
            const item = document.createElement('div');
            item.className = 'result-item';

            // Highlight generic labels
            const generic = ['click here', 'read more', 'more', 'details', 'submit', 'button'].includes(String(link.label || '').toLowerCase());
            let isSuspicious = false;

            if (!link.url && !link.label) isSuspicious = true;
            if (link.destinationTitle && link.destinationTitle.startsWith('❌')) isSuspicious = true;

            // Classes for styling hooks
            if (generic) item.classList.add('generic-label');
            if (isSuspicious) item.classList.add('suspicious');

            // Set dataset for filtering
            item.dataset.suspicious = isSuspicious ? 'true' : 'false';

            const destDisplay = link.destinationTitle && link.destinationTitle !== 'No Title Found'
              ? link.destinationTitle
              : (link.url || 'No Link / JS Action');

            const isUrl = link.url && link.url.startsWith('http');

            const labelSafe = escapeHtml(String(link.label || '[No Label]'));
            const elementSafe = escapeHtml(String(link.element || 'BTN'));
            const urlSafe = escapeHtml(String(link.url || ''));
            const selector = escapeHtml(String(link.path || ''));

            item.innerHTML = `
                <div class="result-content">
                    <div class="result-header">
                        <span class="result-label">${labelSafe}</span>
                        <span class="result-type">${elementSafe}</span>
                    </div>
                    
                    <div class="result-url" title="${urlSafe}">
                        ${urlSafe}
                    </div>
                    
                    <div class="result-meta ${isSuspicious ? 'meta-danger' : 'meta-success'}">
                        <strong class="meta-label">${isUrl ? 'Page:' : 'Action:'}</strong> 
                        <span class="meta-value">${escapeHtml(String(destDisplay))}</span>
                    </div>

                    ${selector ? `
                    <button class="btn btn-sm btn-secondary highlight-btn" style="width: 100%; margin-top: 8px; font-size: 11px; height: 28px;">
                        <span class="btn-icon">👁️</span> Highlight
                    </button>
                    ` : ''}
                </div>
            `;

            if (selector) {
              const hBtn = item.querySelector('.highlight-btn');
              if (hBtn) {
                hBtn.addEventListener('click', () => {
                  const originalHtml = hBtn.innerHTML;
                  hBtn.innerHTML = '👀 Higgins...'; // "Looking..."
                  hBtn.disabled = true;

                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                      chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightButton', selector: link.path }, () => {
                        setTimeout(() => {
                          hBtn.innerHTML = originalHtml;
                          hBtn.disabled = false;
                        }, 800);
                      });
                    }
                  });
                });
              }
            }

            grid.appendChild(item);
          } catch (err) {
            console.error('Error rendering link item:', err, link);
          }
        });
      } catch (outerErr) {
        console.error("Link Render Error:", outerErr);
        grid.innerHTML = '<div style="color:var(--danger); padding:10px;">Error code: RENDER_LOOP_FAIL</div>';
      }

      console.log('🔗 Link Audit: Rendering complete.');
      resetBtn();
    }); // end sendMessage callback

    // Safety Timeout: If nothing happens in 8 seconds, force an error
    setTimeout(() => {
      if (btn && btn.disabled) {
        console.warn('🔗 Link Audit: Operation timed out.');
        // Only overwrite if it implies it's still loading or empty
        if (!grid.hasChildNodes() || grid.innerHTML.includes('Scanning')) {
          grid.innerHTML = `<div class="result-item warning">
                    <div style="font-size: 24px;">⏱️</div>
                    <strong>Timeout</strong><br>
                    <small>The analysis took too long. Try reloading the page.</small>
                </div>`;
          resultsArea.style.display = 'block';
          resetBtn();
        }
      }
    }, 8000);

  } catch (e) {
    console.error('CRITICAL: Link Audit Failed synchronously:', e);
    grid.innerHTML = `<div class="result-item fail">
        <div style="font-size: 24px;">⚠️</div>
        <strong>System Error</strong><br>
        <small>${e.message}</small>
    </div>`;
    resultsArea.style.display = 'block';
    resetBtn();
  }

  function resetBtn() {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// ========== TAB 4: IMAGE AUDIT ==========
const imageAnalyzeBtn = document.getElementById('imageAnalyzeBtn');
const imageResults = document.getElementById('imageResults');
let isImageAnalyzing = false;

if (imageAnalyzeBtn) {
  imageAnalyzeBtn.addEventListener('click', () => analyzeImages(false));
}

async function analyzeImages(isDownloader = false) {
  if (isImageAnalyzing) {
    console.log('⚠️ Already analyzing images...');
    return;
  }

  const btnId = isDownloader ? 'downloaderAnalyzeBtn' : 'imageAnalyzeBtn';
  const btn = document.getElementById(btnId);

  try {
    isImageAnalyzing = true;
    console.log('🖼️ Starting image audit...');

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Scanning...';
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'analyzeImages' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        if (btn) {
          btn.disabled = false;
          btn.textContent = isDownloader ? '🔍 Find Images' : '🖼️ Scan Images';
        }
        isImageAnalyzing = false;
        return;
      }

      if (response && response.success) {
        console.log('✅ Image analysis complete:', response);

        if (isDownloader) {
          const downloaderResults = document.getElementById('downloaderResults');
          if (downloaderResults) {
            downloaderResults.style.display = 'block';
            // Show bulk actions
            const bulkActions = document.getElementById('bulkActions');
            if (bulkActions) bulkActions.style.display = 'flex';
            const selectionControl = document.getElementById('selectionControl');
            if (selectionControl) selectionControl.style.display = 'flex';

            const countEl = document.getElementById('downloaderCount');
            if (countEl) countEl.textContent = response.totalImages;

            // Render grid
            renderImageDownloadGrid(document.getElementById('imageDownloadGrid'), response.allImages);
          }
        } else {
          displayImageResults(response);
        }

        if (btn) btn.textContent = '✅ Scan Complete';

        setTimeout(() => {
          if (btn) {
            btn.textContent = isDownloader ? '🔍 Find Images' : '🖼️ Scan Images';
            btn.disabled = false;
          }
        }, 1500);
      } else {
        console.error('Analysis failed:', response?.error);
        if (btn) {
          btn.textContent = '❌ Analysis Failed';
          btn.disabled = false;
        }
      }

      isImageAnalyzing = false;
    });
  } catch (error) {
    console.error('Image analysis error:', error);
    if (btn) {
      btn.disabled = false;
      btn.textContent = isDownloader ? '🔍 Find Images' : '🖼️ Scan Images';
    }
    isImageAnalyzing = false;
  }
}

function displayImageResults(response) {
  const { totalImages, issues, summary } = response;

  if (imageResults) imageResults.style.display = 'block';

  const totalCountEl = document.getElementById('totalImagesCount');
  const missingCountEl = document.getElementById('imageMissingCount');
  const warningCountEl = document.getElementById('imageWarningCount');

  if (totalCountEl) totalCountEl.textContent = totalImages;
  if (missingCountEl) missingCountEl.textContent = summary.missingAlt;
  if (warningCountEl) warningCountEl.textContent = summary.emptyAlt + summary.poorAltText;

  // USER REQUEST: Only show images where alt text is MISSING (critical)
  const visibleIssues = issues.filter(issue => issue.type === 'missing-alt');

  let html = '';

  if (visibleIssues.length === 0) {
    if (issues.length > 0) {
      html = '<div class="validation-pass">✅ No missing alt text found! (Warnings hidden)</div>';
    } else {
      html = '<div class="validation-pass">✅ All images are accessible!</div>';
    }
  } else {
    visibleIssues.forEach((issue, index) => {
      const severityClass = 'critical'; // Always critical for missing alt
      const icon = '❌';

      // Create thumbnail from src
      html += `
              <div class="violation-item ${severityClass}" data-selector="${escapeHtml(issue.selector)}">
                <img src="${issue.src || ''}" onerror="this.style.display='none';this.parentNode.innerHTML='<div style=\'height:100%;display:flex;align-items:center;justify-content:center;color:#666;font-size:10px;\'>Broken Img</div>'">
                <div class="violation-overlay">
                    <span class="violation-tag">⚠️ MISSING ALT</span>
                    <button class="highlight-btn">Highlight</button>
                </div>
              </div>
            `;
    });
  }

  const listContainer = document.getElementById('imageIssuesList');
  if (listContainer) {
    listContainer.innerHTML = html;
    // Add click listeners for highlighting
    listContainer.querySelectorAll('.violation-item').forEach(item => {
      item.addEventListener('click', () => {
        const selector = item.dataset.selector;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'highlightImage',
              selector: selector
            });
          }
        });
      });
    });
  }
}

// ========== TAB 5: SEO AUDIT ==========
const seoAnalyzeBtn = document.getElementById('seoAnalyzeBtn');
const seoResults = document.getElementById('seoResults');
let isSEOAnalyzing = false;

if (seoAnalyzeBtn) {
  seoAnalyzeBtn.addEventListener('click', analyzeSEO);
}

async function analyzeSEO() {
  if (isSEOAnalyzing) {
    console.log('⚠️ Already analyzing SEO...');
    return;
  }

  try {
    isSEOAnalyzing = true;
    console.log('🔍 Starting SEO audit...');

    seoAnalyzeBtn.disabled = true;
    seoAnalyzeBtn.textContent = '⏳ Analyzing...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    chrome.tabs.sendMessage(tab.id, { action: 'analyzeSEO' }, (response) => {
      console.log('📩 SEO analysis response:', response);

      if (chrome.runtime.lastError) {
        console.error('❌ Error:', chrome.runtime.lastError.message);
        seoAnalyzeBtn.textContent = '🔍 Analyze SEO';
        seoAnalyzeBtn.disabled = false;
        alert('Error: ' + chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success) {
        console.log('✅ SEO audit successful!');
        displaySEOResults(response.summary);
        seoAnalyzeBtn.textContent = '✅ Analysis Complete';
      } else {
        console.error('❌ SEO audit failed:', response?.error);
        alert('Error: ' + (response?.error || 'Analysis failed'));
        seoAnalyzeBtn.textContent = '🔍 Analyze SEO';
      }

      seoAnalyzeBtn.disabled = false;
      isSEOAnalyzing = false;
    });
  } catch (error) {
    console.error('❌ Error:', error);
    seoAnalyzeBtn.textContent = '🔍 Analyze SEO';
    seoAnalyzeBtn.disabled = false;
    isSEOAnalyzing = false;
    alert('Error: ' + error.message);
  }
}

function displaySEOResults(summary) {
  if (!seoResults) return;

  seoResults.style.display = 'block';

  let html = `
      <div class="seo-status">
        <div class="status-indicator ${summary.isValid ? 'pass' : 'fail'}">
          ${summary.isValid ? '✅ Good SEO Metadata' : '⚠️ SEO Issues Found'}
        </div>
      </div>

      <div class="seo-stats">
        <div class="stat-box">
          <span class="stat-icon">📋</span>
          <span class="stat-label">Critical</span>
          <span class="stat-value" style="color: #ef4444;">${summary.stats.critical}</span>
        </div>
        <div class="stat-box">
          <span class="stat-icon">⚠️</span>
          <span class="stat-label">Warnings</span>
          <span class="stat-value" style="color: #f59e0b;">${summary.stats.warning}</span>
        </div>
        <div class="stat-box">
          <span class="stat-icon">ℹ️</span>
          <span class="stat-label">Info</span>
          <span class="stat-value" style="color: #3b82f6;">${summary.stats.info}</span>
        </div>
      </div>
    `;

  // Meta Title
  html += `
      <div class="seo-card">
        <div class="card-header">
          <span class="card-title">📄 Meta Title</span>
          ${summary.title ? `<span class="length-badge">${summary.title.length} chars</span>` : '<span class="length-badge missing">Missing</span>'}
        </div>
        <div class="card-body">
    `;

  if (summary.title) {
    html += `
          <div class="meta-value">${escapeHtml(summary.title.value)}</div>
          <div class="length-info">
            <span class="length-bar">
              <span class="length-fill" style="width: ${Math.min(100, (summary.title.length / 60) * 100)}%"></span>
            </span>
            <span class="length-text">${summary.title.length} / 50-60 recommended</span>
          </div>
      `;
  } else {
    html += `<div class="missing-info">No meta title found. Add &lt;title&gt; tag to your HTML.</div>`;
  }

  html += `</div></div>`;

  // Meta Description
  html += `
      <div class="seo-card">
        <div class="card-header">
          <span class="card-title">📝 Meta Description</span>
          ${summary.description ? `<span class="length-badge">${summary.description.length} chars</span>` : '<span class="length-badge missing">Missing</span>'}
        </div>
        <div class="card-body">
    `;

  if (summary.description) {
    html += `
          <div class="meta-value">${escapeHtml(summary.description.value)}</div>
          <div class="length-info">
            <span class="length-bar">
              <span class="length-fill" style="width: ${Math.min(100, (summary.description.length / 160) * 100)}%"></span>
            </span>
            <span class="length-text">${summary.description.length} / 150-160 recommended</span>
          </div>
      `;
  } else {
    html += `<div class="missing-info">No meta description found. Add &lt;meta name="description" content="..."&gt; to your HTML.</div>`;
  }

  html += `</div></div>`;

  // Open Graph (if available)
  if (summary.ogTitle || summary.ogDescription) {
    html += `<div class="seo-card open-graph">
        <div class="card-header">
          <span class="card-title">🌐 Open Graph Tags</span>
          <span class="badge-success">Found</span>
        </div>
        <div class="card-body">
      `;

    if (summary.ogTitle) {
      html += `
          <div class="og-item">
            <span class="og-label">OG Title:</span>
            <span class="og-value">${escapeHtml(summary.ogTitle.value)}</span>
          </div>
        `;
    }

    if (summary.ogDescription) {
      html += `
          <div class="og-item">
            <span class="og-label">OG Description:</span>
            <span class="og-value">${escapeHtml(summary.ogDescription.value)}</span>
          </div>
        `;
    }

    html += `</div></div>`;
  }

  // Issues List
  if (summary.issues && summary.issues.length > 0) {
    html += `
        <div class="seo-issues">
          <h3 class="section-title">🔍 Issues Found</h3>
      `;

    summary.issues.forEach(issue => {
      const iconMap = {
        'critical': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
      };

      html += `
          <div class="issue-row issue-${issue.severity}">
            <span class="issue-icon">${iconMap[issue.severity]}</span>
            <span class="issue-msg">${issue.message}</span>
          </div>
        `;
    });

    html += `</div>`;
  }

  seoResults.innerHTML = html;
}

// ========== TAB 9: TOOLS & UTILITIES ==========
// Screenshot button moved to main analyze section

// Load page information on Tools tab
function loadPageInfo() {
  const [tab] = chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      document.getElementById('pageUrl').textContent = tabs[0].url || 'N/A';
      document.getElementById('pageTitle').textContent = tabs[0].title || 'N/A';
    }
  });

  // Try to get meta description
  const [activeTab] = chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getPageMeta' }, (response) => {
        if (response && response.description) {
          document.getElementById('pageDesc').textContent = response.description;
        }
      });
    }
  });
}

// Load page info when tools tab is clicked
document.querySelector('[data-tab="tools"]')?.addEventListener('click', loadPageInfo);

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Navigation System
let currentFeature = 'home';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeNavigation();
  initializeFeatures();
});

// Navigation
function initializeNavigation() {
  const featureCards = document.querySelectorAll('.feature-card');
  const backBtn = document.getElementById('backBtn');

  // Feature card clicks
  featureCards.forEach(card => {
    card.addEventListener('click', () => {
      const feature = card.dataset.feature;
      if (!card.classList.contains('coming-soon')) {
        navigateToFeature(feature);
      }
    });
  });

  // Back button
  if (backBtn) {
    backBtn.addEventListener('click', () => navigateToHome());
  }

  // Initialize independent features

  initializeColorExtractor();
}

// START: Fresh Screen / Reset State Logic
function resetFeatureState(feature) {
  if (!feature) return;
  console.log('🔄 Resetting state for:', feature);

  // Dynamic containers (Safe to clear)
  // Dynamic containers (Clear innerHTML)
  const dynamicIds = ['buttonResults', 'fontResults', 'seoResults', 'linkGridOnly', 'loremStatsOnly', 'contentSplitResults'];
  dynamicIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  });

  // Static/Mixed containers (Hide ONLY, do not clear innerHTML)
  const staticIds = ['imageResults', 'manualResults', 'themeResults', 'colorResults', 'downloaderResults', 'contentResults', 'linkResultsOnly', 'loremResultsOnly'];
  staticIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Reset Analysis Buttons and specific UI states
  const resetStates = {
    'buttons': () => {
      const btn = document.getElementById('buttonAnalyzeBtn');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">🔍</span>Analyze Buttons'; }
      const act = document.getElementById('buttonActions');
      if (act) act.style.display = 'none';
    },
    'images': () => {
      const btn = document.getElementById('imageAnalyzeBtn');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">🖼️</span>Scan Images'; }
    },
    'seo': () => {
      const btn = document.getElementById('seoAnalyzeBtn');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">🔍</span>Analyze SEO'; }
    },
    'manual': () => {
      // Reset inputs to default
      if (document.getElementById('textColor')) {
        document.getElementById('textColor').value = '#000000';
        document.getElementById('textColorPicker').value = '#000000';
      }
      if (document.getElementById('bgColor')) {
        document.getElementById('bgColor').value = '#ffffff';
        document.getElementById('bgColorPicker').value = '#ffffff';
      }
      const results = document.getElementById('manualResults');
      if (results) results.style.display = 'none';
    },
    'links': () => {
      const btn = document.getElementById('runLinkAuditBtnOnly');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">▶️</span>Analyze Buttons'; }
    },
    'lorem': () => {
      const btn = document.getElementById('runLoremAuditBtn');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">▶️</span>Scan for Lorem Ipsum'; }
    },
    'contentHelper': () => {
      const btn = document.getElementById('processContentBtn');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">✂️</span>Split Content'; }
      const display = document.getElementById('splitterFileNameDisplay');
      if (display) display.textContent = '(No files selected)';
    },
    'selfAudit': () => {
      const btn = document.getElementById('startSelfAuditBtn');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">🚀</span> Start Self-Audit'; }
      const stopBtn = document.getElementById('stopSelfAuditBtn');
      if (stopBtn) stopBtn.style.display = 'inline-block'; // Or manage visibility
    }
  };

  if (resetStates[feature]) {
    resetStates[feature]();
  }
}
// END: Reset State Logic

function navigateToFeature(feature) {
  currentFeature = feature;

  // Hide home tab
  document.getElementById('homeTab').classList.remove('active');

  // Show feature tab
  const tabId = feature.endsWith('Tab') ? feature : feature + 'Tab';
  const featureTab = document.getElementById(tabId);

  console.log(`Navigating to: ${feature} -> ID: ${tabId}, Found: ${!!featureTab}`);

  if (featureTab) {
    featureTab.classList.add('active');
    // Ensure fresh screen when navigating from home
    resetFeatureState(feature);
  } else {
    console.error(`Tab not found for feature: ${feature}`);
  }



  // Show back button
  document.getElementById('backNav').style.display = 'block';
}

function navigateToHome() {
  currentFeature = 'home';

  // Hide all feature tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Show home tab
  document.getElementById('homeTab').classList.add('active');

  // Hide back button
  document.getElementById('backNav').style.display = 'none';
}



function renderImageDownloadGrid(container, images) {
  container.innerHTML = '';
  if (!images || images.length === 0) {
    container.innerHTML = '<p>No images found.</p>';
    return;
  }

  images.forEach(img => {
    const item = document.createElement('div');
    item.className = 'image-item';
    item.innerHTML = `
          <div class="image-preview-box" style="height: 100px; display: flex; align-items: center; justify-content: center; background: #2a2a2a; overflow: hidden; border-radius: 4px; border: 1px solid var(--border-color);">
              <img src="${img.src}" alt="preview" style="max-height: 100%; max-width: 100%; object-fit: contain;">
          </div>
          <div class="image-info" style="margin-top: 8px;">
              <div style="font-size: 11px; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">${img.width} x ${img.height}</div>
              <div style="color: var(--text-muted); font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 100%;" title="${img.src}">${img.src.substring(0, 30)}...</div>
          </div>
          <div class="image-select-overlay">
              <input type="checkbox" class="image-checkbox" title="Select image">
          </div>
          <div class="image-actions">
              <button class="icon-btn download-img-btn" title="Download">⬇️</button>
          </div>
        `;

    item.querySelector('.download-img-btn').addEventListener('click', () => {
      chrome.downloads.download({
        url: img.src,
        filename: `image-${Date.now()}.png`
      });
    });

    // Handle checkbox selection
    const checkbox = item.querySelector('.image-checkbox');
    checkbox.addEventListener('change', () => {
      updateSelectionState();
    });

    container.appendChild(item);
  });


  // Enable/Disable Select All based on image count
  const selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll) {
    selectAll.disabled = false;
    selectAll.checked = false;
  }
}

function updateSelectionState() {
  const checkboxes = document.querySelectorAll('.image-checkbox:checked');
  const count = checkboxes.length;
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  const countSpan = document.getElementById('selectedCount');

  if (downloadSelectedBtn && countSpan) {
    countSpan.textContent = count;
    downloadSelectedBtn.disabled = count === 0;

    // Update button text/style based on count
    if (count > 0) {
      downloadSelectedBtn.classList.remove('btn-secondary');
      downloadSelectedBtn.classList.add('btn-primary');
    } else {
      downloadSelectedBtn.classList.add('btn-secondary');
      downloadSelectedBtn.classList.remove('btn-primary');
    }
  }

  // Update Select All checkbox state
  const totalCheckboxes = document.querySelectorAll('.image-checkbox');
  const selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll && totalCheckboxes.length > 0) {
    selectAll.checked = checkboxes.length === totalCheckboxes.length;
    selectAll.indeterminate = count > 0 && count < totalCheckboxes.length;
  }
}

function downloadAllImages() {
  const images = document.querySelectorAll('.image-item img');
  let delay = 0;

  const statusBadge = document.getElementById('statusBadge');
  if (statusBadge) statusBadge.textContent = `Downloading ${images.length} images...`;

  images.forEach(img => {
    setTimeout(() => {
      chrome.downloads.download({
        url: img.src,
        filename: `batch - ${Date.now()}.png`
      });
    }, delay);
    delay += 200; // 200ms delay between downloads to prevent choking
  });
}

function downloadSelectedImages() {
  const checkboxes = document.querySelectorAll('.image-checkbox:checked');
  let delay = 0;

  checkboxes.forEach(cb => {
    const imgItem = cb.closest('.image-item');
    const img = imgItem.querySelector('img');

    setTimeout(() => {
      chrome.downloads.download({
        url: img.src,
        filename: `selected - ${Date.now()}.png`
      });
    }, delay);
    delay += 200;
  });
}

// Feature Initialization
function initializeFeatures() {
  initializeContrastAnalyzer();
  initializeButtonAudit();
  initializeFontAudit();
  initializeImageAudit();
  initializeSEOAudit();
  initializeManualChecker();
  initializeThemeGenerator();
  initializeColorExtractor();
  initializeImageDownloader();
  initializeContentSplitter();
}

// 1. CONTRAST ANALYZER
function initializeContrastAnalyzer() {
  // Event listeners already set up at the beginning
  // No need to duplicate them here
}

// 2. BUTTON AUDIT
// 2. BUTTON AUDIT
// 2. BUTTON AUDIT
function initializeButtonAudit() {
  const btn = document.getElementById('buttonAnalyzeBtn');
  const results = document.getElementById('buttonResults');
  let isAnalyzing = false;

  if (btn) {
    // Clone to remove any old listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async () => {
      if (isAnalyzing) return;
      isAnalyzing = true;

      const originalText = newBtn.innerHTML;
      newBtn.disabled = true;
      newBtn.innerHTML = '⏳ Analyzing...';

      // Reset and show results container
      results.style.display = 'block';
      results.innerHTML = '<div class="result-item"><div class="loading-spinner"></div> Analyzing buttons...</div>';

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Send message
        chrome.tabs.sendMessage(tab.id, { action: 'analyzeButtons' }, (response) => {
          isAnalyzing = false;

          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            results.innerHTML = `
              <div class="status-indicator fail">
                 ⚠️ Connection Error
              </div>
              <div class="result-item">
                 <p style="margin-bottom:8px">Cannot connect to the page. Try reloading the page.</p>
                 <small style="opacity:0.7">${chrome.runtime.lastError.message}</small>
              </div>
            `;
            newBtn.disabled = false;
            newBtn.innerHTML = originalText;
            return;
          }

          if (response && response.success) {
            displayButtonResults(response.summary);
            newBtn.innerHTML = '✅ Done';
            setTimeout(() => {
              newBtn.disabled = false;
              newBtn.innerHTML = originalText;
            }, 2000);
          } else {
            results.innerHTML = `
              <div class="status-indicator fail">
                 ⚠️ Analysis Failed
              </div>
              <div class="result-item">
                 <p>${response?.error || 'Unknown error occurred.'}</p>
              </div>
            `;
            newBtn.disabled = false;
            newBtn.innerHTML = originalText;
          }
        });
      } catch (e) {
        console.error(e);
        isAnalyzing = false;
        results.innerHTML = `
              <div class="status-indicator fail">
                 ⚠️ Error
              </div>
              <div class="result-item">
                 <p>${e.message || 'An unexpected error occurred.'}</p>
              </div>
            `;
        newBtn.disabled = false;
        newBtn.innerHTML = originalText;
      }
    });
  }
}

// Minimal Button Summary
// Minimal Button Summary - (Logic merged into displayButtonResults)




function renderImageIssues(issues) {
  const list = document.getElementById('imageIssuesList');
  if (!list) return;

  list.innerHTML = '';
  if (issues.length === 0) {
    list.innerHTML = '<p class="status-pass">✅ No accessibility issues found!</p>';
    return;
  }

  issues.forEach(issue => {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; cursor: pointer; transition: background 0.2s;';
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
          <div><strong>${issue.type}</strong>: ${issue.message}</div>
          <div style="font-size:10px; color:var(--primary);">👆 Click to highlight</div>
      </div>
      `;

    div.addEventListener('mouseenter', () => div.style.background = 'rgba(0,0,0,0.05)');
    div.addEventListener('mouseleave', () => div.style.background = 'transparent');

    div.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'highlightImage',
            elementIndex: issue.index,
            selector: issue.selector,
            src: issue.context
          });
        }
      });
    });

    list.appendChild(div);
  });
}


// 3. FONT AUDIT
function initializeFontAudit() {
  const btn = document.getElementById('fontAnalyzeBtn');
  const results = document.getElementById('fontResults');

  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '⏳ Analyzing...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: 'analyzeFonts' }, (response) => {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">🔤</span>Analyze Fonts';

        if (response && response.success) {
          results.style.display = 'block';
          renderFontResults(results, response.summary);
        }
      });
    });
  }
}

// Minimal Font Summary (Grid)
function renderFontResults(container, summary) {
  container.innerHTML = '';
  if (!summary) return;

  const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];

  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px;';

  headings.forEach(tag => {
    const count = tag === 'p' ? (summary.paragraphs ? summary.paragraphs.count : 0) : (summary[tag] ? summary[tag].count : 0);
    const isHeading = tag.startsWith('h');

    const item = document.createElement('div');
    item.style.cssText = `
  background: var(--bg - acc - 2);
  border: 1px solid var(--border - color);
  border - radius: 6px;
  padding: 10px;
  text - align: center;
  `;

    item.innerHTML = `
    <div style="font-weight: 700; color: ${isHeading ? 'var(--primary)' : 'var(--text-muted)'}; font-size: 14px; text-transform: uppercase;">${tag}</div>
      <div style="font-size: 18px; font-weight: 600; margin-top: 4px; color: var(--text-main);">${count}</div>
  `;

    grid.appendChild(item);
  });

  container.appendChild(grid);

  if (summary.totalHeadings === 0) {
    container.innerHTML += '<p style="margin-top:15px; color:#666; font-size:13px; text-align:center;">No headings found.</p>';
  }
}

// 4. IMAGE AUDIT
function initializeImageAudit() {
  const btn = document.getElementById('imageAnalyzeBtn');
  if (btn) {
    btn.onclick = () => analyzeImages(false);
  }
}

// 4.5 IMAGE DOWNLOADER
function initializeImageDownloader() {
  const analyzeBtn = document.getElementById('downloaderAnalyzeBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');

  if (analyzeBtn) {
    analyzeBtn.onclick = () => analyzeImages(true);
  }

  if (downloadAllBtn) {
    downloadAllBtn.onclick = downloadAllImages;
  }

  if (downloadSelectedBtn) {
    downloadSelectedBtn.onclick = downloadSelectedImages;
  }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.image-checkbox');
      checkboxes.forEach(cb => cb.checked = e.target.checked);
      updateSelectionState();
    });
  }
}

// 5. SEO AUDIT
function initializeSEOAudit() {
  const btn = document.getElementById('seoAnalyzeBtn');
  const results = document.getElementById('seoResults');

  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '⏳ Analyzing...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: 'analyzeSEO' }, (response) => {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">🔍</span>Analyze SEO';

        if (response && response.success) {
          results.style.display = 'block';
          renderSEOResults(results, response.summary);
        }
      });
    });
  }
}

function renderSEOResults(container, data) {
  container.innerHTML = '';

  const titleVal = data.title ? data.title.value : null;
  const descVal = data.description ? data.description.value : null;
  // H1 is not directly in summary root, need to check how to get H1 count/text if needed.
  // Actually, SEOAnalyzer summary struct is { title, description, ogTitle, issues, ... }
  // It doesn't seem to pass H1 explicitly in the top level properties, but maybe in stats?
  // Let's check keys. The analyzer output shows keys: title, description, ogTitle...
  // It checks H1 in FontAnalyzer, not SEOAnalyzer usually? 
  // Wait, the original code looked for data.h1. SEOAnalyzer does NOT return h1.
  // We should remove H1 from SEO result or fetch it separately. For now, let's just show what we have.

  const items = [
    { label: 'Title', value: titleVal, valid: !!titleVal },
    { label: 'Description', value: descVal, valid: !!descVal }
  ];

  items.forEach(item => {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 10px; border-bottom: 1px solid #eee;';
    div.innerHTML = `
    <div style="font-weight: 600; font-size: 12px; color: #555;">${item.label}</div>
      <div style="margin-top: 4px; ${item.valid ? '' : 'color: red; font-style: italic;'}">${item.value || '(Missing)'}</div>
  `;
    container.appendChild(div);
  });
}

// 6. TOOLS
function initializeTools() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      document.getElementById('pageUrl').textContent = new URL(tabs[0].url).hostname;
      document.getElementById('pageTitle').textContent = tabs[0].title;
    }
  });
}



function initializeColorExtractor() {
  const colorAnalyzeBtn = document.getElementById('colorAnalyzeBtn');
  const colorResults = document.getElementById('colorResults');
  const textColorGrid = document.getElementById('textColorGrid');
  const bgColorGrid = document.getElementById('bgColorGrid');
  const borderColorGrid = document.getElementById('borderColorGrid');

  if (colorAnalyzeBtn) {
    colorAnalyzeBtn.addEventListener('click', analyzeColors);
  }

  // Duplicate listener removed


  async function analyzeColors() {
    try {
      colorAnalyzeBtn.disabled = true;
      colorAnalyzeBtn.textContent = '⏳ Extracting...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      chrome.tabs.sendMessage(tab.id, { action: 'analyzeColors' }, (response) => {
        if (response && response.success) {
          displayColorResults(response);
        } else {
          console.error('Color extraction failed');
        }
        colorAnalyzeBtn.disabled = false;
        colorAnalyzeBtn.textContent = '🔍 Extract Colors';
      });
    } catch (e) {
      console.error(e);
      colorAnalyzeBtn.disabled = false;
      colorAnalyzeBtn.textContent = '🔍 Extract Colors';
    }
  }

  function displayColorResults(data) {
    colorResults.style.display = 'block';
    document.getElementById('totalColorsCount').textContent = data.total || 0;

    renderColorGrid(textColorGrid, data.details.text);
    renderColorGrid(bgColorGrid, data.details.background);
    renderColorGrid(borderColorGrid, data.details.border);
  }

  function renderColorGrid(container, colors) {
    container.innerHTML = '';
    if (!colors || colors.length === 0) {
      container.innerHTML = '<p style="font-size:12px; color:var(--text-light)">No colors found</p>';
      return;
    }

    colors.forEach(color => {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.innerHTML = `
            <div class="palette-color" style="background: ${color}; height: 40px; border-radius: 4px;"></div>
            <div class="palette-hex" title="Click to copy">${color}</div>
          `;

      item.querySelector('.palette-hex').addEventListener('click', () => {
        navigator.clipboard.writeText(color);
        const original = item.querySelector('.palette-hex').textContent;
        item.querySelector('.palette-hex').textContent = 'Copied!';
        setTimeout(() => {
          item.querySelector('.palette-hex').textContent = original;
        }, 1000);
      });

      container.appendChild(item);
    });
  }
}



// Duplicate analyzeImages function removed


function renderImageIssues(issues) {
  const list = document.getElementById('imageIssuesList');
  if (!list) return;

  list.innerHTML = '';
  if (issues.length === 0) {
    list.innerHTML = '<p class="status-pass">✅ No accessibility issues found!</p>';
    return;
  }

  issues.forEach(issue => {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;';
    div.innerHTML = `<strong>${issue.type}</strong>: ${issue.message}`;
    list.appendChild(div);
  });
}