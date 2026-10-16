const { query } = require('../db/pool')
const fs   = require('fs')
const path = require('path')

// ── Logo base64 (embedded once at startup) ─────────────────────────────────
let LOGO_B64 = ''
try {
  const logoPath = path.join(__dirname, '../../public/logo.png')
  if (fs.existsSync(logoPath)) {
    LOGO_B64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
  }
} catch {}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtEur(n) {
  return '€\u00a0' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })
}
function fmtDate(d) {
  if (!d) return '—'
  return d.toString().slice(0, 10).split('-').reverse().join('-')
}

// ── HTML template ──────────────────────────────────────────────────────────
function buildHTML(data) {
  const logoTag = LOGO_B64
    ? `<img src="${LOGO_B64}" class="logo" alt="MARS Bouw">`
    : `<div class="logo-text">MARS BOUW</div>`

  const clientHtml = (data.clientLines || [])
    .filter(Boolean)
    .map((ln, i) => `<p class="${i === 0 ? 'client-name' : 'client-addr'}">${ln}</p>`)
    .join('')

  const metaHtml = (data.meta || [])
    .map(([label, val]) => `
      <tr>
        <td class="meta-label">${label}</td>
        <td class="meta-val">${val}</td>
      </tr>`)
    .join('')

  const hdrs = data.headers || []
  const theadHtml = hdrs
    .map((h, i) => `<th style="text-align:${i >= 2 ? 'right' : 'left'}">${h}</th>`)
    .join('')

  const tbodyHtml = (data.rows || [])
    .map((row, ri) => {
      const bg = ri % 2 === 0 ? '#F4F7FB' : '#FFFFFF'
      const cells = row.map((val, ci) => {
        const align  = ci >= 2 ? 'right' : 'left'
        const weight = ci === row.length - 1 ? '600' : '400'
        return `<td style="text-align:${align};font-weight:${weight}">${val}</td>`
      }).join('')
      return `<tr style="background:${bg}">${cells}</tr>`
    })
    .join('')

  const notesHtml = (data.notes || [])
    .filter(Boolean)
    .map(n => `<p class="note">${n}</p>`)
    .join('')

  const totals = data.totals || []
  const totalsHtml = totals.map(([label, val], i) => {
    if (i < totals.length - 1) {
      return `<tr class="total-row">
        <td class="total-label">${label}</td>
        <td class="total-val">${val}</td>
      </tr>`
    }
    return `<tr>
      <td colspan="2" style="padding-top:4pt">
        <div class="total-final">
          <span>${label}</span>
          <span>${val}</span>
        </div>
      </td>
    </tr>`
  }).join('')

  const footerHtml = (data.footer || [])
    .map((ln, i) => `<span class="${i === data.footer.length - 1 ? 'footer-sig' : ''}">${ln}</span>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    color: #1A1A2E;
    background: white;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 15mm 18mm 28mm 18mm;
  }

  /* ── HEADER ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 5mm;
    border-bottom: 0.8px solid #D0DCF0;
    margin-bottom: 6mm;
  }
  .logo { height: 55pt; width: auto; }
  .logo-text { font-size: 18pt; font-weight: 800; color: #1A3E6F; }

  .company-info { text-align: right; }
  .company-name { font-size: 10pt; font-weight: 700; color: #1A3E6F; line-height: 1.8; }
  .company-line { font-size: 8pt; color: #555; line-height: 1.6; }
  .company-meta { font-size: 7.5pt; color: #888; margin-top: 3pt; line-height: 1.6; }

  /* ── DOC TYPE ── */
  .doc-type {
    font-size: 21pt;
    font-weight: 800;
    color: #1A3E6F;
    letter-spacing: -0.02em;
    margin-bottom: 5mm;
  }

  /* ── CLIENT + META ROW ── */
  .info-row {
    display: flex;
    gap: 6mm;
    margin-bottom: 7mm;
    align-items: stretch;
  }
  .client-block {
    flex: 1;
    border-left: 3px solid #1A3E6F;
    background: #F4F7FB;
    padding: 5mm 6mm;
  }
  .client-name { font-size: 10pt; font-weight: 700; color: #1A3E6F; margin-bottom: 3pt; }
  .client-addr { font-size: 8.5pt; color: #444; line-height: 1.6; }

  .meta-block { min-width: 105mm; padding: 3mm 0 3mm 6mm; }
  .meta-block table { border-collapse: collapse; width: 100%; }
  .meta-label { font-size: 8.5pt; color: #888; padding: 3.5pt 12pt 3.5pt 0; white-space: nowrap; vertical-align: middle; }
  .meta-val   { font-size: 9pt; font-weight: 700; color: #1A3E6F; padding: 3.5pt 0; vertical-align: middle; }

  /* ── TABLE ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 5mm;
  }
  .items-table thead tr { background: #1A3E6F; }
  .items-table thead th {
    color: white;
    font-size: 8.5pt;
    font-weight: 600;
    padding: 7pt 7pt;
    letter-spacing: 0.01em;
    vertical-align: middle;
  }
  .items-table tbody tr { border-bottom: 0.3px solid #D8E4F0; }
  .items-table tbody td {
    font-size: 9pt;
    padding: 7pt 7pt;
    color: #1A1A2E;
    vertical-align: middle;
    line-height: 1.35;
  }

  /* ── NOTES ── */
  .note {
    font-size: 8pt;
    color: #888;
    font-style: italic;
    margin-bottom: 2pt;
    margin-top: 3mm;
  }

  /* ── TOTALS ── */
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 5mm; }
  .totals-table { width: 80mm; border-collapse: collapse; }
  .total-row td { padding: 4pt 0; font-size: 9pt; }
  .total-label { color: #888; }
  .total-val { text-align: right; font-weight: 600; color: #1A1A2E; }

  .total-final {
    background: #1A3E6F;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7pt 9pt;
    border-radius: 4px;
    font-size: 11pt;
    font-weight: 700;
    margin-top: 3pt;
  }

  /* ── FOOTER ── */
  .footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: #F4F7FB;
    border-top: 0.7px solid #D0DCF0;
    padding: 5mm 18mm;
    display: flex;
    flex-direction: column;
    gap: 3pt;
  }
  .footer span { font-size: 7.5pt; color: #777; line-height: 1.5; }
  .footer .footer-sig { font-weight: 600; color: #1A3E6F; }

  .page-num {
    position: fixed;
    bottom: 4mm; right: 18mm;
    font-size: 7pt; color: #bbb;
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    ${logoTag}
    <div class="company-info">
      <div class="company-name">MARS Bouw</div>
      <div class="company-line">Haarlemmerweg 555 1-hg</div>
      <div class="company-line">1055PN Amsterdam</div>
      <div class="company-line">T. +31 6 24 204 476 · bnibounsar@live.nl</div>
      <div class="company-meta">KvK: 65036441 · BTW: NL 002437498b14</div>
      <div class="company-meta">IBAN: NL56ABNA0555251608</div>
    </div>
  </div>

  <div class="doc-type">${data.type}</div>

  <div class="info-row">
    <div class="client-block">${clientHtml}</div>
    <div class="meta-block"><table>${metaHtml}</table></div>
  </div>

  <table class="items-table">
    <thead><tr>${theadHtml}</tr></thead>
    <tbody>${tbodyHtml}</tbody>
  </table>

  ${notesHtml}

  <div class="totals-wrap">
    <table class="totals-table">${totalsHtml}</table>
  </div>

  <div class="footer">${footerHtml}</div>
  <div class="page-num">Pagina 1 / 1</div>
</div>
</body>
</html>`
}


// ── PDF via Chromium (Vercel compatible) ───────────────────────────────────
async function htmlToPDF(html) {
  const chromium = require('@sparticuz/chromium')
  const puppeteer = require('puppeteer-core')

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    return pdf
  } finally {
    await browser.close()
  }
}

