const { query } = require('../db/pool')

exports.getClient360 = async (req, res, next) => {
  try {
    const cid = req.params.id
    const [notes, contacts, projects, offertes, facturen] = await Promise.all([
      query('SELECT * FROM crm_notes WHERE client_id=$1 ORDER BY date DESC', [cid]),
      query('SELECT * FROM crm_contacts WHERE client_id=$1 ORDER BY primary_contact DESC', [cid]),
      query('SELECT id,name,status,budget,spent_budget,start_date,estimated_end_date FROM projects WHERE client_id=$1 ORDER BY created_at DESC', [cid]),
      query('SELECT id,offerte_number,date,status,project_name FROM offertes WHERE client_id=$1 ORDER BY date DESC', [cid]),
      query(`SELECT f.id,f.factuur_number,f.date,f.status,f.project_name,
               COALESCE(SUM(fl.qty*fl.unit_price*(1+fl.btw/100)),0) AS total_incl
             FROM facturen f
             LEFT JOIN factuur_lines fl ON f.id=fl.factuur_id
             WHERE f.client_id=$1
             GROUP BY f.id ORDER BY f.date DESC`, [cid]),
    ])
    res.json({
      notes:    notes.rows,
      contacts: contacts.rows,
      projects: projects.rows,
      offertes: offertes.rows,
      facturen: facturen.rows,
    })
  } catch (err) { next(err) }
}

exports.getNotes = async (req, res, next) => {
  try {
    const { client_id } = req.query
    const params = []
    let sql = 'SELECT * FROM crm_notes WHERE 1=1'
    if (client_id) { params.push(client_id); sql += ` AND client_id=$${params.length}` }
    sql += ' ORDER BY date DESC'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}
exports.createNote = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO crm_notes (client_id,date,type,author,content,follow_up,follow_up_done)
      VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING *
    `, [f.clientId, f.date||new Date().toISOString().slice(0,10), f.type, f.author, f.content, f.followUp||null])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}
exports.updateNote = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(
      'UPDATE crm_notes SET follow_up_done=$1 WHERE id=$2 RETURNING *',
      [f.followUpDone, req.params.id]
    )
    res.json(rows[0])
  } catch (err) { next(err) }
}
exports.deleteNote = async (req, res, next) => {
  try {
    await query('DELETE FROM crm_notes WHERE id=$1', [req.params.id])
    res.json({ message: 'Note deleted' })
  } catch (err) { next(err) }
}

exports.getContacts = async (req, res, next) => {
  try {
    const { client_id } = req.query
    const params = []
    let sql = 'SELECT * FROM crm_contacts WHERE 1=1'
    if (client_id) { params.push(client_id); sql += ` AND client_id=$${params.length}` }
    sql += ' ORDER BY primary_contact DESC, name'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}
exports.createContact = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO crm_contacts (client_id,name,role,phone,email,primary_contact)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [f.clientId, f.name, f.role, f.phone, f.email, f.primary||false])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}
exports.deleteContact = async (req, res, next) => {
  try {
    await query('DELETE FROM crm_contacts WHERE id=$1', [req.params.id])
    res.json({ message: 'Contact deleted' })
  } catch (err) { next(err) }
}
