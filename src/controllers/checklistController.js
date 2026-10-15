const { query, getClient } = require('../db/pool')

exports.getAll = async (req, res, next) => {
  try {
    const { rows: instances } = await query(
      'SELECT * FROM checklist_instances ORDER BY created_at DESC'
    )
    if (!instances.length) return res.json([])
    const ids = instances.map(i => i.id)
    const { rows: checks } = await query(
      'SELECT * FROM checklist_checks WHERE instance_id = ANY($1)', [ids]
    )
    // Build checks and notes maps per instance
    res.json(instances.map(inst => {
      const instChecks = checks.filter(c => c.instance_id === inst.id)
      const checksMap = {}
      const notesMap  = {}
      instChecks.forEach(c => {
        checksMap[c.item_id] = c.checked
        if (c.note) notesMap[c.item_id] = c.note
      })
      return { ...inst, checks: checksMap, notes: notesMap }
    }))
  } catch (err) { next(err) }
}

exports.create = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows } = await cl.query(`
      INSERT INTO checklist_instances (template_id, template_type, project_id, project_name, client_name, status, started_at)
      VALUES ($1,$2,$3,$4,$5,'bezig', CURRENT_DATE) RETURNING *
    `, [f.templateId, f.templateType || '', f.projectId || null, f.projectName || '', f.clientName || ''])

    // Insert all items as unchecked
    for (const itemId of (f.itemIds || [])) {
      await cl.query(
        'INSERT INTO checklist_checks (instance_id, item_id, checked) VALUES ($1,$2,false) ON CONFLICT (instance_id, item_id) DO NOTHING',
        [rows[0].id, itemId]
      )
    }
    await cl.query('COMMIT')
    // Return with empty checks/notes maps
    const checksMap = {}
    ;(f.itemIds || []).forEach(id => { checksMap[id] = false })
    res.status(201).json({ ...rows[0], checks: checksMap, notes: {} })
  } catch (err) { await cl.query('ROLLBACK'); next(err) }
  finally { cl.release() }
}

exports.toggleCheck = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const { instanceId, itemId } = req.params
    const { checked, note } = req.body

    await cl.query(`
      INSERT INTO checklist_checks (instance_id, item_id, checked, note, updated_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (instance_id, item_id) DO UPDATE SET checked=$3, note=$4, updated_at=NOW()
    `, [instanceId, itemId, !!checked, note || null])

    // Auto-complete if all checked
    const { rows: [{ remaining }] } = await cl.query(
      "SELECT COUNT(*) FILTER (WHERE checked = false) AS remaining FROM checklist_checks WHERE instance_id=$1",
      [instanceId]
    )
    const newStatus = +remaining === 0 ? 'afgerond' : 'bezig'
    await cl.query(
      "UPDATE checklist_instances SET status=$1, completed_at=$2 WHERE id=$3",
      [newStatus, newStatus === 'afgerond' ? new Date().toISOString().slice(0, 10) : null, instanceId]
    )
    await cl.query('COMMIT')
    res.json({ success: true, status: newStatus })
  } catch (err) { await cl.query('ROLLBACK'); next(err) }
  finally { cl.release() }
}

exports.remove = async (req, res, next) => {
  try {
    await query('DELETE FROM checklist_instances WHERE id=$1', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}