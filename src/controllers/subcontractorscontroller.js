const { query, getClient } = require('../db/pool')

// ── Subcontractors ────────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { status, specialty } = req.query
    const params = []; let sql = 'SELECT * FROM subcontractors WHERE 1=1'
    if (status)    { params.push(status);    sql += ` AND status=$${params.length}` }
    if (specialty) { params.push(specialty); sql += ` AND specialty=$${params.length}` }
    sql += ' ORDER BY name'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}

exports.getById = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM subcontractors WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.create = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO subcontractors
        (name, specialty, contact_person, phone, email, kvk, btw, iban, address, rating, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [f.name, f.specialty||'overig', f.contactPerson||'', f.phone||'', f.email||'',
        f.kvk||'', f.btw||'', f.iban||'', f.address||'',
        f.rating||3, f.status||'actief', f.notes||''])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

exports.update = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE subcontractors SET
        name=$1, specialty=$2, contact_person=$3, phone=$4, email=$5,
        kvk=$6, btw=$7, iban=$8, address=$9, rating=$10, status=$11, notes=$12
      WHERE id=$13 RETURNING *
    `, [f.name, f.specialty, f.contactPerson||'', f.phone||'', f.email||'',
        f.kvk||'', f.btw||'', f.iban||'', f.address||'',
        f.rating||3, f.status||'actief', f.notes||'', req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.remove = async (req, res, next) => {
  try {
    await query('DELETE FROM subcontractors WHERE id=$1', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}

// ── Orders ────────────────────────────────────────────────────────────────────
exports.getOrders = async (req, res, next) => {
  try {
    const { subcontractor_id, status } = req.query
    const params = []
    let sql = `
      SELECT so.*,
        COALESCE(json_agg(sp ORDER BY sp.date) FILTER (WHERE sp.id IS NOT NULL), '[]') AS payments
      FROM subcontractor_orders so
      LEFT JOIN subcontractor_payments sp ON sp.order_id = so.id
      WHERE 1=1
    `
    if (subcontractor_id) { params.push(subcontractor_id); sql += ` AND so.subcontractor_id=$${params.length}` }
    if (status)           { params.push(status);           sql += ` AND so.status=$${params.length}` }
    sql += ' GROUP BY so.id ORDER BY so.created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}

exports.createOrder = async (req, res, next) => {
  try {
    const f = req.body
    const { rows: [{ n }] } = await query('SELECT COUNT(*)+1 AS n FROM subcontractor_orders')
    const num = `SO-${String(n).padStart(3, '0')}`
    const { rows } = await query(`
      INSERT INTO subcontractor_orders
        (subcontractor_id, subcontractor_name, project_id, project_name, type,
         order_number, description, amount, btw, status, sent_date, start_date, end_date, payment_status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
    `, [f.subcontractorId, f.subcontractorName||'', f.projectId||null, f.projectName||'',
        f.type||'opdracht', num, f.description||'',
        f.amount||0, f.btw||21, f.status||'concept',
        f.sentDate||null, f.startDate||null, f.endDate||null,
        f.paymentStatus||'te_betalen', f.notes||''])
    res.status(201).json({ ...rows[0], payments: [] })
  } catch (err) { next(err) }
}

exports.updateOrder = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE subcontractor_orders SET
        subcontractor_id=$1, subcontractor_name=$2, project_id=$3, project_name=$4,
        type=$5, description=$6, amount=$7, btw=$8, status=$9,
        sent_date=$10, start_date=$11, end_date=$12, payment_status=$13, notes=$14
      WHERE id=$15 RETURNING *
    `, [f.subcontractorId, f.subcontractorName||'', f.projectId||null, f.projectName||'',
        f.type||'opdracht', f.description||'',
        f.amount||0, f.btw||21, f.status||'concept',
        f.sentDate||null, f.startDate||null, f.endDate||null,
        f.paymentStatus||'te_betalen', f.notes||'', req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    // Return with payments
    const { rows: payments } = await query('SELECT * FROM subcontractor_payments WHERE order_id=$1 ORDER BY date', [req.params.id])
    res.json({ ...rows[0], payments })
  } catch (err) { next(err) }
}

exports.deleteOrder = async (req, res, next) => {
  try {
    await query('DELETE FROM subcontractor_orders WHERE id=$1', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}

exports.addPayment = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows: [payment] } = await cl.query(
      'INSERT INTO subcontractor_payments (order_id, date, amount, method, note) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, f.date, f.amount, f.method||'overschrijving', f.note||'']
    )
    // Recalculate payment_status
    const { rows: [ord] } = await cl.query('SELECT amount, btw FROM subcontractor_orders WHERE id=$1', [req.params.id])
    const totalIncl = +ord.amount * (1 + +ord.btw / 100)
    const { rows: [paid] } = await cl.query(
      'SELECT COALESCE(SUM(amount),0) AS total FROM subcontractor_payments WHERE order_id=$1', [req.params.id]
    )
    const payStatus = +paid.total >= totalIncl ? 'betaald' : +paid.total > 0 ? 'gedeeltelijk' : 'te_betalen'
    await cl.query('UPDATE subcontractor_orders SET payment_status=$1 WHERE id=$2', [payStatus, req.params.id])
    await cl.query('COMMIT')
    res.status(201).json({ payment, paymentStatus: payStatus })
  } catch (err) { await cl.query('ROLLBACK'); next(err) }
  finally { cl.release() }
}