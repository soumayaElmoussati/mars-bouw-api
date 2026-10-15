exports.up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS subcontractors (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(150) NOT NULL,
      specialty      VARCHAR(50),
      contact_person VARCHAR(100),
      phone          VARCHAR(30),
      email          VARCHAR(150),
      kvk            VARCHAR(20),
      btw            VARCHAR(30),
      iban           VARCHAR(30),
      address        VARCHAR(200),
      rating         INT  DEFAULT 3 CHECK (rating BETWEEN 1 AND 5),
      status         VARCHAR(20) DEFAULT 'actief'
                       CHECK (status IN ('actief','inactief')),
      notes          TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS subcontractor_orders (
      id                 SERIAL PRIMARY KEY,
      subcontractor_id   INT NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
      subcontractor_name VARCHAR(150),
      project_id         INT  REFERENCES projects(id) ON DELETE SET NULL,
      project_name       VARCHAR(200),
      type               VARCHAR(20) DEFAULT 'opdracht'
                           CHECK (type IN ('offerte','opdracht')),
      order_number       VARCHAR(30) UNIQUE NOT NULL,
      description        TEXT,
      amount             NUMERIC(12,2) DEFAULT 0,
      btw                NUMERIC(5,2)  DEFAULT 21,
      status             VARCHAR(20)   DEFAULT 'concept'
                           CHECK (status IN ('concept','goedgekeurd','in_uitvoering','afgerond','geannuleerd')),
      sent_date          DATE,
      start_date         DATE,
      end_date           DATE,
      payment_status     VARCHAR(30) DEFAULT 'te_betalen',
      notes              TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS subcontractor_payments (
      id         SERIAL PRIMARY KEY,
      order_id   INT NOT NULL REFERENCES subcontractor_orders(id) ON DELETE CASCADE,
      date       DATE DEFAULT CURRENT_DATE,
      amount     NUMERIC(12,2) NOT NULL,
      method     VARCHAR(30),
      note       TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS subcontractor_payments CASCADE')
  await client.query('DROP TABLE IF EXISTS subcontractor_orders CASCADE')
  await client.query('DROP TABLE IF EXISTS subcontractors CASCADE')
}
