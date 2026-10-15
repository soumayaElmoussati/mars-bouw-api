const { query, getClient } = require('../db/pool')

// ── helpers ───────────────────────────────────────────────────────────────────
async function updateFactuurStatus(cl, factuurId) {
  const { rows: [tot] } = await cl.query(`
    SELECT COALESCE(SUM(qty * unit_price * (1 + btw/100)), 0) AS total
    FROM factuur_lines WHERE factuur_id = $1
  `, [factuurId])
  const { rows: [paid] } = await cl.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE factuur_id = $1',
    [factuurId]
  )
  const totalIncl = +tot.total
  const totalPaid = +paid.total
  const status = totalPaid >= totalIncl && totalIncl > 0
    ? 'betaald'
    : totalPaid > 0
      ? 'gedeeltelijk'
      : 'openstaand'
  await cl.query('UPDATE facturen SET status=$1 WHERE id=$2', [status, factuurId])
  return status
}

// ── OFFERTES ──────────────────────────────────────────────────────────────────
exports.getOffertes = async (req, res, next) => {
  try {
    const { status } = req.query
    const params = []
    let sql = 'SELECT * FROM offertes WHERE 1=1'
    if (status) { params.push(status); sql += ` AND status=$${params.length}` }
    sql += ' ORDER BY date DESC'

    const { rows: offertes } = await query(sql, params)
    if (!offertes.length) return res.json([])

    const ids = offertes.map(o => o.id)
    const [{ rows: lines }, { rows: terms }] = await Promise.all([
      query('SELECT * FROM offerte_lines WHERE offerte_id=ANY($1) ORDER BY sort_order', [ids]),
      query('SELECT * FROM offerte_payment_terms WHERE offerte_id=ANY($1) ORDER BY sort_order', [ids]),
    ])
    res.json(offertes.map(o => ({
      ...o,
      lines:        lines.filter(l => l.offerte_id === o.id),
      paymentTerms: terms.filter(t => t.offerte_id === o.id),
    })))
  } catch (err) { next(err) }
}

