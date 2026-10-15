const { query } = require('../db/pool')

exports.getAll = async (req, res, next) => {
  try {
    const { project_id, category } = req.query
    const params = []; let sql = 'SELECT * FROM photos WHERE 1=1'
    if (project_id) { params.push(project_id); sql += ` AND project_id=$${params.length}` }
    if (category)   { params.push(category);   sql += ` AND category=$${params.length}` }
    sql += ' ORDER BY date DESC, created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}

exports.create = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO photos (project_id, project_name, url, thumbnail, caption, category, uploaded_by, date, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [
      f.projectId   || null,
      f.projectName || '',
      f.url,
      f.thumbnail   || f.url,
      f.caption     || '',
      f.category    || 'uitvoering',
      f.uploadedBy  || '',
      f.date        || new Date().toISOString().slice(0, 10),
      f.tags        || [],
    ])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

exports.update = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE photos SET
        project_id=$1, project_name=$2, caption=$3, category=$4, tags=$5
      WHERE id=$6 RETURNING *
    `, [
      f.projectId   || f.project_id   || null,
      f.projectName || f.project_name || '',
      f.caption     || '',
      f.category    || 'uitvoering',
      f.tags        || [],
      req.params.id,
    ])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.remove = async (req, res, next) => {
  try {
    await query('DELETE FROM photos WHERE id=$1', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}