const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')
const fs      = require('fs')
const path    = require('path')
const { query } = require('../db/pool')

const NAVY  = rgb(0.102, 0.243, 0.435)
const RED   = rgb(0.784, 0.063, 0.180)
const LIGHT = rgb(0.957, 0.969, 0.988)
const GREY  = rgb(0.416, 0.557, 0.659)
const TEXT  = rgb(0.102, 0.102, 0.180)
const WHITE = rgb(1, 1, 1)
const BORDER= rgb(0.816, 0.863, 0.941)

function fmtEur(n) {
  return '€ ' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })
}
function fmtDate(d) {
  if (!d) return '—'
  return d.toString().slice(0, 10).split('-').reverse().join('-')
}

async function buildPDF(data) {
  const pdfDoc = await PDFDocument.create()
  const page   = pdfDoc.addPage([595, 842])
  const { width, height } = page.getSize()

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica)

  let logoImage = null
  try {
    const logoPath = path.join(__dirname, '../../public/logo.png')
    if (fs.existsSync(logoPath)) {
      logoImage = await pdfDoc.embedPng(fs.readFileSync(logoPath))
    }
  } catch (e) {}

  const ML = 45
  const MR = 45
  const CW = width - ML - MR

  function txt(str, x, y, { font = fontReg, size = 9, color = TEXT } = {}) {
    page.drawText(String(str || ''), { x, y: height - y, font, size, color })
  }
  function rct(x, y, w, h, color, opacity = 1) {
    page.drawRectangle({ x, y: height - y - h, width: w, height: h, color, opacity })
  }
  function txtR(str, rightX, y, opts = {}) {
    const f  = opts.font || fontReg
    const sz = opts.size || 9
    const tw = f.widthOfTextAtSize(String(str || ''), sz)
    txt(str, rightX - tw, y, opts)
  }
  function ln(x1, y, x2, color = BORDER, thickness = 0.5) {
    page.drawLine({ start:{x:x1,y:height-y}, end:{x:x2,y:height-y}, thickness, color })
  }

  // Top bar
  rct(0, 0, width, 6, NAVY)

  // Logo
  if (logoImage) {
    const d = logoImage.scaleToFit(130, 55)
    page.drawImage(logoImage, { x: ML, y: height - 18 - d.height, width: d.width, height: d.height })
  } else {
    txt('MARS BOUW', ML, 22, { font: fontBold, size: 18, color: NAVY })
  }

  // Company info right
  const co = [
    { t:'MARS Bouw',               b:true,  s:10   },
    { t:'Haarlemmerweg 555 1-hg',  b:false, s:8.5  },
    { t:'1055PN Amsterdam',         b:false, s:8.5  },
    { t:'',                         b:false, s:4    },
    { t:'T. +31 6 24 204 476',     b:false, s:8.5  },
    { t:'bnibounsar@live.nl',       b:false, s:8.5  },
    { t:'',                         b:false, s:4    },
    { t:'KvK: 65036441',           b:false, s:7.5  },
    { t:'BTW: NL 002437498b14',    b:false, s:7.5  },
    { t:'IBAN: NL56ABNA0555251608',b:false, s:7.5  },
  ]
  let cy = 16
  for (const c of co) {
    if (!c.t) { cy += c.s; continue }
    const f  = c.b ? fontBold : fontReg
    const tw = f.widthOfTextAtSize(c.t, c.s)
    txt(c.t, width - MR - tw, cy, { font:f, size:c.s, color: c.b ? NAVY : TEXT })
    cy += c.s + 3.5
  }

  // Red separator
  const sepY = 93
  rct(ML, sepY, CW, 1.5, RED)

  // Doc type
  txt(data.type, ML, sepY + 18, { font:fontBold, size:24, color:NAVY })

  // Client block
  const clY = sepY + 36
  const clH = data.clientLines.length * 15 + 14
  rct(ML, clY, 3, clH, NAVY)
  rct(ML, clY, 200, clH, LIGHT, 0.7)
  let cly2 = clY + 6
  for (let i = 0; i < data.clientLines.length; i++) {
    const ln2 = data.clientLines[i]
    if (!ln2) { cly2 += 6; continue }
    txt(ln2, ML + 8, cly2, { font: i===0 ? fontBold : fontReg, size: i===0 ? 9.5 : 8.5, color: i===0 ? NAVY : TEXT })
    cly2 += 15
  }

  // Meta box
  const mX = width/2 + 10
  const mY = clY
  const mH = data.meta.length * 17 + 12
  rct(mX, mY, width - MR - mX, mH, LIGHT, 0.6)
  let my2 = mY + 8
  for (const [label, val] of data.meta) {
    txt(label, mX + 8, my2, { font:fontReg, size:8, color:GREY })
    txt(val,   mX + 100, my2, { font:fontBold, size:8.5, color:NAVY })
    my2 += 17
  }

  // Table
  const tblY = Math.max(cly2, mY + mH) + 16
  const ROW_H = 20

  // Header
  rct(ML, tblY, CW, 22, NAVY)
  let hx = ML
  for (let i = 0; i < data.headers.length; i++) {
    const isR = i >= 2
    if (isR) txtR(data.headers[i], hx + data.colWidths[i] - 3, tblY + 7, { font:fontBold, size:7.5, color:WHITE })
    else     txt(data.headers[i], hx + 4, tblY + 7, { font:fontBold, size:7.5, color:WHITE })
    hx += data.colWidths[i]
  }

  // Rows
  let ry = tblY + 22
  for (let ri = 0; ri < data.rows.length; ri++) {
    const row = data.rows[ri]
    rct(ML, ry, CW, ROW_H, ri%2===0 ? LIGHT : WHITE, ri%2===0 ? 0.7 : 1)
    ln(ML, ry + ROW_H, ML + CW, BORDER, 0.3)
    let rx = ML
    for (let ci = 0; ci < row.length; ci++) {
      const val = String(row[ci] || '')
      const cw  = data.colWidths[ci]
      const isR = ci >= 2
      if (isR) txtR(val, rx + cw - 3, ry + 6, { font:fontReg, size:8, color:TEXT })
      else     txt(val, rx + 4, ry + 6, { font:fontReg, size:8, color:TEXT })
      rx += cw
    }
    ry += ROW_H
  }

  // Notes
  let noteY = ry + 8
  for (const note of (data.notes || [])) {
    txt(note, ML, noteY, { font:fontReg, size:7.5, color:RED })
    noteY += 13
  }

  // Totals
  const totals = data.totals
  const tW = 195
  const tX = width - MR - tW
  let   tY = noteY + 8
  const tH = (totals.length - 1) * 18 + 38
  rct(tX, tY, tW, tH, LIGHT, 0.6)

  let ty2 = tY + 8
  for (let i = 0; i < totals.length - 1; i++) {
    const [label, val] = totals[i]
    txt(label, tX + 6, ty2, { font:fontReg, size:8.5, color:GREY })
    txtR(val, tX + tW - 6, ty2, { font:fontBold, size:8.5, color:TEXT })
    ty2 += 18
  }
  ln(tX + 6, ty2, tX + tW - 6, BORDER, 0.5)
  ty2 += 6

  // Final total
  rct(tX, ty2, tW, 24, NAVY)
  const [fLabel, fVal] = totals[totals.length - 1]
  txt(fLabel, tX + 6, ty2 + 8, { font:fontBold, size:10, color:WHITE })
  txtR(fVal, tX + tW - 6, ty2 + 8, { font:fontBold, size:10, color:WHITE })

  // Footer
  const footerY = height - 80
  ln(0, footerY - 1, width, RED, 1.5)
  rct(0, footerY, width, 80, LIGHT, 0.5)
  let fy = footerY + 10
  for (const fl of (data.footer || [])) {
    txt(fl, ML, fy, { font: fl.startsWith('Met') ? fontBold : fontReg, size:7.5, color: fl.startsWith('Met') ? NAVY : GREY })
    fy += 12
  }
  txtR('Pagina 1 / 1', width - MR, height - 10, { font:fontReg, size:7, color:GREY })

  return await pdfDoc.save()
}

