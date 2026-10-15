exports.up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS offertes (
      id                   SERIAL PRIMARY KEY,
      offerte_number       VARCHAR(50) UNIQUE NOT NULL,
      client_id            INT  REFERENCES clients(id) ON DELETE SET NULL,
      client_name          VARCHAR(150),
      client_address       TEXT,
      date                 DATE  DEFAULT CURRENT_DATE,
      valid_days           INT   DEFAULT 14,
      status               VARCHAR(20) DEFAULT 'concept'
                             CHECK (status IN ('concept','verzonden','goedgekeurd','afgewezen','verlopen')),
      project_name         VARCHAR(200),
      intro                TEXT,
      notes                TEXT,
      converted_to_invoice BOOLEAN DEFAULT FALSE,
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS offerte_lines (
      id          SERIAL PRIMARY KEY,
      offerte_id  INT NOT NULL REFERENCES offertes(id) ON DELETE CASCADE,
      section     VARCHAR(100),
      description TEXT NOT NULL,
      qty         NUMERIC(10,2) DEFAULT 1,
      unit        VARCHAR(30)   DEFAULT 'stuk',
      unit_price  NUMERIC(10,2) DEFAULT 0,
      btw         NUMERIC(5,2)  DEFAULT 21,
      is_optional BOOLEAN       DEFAULT FALSE,
      sort_order  INT           DEFAULT 0
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS offerte_payment_terms (
      id         SERIAL PRIMARY KEY,
      offerte_id INT NOT NULL REFERENCES offertes(id) ON DELETE CASCADE,
      label      VARCHAR(150),
      pct        NUMERIC(5,2),
      sort_order INT DEFAULT 0
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS facturen (
      id             SERIAL PRIMARY KEY,
      factuur_number VARCHAR(50) UNIQUE NOT NULL,
      offerte_id     INT  REFERENCES offertes(id) ON DELETE SET NULL,
      client_id      INT  REFERENCES clients(id)  ON DELETE SET NULL,
      client_name    VARCHAR(150),
      client_address TEXT,
      date           DATE  DEFAULT CURRENT_DATE,
      due_date       DATE,
      status         VARCHAR(20) DEFAULT 'openstaand'
                       CHECK (status IN ('openstaand','gedeeltelijk','betaald','vervallen')),
      project_name   VARCHAR(200),
      notes          TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS factuur_lines (
      id          SERIAL PRIMARY KEY,
      factuur_id  INT NOT NULL REFERENCES facturen(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      qty         NUMERIC(10,2) DEFAULT 1,
      unit        VARCHAR(30)   DEFAULT 'stuk',
      unit_price  NUMERIC(10,2) DEFAULT 0,
      btw         NUMERIC(5,2)  DEFAULT 21,
      sort_order  INT           DEFAULT 0
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id         SERIAL PRIMARY KEY,
      factuur_id INT NOT NULL REFERENCES facturen(id) ON DELETE CASCADE,
      date       DATE DEFAULT CURRENT_DATE,
      amount     NUMERIC(12,2) NOT NULL,
      method     VARCHAR(30)   DEFAULT 'overschrijving',
      note       TEXT,
      created_at TIMESTAMPTZ   DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS uitgaven (
      id             SERIAL PRIMARY KEY,
      date           DATE          DEFAULT CURRENT_DATE,
      description    VARCHAR(300)  NOT NULL,
      category       VARCHAR(50)   DEFAULT 'overig',
      project_id     INT  REFERENCES projects(id) ON DELETE SET NULL,
      project_name   VARCHAR(200),
      supplier       VARCHAR(150),
      amount         NUMERIC(12,2) NOT NULL,
      btw            NUMERIC(5,2)  DEFAULT 21,
      btw_amount     NUMERIC(12,2) DEFAULT 0,
      payment_method VARCHAR(30)   DEFAULT 'pin',
      status         VARCHAR(20)   DEFAULT 'betaald'
                       CHECK (status IN ('betaald','te_betalen','besteld')),
      created_at     TIMESTAMPTZ   DEFAULT NOW(),
      updated_at     TIMESTAMPTZ   DEFAULT NOW()
    )
  `)

  await client.query('CREATE INDEX IF NOT EXISTS idx_facturen_status ON facturen(status)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_facturen_client ON facturen(client_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_offertes_client ON offertes(client_id)')
}

exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS uitgaven CASCADE')
  await client.query('DROP TABLE IF EXISTS payments CASCADE')
  await client.query('DROP TABLE IF EXISTS factuur_lines CASCADE')
  await client.query('DROP TABLE IF EXISTS facturen CASCADE')
  await client.query('DROP TABLE IF EXISTS offerte_payment_terms CASCADE')
  await client.query('DROP TABLE IF EXISTS offerte_lines CASCADE')
  await client.query('DROP TABLE IF EXISTS offertes CASCADE')
}
