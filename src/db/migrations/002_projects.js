exports.up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id                 SERIAL PRIMARY KEY,
      name               VARCHAR(200) NOT NULL,
      client_id          INT          REFERENCES clients(id) ON DELETE SET NULL,
      client_name        VARCHAR(150),
      status             VARCHAR(20)  DEFAULT 'planning'
                           CHECK (status IN ('planning','in_progress','on_hold','completed','cancelled')),
      priority           VARCHAR(10)  DEFAULT 'medium'
                           CHECK (priority IN ('low','medium','high','urgent')),
      start_date         DATE,
      estimated_end_date DATE,
      budget             NUMERIC(12,2) DEFAULT 0,
      spent_budget       NUMERIC(12,2) DEFAULT 0,
      address            VARCHAR(200),
      description        TEXT,
      notes              TEXT,
      created_at         TIMESTAMPTZ  DEFAULT NOW(),
      updated_at         TIMESTAMPTZ  DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS project_tasks (
      id         SERIAL PRIMARY KEY,
      project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text       VARCHAR(300) NOT NULL,
      done       BOOLEAN      DEFAULT FALSE,
      sort_order INT          DEFAULT 0,
      created_at TIMESTAMPTZ  DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS project_problems (
      id         SERIAL PRIMARY KEY,
      project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      date       DATE DEFAULT CURRENT_DATE,
      resolved   BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS project_attachments (
      id         SERIAL PRIMARY KEY,
      project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name       VARCHAR(200) NOT NULL,
      size       INT,
      type       VARCHAR(100),
      url        TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query('CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_project_tasks_pid ON project_tasks(project_id)')
}

exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS project_attachments CASCADE')
  await client.query('DROP TABLE IF EXISTS project_problems CASCADE')
  await client.query('DROP TABLE IF EXISTS project_tasks CASCADE')
  await client.query('DROP TABLE IF EXISTS projects CASCADE')
}