exports.createOfferte = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows: [{ n }] } = await cl.query("SELECT COUNT(*)+1 AS n FROM offertes")
    const num = `MB-${String(n).padStart(2, '0')}`

    const { rows } = await cl.query(`
      INSERT INTO offertes (offerte_number,client_id,client_name,client_address,date,valid_days,status,project_name,intro,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [num, f.clientId||null, f.clientName, f.clientAddress, f.date, f.validDays||14,
        f.status||'concept', f.projectName, f.intro, f.notes])

    for (const [i, l] of (f.lines || []).entries()) {
      await cl.query(
        'INSERT INTO offerte_lines (offerte_id,section,description,qty,unit,unit_price,btw,is_optional,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [rows[0].id, l.section||'', l.description, l.qty, l.unit, l.unitPrice, l.btw||21, l.isOptional||false, i]
      )
    }
    for (const [i, t] of (f.paymentTerms || []).entries()) {
      await cl.query(
        'INSERT INTO offerte_payment_terms (offerte_id,label,pct,sort_order) VALUES ($1,$2,$3,$4)',
        [rows[0].id, t.label, t.pct, i]
      )
    }
    await cl.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) { await cl.query('ROLLBACK'); next(err) } finally { cl.release() }
}

exports.updateOfferte = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows } = await cl.query(`
      UPDATE offertes SET client_id=$1,client_name=$2,client_address=$3,date=$4,valid_days=$5,
        status=$6,project_name=$7,intro=$8,notes=$9,converted_to_invoice=$10
      WHERE id=$11 RETURNING *
    `, [f.clientId||null, f.clientName, f.clientAddress, f.date, f.validDays, f.status,
        f.projectName, f.intro, f.notes, f.convertedToInvoice||false, req.params.id])

    if (!rows[0]) { await cl.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }) }

    await cl.query('DELETE FROM offerte_lines WHERE offerte_id=$1', [req.params.id])
    await cl.query('DELETE FROM offerte_payment_terms WHERE offerte_id=$1', [req.params.id])

    for (const [i, l] of (f.lines || []).entries()) {
      await cl.query(
        'INSERT INTO offerte_lines (offerte_id,section,description,qty,unit,unit_price,btw,is_optional,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [req.params.id, l.section||'', l.description, l.qty, l.unit, l.unitPrice, l.btw||21, l.isOptional||false, i]
      )
    }
    for (const [i, t] of (f.paymentTerms || []).entries()) {
      await cl.query(
        'INSERT INTO offerte_payment_terms (offerte_id,label,pct,sort_order) VALUES ($1,$2,$3,$4)',
        [req.params.id, t.label, t.pct, i]
      )
    }
    await cl.query('COMMIT')
    res.json(rows[0])
  } catch (err) { await cl.query('ROLLBACK'); next(err) } finally { cl.release() }
}

exports.deleteOfferte = async (req, res, next) => {
  try {
    await query('DELETE FROM offertes WHERE id=$1', [req.params.id])
    res.json({ message: 'Offerte deleted' })
  } catch (err) { next(err) }
}

// ── FACTUREN ──────────────────────────────────────────────────────────────────
exports.getFacturen = async (req, res, next) => {
  try {
    const { status } = req.query
    const params = []
    let sql = 'SELECT * FROM facturen WHERE 1=1'
    if (status) { params.push(status); sql += ` AND status=$${params.length}` }
    sql += ' ORDER BY date DESC'

    const { rows: facturen } = await query(sql, params)
    if (!facturen.length) return res.json([])

    const ids = facturen.map(f => f.id)
    const [{ rows: lines }, { rows: payments }] = await Promise.all([
      query('SELECT * FROM factuur_lines WHERE factuur_id=ANY($1) ORDER BY sort_order', [ids]),
      query('SELECT * FROM payments WHERE factuur_id=ANY($1) ORDER BY date', [ids]),
    ])
    res.json(facturen.map(f => ({
      ...f,
      lines:    lines.filter(l => l.factuur_id === f.id),
      payments: payments.filter(p => p.factuur_id === f.id),
    })))
  } catch (err) { next(err) }
}

exports.createFactuur = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows: [{ n }] } = await cl.query("SELECT COUNT(*)+1 AS n FROM facturen")
    const num = `F-${100 + +n}`

    const { rows } = await cl.query(`
      INSERT INTO facturen (factuur_number,offerte_id,client_id,client_name,client_address,date,due_date,status,project_name,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [num, f.offerteId||null, f.clientId||null, f.clientName, f.clientAddress,
        f.date, f.dueDate, f.status||'openstaand', f.projectName, f.notes])

    for (const [i, l] of (f.lines || []).entries()) {
      await cl.query(
        'INSERT INTO factuur_lines (factuur_id,description,qty,unit,unit_price,btw,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [rows[0].id, l.description, l.qty, l.unit, l.unitPrice, l.btw||21, i]
      )
    }
    await cl.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) { await cl.query('ROLLBACK'); next(err) } finally { cl.release() }
}

exports.updateFactuur = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows } = await cl.query(`
      UPDATE facturen SET client_id=$1,client_name=$2,client_address=$3,
        date=$4,due_date=$5,status=$6,project_name=$7,notes=$8
      WHERE id=$9 RETURNING *
    `, [f.clientId||null, f.clientName, f.clientAddress, f.date, f.dueDate,
        f.status, f.projectName, f.notes, req.params.id])

    if (!rows[0]) { await cl.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }) }

    await cl.query('DELETE FROM factuur_lines WHERE factuur_id=$1', [req.params.id])
    for (const [i, l] of (f.lines || []).entries()) {
      await cl.query(
        'INSERT INTO factuur_lines (factuur_id,description,qty,unit,unit_price,btw,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [req.params.id, l.description, l.qty, l.unit, l.unitPrice, l.btw||21, i]
      )
    }
    await cl.query('COMMIT')
    res.json(rows[0])
  } catch (err) { await cl.query('ROLLBACK'); next(err) } finally { cl.release() }
}

