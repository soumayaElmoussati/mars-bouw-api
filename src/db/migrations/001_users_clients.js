exports.up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100)  NOT NULL,
      email      VARCHAR(150)  UNIQUE NOT NULL,
      password   VARCHAR(255)  NOT NULL,
      role       VARCHAR(20)   NOT NULL DEFAULT 'user'
                   CHECK (role IN ('admin','manager','user')),
      avatar     VARCHAR(10),
      active     BOOLEAN       DEFAULT TRUE,
      created_at TIMESTAMPTZ   DEFAULT NOW(),
      updated_at TIMESTAMPTZ   DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id                SERIAL PRIMARY KEY,
      type              VARCHAR(20)  NOT NULL DEFAULT 'company'
                          CHECK (type IN ('individual','company','organisation')),
      subtype           VARCHAR(50),
      first_name        VARCHAR(100),
      last_name         VARCHAR(100),
      company_name      VARCHAR(150),
      address           VARCHAR(200),
      postal_code       VARCHAR(10),
      city              VARCHAR(100),
      phone1            VARCHAR(30),
      phone2            VARCHAR(30),
      email             VARCHAR(150),
      website           VARCHAR(150),
      kvk               VARCHAR(20),
      vat_number        VARCHAR(30),
      contact_person    VARCHAR(100),
      preferred_contact VARCHAR(20)  DEFAULT 'email',
      status            VARCHAR(20)  DEFAULT 'active'
                          CHECK (status IN ('active','inactive','prospect')),
      notes             TEXT,
      created_at        TIMESTAMPTZ  DEFAULT NOW(),
      updated_at        TIMESTAMPTZ  DEFAULT NOW()
    )
  `)
}

exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS clients CASCADE')
  await client.query('DROP TABLE IF EXISTS users CASCADE')
}
