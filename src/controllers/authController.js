const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { query } = require('../db/pool')

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' })

    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1 AND active = TRUE',
      [email.toLowerCase().trim()]
    )
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' })

    const token = signToken(user)
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }
    })
  } catch (err) { next(err) }
}

// GET /api/auth/me
exports.me = async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, avatar, created_at FROM users WHERE id = $1',
      [req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
}

// POST /api/auth/logout
exports.logout = (req, res) => {
  res.json({ message: 'Logged out' })
}
