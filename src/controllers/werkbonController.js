const { query, getClient } = require('../db/pool')

// Helper: load sub-tables for one or many werkbonnen
async function loadSubTables(ids) {
  const [{ rows: workers }, { rows: works }, { rows: materials }] = await Promise.all([
    query('SELECT * FROM werkbon_workers   WHERE werkbon_id = ANY($1) ORDER BY id', [ids]),
    query('SELECT * FROM werkbon_works     WHERE werkbon_id = ANY($1) ORDER BY id', [ids]),
    query('SELECT * FROM werkbon_materials WHERE werkbon_id = ANY($1) ORDER BY id', [ids]),
  ])
  return { workers, works, materials }
}

exports.getAll = async (req, res, next) => {
  try {
    const { status, project_id } = req.query
    const params = []; let sql = 'SELECT * FROM werkbonnen WHERE 1=1'
    if (status)     { params.push(status);     sql += ` AND status=$${params.length}` }
    if (project_id) { params.push(project_id); sql += ` AND project_id=$${params.length}` }
    sql += ' ORDER BY date DESC, created_at DESC'
    const { rows: wbs } = await query(sql, params)
    if (!wbs.length) return res.json([])
    const ids = wbs.map(w => w.id)
    const { workers, works, materials } = await loadSubTables(ids)
    res.json(wbs.map(wb => ({
      ...wb,
      workers:   workers.filter(w => w.werkbon_id === wb.id),
      works:     works.filter(w => w.werkbon_id === wb.id),
      materials: materials.filter(m => m.werkbon_id === wb.id),
    })))
  } catch (err) { next(err) }
}

exports.getById = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM werkbonnen WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    const { workers, works, materials } = await loadSubTables([rows[0].id])
    res.json({ ...rows[0], workers, works, materials })
  } catch (err) { next(err) }
}

async function insertSubTables(cl, werkbonId, f) {
  for (const w of (f.workers || [])) {
    await cl.query(
      'INSERT INTO werkbon_workers (werkbon_id, worker_id, name, start_time, end_time, break_minutes, hours) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [werkbonId, w.workerId || null, w.name || '', w.startTime || '08:00', w.endTime || '17:00', w.breakMinutes || 30, w.hours || 0]
    )
  }
  for (const w of (f.works || [])) {
    await cl.query(
      'INSERT INTO werkbon_works (werkbon_id, description, qty, unit, done) VALUES ($1,$2,$3,$4,$5)',
      [werkbonId, w.description || '', w.qty || 1, w.unit || 'stuk', w.done || false]
    )
  }
  for (const m of (f.materials || [])) {
    await cl.query(
      'INSERT INTO werkbon_materials (werkbon_id, name, qty, unit) VALUES ($1,$2,$3,$4)',
      [werkbonId, m.name || '', m.qty || 1, m.unit || 'stuk']
    )
  }
}

exports.create = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    // Auto-number
    const { rows: [{ n }] } = await cl.query("SELECT COUNT(*)+1 AS n FROM werkbonnen")
    const number = `WB-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`
    const { rows } = await cl.query(`
      INSERT INTO werkbonnen (number, project_id, project_name, client_name, client_address, date, notes, problems, next_steps, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [number, f.projectId || null, f.projectName || '', f.clientName || '', f.clientAddress || '',
        f.date || new Date().toISOString().slice(0, 10), f.notes || '', f.problems || '', f.nextSteps || '', f.status || 'concept'])
    await insertSubTables(cl, rows[0].id, f)
    await cl.query('COMMIT')
    // Return with sub-tables
    const { workers, works, materials } = await loadSubTables([rows[0].id])
    res.status(201).json({ ...rows[0], workers, works, materials })
  } catch (err) { await cl.query('ROLLBACK'); next(err) }
  finally { cl.release() }
}

exports.update = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows } = await cl.query(`
      UPDATE werkbonnen SET
        project_id=$1, project_name=$2, client_name=$3, client_address=$4,
        date=$5, notes=$6, problems=$7, next_steps=$8, status=$9,
        client_signed_by=$10, signed_at=$11
      WHERE id=$12 RETURNING *
    `, [f.projectId || null, f.projectName || '', f.clientName || '', f.clientAddress || '',
        f.date, f.notes || '', f.problems || '', f.nextSteps || '', f.status || 'concept',
        f.clientSignedBy || null, f.signedAt || null, req.params.id])
    if (!rows[0]) { await cl.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }) }
    // Replace sub-tables
    await cl.query('DELETE FROM werkbon_workers   WHERE werkbon_id=$1', [req.params.id])
    await cl.query('DELETE FROM werkbon_works     WHERE werkbon_id=$1', [req.params.id])
    await cl.query('DELETE FROM werkbon_materials WHERE werkbon_id=$1', [req.params.id])
    await insertSubTables(cl, rows[0].id, f)
    await cl.query('COMMIT')
    const { workers, works, materials } = await loadSubTables([rows[0].id])
    res.json({ ...rows[0], workers, works, materials })
  } catch (err) { await cl.query('ROLLBACK'); next(err) }
  finally { cl.release() }
}

exports.remove = async (req, res, next) => {
  try {
    await query('DELETE FROM werkbonnen WHERE id=$1', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}

exports.sign = async (req, res, next) => {
  try {
    const { clientSignedBy } = req.body
    if (!clientSignedBy?.trim()) return res.status(400).json({ error: 'clientSignedBy required' })
    const { rows } = await query(`
      UPDATE werkbonnen SET status='ondertekend', client_signed_by=$1, signed_at=NOW()
      WHERE id=$2 RETURNING *
    `, [clientSignedBy, req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    const { workers, works, materials } = await loadSubTables([rows[0].id])
    res.json({ ...rows[0], workers, works, materials })
  } catch (err) { next(err) }
}