const PDFDocument = require('pdfkit')
const path        = require('path')
const { query }   = require('../db/pool')

// ── Colors ─────────────────────────────────────────────────────────────────
const NAVY  = '#1A3E6F'
const RED   = '#C8102E'
const LIGHT = '#F4F7FB'
const GREY  = '#6B7280'
const TEXT  = '#1A1A2E'
const WHITE = '#FFFFFF'
const BORDER= '#D0DCF0'

const LOGO_PATH = path.join(__dirname, '../../public/logo.png')

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtEur(n) {
  return '€ ' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })
}
function fmtDate(d) {
  if (!d) return '—'
  return d.toString().slice(0, 10).split('-').reverse().join('-')
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

// ── PDF Builder ────────────────────────────────────────────────────────────
function buildPDF(doc, data) {
  const W = doc.page.width
  const H = doc.page.height
  const ML = 45   // margin left
  const MR = 45   // margin right
  const CW = W - ML - MR  // content width

  // ── TOP NAVY BAR ────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 8).fill(NAVY)

  // ── LOGO ────────────────────────────────────────────────────────────────
  doc.image(LOGO_PATH, ML, 20, { width: 130, height: 80, fit: [130, 80] })

  // ── COMPANY INFO (right) ─────────────────────────────────────────────────
  const companyLines = [
    { text: 'MARS Bouw', bold: true, size: 10 },
    { text: 'Haarlemmerweg 555 1-hg', bold: false, size: 9 },
    { text: '1055PN Amsterdam', bold: false, size: 9 },
    { text: '', bold: false, size: 4 },
    { text: 'T. +31 6 24 204 476', bold: false, size: 9 },
    { text: 'bnibounsar@live.nl', bold: false, size: 9 },
    { text: '', bold: false, size: 4 },
    { text: 'KvK: 65036441', bold: false, size: 8 },
    { text: 'BTW: NL 002437498b14', bold: false, size: 8 },
    { text: 'IBAN: NL56ABNA0555251608', bold: false, size: 8 },
  ]
  let cy = 22
  for (const line of companyLines) {
    if (!line.text) { cy += line.size; continue }
    doc
      .font(line.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(line.size)
      .fillColor(line.bold ? NAVY : TEXT)
    const tw = doc.widthOfString(line.text)
    doc.text(line.text, W - MR - tw, cy, { lineBreak: false })
    cy += line.size + 3
  }

  // ── RED SEPARATOR ────────────────────────────────────────────────────────
  doc.rect(ML, 110, CW, 1.5).fill(RED)

  // ── DOCUMENT TYPE ────────────────────────────────────────────────────────
  doc
    .font('Helvetica-Bold')
    .fontSize(26)
    .fillColor(NAVY)
    .text(data.type, ML, 120)

  // ── CLIENT BLOCK ─────────────────────────────────────────────────────────
  const clientLines = data.clientLines || []
  const clientH = clientLines.length * 16 + 20
  doc.rect(ML, 160, 3, clientH).fill(NAVY)
  doc.rect(ML, 160, 200, clientH).fill(LIGHT).fillOpacity(0.6)

  let cly = 168
  for (let i = 0; i < clientLines.length; i++) {
    doc
      .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(i === 0 ? 10 : 9)
      .fillColor(i === 0 ? NAVY : TEXT)
      .fillOpacity(1)
      .text(clientLines[i], ML + 10, cly, { lineBreak: false })
    cly += 16
  }

  // ── META TABLE ────────────────────────────────────────────────────────────
  const meta = data.meta || []
  const metaY = 160
  const metaX = W / 2
  doc.rect(metaX, metaY, W - MR - metaX, meta.length * 18 + 14).fill(LIGHT).fillOpacity(0.5)
  let my = metaY + 8
  for (const [label, val] of meta) {
    doc.font('Helvetica').fontSize(8.5).fillColor(GREY).fillOpacity(1).text(label, metaX + 10, my, { lineBreak: false })
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY).text(val, metaX + 110, my, { lineBreak: false })
    my += 18
  }

  // ── TABLE ─────────────────────────────────────────────────────────────────
  const tableY  = Math.max(160 + clientH, metaY + meta.length * 18 + 14) + 20
  const headers = data.headers || []
  const colW    = data.colWidths || []
  const rows    = data.rows || []

  // Header row
  doc.rect(ML, tableY, CW, 24).fill(NAVY).fillOpacity(1)
  let hx = ML
  for (let i = 0; i < headers.length; i++) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
    const isRight = i >= 2
    if (isRight) {
      const tw = doc.widthOfString(headers[i])
      doc.text(headers[i], hx + colW[i] - tw - 4, tableY + 8, { lineBreak: false })
    } else {
      doc.text(headers[i], hx + 4, tableY + 8, { lineBreak: false })
    }
    hx += colW[i]
  }

  // Data rows
  let ry = tableY + 24
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]
    const rh  = 22
    doc.rect(ML, ry, CW, rh).fill(ri % 2 === 0 ? LIGHT : WHITE).fillOpacity(ri % 2 === 0 ? 0.7 : 1)
    doc.rect(ML, ry + rh - 0.3, CW, 0.3).fill(BORDER).fillOpacity(1)
    let rx = ML
    for (let ci = 0; ci < row.length; ci++) {
      doc.font('Helvetica').fontSize(8.5).fillColor(TEXT).fillOpacity(1)
      const isRight = ci >= 2
      if (isRight) {
        const tw = doc.widthOfString(String(row[ci]))
        doc.text(String(row[ci]), rx + colW[ci] - tw - 4, ry + 7, { lineBreak: false })
      } else {
        doc.text(String(row[ci]), rx + 4, ry + 7, { lineBreak: false })
      }
      rx += colW[ci]
    }
    ry += rh
  }

  // ── NOTES ─────────────────────────────────────────────────────────────────
  let noteY = ry + 8
  for (const note of (data.notes || [])) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(RED).fillOpacity(1).text(note, ML, noteY)
    noteY += 14
  }

  // ── TOTALS ────────────────────────────────────────────────────────────────
  const totals = data.totals || []
  const tW     = 200
  const tX     = W - MR - tW
  let   tY     = noteY + 10

  doc.rect(tX, tY, tW, totals.length * 20 + 20).fill(LIGHT).fillOpacity(0.6)

  let ty = tY + 8
  for (let i = 0; i < totals.length - 1; i++) {
    const [label, val] = totals[i]
    doc.font('Helvetica').fontSize(9).fillColor(GREY).fillOpacity(1).text(label, tX + 8, ty, { lineBreak: false })
    const tw = doc.widthOfString(val)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text(val, tX + tW - tw - 8, ty, { lineBreak: false })
    ty += 20
  }

  // Divider
  doc.rect(tX + 8, ty - 4, tW - 16, 0.5).fill(BORDER).fillOpacity(1)

  // Final total box
  doc.rect(tX, ty + 2, tW, 26).fill(NAVY).fillOpacity(1)
  const [finalLabel, finalVal] = totals[totals.length - 1]
  doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE).text(finalLabel, tX + 8, ty + 9, { lineBreak: false })
  const ftw = doc.widthOfString(finalVal)
  doc.text(finalVal, tX + tW - ftw - 8, ty + 9, { lineBreak: false })

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerH = 90
  doc.rect(0, H - footerH, W, footerH).fill(LIGHT).fillOpacity(0.5)
  doc.rect(0, H - footerH, W, 1.5).fill(RED).fillOpacity(1)
  let fy = H - footerH + 10
  for (const line of (data.footer || [])) {
    const isBold = line.startsWith('Met')
    doc
      .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(7.5)
      .fillColor(isBold ? NAVY : GREY)
      .fillOpacity(1)
      .text(line, ML, fy, { lineBreak: false })
    fy += 13
  }

  // Page number
  doc.font('Helvetica').fontSize(7).fillColor(GREY).text(`Pagina 1 / 1`, W - MR - 50, H - 15, { lineBreak: false })
}

