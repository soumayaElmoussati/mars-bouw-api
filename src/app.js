require('dotenv').config()
const express      = require('express')
const cors         = require('cors')
const helmet       = require('helmet')
const rateLimit    = require('express-rate-limit')
const routes       = require('./routes/index')
const errorHandler = require('./middleware/errorHandler')

const app = express()

// ── CORS ─────────────────────────────────────────────────────────────────────
// Accepte plusieurs origines (dev local + Vercel preview + prod)
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .concat([
    'https://mars-bouw-app-three.vercel.app',
    'https://mars-bouw-app.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ])

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, mobile)
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}))

app.options('*', cors()) // handle preflight

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet())

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false }))
app.use('/api',      rateLimit({ windowMs:      60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }))

// ── Body ──────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const start = Date.now()
  try {
    const { pool } = require('./db/pool')
    const { rows } = await pool.query('SELECT version(), NOW() as server_time')
    res.json({
      status:      'ok',
      environment: process.env.NODE_ENV || 'development',
      timestamp:   new Date().toISOString(),
      database: {
        status:      'connected',
        server_time: rows[0].server_time,
        version:     rows[0].version.split(' ').slice(0,2).join(' '),
        latency_ms:  Date.now() - start,
      },
    })
  } catch (err) {
    res.status(503).json({
      status:    'error',
      timestamp: new Date().toISOString(),
      database: {
        status:  'disconnected',
        error:   err.message,
      },
    })
  }
})

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', routes)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Start (dev local uniquement) ─────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    console.log(`\n🚀  Mars Bouw API`)
    console.log(`   Local  : http://localhost:${PORT}/api/health`)
    console.log(`   Env    : ${process.env.NODE_ENV || 'development'}\n`)
  })
}

module.exports = app
