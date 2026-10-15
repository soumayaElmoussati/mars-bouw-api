const { query } = require('../db/pool')

exports.getAll = async (req, res, next) => {
  try {
    const { project_id, status, from, to } = req.query
    const params = []; let sql = 'SELECT * FROM planning_events WHERE 1=1'
    if (project_id) { params.push(project_id); sql += ` AND project_id=$${params.length}` }
    if (status)     { params.push(status);     sql += ` AND status=$${params.length}` }
    if (from)       { params.push(from);       sql += ` AND end_date>=$${params.length}` }
    if (to)         { params.push(to);         sql += ` AND start_date<=$${params.length}` }
    sql += ' ORDER BY start_date, start_time'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}

exports.create = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO planning_events
        (title, project_id, project_name, assignee, start_date, end_date, start_time, end_time, type, status, color, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [f.title, f.projectId||null, f.projectName||'', f.assignee||'',
        f.startDate, f.endDate, f.startTime||'08:00', f.endTime||'17:00',
        f.type||'overig', f.status||'planned', f.color||'#1A3E6F', f.notes||''])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

exports.update = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE planning_events SET
        title=$1, project_id=$2, project_name=$3, assignee=$4,
        start_date=$5, end_date=$6, start_time=$7, end_time=$8,
        type=$9, status=$10, color=$11, notes=$12
      WHERE id=$13 RETURNING *
    `, [f.title, f.projectId||null, f.projectName||'', f.assignee||'',
        f.startDate, f.endDate, f.startTime||'08:00', f.endTime||'17:00',
        f.type||'overig', f.status||'planned', f.color||'#1A3E6F', f.notes||'',
        req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.remove = async (req, res, next) => {
  try {
    await query('DELETE FROM planning_events WHERE id=$1', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}