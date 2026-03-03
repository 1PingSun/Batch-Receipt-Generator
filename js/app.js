/**
 * app.js
 * 主控制邏輯：CSV 解析 → 資料預覽 → PDF 批次生成 → ZIP 下載
 */

/* ═══════════════════════════════════════════════
   狀態管理
═══════════════════════════════════════════════ */
const State = {
  parsedRows: [],
  fontReady: false,
  fontHasCJK: false, // true = 中文字體，false = Roboto fallback
};

/* ═══════════════════════════════════════════════
   必填欄位
═══════════════════════════════════════════════ */
const REQUIRED_FIELDS = ['customer', 'item', 'amount'];

/* ═══════════════════════════════════════════════
   DOM 快取
═══════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const DOM = {
  fontStatus: $('font-status'),
  fontStatusText: $('font-status-text'),
  fontProgress: $('font-progress'),
  statusIcon: $('font-status')?.querySelector('.status-icon'),

  fontFallbackPanel: $('font-fallback-panel'),
  fontFileInput: $('font-file-input'),
  btnUseRoboto: $('btn-use-roboto'),

  dropZone: $('drop-zone'),
  fileInput: $('file-input'),
  csvTextarea: $('csv-textarea'),
  orgNameInput: $('org-name-input'),
  receiptDateInput: $('receipt-date-input'),
  filenamePatternInput: $('filename-pattern-input'),
  filenamePreview: $('filename-preview'),
  btnLoadSample: $('btn-load-sample'),
  btnDownloadTemplate: $('btn-download-template'),
  btnClear: $('btn-clear'),
  btnParse: $('btn-parse'),

  stepInput: $('step-input'),
  stepPreview: $('step-preview'),
  stepGenerating: $('step-generating'),

  previewCount: $('preview-count'),
  previewThead: $('preview-thead'),
  previewTbody: $('preview-tbody'),
  validationErrors: $('validation-errors'),

  btnBack: $('btn-back'),
  btnGenerateNormal: $('btn-generate-normal'),
  btnGenerateBeautiful: $('btn-generate-beautiful'),

  genProgressBar: $('gen-progress-bar'),
  genProgressText: $('gen-progress-text'),
  genStatusText: $('gen-status-text'),

  guideCollapsible: $('format-guide'),
  guideTrigger: $('guide-trigger'),

  toastContainer: $('toast-container'),
};

/* ═══════════════════════════════════════════════
   初始化
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  _initFontLoader();
  _initDragDrop();
  _initButtons();
  _initCollapsible();
  if (DOM.receiptDateInput) {
    DOM.receiptDateInput.value = new Date().toISOString().slice(0, 10);
  }
});

/* ── 字體載入 ── */
async function _initFontLoader() {
  /* 先綁定本機字體上傳與略過按鈕（面板尚未顯示） */
  DOM.fontFileInput?.addEventListener('change', _onLocalFontSelected);
  DOM.btnUseRoboto?.addEventListener('click', _onSkipFont);

  try {
    const success = await FontLoader.load(_onFontProgress, _onAllCdnFailed);

    if (success) {
      /* CDN 字體載入成功 */
      State.fontReady = true;
      State.fontHasCJK = true;
      _setFontStatus('ready', '✓ 中文字體載入完成，可以開始使用！');
      DOM.btnParse.disabled = DOM.csvTextarea.value.trim() === '';
    }
    /* 若 success === false，代表所有 CDN 均失敗，
       _onAllCdnFailed 已被呼叫，等待使用者操作。 */
  } catch (e) {
    console.error('[App] FontLoader error:', e);
    _onAllCdnFailed();
  }
}

/* 所有 CDN 均失敗 → 顯示備援面板 */
function _onAllCdnFailed() {
  _setFontStatus('error', '⚠ 自動下載字體失敗，請選擇下方處理方式。');
  DOM.fontFallbackPanel?.classList.remove('hidden');
}

/* 使用者上傳本機字體 */
async function _onLocalFontSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.match(/\.(ttf|otf)$/i)) {
    showToast('請選擇 .ttf 或 .otf 格式的字體檔案。', 'error');
    return;
  }

  _setFontStatus('loading', `讀取字體：${file.name}…`);
  DOM.fontFallbackPanel?.classList.add('hidden');

  try {
    const buffer = await file.arrayBuffer();
    const success = await FontLoader.loadFromArrayBuffer(buffer);
    State.fontReady = true;
    State.fontHasCJK = success;

    if (success) {
      _setFontStatus('ready', `✓ 字體「${file.name}」載入成功！`);
      showToast('本機字體載入成功，PDF 中文將可正確顯示。', 'success');
    } else {
      _setFontStatus('error', '⚠ 字體解析失敗，將使用預設字體。');
      showToast('字體解析失敗，PDF 中文可能顯示為方框。', 'error', 5000);
    }
  } catch (err) {
    console.error('[App] 本機字體讀取失敗：', err);
    _setFontStatus('error', '⚠ 字體讀取失敗。');
    showToast('字體讀取失敗，請重試。', 'error');
    DOM.fontFallbackPanel?.classList.remove('hidden');
  }
  DOM.btnParse.disabled = DOM.csvTextarea.value.trim() === '';
}

