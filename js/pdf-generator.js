/**
 * pdf-generator.js
 * 根據單筆資料列產生 pdfmake docDefinition 並回傳 Blob。
 * 排版依據：領據格式（7列表格）
 */

const PdfGenerator = (() => {

  /* ────────────────────────────────────────────────
     公開 API
  ──────────────────────────────────────────────── */

  /**
   * 批次生成多個 PDF Blob
   * @param {Object[]} rows      - 已解析的資料列陣列
   * @param {string}   fontName  - 'NotoSansTC' or 'Roboto'
   * @param {string}   orgName   - 機構名稱（若 CSV 有 org 欄位則以 CSV 為主）
   * @param {string}   globalDate  - 預設日期
   * @param {string}   filePattern - 檔名格式字串，支援變數 {name}/{id}/{month_zh}/...
   * @param {string}   templateType - 'normal' | 'beautiful'
   * @param {Function} onProgress - (current, total, filename) => void
   * @returns {Promise<{name: string, blob: Blob}[]>}
   */
  async function generateAll(rows, fontName, orgName, globalDate, filePattern, templateType, onProgress) {
    const results = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const filename = _buildFilename(filePattern, row, globalDate);
      onProgress && onProgress(i + 1, rows.length, filename);

      const blob = await _generateOne(row, fontName, orgName, globalDate, templateType);
      results.push({ name: filename, blob });

      if ((i + 1) % 5 === 0) await _tick();
    }
    return results;
  }

  /* ────────────────────────────────────────────────
     私有方法
  ──────────────────────────────────────────────── */

  function _generateOne(row, fontName, orgName, globalDate, templateType) {
    return new Promise((resolve, reject) => {
      try {
        // 每次生成前重新確保字體已寫入 pdfMake.vfs，防止內部快取遺失
        if (typeof FontLoader !== 'undefined') {
          const vfs = FontLoader.getVfs();
          pdfMake.vfs = Object.assign(pdfMake.vfs || {}, vfs);
          pdfMake.fonts = Object.assign(pdfMake.fonts || {}, FontLoader.getFontsConfig());
          console.log('[PdfGen] 生成前 pdfMake.vfs[KaiFont.ttf] 存在:', !!pdfMake.vfs['KaiFont.ttf']);
          console.log('[PdfGen] 生成前 pdfMake.fonts:', JSON.stringify(Object.keys(pdfMake.fonts || {})));
        }

        const docDef = templateType === 'beautiful'
          ? _buildBeautifulDocDefinition(row, fontName, orgName, globalDate)
          : _buildDocDefinition(row, fontName, orgName, globalDate);
        pdfMake.createPdf(docDef).getBlob(blob => resolve(blob));
      } catch (err) {
        reject(err);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PDF 模板 — 依附圖「領據」格式設計
     欄位：請款項目 / 請款金額 / 實領金額 /
           領款人姓名+身分證字號 / 戶籍地址 / 連絡電話 / 備註
  ══════════════════════════════════════════════════════════════ */
  function _buildDocDefinition(row, fontName, globalOrgName, globalDate) {
    const BASE_FONT = fontName || 'NotoSansTC';
    const org = (row.org || globalOrgName || '').trim();
    const amountNum = parseFloat(row.amount) || 0;
    const amountFmt = _formatCurrency(amountNum);
    const chinesePay = _toChineseAmount(amountNum);

    // 使用外部傳入的 globalDate
    const rocDate = _toROCDate(globalDate);

    /* 表格外框線統一設定 */
    const tableLayout = {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 2 : 1,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 2 : 1,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 12,
      paddingBottom: () => 12,
    };

    /* 欄位寬度 [標籤欄, 主值欄, 次標籤欄, 次值欄] */
    const COL_WIDTHS = [85, '*', 85, 110];

    /* 標籤 cell (加上網底) */
    const lbl = (text, extra) => Object.assign({
      text,
      fontSize: 12,
      bold: true,
      alignment: 'center',
      fillColor: '#F0F0F0',
      margin: [0, 4, 0, 0],
    }, extra || {});

    /* 值 cell */
    const val = (text, extra) => Object.assign({
      text: (text != null ? String(text) : ''),
      fontSize: 12,
      alignment: 'center',
      margin: [0, 4, 0, 0],
    }, extra || {});

    return {
      pageSize: 'A4',
      pageMargins: [60, 60, 60, 50],

      defaultStyle: {
        font: BASE_FONT,
        fontSize: 12,
        color: '#000000',
        lineHeight: 1.4,
      },

      content: [

        /* ── 機構名稱（選填） ── */
        ...(org ? [{
          text: org,
          fontSize: 20,
          bold: true,
          alignment: 'center',
          marginBottom: 6,
        }] : []),

        /* ── 領據標題 ── */
        {
          text: '領據',
          fontSize: 18,
          bold: true,
          alignment: 'center',
          marginBottom: 16,
        },

        /* ══ 主表格（7列） ══ */
        {
          table: {
            widths: COL_WIDTHS,
            body: [

              /* Row 1：請款項目 */
              [
                lbl('請款項目'),
                val(row.item || '', { colSpan: 3 }),
                {}, {}
              ],

              /* Row 2：請款金額 */
              [
                lbl('請款金額'),
                val(chinesePay),
                val('NT $', { bold: true }),
                val(amountFmt, { alignment: 'right' }),
              ],

              /* Row 3：實領金額 */
              [
                lbl('實領金額', { bold: true }),
                val(chinesePay),
                val('NT $', { bold: true }),
                val(amountFmt, { alignment: 'right' }),
              ],

              /* Row 4：領款人姓名 + 身分證字號 */
              [
                lbl('領款人姓名'),
                val(row.customer || ''),
                lbl('身分證字號'),
                val(row.id_number || ''),
              ],

              /* Row 5：戶籍地址 */
              [
                lbl('戶籍地址'),
                val(row.address || '', { colSpan: 3 }),
                {}, {}
              ],

              /* Row 6：連絡電話 */
              [
                lbl('連絡電話'),
                val(row.phone || '', { colSpan: 3 }),
                {}, {}
              ],

              /* Row 7：備註（較高） */
              [
                lbl('備註', { margin: [0, 4, 0, 0] }),
                {
                  text: row.note || '',
                  fontSize: 12,
                  colSpan: 3,
                  minHeight: 80,
                  margin: [0, 4, 0, 0],
                },
                {}, {}
              ],
            ],
          },
          layout: tableLayout,
          marginBottom: 28,
        },
        /* ══ 表格結束 ══ */

        /* ── 領款人簽章 & 日期 ── */
        {
          columns: [
            { text: '', width: '*' },
            {
              width: 'auto',
              stack: [
                {
                  columns: [
                    { text: '領款人簽章：', fontSize: 12, width: 85, alignment: 'right' },
                    {
                      canvas: [{ type: 'line', x1: 0, y1: 14, x2: 180, y2: 14, lineWidth: 1, lineColor: '#000000' }],
                      width: 180
                    }
                  ],
                  marginBottom: 12,
                },
                {
                  columns: [
                    { text: '日期：', fontSize: 12, width: 85, alignment: 'right' },
                    { text: '     ' + rocDate, fontSize: 12, width: 'auto' }
                  ],
                },
              ],
            },
          ],
        },
      ],

      styles: {},
    };
  }

  /* ══════════════════════════════════════════════════════════════
     PDF 模板 — 精美版 (modern & beautiful layout)
  ══════════════════════════════════════════════════════════════ */
  function _buildBeautifulDocDefinition(row, fontName, globalOrgName, globalDate) {
    const BASE_FONT = fontName || 'NotoSansTC';
    const org = (row.org || globalOrgName || ' ').trim();
    const amountNum = parseFloat(row.amount) || 0;
    const amountFmt = _formatCurrency(amountNum);
    const chinesePay = _toChineseAmount(amountNum);
    const rocDate = _toROCDate(globalDate);

    return {
      pageSize: 'A4',
      pageMargins: [50, 60, 50, 60],
      defaultStyle: {
        font: BASE_FONT,
        fontSize: 11,
        color: '#333333',
        lineHeight: 1.5,
      },
      content: [
        /* ── Header ── */
        {
          columns: [
            {
              text: org,
              fontSize: 22,
              bold: true,
              color: '#2C3E50',
              width: '*'
            },
            {
              text: '領 款 收 據',
              fontSize: 26,
              bold: true,
              color: '#10B981',
              alignment: 'right',
              width: 'auto'
            }
          ],
          margin: [0, 0, 0, 10]
        },
        /* ── Divider line ── */
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 2, lineColor: '#ECECEC' }],
          margin: [0, 0, 0, 25]
        },

        /* ── Payee Info Section ── */
        {
          text: '領款資訊',
          fontSize: 14,
          bold: true,
          color: '#7F8C8D',
          margin: [0, 0, 0, 8]
        },
        {
          layout: {
            hLineWidth: function () { return 0; },
            vLineWidth: function () { return 0; },
            paddingLeft: function () { return 0; },
            paddingTop: function () { return 6; },
            paddingBottom: function () { return 6; }
          },
          table: {
            widths: [80, '*', 80, 140],
            body: [
              [
                { text: '領款人姓名：', color: '#95A5A6', alignment: 'right' },
                { text: row.customer || '', bold: true, fontSize: 13, color: '#2C3E50' },
                { text: '身分證字號：', color: '#95A5A6', alignment: 'right' },
                { text: row.id_number || '', bold: true, color: '#2C3E50' }
              ],
              [
                { text: '連絡電話：', color: '#95A5A6', alignment: 'right' },
                { text: row.phone || '', color: '#2C3E50' },
                { text: '日期：', color: '#95A5A6', alignment: 'right' },
                { text: rocDate, color: '#2C3E50' }
              ],
              [
                { text: '戶籍地址：', color: '#95A5A6', alignment: 'right' },
                { text: row.address || '', color: '#2C3E50', colSpan: 3 },
                {}, {}
              ]
            ]
          },
          margin: [0, 0, 0, 30]
        },

        /* ── Item Details ── */
        {
          text: '款項明細',
          fontSize: 14,
          bold: true,
          color: '#7F8C8D',
          margin: [0, 0, 0, 8]
        },
        {
          layout: {
            hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length) ? 1 : 0,
            vLineWidth: () => 0,
            hLineColor: (i, node) => (i === 0 || i === node.table.body.length) ? '#2C3E50' : '#ECECEC',
            paddingTop: () => 10,
            paddingBottom: () => 10,
            paddingLeft: () => 10,
            paddingRight: () => 10
          },
          table: {
            widths: ['*', 120],
            headerRows: 1,
            body: [
              [
                { text: '請款項目', bold: true, color: '#2C3E50' },
                { text: '金額', bold: true, alignment: 'right', color: '#2C3E50' }
              ],
              [
                { text: row.item || '', margin: [0, 10, 0, 10] },
                { text: 'NT$ ' + amountFmt, alignment: 'right', margin: [0, 10, 0, 10] }
              ],
              [
                { text: '總計 (大寫)：' + chinesePay, bold: true, colSpan: 2, alignment: 'right', fillColor: '#F8F9FA' },
                {}
              ]
            ]
          },
          margin: [0, 0, 0, 30]
        },

        /* ── Note Section ── */
        ...(row.note ? [{
          stack: [
            { text: '備註', fontSize: 13, bold: true, color: '#7F8C8D', margin: [0, 0, 0, 5] },
            {
              text: row.note,
              color: '#2C3E50',
              margin: [0, 5, 0, 0]
            }
          ],
          margin: [0, 0, 0, 40]
        }] : []),

        /* ── Signature Section ── */
        {
          columns: [
            { width: '*', text: '' },
            {
              width: 250,
              stack: [
                {
                  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 250, y2: 0, lineWidth: 1, lineColor: '#BDC3C7' }],
                  margin: [0, 0, 0, 8]
                },
                { text: '領款人簽章', alignment: 'center', color: '#7F8C8D', fontSize: 12 }
              ]
            }
          ],
          margin: [0, 50, 0, 0]
        }
      ]
    };
  }

  /* ════════════════════════════════════════════════
     工具函式
  ════════════════════════════════════════════════ */

  /**
   * 數字轉中文大寫金額，例如 1000 → '新台幣：壹仟元整'
   */
  function _toChineseAmount(num) {
    const n = Math.round(parseFloat(num) || 0);
    if (n === 0) return '新台幣：零元整';

    const DIGITS = ['', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
    const UNITS = ['', '拾', '佰', '仟'];

    function grp(v) {
      if (v === 0) return '';
      let s = '';
      const d = [
        Math.floor(v / 1000),
        Math.floor((v % 1000) / 100),
        Math.floor((v % 100) / 10),
        v % 10,
      ];
      for (let i = 0; i < 4; i++) {
        if (d[i] !== 0) {
          s += DIGITS[d[i]] + UNITS[3 - i];
        } else if (s && s[s.length - 1] !== '零') {
          s += '零';
        }
      }
      return s.replace(/零$/, '');
    }

    const yi = Math.floor(n / 1e8);
    const wan = Math.floor((n % 1e8) / 10000);
    const rest = n % 10000;

    let result = '';
    if (yi > 0) result += grp(yi) + '億';
    if (wan > 0) result += grp(wan) + '萬';
    if (rest > 0) {
      if (result && Math.floor(rest / 1000) === 0) result += '零';
      result += grp(rest);
    }

    return `新台幣：${result}元整`;
  }

  /**
   * 西元日期字串 → 民國年格式，例如 '2026-01-31' → '115 年 1 月 31 日'
   */
  function _toROCDate(dateStr) {
    const d = dateStr
      ? new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''))
      : new Date();
    if (isNaN(d.getTime())) return String(dateStr || '');
    const roc = d.getFullYear() - 1911;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${roc} 年 ${month} 月 ${day} 日`;
  }

  function _buildFilename(pattern, row, globalDate) {
    const targetDate = globalDate;
    const date = targetDate ? new Date(targetDate + 'T00:00:00') : new Date();
    const isValid = !isNaN(date.getTime());
    const month = isValid ? date.getMonth() + 1 : 1;
    const year = isValid ? date.getFullYear() : new Date().getFullYear();
    const rocYear = year - 1911;

    const ZH_MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

    const tokens = {
      '{name}': String(row.customer || ''),
      '{item}': String(row.item || ''),
      '{month}': String(month),
      '{month_zh}': ZH_MONTHS[month - 1] + '月',
      '{year}': String(year),
      '{roc_year}': String(rocYear),
    };

    let name = (pattern || '{name}-{month_zh}').trim();
    for (const [token, value] of Object.entries(tokens)) {
      name = name.split(token).join(value);
    }

    /* 移除不合法的檔名字元，但保留中文 */
    name = name.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
    if (!name) name = '領據';

    return name + '.pdf';
  }

  function _formatCurrency(n) {
    return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function _tick() { return new Promise(res => setTimeout(res, 0)); }

  return { generateAll, buildFilename: _buildFilename };
})();