// ── OFFERTE endpoint ───────────────────────────────────────────────────────
exports.getOffertePDF = async (req, res, next) => {
  try {
    // Load offerte + lines from DB
    const { rows: [offerte] } = await query('SELECT * FROM offertes WHERE id=$1', [req.params.id])
    if (!offerte) return res.status(404).json({ error: 'Not found' })
    const { rows: lines } = await query('SELECT * FROM offerte_lines WHERE offerte_id=$1 ORDER BY sort_order', [req.params.id])

    const subtotal = lines.reduce((s, l) => s + (+l.qty * +l.unit_price), 0)
    const btwAmt   = lines.reduce((s, l) => s + (+l.qty * +l.unit_price * +l.btw / 100), 0)
    const total    = subtotal + btwAmt

    const data = {
      type: 'OFFERTE',
      clientLines: [
        `Aan: ${offerte.client_name}`,
        offerte.client_address || '',
      ].filter(Boolean),
      meta: [
        ['Datum:',       fmtDate(offerte.date)],
        ['Offerte nr.:',  offerte.offerte_number],
        ['Geldigheid:',  `${offerte.valid_days || 14} dagen`],
      ],
      headers:   ['Omschrijving', 'Aantal', 'Tarief', 'BTW', 'Bedrag'],
      colWidths: [220, 50, 70, 45, 70],
      rows: lines.map(l => [
        l.description,
        Number(l.qty).toFixed(2).replace('.', ','),
        fmtEur(l.unit_price),
        `${l.btw}%`,
        fmtEur(+l.qty * +l.unit_price),
      ]),
      notes:  offerte.notes ? [offerte.notes] : [],
      totals: [
        ['Subtotaal excl. BTW', fmtEur(subtotal)],
        ['BTW',                 fmtEur(btwAmt)],
        ['Totaal incl. BTW',    fmtEur(total)],
      ],
      footer: [
        'Betaling en leveringsvoorwaarden:',
        '• 50% bij de opdracht dient in bezit te zijn alvorens de opdracht in behandeling is genomen.',
        '• 40% als 70% van het werk gedaan is.   • 10% na opleveren binnen de afgesproken termijn.',
        'Op alle leveringen, diensten en aanbiedingen gelden onze Algemene Leveringsvoorwaarden.',
        'Met vriendelijke groet,  Mohamed El Mourabit  —  MARS Bouw',
      ],
    }

    const doc = new PDFDocument({ size: 'A4', margin: 0 })
    const filename = `offerte-${offerte.offerte_number || req.params.id}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition',
      req.query.download === '1'
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`
    )
    doc.pipe(res)
    buildPDF(doc, data)
    doc.end()
  } catch (err) { next(err) }
}