/* 使用者選擇略過 → Roboto fallback */
function _onSkipFont() {
  FontLoader.skipToFallback();
  State.fontReady = true;
  State.fontHasCJK = false;
  DOM.fontFallbackPanel?.classList.add('hidden');
  _setFontStatus('error', '⚠ 使用預設字體（中文字可能為方框）。');
  showToast('將以預設英文字體生成 PDF，中文字可能無法顯示。', 'info', 5000);
  DOM.btnParse.disabled = DOM.csvTextarea.value.trim() === '';
}

function _onFontProgress(pct, label) {
  DOM.fontProgress.style.width = pct + '%';
  DOM.fontStatusText.textContent = label;
}

function _setFontStatus(type, text) {
  // type: 'loading' | 'ready' | 'error'
  DOM.fontStatus.className = `status-bar status-${type === 'loading' ? 'loading' : type}`;
  DOM.fontStatusText.textContent = text;
  DOM.fontProgress.style.width = (type === 'ready') ? '100%' : DOM.fontProgress.style.width;

  const icon = DOM.fontStatus.querySelector('.status-icon');
  if (icon) {
    icon.textContent = type === 'ready' ? '✓' : type === 'error' ? '⚠' : '⟳';
    icon.style.animation = (type === 'loading') ? '' : 'none';
  }
}

/* ── 拖曳上傳 ── */
function _initDragDrop() {
  const dz = DOM.dropZone;

  dz.addEventListener('click', () => DOM.fileInput.click());
  DOM.fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) _readFile(file);
    e.target.value = ''; // reset so same file can be re-selected
  });

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      _readFile(file);
    } else {
      showToast('請上傳 .csv 格式的檔案。', 'error');
    }
  });
}

function _readFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    DOM.csvTextarea.value = e.target.result;
    _onTextareaChange();
    showToast(`已載入：${file.name}`, 'success');
  };
  reader.onerror = () => showToast('讀取檔案時發生錯誤，請重試。', 'error');
  reader.readAsText(file, 'UTF-8');
}

/* ── 按鈕事件 ── */
function _initButtons() {
  /* 即時偵測 textarea 輸入，控制「解析」按鈕 */
  DOM.csvTextarea.addEventListener('input', _onTextareaChange);

  /* 檔名格式輸入：即時預覽 + 變數按鈕 */
  DOM.filenamePatternInput?.addEventListener('input', _updateFilenamePreview);
  document.querySelectorAll('.token-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const inp = DOM.filenamePatternInput;
      if (!inp) return;
      const token = chip.dataset.token;
      const start = inp.selectionStart;
      const end = inp.selectionEnd;
      inp.value = inp.value.slice(0, start) + token + inp.value.slice(end);
      inp.focus();
      inp.setSelectionRange(start + token.length, start + token.length);
      _updateFilenamePreview();
    });
  });
  _updateFilenamePreview();

  DOM.btnLoadSample.addEventListener('click', () => {
    DOM.csvTextarea.value = _sampleCSV();
    _onTextareaChange();
    showToast('已載入範例資料。', 'info');
  });

  DOM.btnDownloadTemplate?.addEventListener('click', _downloadTemplateCsv);

  DOM.btnClear.addEventListener('click', () => {
    DOM.csvTextarea.value = '';
    _onTextareaChange();
  });

  DOM.btnParse.addEventListener('click', _parseAndPreview);
  DOM.btnBack.addEventListener('click', _backToInput);
  DOM.btnGenerateNormal.addEventListener('click', () => _startGeneration('normal'));
  DOM.btnGenerateBeautiful.addEventListener('click', () => _startGeneration('beautiful'));
}

function _onTextareaChange() {
  DOM.btnParse.disabled = !State.fontReady || DOM.csvTextarea.value.trim() === '';
}

/* 檔名即時預覽（以第一筆範例資料为測試輸入） */
function _updateFilenamePreview() {
  const el = DOM.filenamePreview;
  if (!el) return;
  const pattern = (DOM.filenamePatternInput?.value || '').trim();
  if (!pattern) { el.textContent = ''; return; }

  /* 嘗試使用第一筆已解析資料預覽；若尚未解析則用包含示例值的 mock 資料 */
  const sampleRow = (State.parsedRows && State.parsedRows.length)
    ? State.parsedRows[0]
    : { customer: '王小明', item: '車馬費' };

  const globalDate = DOM.receiptDateInput?.value || '';
  el.textContent = PdfGenerator.buildFilename(pattern, sampleRow, globalDate);
}

