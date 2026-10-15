const TABLES_WITH_UPDATED_AT = [
  'users', 'clients', 'projects', 'workers', 'time_entries',
  'tasks', 'planning_events', 'stock_items', 'purchase_orders',
  'offertes', 'facturen', 'uitgaven', 'subcontractors',
  'subcontractor_orders', 'werkbonnen', 'checklist_instances',
]

exports.up = async (client) => {
  // Create the trigger function once
  await client.query(`
    CREATE OR REPLACE FUNCTION fn_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)

  // Apply to every table that has updated_at
  for (const table of TABLES_WITH_UPDATED_AT) {
    await client.query(`
      DROP TRIGGER IF EXISTS trg_updated_at ON ${table};
      CREATE TRIGGER trg_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()
    `)
  }
}

exports.down = async (client) => {
  for (const table of TABLES_WITH_UPDATED_AT) {
    await client.query(`DROP TRIGGER IF EXISTS trg_updated_at ON ${table}`)
  }
  await client.query('DROP FUNCTION IF EXISTS fn_set_updated_at()')
}