// ── OFFERTE ────────────────────────────────────────────────────────────────
exports.getOffertePDF = async (req, res, next) => {
  try {
    const { rows:[offerte] } = await query('SELECT * FROM offertes WHERE id=$1', [req.params.id])
    if (!offerte) return res.status(404).json({ error:'Not found' })
    const { rows:lines } = await query('SELECT * FROM offerte_lines WHERE offerte_id=$1 ORDER BY sort_order', [req.params.id])

    const subtotal = lines.reduce((s,l) => s + (+l.qty * +l.unit_price), 0)
    const btwAmt   = lines.reduce((s,l) => s + (+l.qty * +l.unit_price * +l.btw/100), 0)

    const pdfBytes = await buildPDF({
      type: 'OFFERTE',
      clientLines: [`Aan: ${offerte.client_name||''}`, offerte.client_address||''].filter(Boolean),
      meta: [
        ['Datum:', fmtDate(offerte.date)],
        ['Offerte nr.:', offerte.offerte_number||'—'],
        ['Geldigheid:', `${offerte.valid_days||14} dagen`],
      ],
      headers:   ['Omschrijving','Aantal','Tarief','BTW','Bedrag'],
      colWidths: [210,55,70,45,75],
      rows: lines.map(l => [l.description||'', Number(l.qty||0).toFixed(2).replace('.',','), fmtEur(l.unit_price), `${l.btw||0}%`, fmtEur(+l.qty * +l.unit_price)]),
      notes: offerte.notes ? [`ℹ  ${offerte.notes}`] : [],
      totals: [['Subtotaal excl. BTW', fmtEur(subtotal)], ['BTW', fmtEur(btwAmt)], ['Totaal incl. BTW', fmtEur(subtotal+btwAmt)]],
      footer: ['Betaling en leveringsvoorwaarden:', '• 50% bij de opdracht dient in bezit te zijn alvorens de opdracht in behandeling is genomen.', '• 40% als 70% van het werk gedaan is.   • 10% na opleveren binnen de afgesproken termijn.', 'Op alle leveringen, diensten en aanbiedingen gelden onze Algemene Leveringsvoorwaarden.', 'Met vriendelijke groet,  Mohamed El Mourabit  —  MARS Bouw'],
    })

    const fn = `offerte-${offerte.offerte_number||req.params.id}.pdf`
    res.setHeader('Content-Type','application/pdf')
    res.setHeader('Content-Disposition', req.query.download==='1' ? `attachment; filename="${fn}"` : `inline; filename="${fn}"`)
    res.setHeader('Content-Length', pdfBytes.length)
    res.end(Buffer.from(pdfBytes))
  } catch (err) { next(err) }
}