// ── FACTUUR endpoint ───────────────────────────────────────────────────────
exports.getFactuurPDF = async (req, res, next) => {
  try {
    const { rows: [factuur] } = await query('SELECT * FROM facturen WHERE id=$1', [req.params.id])
    if (!factuur) return res.status(404).json({ error: 'Not found' })
    const { rows: lines }     = await query('SELECT * FROM factuur_lines WHERE factuur_id=$1 ORDER BY sort_order', [req.params.id])
    const { rows: payments }  = await query('SELECT COALESCE(SUM(amount),0) AS paid FROM factuur_payments WHERE factuur_id=$1', [req.params.id])

    const subtotal = lines.reduce((s, l) => s + (+l.qty * +l.unit_price), 0)
    const btwAmt   = lines.reduce((s, l) => s + (+l.qty * +l.unit_price * +l.btw / 100), 0)
    const total    = subtotal + btwAmt
    const paid     = +payments[0].paid
    const remaining= total - paid

    const data = {
      type: 'FACTUUR',
      clientLines: [
        `Aan: ${factuur.client_name}`,
        factuur.client_address || '',
      ].filter(Boolean),
      meta: [
        ['Factuurnummer:',    factuur.factuur_number],
        ['Factuurdatum:',     fmtDate(factuur.date)],
        ['Vervaldatum:',      fmtDate(factuur.due_date)],
        ['Betalingstermijn:', '14 dagen'],
      ],
      headers:   ['Omschrijving', 'Aantal', 'Eenheid', 'Tarief', 'Subtotaal', 'BTW%'],
      colWidths: [195, 45, 45, 65, 65, 40],
      rows: lines.map(l => [
        l.description,
        Number(l.qty).toFixed(0),
        l.unit || 'stuk',
        fmtEur(l.unit_price),
        fmtEur(+l.qty * +l.unit_price),
        `${l.btw}%`,
      ]),
      notes: [
        `t.n.v. MARS Bouw o.v.v. factuurnummer ${factuur.factuur_number}  |  IBAN: NL56ABNA0555251608`,
        paid > 0 ? `Reeds betaald: ${fmtEur(paid)}  |  Resterend: ${fmtEur(remaining)}` : '',
      ].filter(Boolean),
      totals: [
        ['Subtotaal excl. BTW', fmtEur(subtotal)],
        ['BTW 21%',             fmtEur(btwAmt)],
        ['Totaal te betalen',   fmtEur(total)],
      ],
      footer: [
        'Op alle leveringen, diensten en aanbiedingen gelden onze Algemene Leveringsvoorwaarden.',
        '• Betaling binnen 14 dagen na factuurdatum.',
        '• Bij te late betaling wordt wettelijke rente in rekening gebracht.',
        '• Gelieve het factuurnummer te vermelden bij uw betaling.',
        'Met vriendelijke groet,  Mohamed El Mourabit  —  MARS Bouw',
      ],
    }

    const doc = new PDFDocument({ size: 'A4', margin: 0 })
    const filename = `factuur-${factuur.factuur_number || req.params.id}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition',
      req.query.download === '1'
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`
    )
    doc.pipe(res)
    buildPDF(doc, data)
    doc.end()
  } catch (err) { next(err) }
}