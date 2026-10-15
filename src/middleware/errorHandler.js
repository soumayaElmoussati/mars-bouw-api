module.exports = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} —`, err.message)

  // PostgreSQL errors
  if (err.code === '23505') return res.status(409).json({ error: 'Duplicate entry',             detail: err.detail })
  if (err.code === '23503') return res.status(400).json({ error: 'Referenced record not found', detail: err.detail })
  if (err.code === '23502') return res.status(400).json({ error: 'Missing required field',      column: err.column })

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  })
}
