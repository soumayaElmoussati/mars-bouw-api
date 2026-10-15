exports.up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(150) NOT NULL,
      contact    VARCHAR(150),
      phone      VARCHAR(30),
      email      VARCHAR(150),
      created_at TIMESTAMPTZ  DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS stock_items (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(200) NOT NULL,
      sku            VARCHAR(50)  UNIQUE NOT NULL,
      category       VARCHAR(50)  DEFAULT 'overig',
      unit           VARCHAR(20)  DEFAULT 'stuk',
      quantity       NUMERIC(10,2) DEFAULT 0,
      min_stock      NUMERIC(10,2) DEFAULT 0,
      max_stock      NUMERIC(10,2) DEFAULT 100,
      location       VARCHAR(100),
      supplier_id    INT  REFERENCES suppliers(id) ON DELETE SET NULL,
      supplier_name  VARCHAR(150),
      purchase_price NUMERIC(10,2) DEFAULT 0,
      description    TEXT,
      active         BOOLEAN       DEFAULT TRUE,
      created_at     TIMESTAMPTZ   DEFAULT NOW(),
      updated_at     TIMESTAMPTZ   DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id             SERIAL PRIMARY KEY,
      order_number   VARCHAR(30) UNIQUE NOT NULL,
      supplier_id    INT  REFERENCES suppliers(id)  ON DELETE SET NULL,
      supplier_name  VARCHAR(150),
      project_id     INT  REFERENCES projects(id)   ON DELETE SET NULL,
      project_name   VARCHAR(200),
      status         VARCHAR(20) DEFAULT 'besteld'
                       CHECK (status IN ('besteld','ontvangen','gedeeltelijk','geannuleerd')),
      order_date     DATE         DEFAULT CURRENT_DATE,
      expected_date  DATE,
      received_date  DATE,
      total_amount   NUMERIC(12,2) DEFAULT 0,
      notes          TEXT,
      created_at     TIMESTAMPTZ   DEFAULT NOW(),
      updated_at     TIMESTAMPTZ   DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id         SERIAL PRIMARY KEY,
      order_id   INT  NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      stock_id   INT  REFERENCES stock_items(id) ON DELETE SET NULL,
      name       VARCHAR(200) NOT NULL,
      quantity   NUMERIC(10,2) NOT NULL,
      unit       VARCHAR(20),
      unit_price NUMERIC(10,2) DEFAULT 0,
      received   NUMERIC(10,2) DEFAULT 0
    )
  `)

  await client.query('CREATE INDEX IF NOT EXISTS idx_stock_sku      ON stock_items(sku)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_stock_supplier ON stock_items(supplier_id)')
}

exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS purchase_order_items CASCADE')
  await client.query('DROP TABLE IF EXISTS purchase_orders CASCADE')
  await client.query('DROP TABLE IF EXISTS stock_items CASCADE')
  await client.query('DROP TABLE IF EXISTS suppliers CASCADE')
}