// ── OFFERTE endpoint ───────────────────────────────────────────────────────
exports.getOffertePDF = async (req, res, next) => {
  try {
    const { rows: [o] } = await query('SELECT * FROM offertes WHERE id=$1', [req.params.id])
    if (!o) return res.status(404).json({ error: 'Not found' })
    const { rows: lines } = await query(
      'SELECT * FROM offerte_lines WHERE offerte_id=$1 ORDER BY sort_order', [req.params.id]
    )

    const sub = lines.reduce((s, l) => s + +l.qty * +l.unit_price, 0)
    const btw = lines.reduce((s, l) => s + +l.qty * +l.unit_price * +l.btw / 100, 0)

    const html = buildHTML({
      type: 'OFFERTE',
      clientLines: [`Aan: ${o.client_name || ''}`, o.client_address || ''].filter(Boolean),
      meta: [
        ['Datum:',       fmtDate(o.date)],
        ['Offerte nr.:',  o.offerte_number || '—'],
        ['Geldigheid:',  `${o.valid_days || 14} dagen`],
      ],
      headers: ['Omschrijving', 'Aantal', 'Tarief', 'BTW', 'Bedrag'],
      rows: lines.map(l => [
        l.description || '',
        Number(l.qty || 0).toFixed(2).replace('.', ','),
        fmtEur(l.unit_price),
        `${l.btw || 0}%`,
        fmtEur(+l.qty * +l.unit_price),
      ]),
      notes: o.notes ? [o.notes] : [],
      totals: [
        ['Subtotaal excl. BTW', fmtEur(sub)],
        ['BTW',                 fmtEur(btw)],
        ['Totaal incl. BTW',    fmtEur(sub + btw)],
      ],
      footer: [
        'Betaling: 50% bij opdracht · 40% als 70% gedaan · 10% na oplevering binnen de afgesproken termijn.',
        'Op alle leveringen gelden onze Algemene Leveringsvoorwaarden, op verzoek verstrekt.',
        'Met vriendelijke groet,  Mohamed El Mourabit  —  MARS Bouw',
      ],
    })

    const pdf = await htmlToPDF(html)
    const fn  = `offerte-${o.offerte_number || req.params.id}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition',
      req.query.download === '1' ? `attachment; filename="${fn}"` : `inline; filename="${fn}"`
    )
    res.setHeader('Content-Length', pdf.length)
    res.end(pdf)
  } catch (err) { next(err) }
}

// ── FACTUUR endpoint ───────────────────────────────────────────────────────
exports.getFactuurPDF = async (req, res, next) => {
  try {
    const { rows: [f] } = await query('SELECT * FROM facturen WHERE id=$1', [req.params.id])
    if (!f) return res.status(404).json({ error: 'Not found' })
    const { rows: lines } = await query(
      'SELECT * FROM factuur_lines WHERE factuur_id=$1 ORDER BY sort_order', [req.params.id]
    )
    const { rows: [pmts] } = await query(
      'SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE factuur_id=$1', [req.params.id]
    )

    const sub  = lines.reduce((s, l) => s + +l.qty * +l.unit_price, 0)
    const btw  = lines.reduce((s, l) => s + +l.qty * +l.unit_price * +l.btw / 100, 0)
    const tot  = sub + btw
    const paid = +pmts.paid

    const html = buildHTML({
      type: 'FACTUUR',
      clientLines: [`Aan: ${f.client_name || ''}`, f.client_address || ''].filter(Boolean),
      meta: [
        ['Factuurnummer:', f.factuur_number || '—'],
        ['Factuurdatum:',  fmtDate(f.date)],
        ['Vervaldatum:',   fmtDate(f.due_date)],
        ['Betaaltermijn:', '14 dagen'],
      ],
      headers: ['Omschrijving', 'Aantal', 'Eenheid', 'Tarief', 'Subtotaal', 'BTW%'],
      rows: lines.map(l => [
        l.description || '',
        Number(l.qty || 0).toFixed(0),
        l.unit || 'stuk',
        fmtEur(l.unit_price),
        fmtEur(+l.qty * +l.unit_price),
        `${l.btw || 0}%`,
      ]),
      notes: [
        `Betaling t.n.v. MARS Bouw o.v.v. factuurnummer ${f.factuur_number} · IBAN: NL56ABNA0555251608`,
        paid > 0 ? `Reeds betaald: ${fmtEur(paid)}  —  Resterend: ${fmtEur(tot - paid)}` : '',
      ].filter(Boolean),
      totals: [
        ['Subtotaal excl. BTW', fmtEur(sub)],
        ['BTW 21%',             fmtEur(btw)],
        ['Totaal te betalen',   fmtEur(tot)],
      ],
      footer: [
        'Betaling binnen 14 dagen na factuurdatum · Bij te late betaling wordt wettelijke rente in rekening gebracht.',
        'Op alle leveringen gelden onze Algemene Leveringsvoorwaarden, op verzoek verstrekt.',
        'Met vriendelijke groet,  Mohamed El Mourabit  —  MARS Bouw',
      ],
    })

    const pdf = await htmlToPDF(html)
    const fn  = `factuur-${f.factuur_number || req.params.id}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition',
      req.query.download === '1' ? `attachment; filename="${fn}"` : `inline; filename="${fn}"`
    )
    res.setHeader('Content-Length', pdf.length)
    res.end(pdf)
  } catch (err) { next(err) }
}