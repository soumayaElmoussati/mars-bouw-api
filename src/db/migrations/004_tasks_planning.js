exports.up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id           SERIAL PRIMARY KEY,
      title        VARCHAR(300) NOT NULL,
      description  TEXT,
      project_id   INT  REFERENCES projects(id) ON DELETE SET NULL,
      project_name VARCHAR(200),
      assignee     VARCHAR(100),
      due_date     DATE,
      priority     VARCHAR(10) DEFAULT 'medium'
                     CHECK (priority IN ('low','medium','high','urgent')),
      status       VARCHAR(20) DEFAULT 'todo'
                     CHECK (status IN ('todo','in_progress','done')),
      category     VARCHAR(50),
      tags         TEXT[]      DEFAULT '{}',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS planning_events (
      id           SERIAL PRIMARY KEY,
      title        VARCHAR(200) NOT NULL,
      project_id   INT  REFERENCES projects(id) ON DELETE SET NULL,
      project_name VARCHAR(200),
      assignee     VARCHAR(100),
      start_date   DATE NOT NULL,
      end_date     DATE NOT NULL,
      start_time   VARCHAR(5) DEFAULT '08:00',
      end_time     VARCHAR(5) DEFAULT '17:00',
      type         VARCHAR(50) DEFAULT 'overig',
      status       VARCHAR(20) DEFAULT 'planned'
                     CHECK (status IN ('planned','in_progress','done','cancelled')),
      color        VARCHAR(20) DEFAULT '#1A3E6F',
      notes        TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_planning_dates ON planning_events(start_date, end_date)')
}

exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS planning_events CASCADE')
  await client.query('DROP TABLE IF EXISTS tasks CASCADE')
}
