const { query, getClient } = require('../db/pool')

// ── helpers ───────────────────────────────────────────────────────────────────
async function enrichProjects(projects) {
  if (!projects.length) return []
  const ids = projects.map(p => p.id)
  const [{ rows: tasks }, { rows: problems }] = await Promise.all([
    query('SELECT * FROM project_tasks    WHERE project_id = ANY($1) ORDER BY sort_order', [ids]),
    query('SELECT * FROM project_problems WHERE project_id = ANY($1) ORDER BY created_at DESC', [ids]),
  ])
  return projects.map(p => ({
    ...p,
    tasks:    tasks.filter(t => t.project_id === p.id),
    problems: problems.filter(pb => pb.project_id === p.id),
  }))
}

// GET /api/projects
exports.getAll = async (req, res, next) => {
  try {
    const { status, priority, client_id } = req.query
    const params = []
    let sql = 'SELECT * FROM projects WHERE 1=1'
    if (status)    { params.push(status);    sql += ` AND status    = $${params.length}` }
    if (priority)  { params.push(priority);  sql += ` AND priority  = $${params.length}` }
    if (client_id) { params.push(client_id); sql += ` AND client_id = $${params.length}` }
    sql += ' ORDER BY created_at DESC'
    const { rows } = await query(sql, params)
    res.json(await enrichProjects(rows))
  } catch (err) { next(err) }
}

// GET /api/projects/:id
exports.getById = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM projects WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' })
    const [{ rows: tasks }, { rows: problems }, { rows: attachments }] = await Promise.all([
      query('SELECT * FROM project_tasks       WHERE project_id=$1 ORDER BY sort_order',     [req.params.id]),
      query('SELECT * FROM project_problems    WHERE project_id=$1 ORDER BY created_at DESC',[req.params.id]),
      query('SELECT * FROM project_attachments WHERE project_id=$1 ORDER BY created_at DESC',[req.params.id]),
    ])
    res.json({ ...rows[0], tasks, problems, attachments })
  } catch (err) { next(err) }
}

// POST /api/projects
exports.create = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows } = await cl.query(`
      INSERT INTO projects
        (name, client_id, client_name, status, priority,
         start_date, estimated_end_date, budget, address, description, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [f.name, f.clientId||null, f.clientName, f.status||'planning', f.priority||'medium',
        f.startDate||null, f.estimatedEndDate||null, f.budget||0,
        f.address, f.description, f.notes])

    // Insert initial tasks if provided
    for (const [i, t] of (f.tasks || []).entries()) {
      await cl.query(
        'INSERT INTO project_tasks (project_id, text, done, sort_order) VALUES ($1,$2,$3,$4)',
        [rows[0].id, t.text, t.done || false, i]
      )
    }
    await cl.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) {
    await cl.query('ROLLBACK')
    next(err)
  } finally { cl.release() }
}

// PUT /api/projects/:id
exports.update = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE projects SET
        name=$1, client_id=$2, client_name=$3, status=$4, priority=$5,
        start_date=$6, estimated_end_date=$7, budget=$8, spent_budget=$9,
        address=$10, description=$11, notes=$12
      WHERE id=$13
      RETURNING *
    `, [f.name, f.clientId||null, f.clientName, f.status, f.priority,
        f.startDate, f.estimatedEndDate, f.budget, f.spentBudget,
        f.address, f.description, f.notes, req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

// DELETE /api/projects/:id
exports.remove = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM projects WHERE id=$1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Project not found' })
    res.json({ message: 'Project deleted' })
  } catch (err) { next(err) }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
exports.addTask = async (req, res, next) => {
  try {
    const { rows: [cnt] } = await query(
      'SELECT COUNT(*) FROM project_tasks WHERE project_id=$1', [req.params.id]
    )
    const { rows } = await query(
      'INSERT INTO project_tasks (project_id,text,done,sort_order) VALUES ($1,$2,false,$3) RETURNING *',
      [req.params.id, req.body.text, +cnt.count]
    )
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

exports.updateTask = async (req, res, next) => {
  try {
    const { text, done } = req.body
    const { rows } = await query(
      'UPDATE project_tasks SET text=$1, done=$2 WHERE id=$3 AND project_id=$4 RETURNING *',
      [text, done, req.params.taskId, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.deleteTask = async (req, res, next) => {
  try {
    await query('DELETE FROM project_tasks WHERE id=$1 AND project_id=$2', [req.params.taskId, req.params.id])
    res.json({ message: 'Task deleted' })
  } catch (err) { next(err) }
}

// ── Problems ──────────────────────────────────────────────────────────────────
exports.addProblem = async (req, res, next) => {
  try {
    const { rows } = await query(
      'INSERT INTO project_problems (project_id,text,date,resolved) VALUES ($1,$2,CURRENT_DATE,false) RETURNING *',
      [req.params.id, req.body.text]
    )
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

exports.updateProblem = async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE project_problems SET resolved=$1 WHERE id=$2 AND project_id=$3 RETURNING *',
      [req.body.resolved, req.params.problemId, req.params.id]
    )
    res.json(rows[0])
  } catch (err) { next(err) }
}
