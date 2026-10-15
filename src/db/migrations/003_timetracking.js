exports.up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS workers (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(100) NOT NULL,
      role           VARCHAR(100),
      hourly_rate    NUMERIC(8,2) NOT NULL DEFAULT 0,
      overtime_rate  NUMERIC(8,2) NOT NULL DEFAULT 0,
      phone          VARCHAR(30),
      email          VARCHAR(150),
      status         VARCHAR(20)  DEFAULT 'actief'
                       CHECK (status IN ('actief','inactief')),
      color          VARCHAR(20)  DEFAULT '#1A3E6F',
      created_at     TIMESTAMPTZ  DEFAULT NOW(),
      updated_at     TIMESTAMPTZ  DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id             SERIAL PRIMARY KEY,
      worker_id      INT  NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      project_id     INT  REFERENCES projects(id) ON DELETE SET NULL,
      project_name   VARCHAR(200),
      date           DATE NOT NULL,
      start_time     VARCHAR(5) NOT NULL,
      end_time       VARCHAR(5) NOT NULL,
      break_minutes  INT  DEFAULT 30,
      work_type      VARCHAR(20) DEFAULT 'normaal'
                       CHECK (work_type IN ('normaal','overwerk','verlof','ziek')),
      description    TEXT,
      status         VARCHAR(20) DEFAULT 'concept'
                       CHECK (status IN ('concept','wacht_goedkeuring','goedgekeurd')),
      approved_by    VARCHAR(100),
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query('CREATE INDEX IF NOT EXISTS idx_time_entries_worker  ON time_entries(worker_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_time_entries_date    ON time_entries(date)')
}

exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS time_entries CASCADE')
  await client.query('DROP TABLE IF EXISTS workers CASCADE')
}
