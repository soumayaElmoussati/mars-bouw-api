const { query, getClient } = require('../db/pool')

// ── Stock items ───────────────────────────────────────────────────────────────
exports.getItems = async (req, res, next) => {
  try {
    const { category, search } = req.query
    const params = []
    let sql = 'SELECT * FROM stock_items WHERE active=true'
    if (category) { params.push(category);       sql += ` AND category=$${params.length}` }
    if (search)   { params.push(`%${search}%`);  sql += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length})` }
    sql += ' ORDER BY name'
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) { next(err) }
}

exports.createItem = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      INSERT INTO stock_items (name,sku,category,unit,quantity,min_stock,max_stock,location,supplier_id,supplier_name,purchase_price,description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [f.name, f.sku, f.category||'overig', f.unit||'stuk', f.quantity||0,
        f.minStock||0, f.maxStock||100, f.location||'', f.supplierId||null,
        f.supplierName||'', f.purchasePrice||0, f.description||''])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

exports.updateItem = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(`
      UPDATE stock_items SET
        name=$1, category=$2, unit=$3, quantity=$4, min_stock=$5,
        max_stock=$6, location=$7, supplier_id=$8, supplier_name=$9,
        purchase_price=$10, description=$11
      WHERE id=$12 RETURNING *
    `, [f.name, f.category, f.unit, f.quantity, f.minStock,
        f.maxStock, f.location||'', f.supplierId||null, f.supplierName||'',
        f.purchasePrice, f.description||'', req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.deleteItem = async (req, res, next) => {
  try {
    await query('UPDATE stock_items SET active=false WHERE id=$1', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}

exports.updateQuantity = async (req, res, next) => {
  try {
    const { delta, absolute } = req.body
    const sql = absolute !== undefined
      ? 'UPDATE stock_items SET quantity=$1 WHERE id=$2 RETURNING *'
      : 'UPDATE stock_items SET quantity=GREATEST(0,quantity+$1) WHERE id=$2 RETURNING *'
    const { rows } = await query(sql, [absolute ?? delta, req.params.id])
    res.json(rows[0])
  } catch (err) { next(err) }
}

// ── Purchase orders ───────────────────────────────────────────────────────────
exports.getOrders = async (req, res, next) => {
  try {
    const { status } = req.query
    const params = []; let sql = 'SELECT * FROM purchase_orders WHERE 1=1'
    if (status) { params.push(status); sql += ` AND status=$${params.length}` }
    sql += ' ORDER BY order_date DESC'
    const { rows: orders } = await query(sql, params)
    if (!orders.length) return res.json([])
    const ids = orders.map(o => o.id)
    const { rows: items } = await query('SELECT * FROM purchase_order_items WHERE order_id=ANY($1)', [ids])
    res.json(orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id) })))
  } catch (err) { next(err) }
}

exports.createOrder = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const f = req.body
    const { rows: [{ n }] } = await cl.query('SELECT COUNT(*)+1 AS n FROM purchase_orders')
    const num = `PO-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`
    const total = (f.items || []).reduce((s, i) => s + i.quantity * (i.unitPrice || 0), 0)
    const { rows } = await cl.query(`
      INSERT INTO purchase_orders
        (order_number, supplier_id, supplier_name, project_id, project_name, status, order_date, expected_date, total_amount, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [num, f.supplierId||null, f.supplierName||'', f.projectId||null, f.projectName||'',
        f.status||'besteld', f.orderDate||new Date().toISOString().slice(0,10),
        f.expectedDate||null, total, f.notes||''])
    for (const item of (f.items || [])) {
      await cl.query(
        'INSERT INTO purchase_order_items (order_id,stock_id,name,quantity,unit,unit_price) VALUES ($1,$2,$3,$4,$5,$6)',
        [rows[0].id, item.stockId||null, item.name, item.quantity, item.unit||'stuk', item.unitPrice||0]
      )
    }
    await cl.query('COMMIT')
    // Return with items
    const { rows: orderItems } = await query('SELECT * FROM purchase_order_items WHERE order_id=$1', [rows[0].id])
    res.status(201).json({ ...rows[0], items: orderItems })
  } catch (err) { await cl.query('ROLLBACK'); next(err) }
  finally { cl.release() }
}

exports.receiveOrder = async (req, res, next) => {
  const cl = await getClient()
  try {
    await cl.query('BEGIN')
    const { rows } = await cl.query(
      "UPDATE purchase_orders SET status='ontvangen', received_date=CURRENT_DATE WHERE id=$1 RETURNING *",
      [req.params.id]
    )
    const { rows: items } = await cl.query('SELECT * FROM purchase_order_items WHERE order_id=$1', [req.params.id])
    for (const item of items) {
      if (item.stock_id) {
        await cl.query('UPDATE stock_items SET quantity=quantity+$1 WHERE id=$2', [item.quantity, item.stock_id])
      }
    }
    await cl.query('COMMIT')
    res.json({ ...rows[0], items })
  } catch (err) { await cl.query('ROLLBACK'); next(err) }
  finally { cl.release() }
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
exports.getSuppliers = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM suppliers ORDER BY name')
    res.json(rows)
  } catch (err) { next(err) }
}

exports.createSupplier = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(
      'INSERT INTO suppliers (name, contact, phone, email) VALUES ($1,$2,$3,$4) RETURNING *',
      [f.name, f.contact||'', f.phone||'', f.email||'']
    )
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
}

exports.updateSupplier = async (req, res, next) => {
  try {
    const f = req.body
    const { rows } = await query(
      'UPDATE suppliers SET name=$1, contact=$2, phone=$3, email=$4 WHERE id=$5 RETURNING *',
      [f.name, f.contact||'', f.phone||'', f.email||'', req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

exports.deleteSupplier = async (req, res, next) => {
  try {
    await query('DELETE FROM suppliers WHERE id=$1', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}