/**
 * font-loader.js
 * 動態載入中文字體並注入至 pdfmake VFS。
 *
 * 字體：cwTeXQMingZH-Medium（本地字體檔）
 * 路徑：src/cwTeXQMingZH-Medium.ttf
 *
 * 策略：
 *   1. 以 XHR 載入本地 TTF 檔
 *   2. 轉為 Base64 字串，寫入 pdfMake.vfs
 *   3. 設定 pdfMake.fonts，讓 PDF 生成時可引用 'KaiFont'
 */

const FontLoader = (() => {

  /* ── 本地字體路徑 ───────────────────────────────────────────────── */
  const FONT_URLS = [
    'src/cwTeXQMing-Medium.ttf',
  ];

  const FONT_NAME = 'KaiFont';
  const VFS_KEY = 'KaiFont.ttf';

  let _ready     = false;
  let _loading    = false;
  let _fontBase64 = null;   // 儲存已載入的字體 base64，供 getVfs() 使用
  let _onReadyCbs = [];

  /* ── Public API ── */

  /**
   * 開始非同步載入字體。
   * @param {Function} onProgress        - (percent: 0-100, label: string) => void
   * @param {Function} onAllCdnFailed    - () => void  當所有 CDN 均失敗時呼叫，顯示本機上傳提示
   * @returns {Promise<boolean>} true = 中文字體成功，false = fallback Roboto
   */
  async function load(onProgress, onAllCdnFailed) {
    if (_loading) return new Promise(res => _onReadyCbs.push(res));
    _loading = true;

    onProgress && onProgress(5, '連線至字體伺服器…');

    for (let i = 0; i < FONT_URLS.length; i++) {
      const url = FONT_URLS[i];
      try {
        onProgress && onProgress(8, `嘗試字體來源 ${i + 1}/${FONT_URLS.length}…`);
        const ok = await _fetchAndRegister(url, onProgress);
        if (ok) {
          _registerFonts(true);
          _ready = true;
          _flush(true);
          return true;
        }
      } catch (e) {
        console.warn(`[FontLoader] 來源 ${i + 1} 失敗 (${url}):`, e.message || e);
      }
    }

    /* 所有 CDN 均失敗 → 通知 UI 顯示本機上傳選項 */
    console.warn('[FontLoader] 所有 CDN 來源失敗，切換至本機上傳模式。');
    _loading = false; // 允許 loadFromArrayBuffer 重新設定
    onAllCdnFailed && onAllCdnFailed();
    /* 不立即 flush，等使用者上傳或放棄 */
    return false;
  }

  /**
   * 從本機 ArrayBuffer（使用者上傳的字體檔）載入字體。
   * @param {ArrayBuffer} buffer
   * @returns {Promise<boolean>}
   */
  async function loadFromArrayBuffer(buffer) {
    try {
      const uint8 = new Uint8Array(buffer);
      const base64 = _uint8ToBase64(uint8);
      _fontBase64 = base64;
      pdfMake.vfs[VFS_KEY] = base64;
      _registerFonts(true);
      _ready = true;
      _flush(true);
      return true;
    } catch (e) {
      console.error('[FontLoader] loadFromArrayBuffer 失敗：', e);
      _registerFonts(false);
      _ready = true;
      _flush(false);
      return false;
    }
  }

  /**
   * 放棄字體載入，使用 Roboto fallback 繼續。
   */
  function skipToFallback() {
    _registerFonts(false);
    _ready = true;
    _flush(false);
  }

  function isReady() { return _ready; }

  /* ── Private ── */

  async function _fetchAndRegister(url, onProgress) {
    onProgress && onProgress(10, '下載標楷體字型中（~5 MB），請稍候…');

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    /* 讀取 ArrayBuffer，同時追蹤進度 */
    const contentLength = parseInt(resp.headers.get('Content-Length') || '0', 10);
    let received = 0;
    const chunks = [];

    const reader = resp.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0 && onProgress) {
        const pct = Math.min(10 + Math.round((received / contentLength) * 75), 85);
        onProgress(pct, `下載字體中… ${_formatBytes(received)} / ${_formatBytes(contentLength)}`);
      }
    }

    onProgress && onProgress(87, '轉換字體格式…');

    /* 合併 Uint8Array → Base64 */
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }

    const base64 = _uint8ToBase64(merged);
    onProgress && onProgress(97, '注入字體至 PDF 引擎…');

    if (!base64) throw new Error('字體檔讀取結果為空，請確認檔案存在且不為空檔。');

    _fontBase64 = base64;
    pdfMake.vfs[VFS_KEY] = base64;
    console.log('[FontLoader] 字體已寫入 VFS，key:', VFS_KEY, '大小:', base64.length);
    return true;
  }

  function _registerFonts(hasChinese) {
    if (hasChinese) {
      pdfMake.fonts = {
        KaiFont: {
          normal: VFS_KEY,
          bold: VFS_KEY,
          italics: VFS_KEY,
          bolditalics: VFS_KEY,
        }
      };
    } else {
      /* Roboto 已是 pdfmake 的預設字體，直接沿用 */
      pdfMake.fonts = pdfMake.fonts || {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf',
        }
      };
    }
  }

  function _flush(result) {
    _onReadyCbs.forEach(cb => cb(result));
    _onReadyCbs = [];
  }

  /* Base64 encoder — 安全處理大型 Buffer（避免 call stack overflow） */
  function _uint8ToBase64(uint8) {
    const CHUNK = 8192;
    let result = '';
    for (let i = 0; i < uint8.length; i += CHUNK) {
      result += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
    }
    return btoa(result);
  }

  function _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * 回傳目前 pdfMake 字體設定（供 createPdf 第 3 個參數使用）。
   */
  function getFontsConfig() {
    return pdfMake.fonts || {};
  }

  /**
   * 回傳包含已載入字體的 VFS 快照（供 createPdf 第 4 個參數使用）。
   * 即使 pdfMake.vfs 被外部覆寫，此方法仍可保證字體存在。
   */
  function getVfs() {
    const vfs = Object.assign({}, pdfMake.vfs || {});
    if (_fontBase64 != null && _fontBase64.length > 0) vfs[VFS_KEY] = _fontBase64;
    console.log('[FontLoader] getVfs() KaiFont.ttf 存在:', !!vfs[VFS_KEY]);
    return vfs;
  }

  return { load, loadFromArrayBuffer, skipToFallback, isReady, FONT_NAME, getFontsConfig, getVfs };
})();