// POST /api/finance/facturen/:id/payments
exports.addPayment = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows } = await cl.query(
      'INSERT INTO payments (factuur_id,date,amount,method,note) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, f.date, f.amount, f.method||'overschrijving', f.note]
    )
    const newStatus = await updateFactuurStatus(cl, req.params.id)
    await cl.query('COMMIT')
    res.status(201).json({ payment: rows[0], factuurStatus: newStatus })
  } catch (err) { await cl.query('ROLLBACK'); next(err) } finally { cl.release() }
}

// ── UITGAVEN ──────────────────────────────────────────────────────────────────
exports.getUitgaven = async (req, res, next) => {
  try {
    const { category, status, project_id } = req.query
    const params = []
    let sql = 'SELECT * FROM uitgaven WHERE 1=1'
    if (category)   { params.push(category);   sql += ` AND category=$${params.length}` }
    if (status)     { params.push(status);     sql += ` AND status=$${params.length}` }
    if (project_id) { params.push(project_id); sql += ` AND project_id=$${params.length}` }
    sql += ' ORDER BY date DESC'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}

exports.createUitgave = async (req, res, next) => {
  try {
    const f = req.body
    const btwAmount = (f.amount || 0) * (f.btw || 21) / 100
    const { rows } = await query(`
      INSERT INTO uitgaven (date,description,category,project_id,project_name,supplier,amount,btw,btw_amount,payment_method,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [f.date, f.description, f.category||'overig', f.projectId||null, f.projectName,
        f.supplier, f.amount, f.btw||21, btwAmount, f.paymentMethod||'pin', f.status||'betaald'])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

exports.updateUitgave = async (req, res, next) => {
  try {
    const f = req.body
    const btwAmount = (f.amount || 0) * (f.btw || 21) / 100
    const { rows } = await query(`
      UPDATE uitgaven SET date=$1,description=$2,category=$3,project_id=$4,project_name=$5,
        supplier=$6,amount=$7,btw=$8,btw_amount=$9,payment_method=$10,status=$11
      WHERE id=$12 RETURNING *
    `, [f.date, f.description, f.category, f.projectId||null, f.projectName,
        f.supplier, f.amount, f.btw, btwAmount, f.paymentMethod, f.status, req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.deleteUitgave = async (req, res, next) => {
  try {
    await query('DELETE FROM uitgaven WHERE id=$1', [req.params.id])
    res.json({ message: 'Uitgave deleted' })
  } catch (err) { next(err) }
}

// ── FINANCE STATS ─────────────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [revenue, expenses, open] = await Promise.all([
      query(`SELECT COALESCE(SUM(fl.qty*fl.unit_price*(1+fl.btw/100)),0) AS total
             FROM factuur_lines fl JOIN facturen f ON fl.factuur_id=f.id`),
      query(`SELECT COALESCE(SUM(amount),0) AS total FROM uitgaven WHERE status='betaald'`),
      query(`SELECT COUNT(*) AS count, COALESCE(SUM(fl.qty*fl.unit_price*(1+fl.btw/100)),0) AS total
             FROM facturen f JOIN factuur_lines fl ON f.id=fl.factuur_id
             WHERE f.status != 'betaald'`),
    ])
    res.json({
      totalRevenue:     +revenue.rows[0].total,
      totalExpenses:    +expenses.rows[0].total,
      result:           +revenue.rows[0].total - +expenses.rows[0].total,
      openInvoices:     +open.rows[0].count,
      openInvoiceTotal: +open.rows[0].total,
    })
  } catch (err) { next(err) }
}
