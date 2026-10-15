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

exports.register = async (req, res, next) => {
  try {
    let { name, email, password, role, avatar } = req.body

    // --- Validation ---
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required' })

    name  = name.trim()
    email = email.toLowerCase().trim()

    if (name.length < 2)
      return res.status(400).json({ error: 'Name must be at least 2 characters' })

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email))
      return res.status(400).json({ error: 'Invalid email format' })

    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' })

    // Rôle : par défaut 'user'. On n'autorise 'admin'/'manager'
    // que si l'appelant est déjà admin (à adapter selon ta logique).
    const allowedRoles = ['admin', 'manager', 'user']
    role = role || 'user'
    if (!allowedRoles.includes(role))
      return res.status(400).json({ error: 'Invalid role' })

    // --- Vérifier si l'email existe déjà ---
    const existing = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows[0])
      return res.status(409).json({ error: 'Email already in use' })

    // --- Hash du mot de passe ---
    const hashed = await bcrypt.hash(password, 12)

    // --- Insertion ---
    const { rows } = await query(
      `INSERT INTO users (name, email, password, role, avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, avatar, active, created_at`,
      [name, email, hashed, role, avatar || null]
    )

    const user = rows[0]
    const token = signToken(user)

    res.status(201).json({ token, user })
  } catch (err) { next(err) }
}
