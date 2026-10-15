/**
 * Mars Bouw — JS Migration Runner
 *
 * Usage:
 *   npm run migrate        → run all pending migrations (up)
 *   npm run migrate:down   → rollback all migrations (down) — CAREFUL!
 *
 * Each migration file in ./migrations/ must export:
 *   exports.up   = async (client) => { ... }
 *   exports.down = async (client) => { ... }
 *
 * Applied migrations are tracked in the _migrations table.
 */
require('dotenv').config()
const path = require('path')
const fs   = require('fs')
const { pool } = require('./pool')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

async function ensureMetaTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(200) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

async function getApplied(client) {
  const { rows } = await client.query('SELECT name FROM _migrations ORDER BY id')
  return new Set(rows.map(r => r.name))
}

function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort()
}

async function migrateUp() {
  const client = await pool.connect()
  console.log('\n🚀  Running migrations...\n')
  try {
    await ensureMetaTable(client)
    const applied = await getApplied(client)
    const files   = getMigrationFiles()
    let count = 0

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  ⏭   ${file} — already applied`)
        continue
      }

      const migration = require(path.join(MIGRATIONS_DIR, file))

      try {
        await client.query('BEGIN')
        await migration.up(client)
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`  ✅  ${file}`)
        count++
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`  ❌  ${file}: ${err.message}`)
        throw err
      }
    }

    if (count === 0) {
      console.log('  ℹ️   Nothing to migrate — all up to date.\n')
    } else {
      console.log(`\n✅  Done — ${count} migration(s) applied.\n`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

async function migrateDown() {
  const client = await pool.connect()
  console.log('\n⚠️   Rolling back all migrations...\n')
  try {
    await ensureMetaTable(client)
    const applied = await getApplied(client)
    const files   = getMigrationFiles().reverse() // reverse order for rollback

    for (const file of files) {
      if (!applied.has(file)) continue

      const migration = require(path.join(MIGRATIONS_DIR, file))

      try {
        await client.query('BEGIN')
        await migration.down(client)
        await client.query('DELETE FROM _migrations WHERE name = $1', [file])
        await client.query('COMMIT')
        console.log(`  ↩️   ${file} — rolled back`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`  ❌  ${file}: ${err.message}`)
        throw err
      }
    }
    console.log('\n✅  All migrations rolled back.\n')
  } finally {
    client.release()
    await pool.end()
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const cmd = process.argv[2] || 'up'

if (cmd === 'up') {
  migrateUp().catch(err => { console.error(err.message); process.exit(1) })
} else if (cmd === 'down') {
  migrateDown().catch(err => { console.error(err.message); process.exit(1) })
} else {
  console.error(`Unknown command: ${cmd}. Use "up" or "down".`)
  process.exit(1)
}
