const { query } = require('../db/pool')

// ── Workers ───────────────────────────────────────────────────────────────────
exports.getWorkers = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM workers ORDER BY name')
    res.json(rows)
  } catch (err) { next(err) }
}
exports.createWorker = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO workers (name,role,hourly_rate,overtime_rate,phone,email,status,color)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [f.name,f.role,f.hourlyRate||0,f.overtimeRate||0,f.phone,f.email,f.status||'actief',f.color||'#1A3E6F'])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}
exports.updateWorker = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE workers SET name=$1,role=$2,hourly_rate=$3,overtime_rate=$4,phone=$5,email=$6,status=$7,color=$8
      WHERE id=$9 RETURNING *
    `, [f.name,f.role,f.hourlyRate,f.overtimeRate,f.phone,f.email,f.status,f.color,req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Worker not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}
exports.deleteWorker = async (req, res, next) => {
  try {
    await query('DELETE FROM workers WHERE id=$1', [req.params.id])
    res.json({ message: 'Worker deleted' })
  } catch (err) { next(err) }
}

// ── Entries ───────────────────────────────────────────────────────────────────
// Compute hours in JS (no generated column needed)
function computeHours(startTime, endTime, breakMinutes = 30) {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm) - breakMinutes
  return Math.max(0, Math.round(mins * 100 / 60) / 100)
}

exports.getEntries = async (req, res, next) => {
  try {
    const { week_start, worker_id, project_id, status } = req.query
    const params = []
    let sql = `
      SELECT te.*,
        w.name           AS worker_name,
        w.role           AS worker_role,
        w.color          AS worker_color,
        w.hourly_rate,
        w.overtime_rate
      FROM time_entries te
      LEFT JOIN workers w ON te.worker_id = w.id
      WHERE 1=1
    `
    if (week_start) {
      const end = new Date(new Date(week_start).getTime() + 7 * 86400000).toISOString().slice(0, 10)
      params.push(week_start); sql += ` AND te.date >= $${params.length}`
      params.push(end);        sql += ` AND te.date <  $${params.length}`
    }
    if (worker_id)  { params.push(worker_id);  sql += ` AND te.worker_id  = $${params.length}` }
    if (project_id) { params.push(project_id); sql += ` AND te.project_id = $${params.length}` }
    if (status)     { params.push(status);     sql += ` AND te.status     = $${params.length}` }
    sql += ' ORDER BY te.date, te.start_time'

    const { rows } = await query(sql, params)
    // Add computed hours + cost
    const enriched = rows.map(e => {
      const hours = computeHours(e.start_time, e.end_time, e.break_minutes)
      const rate  = e.work_type === 'overwerk' ? +e.overtime_rate : +e.hourly_rate
      return { ...e, hours, cost: Math.round(hours * rate * 100) / 100, effectiveRate: rate }
    })
    res.json(enriched)
  } catch (err) { next(err) }
}

exports.createEntry = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO time_entries
        (worker_id,project_id,project_name,date,start_time,end_time,break_minutes,work_type,description,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [f.workerId,f.projectId||null,f.projectName,f.date,f.startTime,f.endTime,
        f.breakMinutes||30,f.workType||'normaal',f.description,f.status||'concept'])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

exports.updateEntry = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE time_entries SET
        worker_id=$1,project_id=$2,project_name=$3,date=$4,
        start_time=$5,end_time=$6,break_minutes=$7,work_type=$8,
        description=$9,status=$10,approved_by=$11
      WHERE id=$12 RETURNING *
    `, [f.workerId,f.projectId||null,f.projectName,f.date,
        f.startTime,f.endTime,f.breakMinutes,f.workType,
        f.description,f.status,f.approvedBy||null, req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Entry not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.approveEntry = async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE time_entries SET status='goedgekeurd', approved_by=$1 WHERE id=$2 RETURNING *",
      [req.user.name, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Entry not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.deleteEntry = async (req, res, next) => {
  try {
    await query('DELETE FROM time_entries WHERE id=$1', [req.params.id])
    res.json({ message: 'Entry deleted' })
  } catch (err) { next(err) }
}

exports.getReport = async (req, res, next) => {
  try {
    const { group_by = 'worker', from, to } = req.query
    const params = []
    let where = '1=1'
    if (from) { params.push(from); where += ` AND te.date >= $${params.length}` }
    if (to)   { params.push(to);   where += ` AND te.date <= $${params.length}` }

    const sql = group_by === 'project' ? `
      SELECT te.project_id, te.project_name,
        COUNT(*) AS entries,
        COUNT(DISTINCT te.worker_id) AS workers
      FROM time_entries te WHERE ${where}
      GROUP BY te.project_id, te.project_name
      ORDER BY te.project_name
    ` : `
      SELECT te.worker_id, w.name AS worker_name, w.role, w.color,
        w.hourly_rate, w.overtime_rate,
        COUNT(*) AS entries,
        COUNT(DISTINCT te.project_id) AS projects
      FROM time_entries te
      LEFT JOIN workers w ON te.worker_id=w.id
      WHERE ${where}
      GROUP BY te.worker_id, w.name, w.role, w.color, w.hourly_rate, w.overtime_rate
      ORDER BY w.name
    `
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}
