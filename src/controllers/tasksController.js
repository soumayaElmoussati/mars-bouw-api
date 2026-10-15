const { query } = require('../db/pool')

exports.getAll = async (req, res, next) => {
  try {
    const { status, priority, project_id } = req.query
    const params = []
    let sql = 'SELECT * FROM tasks WHERE 1=1'
    if (status)     { params.push(status);     sql += ` AND status    = $${params.length}` }
    if (priority)   { params.push(priority);   sql += ` AND priority  = $${params.length}` }
    if (project_id) { params.push(project_id); sql += ` AND project_id = $${params.length}` }
    sql += ' ORDER BY due_date ASC NULLS LAST, created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}
exports.create = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO tasks (title,description,project_id,project_name,assignee,due_date,priority,status,category,tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [f.title,f.description,f.projectId||null,f.projectName,f.assignee,
        f.dueDate||null,f.priority||'medium',f.status||'todo',f.category,f.tags||[]])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}
exports.update = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE tasks SET title=$1,description=$2,project_id=$3,project_name=$4,
        assignee=$5,due_date=$6,priority=$7,status=$8,category=$9,tags=$10
      WHERE id=$11 RETURNING *
    `, [f.title,f.description,f.projectId||null,f.projectName,
        f.assignee,f.dueDate||null,f.priority,f.status,f.category,f.tags||[],req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}
exports.setStatus = async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE tasks SET status=$1 WHERE id=$2 RETURNING *',
      [req.body.status, req.params.id]
    )
    res.json(rows[0])
  } catch (err) { next(err) }
}
exports.remove = async (req, res, next) => {
  try {
    await query('DELETE FROM tasks WHERE id=$1', [req.params.id])
    res.json({ message: 'Task deleted' })
  } catch (err) { next(err) }
}