/* ── Collapsible ── */
function _initCollapsible() {
  DOM.guideTrigger?.addEventListener('click', () => {
    DOM.guideCollapsible?.classList.toggle('open');
  });
}

/* ═══════════════════════════════════════════════
   STEP 1 → STEP 2：解析 & 預覽
═══════════════════════════════════════════════ */
function _parseAndPreview() {
  const raw = DOM.csvTextarea.value.trim();
  if (!raw) { showToast('請先輸入 CSV 資料。', 'error'); return; }

  const result = Papa.parse(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
    transform: v => v.trim(),
  });

  if (result.errors.length > 0) {
    const msgs = result.errors.map(e => `第 ${(e.row || 0) + 2} 行：${e.message}`);
    _showValidationErrors(msgs);
    showToast('CSV 解析發生錯誤，請確認格式。', 'error');
    return;
  }

  const rows = result.data;

  /* 欄位驗證 */
  const errors = _validateRows(rows);
  if (errors.length > 0) {
    _showValidationErrors(errors);
    return;
  }

  _hideValidationErrors();
  State.parsedRows = rows;

  _renderPreviewTable(rows);

  DOM.stepInput.classList.add('hidden');
  DOM.stepPreview.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function _validateRows(rows) {
  const errors = [];

  if (!rows || rows.length === 0) {
    errors.push('CSV 不包含任何資料列。');
    return errors;
  }

  const headers = Object.keys(rows[0]).map(k => k.toLowerCase().trim());
  const missing = REQUIRED_FIELDS.filter(f => !headers.includes(f));

  if (missing.length > 0) {
    errors.push(`缺少必要欄位：${missing.map(f => `<code>${f}</code>`).join('、')}`);
  }

  /* 检查每一行的必填字段 */
  rows.forEach((row, i) => {
    const rowNum = i + 2; // 含標題行偏移
    REQUIRED_FIELDS.forEach(field => {
      if (!row[field] || String(row[field]).trim() === '') {
        errors.push(`第 ${rowNum} 行：欄位 <code>${field}</code> 不得為空。`);
      }
    });
    if (row.amount && isNaN(parseFloat(row.amount))) {
      errors.push(`第 ${rowNum} 行：<code>amount</code> 必須為數字，目前值為「${row.amount}」。`);
    }
  });

  return errors;
}

function _showValidationErrors(msgs) {
  DOM.validationErrors.innerHTML = '<strong>⚠ 發現以下問題，請修正後重試：</strong><ul>' +
    msgs.map(m => `<li>${m}</li>`).join('') + '</ul>';
  DOM.validationErrors.classList.remove('hidden');
  DOM.btnGenerateNormal.disabled = true;
  DOM.btnGenerateBeautiful.disabled = true;
}

function _hideValidationErrors() {
  DOM.validationErrors.innerHTML = '';
  DOM.validationErrors.classList.add('hidden');
  DOM.btnGenerateNormal.disabled = false;
  DOM.btnGenerateBeautiful.disabled = false;
}

function _renderPreviewTable(rows) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  /* 列頭 */
  DOM.previewThead.innerHTML =
    '<tr>' + headers.map(h => `<th>${_escHtml(h)}</th>`).join('') + '</tr>';

  /* 最多顯示 50 列（Preview 用途） */
  const MAX_PREVIEW = 50;
  const shown = rows.slice(0, MAX_PREVIEW);

  DOM.previewTbody.innerHTML = shown.map(row =>
    '<tr>' + headers.map(h => `<td title="${_escHtml(row[h] || '')}">${_escHtml(row[h] || '')}</td>`).join('') + '</tr>'
  ).join('');

  const totalCount = rows.length;
  const shownCount = shown.length;
  const extraNote = totalCount > MAX_PREVIEW ? `（顯示前 ${MAX_PREVIEW} 筆）` : '';
  DOM.previewCount.textContent = `共 ${totalCount} 筆資料${extraNote}`;
}

