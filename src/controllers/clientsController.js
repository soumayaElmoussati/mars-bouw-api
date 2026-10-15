const { query } = require('../db/pool')

// GET /api/clients
exports.getAll = async (req, res, next) => {
  try {
    const { search, status, type } = req.query
    const params = []
    let sql = 'SELECT * FROM clients WHERE 1=1'

    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (first_name ILIKE $${params.length}
               OR last_name    ILIKE $${params.length}
               OR company_name ILIKE $${params.length}
               OR email        ILIKE $${params.length}
               OR city         ILIKE $${params.length})`
    }
    if (status) { params.push(status); sql += ` AND status = $${params.length}` }
    if (type)   { params.push(type);   sql += ` AND type   = $${params.length}` }

    sql += ' ORDER BY created_at DESC'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}

// GET /api/clients/:id
exports.getById = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM clients WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

// POST /api/clients
exports.create = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO clients
        (type, subtype, first_name, last_name, company_name,
         address, postal_code, city, phone1, phone2,
         email, website, kvk, vat_number, contact_person,
         preferred_contact, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [
      f.type, f.subtype, f.firstName, f.lastName, f.companyName,
      f.address, f.postalCode, f.city, f.phone1, f.phone2,
      f.email, f.website, f.kvk, f.vatNumber, f.contactPerson,
      f.preferredContact, f.status || 'active', f.notes,
    ])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

// PUT /api/clients/:id
exports.update = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE clients SET
        type=$1, subtype=$2, first_name=$3, last_name=$4, company_name=$5,
        address=$6, postal_code=$7, city=$8, phone1=$9, phone2=$10,
        email=$11, website=$12, kvk=$13, vat_number=$14, contact_person=$15,
        preferred_contact=$16, status=$17, notes=$18
      WHERE id = $19
      RETURNING *
    `, [
      f.type, f.subtype, f.firstName, f.lastName, f.companyName,
      f.address, f.postalCode, f.city, f.phone1, f.phone2,
      f.email, f.website, f.kvk, f.vatNumber, f.contactPerson,
      f.preferredContact, f.status, f.notes,
      req.params.id,
    ])
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

// DELETE /api/clients/:id
exports.remove = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM clients WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Client not found' })
    res.json({ message: 'Client deleted' })
  } catch (err) { next(err) }
}
