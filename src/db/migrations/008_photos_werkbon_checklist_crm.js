exports.up = async (client) => {
  // ── Photos ──────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS photos (
      id           SERIAL PRIMARY KEY,
      project_id   INT  REFERENCES projects(id) ON DELETE SET NULL,
      project_name VARCHAR(200),
      url          TEXT NOT NULL,
      thumbnail    TEXT,
      caption      VARCHAR(300),
      category     VARCHAR(30) DEFAULT 'uitvoering'
                     CHECK (category IN ('voor','uitvoering','na','probleem','materiaal','overig')),
      uploaded_by  VARCHAR(100),
      date         DATE DEFAULT CURRENT_DATE,
      tags         TEXT[] DEFAULT '{}',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // ── Werkbonnen ──────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS werkbonnen (
      id               SERIAL PRIMARY KEY,
      number           VARCHAR(30) UNIQUE NOT NULL,
      project_id       INT  REFERENCES projects(id) ON DELETE SET NULL,
      project_name     VARCHAR(200),
      client_name      VARCHAR(150),
      client_address   TEXT,
      date             DATE DEFAULT CURRENT_DATE,
      notes            TEXT,
      problems         TEXT,
      next_steps       TEXT,
      status           VARCHAR(20) DEFAULT 'concept'
                         CHECK (status IN ('concept','verzonden','ondertekend')),
      client_signed_by VARCHAR(100),
      signed_at        TIMESTAMPTZ,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS werkbon_workers (
      id            SERIAL PRIMARY KEY,
      werkbon_id    INT NOT NULL REFERENCES werkbonnen(id) ON DELETE CASCADE,
      worker_id     INT  REFERENCES workers(id) ON DELETE SET NULL,
      name          VARCHAR(100),
      start_time    VARCHAR(5),
      end_time      VARCHAR(5),
      break_minutes INT  DEFAULT 30,
      hours         NUMERIC(5,2) DEFAULT 0
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS werkbon_works (
      id          SERIAL PRIMARY KEY,
      werkbon_id  INT NOT NULL REFERENCES werkbonnen(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      qty         NUMERIC(10,2) DEFAULT 1,
      unit        VARCHAR(20)   DEFAULT 'stuk',
      done        BOOLEAN       DEFAULT FALSE
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS werkbon_materials (
      id          SERIAL PRIMARY KEY,
      werkbon_id  INT NOT NULL REFERENCES werkbonnen(id) ON DELETE CASCADE,
      name        VARCHAR(200) NOT NULL,
      qty         NUMERIC(10,2) DEFAULT 1,
      unit        VARCHAR(20)   DEFAULT 'stuk'
    )
  `)

  // ── Checklists ──────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS checklist_instances (
      id            SERIAL PRIMARY KEY,
      template_id   INT  NOT NULL,
      template_type VARCHAR(50),
      project_id    INT  REFERENCES projects(id) ON DELETE SET NULL,
      project_name  VARCHAR(200),
      client_name   VARCHAR(150),
      started_at    DATE DEFAULT CURRENT_DATE,
      completed_at  DATE,
      status        VARCHAR(20) DEFAULT 'bezig'
                      CHECK (status IN ('bezig','afgerond','geannuleerd')),
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS checklist_checks (
      id          SERIAL PRIMARY KEY,
      instance_id INT NOT NULL REFERENCES checklist_instances(id) ON DELETE CASCADE,
      item_id     INT NOT NULL,
      checked     BOOLEAN DEFAULT FALSE,
      note        TEXT,
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (instance_id, item_id)
    )
  `)

  // ── CRM ─────────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS crm_notes (
      id             SERIAL PRIMARY KEY,
      client_id      INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      date           DATE DEFAULT CURRENT_DATE,
      type           VARCHAR(20) DEFAULT 'gesprek'
                       CHECK (type IN ('gesprek','telefoon','email','vergadering','probleem')),
      author         VARCHAR(100),
      content        TEXT NOT NULL,
      follow_up      DATE,
      follow_up_done BOOLEAN DEFAULT FALSE,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS crm_contacts (
      id              SERIAL PRIMARY KEY,
      client_id       INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name            VARCHAR(100) NOT NULL,
      role            VARCHAR(100),
      phone           VARCHAR(30),
      email           VARCHAR(150),
      primary_contact BOOLEAN DEFAULT FALSE,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query('CREATE INDEX IF NOT EXISTS idx_photos_project      ON photos(project_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_werkbonnen_project  ON werkbonnen(project_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_crm_notes_client    ON crm_notes(client_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_crm_contacts_client ON crm_contacts(client_id)')
}

exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS crm_contacts CASCADE')
  await client.query('DROP TABLE IF EXISTS crm_notes CASCADE')
  await client.query('DROP TABLE IF EXISTS checklist_checks CASCADE')
  await client.query('DROP TABLE IF EXISTS checklist_instances CASCADE')
  await client.query('DROP TABLE IF EXISTS werkbon_materials CASCADE')
  await client.query('DROP TABLE IF EXISTS werkbon_works CASCADE')
  await client.query('DROP TABLE IF EXISTS werkbon_workers CASCADE')
  await client.query('DROP TABLE IF EXISTS werkbonnen CASCADE')
  await client.query('DROP TABLE IF EXISTS photos CASCADE')
}