function _backToInput() {
  DOM.stepPreview.classList.add('hidden');
  DOM.stepInput.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════
   STEP 2 → STEP 3：批次生成 + ZIP 下載
═══════════════════════════════════════════════ */
async function _startGeneration(templateType) {
  if (!State.parsedRows.length) return;

  const rows = State.parsedRows;

  /* 警告超大批次 */
  if (rows.length > 100) {
    const ok = confirm(`您即將生成 ${rows.length} 份 PDF，建議單次不超過 100 份以避免瀏覽器記憶體不足。\n確定繼續？`);
    if (!ok) return;
  }

  DOM.stepPreview.classList.add('hidden');
  DOM.stepGenerating.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const fontName = State.fontHasCJK ? FontLoader.FONT_NAME : 'Roboto';
    const orgName = (DOM.orgNameInput?.value || '').trim();
    const globalDate = DOM.receiptDateInput?.value || '';
    const filePattern = (DOM.filenamePatternInput?.value || '').trim() || '{name}-{month_zh}';

    /* 生成所有 PDF */
    const pdfs = await PdfGenerator.generateAll(
      rows,
      fontName,
      orgName,
      globalDate,
      filePattern,
      templateType,
      (current, total, filename) => _updateGenProgress(current, total, filename)
    );

    /* 打包 ZIP */
    DOM.genStatusText.textContent = '打包壓縮中…';
    const zip = new JSZip();
    pdfs.forEach(({ name, blob }) => zip.file(name, blob));

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }, meta => {
      const pct = Math.round(meta.percent);
      DOM.genProgressBar.style.width = pct + '%';
      DOM.genStatusText.textContent = `壓縮中… ${pct}%`;
    });

    /* 觸發下載 */
    const ts = new Date().toISOString().slice(0, 10);
    const fname = `收據批次_${ts}_${rows.length}份.zip`;
    _triggerDownload(zipBlob, fname);

    DOM.genStatusText.textContent = `✓ 完成！已下載 ${rows.length} 份 PDF。`;
    DOM.genProgressBar.style.width = '100%';
    showToast(`🎉 成功生成並下載 ${rows.length} 份 PDF！`, 'success', 6000);

    /* 提供重設按鈕 */
    setTimeout(() => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '← 重新開始';
      btn.style.marginTop = '20px';
      btn.addEventListener('click', _resetAll);
      DOM.stepGenerating.querySelector('.center-content').appendChild(btn);
    }, 800);

  } catch (err) {
    console.error('[App] Generation error:', err);
    showToast(`生成時發生錯誤：${err.message}`, 'error', 8000);
    DOM.stepGenerating.classList.add('hidden');
    DOM.stepPreview.classList.remove('hidden');
  }
}

function _updateGenProgress(current, total, filename) {
  const pct = Math.round((current / total) * 90); // 90% 留給 zip
  DOM.genProgressBar.style.width = pct + '%';
  DOM.genProgressText.textContent = `${current} / ${total}`;
  DOM.genStatusText.textContent = `生成中：${filename}`;
}

function _triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function _resetAll() {
  State.parsedRows = [];
  DOM.csvTextarea.value = '';
  DOM.previewThead.innerHTML = '';
  DOM.previewTbody.innerHTML = '';
  DOM.genProgressBar.style.width = '0%';
  DOM.genProgressText.textContent = '0 / 0';
  DOM.genStatusText.textContent = '準備中…';

  /* 移除動態加入的按鈕 */
  const cc = DOM.stepGenerating.querySelector('.center-content');
  cc.querySelectorAll('.btn').forEach(b => b.remove());

  DOM.stepGenerating.classList.add('hidden');
  DOM.stepPreview.classList.add('hidden');
  DOM.stepInput.classList.remove('hidden');
  _onTextareaChange();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════
   Toast 通知
═══════════════════════════════════════════════ */
function showToast(message, type = 'info', duration = 4000) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${_escHtml(message)}</span>`;
  DOM.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* ═══════════════════════════════════════════════
   範例資料
═══════════════════════════════════════════════ */
function _sampleCSV() {
  return [
    'org,customer,id_number,address,phone,item,amount,note',
    'XX 社會福利基金會,王小明,A987654321,台北市中正區重慶南路一段122號,0912345678,車馬費,1000,',
    'XX 社會福利基金會,王大明,A123456789,台北市信義區松仁路100號,0912345678,誤餐費,800,出差補助',
    'XX 社會福利基金會,李小美,F234567890,台中市西屯區台灣大道二段10號,0923456789,交通費,1200,',
  ].join('\n');
}

/* 下載 CSV 範本（空白模板，只含標頭 + 一筆示例） */
function _downloadTemplateCsv() {
  const header = 'org,customer,id_number,address,phone,item,amount,note';
  const example = '機構名稱,姓名,身分證字號,戶籍地址,連絡電話,請款項目,金額數字,備註';
  const csv = header + '\n' + example + '\n';
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM 讓 Excel 正確識別 UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '領據_範本模板.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('範本 CSV 已下載，用 Excel 或文字編輯器開啟填寫後再匯入。', 'success', 5000);
}

/* ═══════════════════════════════════════════════
   工具函式
═══════════════════════════════════════════════ */
function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