// ── FACTUUR ────────────────────────────────────────────────────────────────
exports.getFactuurPDF = async (req, res, next) => {
  try {
    const { rows:[factuur] } = await query('SELECT * FROM facturen WHERE id=$1', [req.params.id])
    if (!factuur) return res.status(404).json({ error:'Not found' })
    const { rows:lines } = await query('SELECT * FROM factuur_lines WHERE factuur_id=$1 ORDER BY sort_order', [req.params.id])
    const { rows:[pmts] } = await query('SELECT COALESCE(SUM(amount),0) AS paid FROM factuur_payments WHERE factuur_id=$1', [req.params.id])

    const subtotal  = lines.reduce((s,l) => s + (+l.qty * +l.unit_price), 0)
    const btwAmt    = lines.reduce((s,l) => s + (+l.qty * +l.unit_price * +l.btw/100), 0)
    const total     = subtotal + btwAmt
    const paid      = +pmts.paid

    const pdfBytes = await buildPDF({
      type: 'FACTUUR',
      clientLines: [`Aan: ${factuur.client_name||''}`, factuur.client_address||''].filter(Boolean),
      meta: [
        ['Factuurnummer:', factuur.factuur_number||'—'],
        ['Factuurdatum:',  fmtDate(factuur.date)],
        ['Vervaldatum:',   fmtDate(factuur.due_date)],
        ['Betaaltermijn:', '14 dagen'],
      ],
      headers:   ['Omschrijving','Aantal','Eenheid','Tarief','Subtotaal','BTW%'],
      colWidths: [185,45,45,65,65,50],
      rows: lines.map(l => [l.description||'', Number(l.qty||0).toFixed(0), l.unit||'stuk', fmtEur(l.unit_price), fmtEur(+l.qty * +l.unit_price), `${l.btw||0}%`]),
      notes: [`t.n.v. MARS Bouw o.v.v. factuurnummer ${factuur.factuur_number}  |  IBAN: NL56ABNA0555251608`, paid>0 ? `Reeds betaald: ${fmtEur(paid)}  |  Resterend: ${fmtEur(total-paid)}` : ''].filter(Boolean),
      totals: [['Subtotaal excl. BTW', fmtEur(subtotal)], ['BTW 21%', fmtEur(btwAmt)], ['Totaal te betalen', fmtEur(total)]],
      footer: ['Op alle leveringen, diensten en aanbiedingen gelden onze Algemene Leveringsvoorwaarden.', '• Betaling binnen 14 dagen na factuurdatum.', '• Bij te late betaling wordt wettelijke rente in rekening gebracht.', '• Gelieve het factuurnummer te vermelden bij uw betaling.', 'Met vriendelijke groet,  Mohamed El Mourabit  —  MARS Bouw'],
    })

    const fn = `factuur-${factuur.factuur_number||req.params.id}.pdf`
    res.setHeader('Content-Type','application/pdf')
    res.setHeader('Content-Disposition', req.query.download==='1' ? `attachment; filename="${fn}"` : `inline; filename="${fn}"`)
    res.setHeader('Content-Length', pdfBytes.length)
    res.end(Buffer.from(pdfBytes))
  } catch (err) { next(err) }
}