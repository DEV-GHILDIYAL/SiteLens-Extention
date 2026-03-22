// SiteLens Premium Sidepanel Controller
document.addEventListener('DOMContentLoaded', function () {
  console.log('🚀 SiteLens Premium loaded');

  // Initialize Global Managers
  window.selfAudit = new SelfAuditManager();
  window.imageAudit = new ImageAuditManager();

  /**
   * ENSURE FRESH PAGE
   * Reloads the active tab and waits for it to complete.
   * This ensures a fresh connection and that content scripts are ready.
   */
  async function ensureFreshPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Skip system pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
      return;
    }

    console.log('🔄 Auto-refreshing page for fresh connection...');

    return new Promise((resolve) => {
      let resolved = false;

      // Timeout safety (3 seconds)
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }, 3000);

      function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          resolved = true;
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          // Extra buffer for scripts to initialize
          setTimeout(resolve, 800);
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.reload(tab.id);
    });
  }

  // Navigation handled in initializeNavigation()


  // Handle Back Navigation
  // Back button handled in initializeNavigation()


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

  // Listener for Results from Content Script (Post-Reload)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'contentCheckResults') {
      console.log('📬 Received contentCheckResults:', message.results);
      displayContentCheckResults(message.results);
    }
  });

  async function handleContentCheck() {
    console.log('🔍 handleContentCheck triggered');
    const text = contentInput.value.trim();
    if (!text) {
      alert('Please enter text or upload a file');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Parse Input into Lines
    const sourceLines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Save to storage and Reload
    chrome.storage.local.set({ 
      pendingContentCheck: true,
      sourceLines: sourceLines,
      tabId: tab.id 
    }, () => {
      console.log('💾 Pending check saved. Reloading tab...');
      
      // Update UI to "Analyzing" state
      document.getElementById('contentResults').style.display = 'block';
      document.getElementById('contentMatchPercent').textContent = '...';
      document.getElementById('contentMissingCount').textContent = '...';
      const detailsEl = document.getElementById('contentResultDetails');
      if (detailsEl) {
        detailsEl.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; background: rgba(30, 41, 59, 0.4); border-radius: 12px;">
            <div style="font-size: 32px; animation: pulse 1.5s infinite;">👀</div>
            <div style="color: var(--text-dim); font-size: 13px; font-weight: 500;">Reloading & Reaching Footer...</div>
          </div>
        `;
      }

      chrome.tabs.reload(tab.id);
    });
  }

  function displayContentCheckResults(results) {
    if (!results || !results.success) return;

    // Calculate Percentage
    const percent = results.totalLines > 0 
      ? Math.round((results.matchCount / results.totalLines) * 100) 
      : 0;
    
    // Update UI
    const matchPercentEl = document.getElementById('contentMatchPercent');
    const missingCountEl = document.getElementById('contentMissingCount');
    const detailsEl = document.getElementById('contentResultDetails');

    if (matchPercentEl) matchPercentEl.textContent = percent + '%';
    if (missingCountEl) missingCountEl.textContent = results.missingLines.length;

    if (detailsEl) {
      if (results.missingLines.length === 0) {
        detailsEl.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; text-align: center;">
            <div style="font-size: 32px;">✨</div>
            <div style="color: #10b981; font-weight: 700; font-size: 14px; font-family: 'Outfit', sans-serif;">ALL CONTENT FOUND!</div>
            <div style="color: var(--text-muted); font-size: 11px;">Every segment was identified on the page.</div>
          </div>
        `;
      } else {
        detailsEl.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${results.missingLines.map((line, idx) => `
              <div style="display: flex; gap: 12px; padding: 12px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; transition: all 0.2s ease;">
                <div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-radius: 6px; font-weight: 800; font-size: 10px; flex-shrink: 0;">
                  ${idx + 1}
                </div>
                <div style="font-size: 12px; line-height: 1.5; color: var(--text-main); font-weight: 400;">
                  ${line}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
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
      if (toggleBtn) {
        toggleBtn.disabled = true;
        toggleBtn.innerHTML = '<span class="btn-icon">⏳</span>Analyzing...';
      }
      
      console.log('🔍 Starting analysis...');
      setStatus('analyzing', 'Refreshing page...');
      await ensureFreshPage();
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
          if (toggleBtn) toggleBtn.disabled = true;
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
          if (toggleBtn) toggleBtn.disabled = true;
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
    const totalCount = violations ? violations.length : 0;

    console.log('📊 Displaying results:', summary);

    resultsSection.style.display = 'block';
    secondaryActions.style.display = 'block';

    if (toggleBtn) {
      toggleBtn.disabled = false;
      toggleBtn.innerHTML = '<span class="btn-icon">🙈</span>Hide Highlights';
    }

    // Update Total and Status
    document.getElementById('totalViolations').textContent = totalCount;
    const statusSummary = document.getElementById('statusSummary');
    const scoreCard = document.querySelector('.score-card');
    const perfectState = document.getElementById('perfectState');

    if (totalCount === 0) {
      statusSummary.textContent = 'Excellent!';
      statusSummary.style.color = 'var(--success)';
      if (scoreCard) scoreCard.style.borderLeft = '4px solid var(--success)';
      if (perfectState) perfectState.style.display = 'block';
    } else {
      statusSummary.textContent = totalCount < 5 ? 'Good Progress' : 'Needs Attention';
      statusSummary.style.color = totalCount < 5 ? 'var(--warning)' : 'var(--danger)';
      if (scoreCard) scoreCard.style.borderLeft = `4px solid ${totalCount < 5 ? 'var(--warning)' : 'var(--danger)'}`;
      if (perfectState) perfectState.style.display = 'none';
    }

    // Update Counts
    const criticalCount = summary.byCategory ?
      Object.values(summary.byCategory).reduce((sum, val) => sum + val, 0) : 0;
    document.getElementById('criticalCount').textContent =
      Math.min(criticalCount, totalCount);

    const categories = summary.byCategory || {};
    document.getElementById('textCount').textContent = categories.text || 0;
    document.getElementById('buttonCount').textContent = categories.button || 0;
    document.getElementById('gradientCount').textContent = categories.gradient || 0;
    document.getElementById('imageCount').textContent = categories.image || 0;

    if (summary.worstContrast) {
      const worstCase = document.getElementById('worstCase');
      if (worstCase) worstCase.style.display = 'flex'; // Changed to flex for minimal design

      const ratioDisplay = document.getElementById('worstRatioDisplay');
      if (ratioDisplay) ratioDisplay.textContent = summary.worstContrast.contrastRatio.toFixed(2) + ':1';
      
      const textColorDot = document.getElementById('worstTextColor');
      if (textColorDot) textColorDot.style.backgroundColor = summary.worstContrast.textColor;
      
      const bgColorDot = document.getElementById('worstBgColor');
      if (bgColorDot) bgColorDot.style.backgroundColor = summary.worstContrast.backgroundColor;
    } else {
      const worstCase = document.getElementById('worstCase');
      if (worstCase) worstCase.style.display = 'none';
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
          
          if (response.visible) {
            toggleBtn.classList.remove('btn-secondary');
            toggleBtn.classList.add('btn-primary');
          } else {
            toggleBtn.classList.add('btn-secondary');
            toggleBtn.classList.remove('btn-primary');
          }
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
    
    // New Compact Result UI
    const ratioHtml = `
      <div class="compact-ratio-strip">
        <div class="strip-main">
          <span class="strip-ratio">${ratio.toFixed(2)}:1</span>
          <span class="strip-status ${ratio >= 4.5 ? 'pass' : 'fail'}">${ratio >= 4.5 ? 'PASS' : 'FAIL'}</span>
        </div>
        <div class="strip-compliance">
          <span class="mini-badge ${ratio >= 4.5 ? 'pass' : 'fail'}">AA</span>
          <span class="mini-badge ${ratio >= 7 ? 'pass' : 'fail'}">AAA</span>
          <span class="mini-badge ${ratio >= 3 ? 'pass' : 'fail'}">LG</span>
        </div>
      </div>
    `;
    
    document.getElementById('manualRatio').innerHTML = ratioHtml;

    // Small Sample View
    const sampleNormal = document.getElementById('sampleNormal');
    const sampleLarge = document.getElementById('sampleLarge');
    
    if (sampleNormal) {
      sampleNormal.style.color = text;
      sampleNormal.style.backgroundColor = bg;
      sampleNormal.style.padding = '8px';
      sampleNormal.style.borderRadius = '6px';
    }
    if (sampleLarge) {
      sampleLarge.style.color = text;
      sampleLarge.style.backgroundColor = bg;
      sampleLarge.style.padding = '8px';
      sampleLarge.style.borderRadius = '6px';
    }

    // Hide the old large compliance grid if it exists
    const oldGrid = document.querySelector('.compliance-grid');
    if (oldGrid) oldGrid.style.display = 'none';
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
  if (!themeInputs) return;

  // Remove color count selector safely
  const colorCount = document.getElementById('colorCount');
  if (colorCount) {
    const group = colorCount.closest('.input-group');
    if (group) group.remove();
  }

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

    // Display palette as grid (Compact version)
    paletteDisplay.innerHTML = '';
    paletteDisplay.style.display = 'flex';
    paletteDisplay.style.flexWrap = 'wrap';
    paletteDisplay.style.gap = '6px';
    paletteDisplay.style.margin = '10px 0';

    palette.forEach(color => {
      const item = document.createElement('div');
      item.className = 'mini-color-swatch';
      item.style.backgroundColor = color.hex;
      item.title = `${color.name}: ${color.hex}`;

      item.onclick = async () => {
        await navigator.clipboard.writeText(color.hex);
        const hex = item.querySelector('.color-hex');
        const original = hex.textContent;
        hex.textContent = 'COPIED';
        setTimeout(() => hex.textContent = original, 1000);
      };

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
            <div class="compact-specs">
                <div class="spec-pill"><span class="dot" style="background:${btnData.bg}"></span>BG: ${btnData.bg}</div>
                <div class="spec-pill"><span class="dot" style="background:${btnData.text}"></span>Text: ${btnData.text}</div>
                <div class="spec-pill contrast ${isPass ? 'pass' : 'fail'}">${btnData.ratio.toFixed(1)}:1</div>
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
function initializeButtonAudit() {
  const buttonAnalyzeBtn = document.getElementById('buttonAnalyzeBtn');
  if (buttonAnalyzeBtn) {
    buttonAnalyzeBtn.addEventListener('click', async () => {
      const originalText = buttonAnalyzeBtn.innerHTML;
      buttonAnalyzeBtn.disabled = true;
      buttonAnalyzeBtn.innerHTML = '⏳ Analyzing...';

      try {
        await ensureFreshPage();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'analyzeButtons' }, (response) => {
          buttonAnalyzeBtn.disabled = false;
          buttonAnalyzeBtn.innerHTML = originalText;

          if (response && response.success) {
            displayButtonResults(response.summary);
          } else {
            alert('Button Analysis failed: ' + (response?.error || 'Unknown error'));
          }
        });
      } catch (e) {
        console.error(e);
        buttonAnalyzeBtn.disabled = false;
        buttonAnalyzeBtn.innerHTML = originalText;
      }
    });
  }

  // Highlight All Buttons Issue
  const highlightAllBtn = document.getElementById('highlightAllButtonsBtn');
  if (highlightAllBtn) {
    highlightAllBtn.addEventListener('click', () => {
      if (!lastButtonSummary) return;
      
      const selectors = [
        ...lastButtonSummary.capitalizationIssues.map(i => i.button.selector),
        ...lastButtonSummary.destinationIssues.map(i => i.button.selector)
      ];

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightButtons', selectors }, (response) => {
            if (response && response.success) {
              highlightAllBtn.innerHTML = '✅ Highlighted!';
              const clearBtn = document.getElementById('clearButtonHighlightsBtn');
              if (clearBtn) clearBtn.style.display = 'block';
              setTimeout(() => highlightAllBtn.innerHTML = '<span class="btn-icon">👁️</span> Highlight All Issues', 2000);
            }
          });
        }
      });
    });
  }

  // Clear Highlights
  const clearBtn = document.getElementById('clearButtonHighlightsBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'clearButtonHighlight' }, () => {
            clearBtn.style.display = 'none';
          });
        }
      });
    });
  }
}

let lastButtonSummary = null;

function displayButtonResults(summary) {
  const buttonResults = document.getElementById('buttonResults');
  if (!buttonResults) return;

  buttonResults.style.display = 'block';
  lastButtonSummary = summary;

  // Show/Hide Actions based on issues
  const buttonActions = document.getElementById('buttonActions');
  const highlightAllBtn = document.getElementById('highlightAllButtonsBtn');
  const clearHighlightsBtn = document.getElementById('clearButtonHighlightsBtn');

  if (buttonActions) {
    const hasIssues = (summary.capitalizationIssues.length + summary.destinationIssues.length) > 0;
    buttonActions.style.display = 'grid'; // Use grid for action buttons
    buttonActions.style.gridTemplateColumns = '1fr 1fr';
    buttonActions.style.gap = '8px';
    buttonActions.style.margin = '15px 0';

    if (highlightAllBtn) {
      highlightAllBtn.style.display = hasIssues ? 'block' : 'none';
      highlightAllBtn.innerHTML = '<span class="btn-icon">👁️</span> Highlight All Issues';
    }
    if (clearHighlightsBtn) {
      clearHighlightsBtn.style.display = 'none';
    }
  }

  const hasIssues = (summary.capitalizationIssues.length + summary.destinationIssues.length) > 0;
  const statusType = summary.stats.total === 0 ? 'warning' : (hasIssues ? 'fail' : 'pass');
  
  let html = `
      <div class="premium-status-card ${statusType}">
        <div class="status-icon">${statusType === 'pass' ? '✅' : (statusType === 'warning' ? '⚠️' : '🚨')}</div>
        <div class="status-content">
          <div class="status-title">${summary.stats.total === 0 ? 'No Buttons Found' : (hasIssues ? 'Button Issues Detected' : 'All Buttons Valid')}</div>
          <div class="status-desc">${summary.stats.total} buttons analyzed on this page.</div>
        </div>
      </div>

      <div class="premium-stats-grid">
        <div class="stat-pill total">
          <span class="pill-label">Total</span>
          <span class="pill-value">${summary.stats.total}</span>
        </div>
        <div class="stat-pill warning">
          <span class="pill-label">Caps</span>
          <span class="pill-value">${summary.stats.capitalizationIssues}</span>
        </div>
        <div class="stat-pill danger">
          <span class="pill-label">Links</span>
          <span class="pill-value">${summary.stats.destinationIssues}</span>
        </div>
      </div>
    `;

  // Show issues if any
  if (hasIssues) {
    html += `<div class="results-sections-wrapper">`;
    
    // Capitalization
    if (summary.capitalizationIssues.length > 0) {
      html += `
        <div class="result-group">
          <div class="group-header">📝 Capitalization Issues</div>
          <div class="issue-cards-container">
      `;
      summary.capitalizationIssues.forEach(issue => {
        html += `
          <div class="premium-issue-card warning clickable" data-selector="${escapeHtml(issue.button.selector)}">
            <div class="card-left">
              <div class="card-main-text">"${escapeHtml(issue.button.text)}"</div>
              <div class="card-sub-text">${issue.message}</div>
            </div>
            <div class="card-right">
              <span class="badge warning">${issue.style}</span>
              <div class="card-arrow">→</div>
            </div>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    // Destination
    if (summary.destinationIssues.length > 0) {
      html += `
        <div class="result-group">
          <div class="group-header">🔗 Link Mismatches</div>
          <div class="issue-cards-container">
      `;
      summary.destinationIssues.forEach(issue => {
        html += `
          <div class="premium-issue-card danger clickable" data-selector="${escapeHtml(issue.button.selector)}">
            <div class="card-left">
              <div class="card-main-text">"${escapeHtml(issue.button.text)}"</div>
              <div class="card-sub-text">${issue.message}</div>
              <div class="card-code-block">${escapeHtml(issue.button.destination)}</div>
            </div>
            <div class="card-right">
              <div class="card-arrow">→</div>
            </div>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    html += `</div>`;
  } else if (summary.stats.total > 0) {
    html += `
      <div class="empty-state-card success">
        <div class="empty-icon">✨</div>
        <div class="empty-title">Great Job!</div>
        <div class="empty-desc">No accessibility issues found for the buttons on this page.</div>
      </div>
    `;
  }

  // All Buttons List (Collapsible or simplified)
  if (summary.buttons.length > 0) {
    html += `
      <div class="result-group">
        <div class="group-header">📋 Analyzed Buttons (${summary.buttons.length})</div>
        <div class="premium-compact-list">
    `;
    summary.buttons.slice(0, 30).forEach(button => {
      html += `
        <div class="compact-item">
          <span class="item-tag">${button.tagName}</span>
          <span class="item-text">"${escapeHtml(button.text)}"</span>
        </div>
      `;
    });
    if (summary.buttons.length > 30) {
      html += `<div class="list-more">+ ${summary.buttons.length - 30} more</div>`;
    }
    html += `</div></div>`;
  }

  buttonResults.innerHTML = html;

  // Add click handlers
  buttonResults.querySelectorAll('.premium-issue-card.clickable').forEach(card => {
    card.addEventListener('click', () => {
      const selector = card.getAttribute('data-selector');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightButton', selector: selector });
        }
      });
    });
  });
}

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

// Initialize button action listeners (Running inside main DOMContentLoaded)
const highlightAllBtn = document.getElementById('highlightAllButtonsBtn');
const clearHighlightsBtn = document.getElementById('clearButtonHighlightsBtn');

if (highlightAllBtn) highlightAllBtn.addEventListener('click', toggleHighlightAllButtons);
if (clearHighlightsBtn) clearHighlightsBtn.addEventListener('click', clearButtonHighlights);
// End button highlight coordination


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
      <!-- Font Score Card -->
      <div class="font-score-card">
        <div class="font-main-stats">
          <div class="font-stat-item">
            <span class="font-stat-label">Headings</span>
            <span class="font-stat-value">${summary.totalHeadings}</span>
          </div>
          <div class="font-stat-item">
            <span class="font-stat-label">Paragraphs</span>
            <span class="font-stat-value">${summary.totalParagraphs}</span>
          </div>
        </div>

        <div class="heading-pill-grid">
    `;

  headings.forEach(tag => {
    const data = summary[tag];
    html += `
        <div class="heading-pill">
          <span class="pill-tag">${tag.toUpperCase()}</span>
          <span class="pill-count">${data.count}</span>
        </div>
      `;
  });

  html += `
        </div>
      </div>
    `;

  // Minimalist Issues List
  if (summary.issues && summary.issues.length > 0) {
    html += `<div class="font-issues-list">
        <h3 class="section-title" style="margin-bottom: 12px; font-size: 13px;">⚠️ Structure Insights</h3>
      `;

    summary.issues.forEach(issue => {
      const severityIcon = issue.severity === 'critical' ? '🚫' : '⚠️';
      html += `
          <div class="font-issue-card ${issue.severity}">
            <span class="font-issue-icon">${severityIcon}</span>
            <span class="font-issue-msg">${issue.message}</span>
          </div>
        `;
    });

    html += `</div>`;
  }

  // Validation Status
  const isValid = summary.hierarchyValid;
  html += `
      <div class="validation-box ${isValid ? 'pass' : 'fail'}">
        ${isValid ? '✅ Hierarchy looks perfect!' : '❌ Hierarchy needs attention'}
      </div>
    `;

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
  data = data || { found: false, instances: [] };
  const container = document.getElementById('loremStatsOnly');
  const wrapper = document.getElementById('loremResultsOnly');

  if (!container) return;
  if (wrapper) wrapper.style.display = 'block';

  container.innerHTML = '';
  container.style.display = 'block';

  const hasInstances = data.found && data.instances.length > 0;
  const statusType = hasInstances ? 'fail' : 'pass';

  let html = `
    <div class="premium-status-card ${statusType}">
      <div class="status-icon">${statusType === 'pass' ? '✅' : '🚨'}</div>
      <div class="status-content">
        <div class="status-title">${hasInstances ? 'Placeholder Text Detected' : 'Content is Clean'}</div>
        <div class="status-desc">${hasInstances ? `Found ${data.instances.length} instance${data.instances.length > 1 ? 's' : ''} of Lorem Ipsum.` : 'No placeholder text was found on this page.'}</div>
      </div>
    </div>
  `;

  if (hasInstances) {
    html += `
      <button id="highlightAllLoremBtn" class="btn btn-primary premium-action-btn" style="width:100%; margin: 15px 0;">
        <span class="btn-icon">🔦</span> Highlight All on Page
      </button>
      <div class="issue-cards-container">
    `;

    data.instances.forEach((item, index) => {
      const snippet = item.text || 'Lorem ipsum text...';
      const selector = item.path || 'Unknown location';

      html += `
        <div class="premium-issue-card warning">
          <div class="card-left">
            <div class="card-tag">Instance #${index + 1}</div>
            <div class="card-main-text context-snippet">"${escapeHtml(snippet)}"</div>
            <div class="card-code-block selector-text">${escapeHtml(selector)}</div>
          </div>
          <div class="card-right">
             <button class="icon-btn highlight-single-lorem" data-selector="${escapeHtml(selector)}" title="Highlight on Page">👁️</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  } else {
    html += `
      <div class="empty-state-card success">
        <div class="empty-icon">✨</div>
        <div class="empty-title">Ready for Production</div>
        <div class="empty-desc">Your page content doesn't contain any common placeholder patterns.</div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Add Listeners
  const highlightAllBtn = container.querySelector('#highlightAllLoremBtn');
  if (highlightAllBtn) {
    highlightAllBtn.onclick = () => {
      const originalText = highlightAllBtn.innerHTML;
      highlightAllBtn.innerHTML = '🔦 Highlighting...';
      highlightAllBtn.disabled = true;

      const selectors = data.instances.map(i => i.path).filter(p => p);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightList', selectors: selectors, label: 'Lorem Ipsum' }, () => {
            setTimeout(() => {
              highlightAllBtn.innerHTML = originalText;
              highlightAllBtn.disabled = false;
            }, 1000);
          });
        }
      });
    };
  }

  container.querySelectorAll('.highlight-single-lorem').forEach(btn => {
    btn.onclick = () => {
      const selector = btn.getAttribute('data-selector');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightList', selectors: [selector], label: 'Lorem Ipsum' });
        }
      });
    };
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


function displayImageResults(response) {
  const { totalImages, issues, summary } = response;

  if (imageResults) imageResults.style.display = 'block';

  const totalCountEl = document.getElementById('totalImagesCount');
  const missingCountEl = document.getElementById('imageMissingCount');

  if (totalCountEl) totalCountEl.textContent = totalImages;
  if (missingCountEl) missingCountEl.textContent = summary.missingAlt;

  // USER REQUEST: Compact "mini-tiles" for missing alt text
  const visibleIssues = issues.filter(issue => issue.type === 'missing-alt');
  const listContainer = document.getElementById('imageIssuesList');

  if (!listContainer) return;

  if (visibleIssues.length === 0) {
    listContainer.innerHTML = `
      <div class="validation-box pass" style="grid-column: 1 / -1; width: 100%;">
        ✅ All images have alt text!
      </div>
    `;
  } else {
    let html = '';
    visibleIssues.forEach((issue) => {
      html += `
        <div class="image-mini-tile" data-selector="${escapeHtml(issue.selector)}" title="Click to highlight">
          <img src="${issue.src || ''}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSI0Ij5Ccm9rZW48L3RleHQ+PC9zdmc+'">
          <span class="tile-badge">Alt</span>
          <div class="tile-overlay">
            <span class="tile-action">Highlight</span>
          </div>
        </div>
      `;
    });
    listContainer.innerHTML = html;

    // Add click listeners for highlighting
    listContainer.querySelectorAll('.image-mini-tile').forEach(item => {
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
  if (isSEOAnalyzing) return;

  try {
    isSEOAnalyzing = true;
    seoAnalyzeBtn.disabled = true;
    seoAnalyzeBtn.innerHTML = '⏳ Analyzing...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab');

    chrome.tabs.sendMessage(tab.id, { action: 'analyzeSEO' }, (response) => {
      isSEOAnalyzing = false;
      seoAnalyzeBtn.disabled = false;
      seoAnalyzeBtn.innerHTML = '🔍 Analyze SEO';

      if (response && response.success) {
        displaySEOResults(response.summary);
      } else {
        alert('SEO Analysis failed: ' + (response?.error || 'Unknown error'));
      }
    });
  } catch (error) {
    console.error(error);
    isSEOAnalyzing = false;
    seoAnalyzeBtn.disabled = false;
    seoAnalyzeBtn.innerHTML = '🔍 Analyze SEO';
  }
}

function displaySEOResults(summary) {
  if (!summary) return;
  const seoResults = document.getElementById('seoResults');
  if (!seoResults) return;

  seoResults.style.display = 'block';
  
  // SEO Score Card
  let html = `
    <div class="font-score-card">
      <div class="font-main-stats">
        <div class="font-stat-item">
          <span class="font-stat-label">Title</span>
          <span class="font-stat-value" style="color: ${summary.title ? 'var(--success)' : 'var(--danger)'}">
            ${summary.title ? summary.title.length : 0} <small style="font-size: 10px; opacity: 0.7;">ch</small>
          </span>
        </div>
        <div class="font-stat-item">
          <span class="font-stat-label">Description</span>
          <span class="font-stat-value" style="color: ${summary.description ? 'var(--success)' : 'var(--danger)'}">
            ${summary.description ? summary.description.length : 0} <small style="font-size: 10px; opacity: 0.7;">ch</small>
          </span>
        </div>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
  `;

  // Title & Description Cards
  const metaItems = [
    { label: 'META TITLE', data: summary.title, fallback: 'No title tag found.' },
    { label: 'DESCRIPTION', data: summary.description, fallback: 'No meta description found.' }
  ];

  metaItems.forEach(item => {
    html += `
      <div class="font-issue-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 700; font-size: 11px; font-family: 'Outfit'; color: var(--text-muted); opacity: 0.8;">📄 ${item.label}</span>
          <div class="validation-box ${item.data ? 'pass' : 'fail'}">${item.data ? 'PASS' : 'FAIL'}</div>
        </div>
        <div style="font-size: 11px; color: var(--text-main); line-height: 1.5; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);">
          ${item.data ? escapeHtml(item.data.value) : item.fallback}
        </div>
      </div>
    `;
  });

  // Optimization Tips
  if (summary.issues && summary.issues.length > 0) {
    const iconMap = { 'critical': '❌', 'warning': '⚠️', 'info': 'ℹ️' };
    html += `<h3 class="section-title" style="font-size: 12px; margin-top: 8px; margin-bottom: 8px; font-family: 'Outfit';">🔍 Optimization Tips</h3>`;
    summary.issues.forEach(issue => {
      html += `
        <div class="font-issue-card">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-size: 14px;">${iconMap[issue.severity] || 'ℹ️'}</span>
            <div style="font-size: 11px; color: var(--text-muted); line-height: 1.5;">${issue.message}</div>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;
  seoResults.innerHTML = html;
}

// ========== TAB 9: TOOLS & UTILITIES ==========
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

async function analyzeImages(isDownloader = false) {
  const btn = isDownloader ? document.getElementById('downloaderAnalyzeBtn') : document.getElementById('imageAnalyzeBtn');
  const results = isDownloader ? document.getElementById('downloaderResults') : document.getElementById('imageResults');
  if (!btn || !results) return;
  
  if (isImageAnalyzing) return;
  
  const originalText = btn.innerHTML;
  btn.disabled = true;

  try {
    isImageAnalyzing = true;
    btn.innerHTML = '⏳ Refreshing...';
    
    await ensureFreshPage();
    
    btn.innerHTML = '⏳ Analyzing...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'analyzeImages' }, (response) => {
      isImageAnalyzing = false;
      btn.disabled = false;
      btn.innerHTML = originalText;

      if (response && response.success) {
        results.style.display = 'block';
        if (isDownloader) {
          const countEl = document.getElementById('downloaderCount');
          if (countEl) countEl.textContent = response.totalImages;
          const bulkActions = document.getElementById('bulkActions');
          if (bulkActions) bulkActions.style.display = 'flex';
          const selectionControl = document.getElementById('selectionControl');
          if (selectionControl) selectionControl.style.display = 'flex';
          renderImageDownloadGrid(document.getElementById('imageDownloadGrid'), response.allImages);
        } else {
          displayImageResults(response);
        }
      }
    });
  } catch (e) {
    console.error(e);
    isImageAnalyzing = false;
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

function renderImageDownloadGrid(container, images) {
  if (!container) return;
  container.innerHTML = '';
  if (!images || images.length === 0) {
    container.innerHTML = '<p>No images found.</p>';
    return;
  }

  images.forEach(img => {
    const item = document.createElement('div');
    item.className = 'image-item';
    item.innerHTML = `
          <div class="image-preview-box" style="height: 100px; display: flex; align-items: center; justify-content: center; background: #1a1a1a; overflow: hidden; border-radius: 4px;">
              <img src="${img.src}" alt="preview" style="max-height: 100%; max-width: 100%; object-fit: contain;">
          </div>
          <div class="image-info" style="margin-top: 8px;">
              <div style="font-size: 11px; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">${img.width} x ${img.height}</div>
              <div style="color: var(--text-dim); font-size: 9px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 100%;" title="${img.src}">${img.src.substring(0, 30)}...</div>
          </div>
          <div class="image-select-overlay">
              <input type="checkbox" class="image-checkbox">
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

    const checkbox = item.querySelector('.image-checkbox');
    checkbox.addEventListener('change', () => {
      updateSelectionState();
    });

    container.appendChild(item);
  });

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
  }
}

function downloadAllImages() {
  const images = document.querySelectorAll('.image-item img');
  images.forEach((img, i) => {
    setTimeout(() => {
      chrome.downloads.download({
        url: img.src,
        filename: `all-${i}-${Date.now()}.png`
      });
    }, i * 200);
  });
}

function downloadSelectedImages() {
  const checkboxes = document.querySelectorAll('.image-checkbox:checked');
  checkboxes.forEach((cb, i) => {
    const imgItem = cb.closest('.image-item');
    const img = imgItem.querySelector('img');
    setTimeout(() => {
      chrome.downloads.download({
        url: img.src,
        filename: `selected-${i}-${Date.now()}.png`
      });
    }, i * 200);
  });
}

function initializeColorExtractor() {
  const colorAnalyzeBtn = document.getElementById('colorAnalyzeBtn');
  if (colorAnalyzeBtn) {
    colorAnalyzeBtn.onclick = async () => {
      colorAnalyzeBtn.disabled = true;
      colorAnalyzeBtn.innerHTML = '⏳ Extracting...';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'analyzeColors' }, (response) => {
          if (response && response.success) {
            displayColorResults(response);
          }
          colorAnalyzeBtn.disabled = false;
          colorAnalyzeBtn.innerHTML = '🔍 Extract Colors';
        });
      } catch (e) {
        console.error(e);
        colorAnalyzeBtn.disabled = false;
        colorAnalyzeBtn.innerHTML = '🔍 Extract Colors';
      }
    };
  }

  function displayColorResults(data) {
    const results = document.getElementById('colorResults');
    if (!results) return;

    results.style.display = 'block';
    results.innerHTML = `
      <div class="compact-results-header">
        <div class="result-badge">
          <span class="badge-count">${data.total || 0}</span>
          <span class="badge-text">Unique Colors Found</span>
        </div>
      </div>
      
      <div id="textColorsGroup" class="color-group"></div>
      <div id="bgColorsGroup" class="color-group"></div>
      <div id="borderColorsGroup" class="color-group"></div>
    `;
    
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    renderPremiumChips(document.getElementById('textColorsGroup'), 'Text Colors', data.details.text);
    renderPremiumChips(document.getElementById('bgColorsGroup'), 'Background Colors', data.details.background);
    renderPremiumChips(document.getElementById('borderColorsGroup'), 'Border Colors', data.details.border);
  }

  function renderPremiumChips(container, title, colors) {
    if (!container) return;
    if (!colors || colors.length === 0) {
      container.innerHTML = ''; // Hide empty groups
      return;
    }

    container.innerHTML = `
      <div class="color-section-header">
        <h4>${title}</h4>
        <span class="color-count-pill">${colors.length}</span>
      </div>
      <div class="color-chip-grid"></div>
    `;

    const grid = container.querySelector('.color-chip-grid');
    colors.forEach(color => {
      const chip = document.createElement('div');
      chip.className = 'color-chip';
      const hex = color.toUpperCase();
      
      chip.innerHTML = `
        <div class="color-chip-swatch" style="background-color: ${color}"></div>
        <div class="color-chip-info">
          <span class="color-chip-hex">${hex}</span>
          <span class="color-chip-action">Copy</span>
        </div>
      `;

      chip.onclick = async () => {
        try {
          await navigator.clipboard.writeText(color);
          chip.classList.add('copied');
          const actionText = chip.querySelector('.color-chip-action');
          actionText.textContent = 'Copied!';
          setTimeout(() => {
            chip.classList.remove('copied');
            actionText.textContent = 'Copy';
          }, 1500);
        } catch (err) {
          console.error('Failed to copy color:', err);
        }
      };
      
      grid.appendChild(chip);
    });
  }
}

function initializeFeatures() {
  // initializeContrastAnalyzer function was merged into analyzePage logic
  initializeButtonAudit();
  initializeManualChecker();
  initializeThemeGenerator();
  initializeColorExtractor();
  initializeImageDownloader();
  initializeAltGenerator();
}

function initializeAltGenerator() {
  const companyInput = document.getElementById('altCompanyInput');
  const pageInput = document.getElementById('altPageInput');
  const imageInput = document.getElementById('altImageInput');
  const output = document.getElementById('altOutput');
  const container = document.getElementById('altOutputContainer');
  const overlay = document.getElementById('copyOverlay');

  if (!companyInput || !pageInput || !imageInput || !output || !container) return;

  const updateOutput = () => {
    const company = companyInput.value.trim();
    const page = pageInput.value.trim();
    const image = imageInput.value.trim();

    if (!company && !page && !image) {
      output.innerText = "Result will appear here...";
      output.style.color = "var(--text-dim)";
      return;
    }

    const parts = [company, page, image].filter(p => p.length > 0);
    
    let result = parts.join('-')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9\s-]/g, '') // remove other special chars
      .replace(/\s+/g, '-') // spaces to dashes
      .replace(/-+/g, '-'); // collapse dashes

    output.innerText = result;
    output.style.color = "#818cf8"; // Bright indigo for visibility
  };

  [companyInput, pageInput, imageInput].forEach(el => {
    el.addEventListener('input', updateOutput);
  });

  container.addEventListener('click', async () => {
    const text = output.innerText.trim();
    if (!text || text === "Result will appear here...") return;
    
    try {
      await navigator.clipboard.writeText(text);
      if (overlay) {
        overlay.style.display = 'flex';
        setTimeout(() => {
          overlay.style.display = 'none';
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (overlay) {
        overlay.style.display = 'flex';
        setTimeout(() => overlay.style.display = 'none', 1200);
      }
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Navigation Logic
function initializeNavigation() {
  const featureCards = document.querySelectorAll('.feature-card');
  const backBtn = document.getElementById('backBtn');

  featureCards.forEach(card => {
    card.addEventListener('click', () => {
      if (!card.classList.contains('coming-soon')) navigateToFeature(card.dataset.feature);
    });
  });

  if (backBtn) backBtn.addEventListener('click', navigateToHome);

  const grid = document.querySelector('.features-grid');
  if (grid) {
    grid.addEventListener('mousemove', (e) => {
      document.querySelectorAll('.feature-card').forEach(card => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      });
    });
  }
}

function navigateToFeature(feature) {
  document.getElementById('homeTab').classList.remove('active');
  const tab = document.getElementById(feature.endsWith('Tab') ? feature : feature + 'Tab');
  if (tab) tab.classList.add('active');
  const nav = document.getElementById('backNav');
  if (nav) nav.style.display = 'block';

  // Reset internal states of complex features
  if (window.selfAudit) window.selfAudit.resetUI();
}

function navigateToHome() {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('homeTab').classList.add('active');
  document.getElementById('backNav').style.display = 'none';

  // Reset internal states
  if (window.selfAudit) window.selfAudit.resetUI();
}

// Final Initialization
initializeNavigation();
initializeFeatures();
});