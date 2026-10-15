const router = require('express').Router()
const { authMiddleware } = require('../middleware/auth')

// Auth
const auth = require('../controllers/authController')
router.post('/auth/register', auth.register)
router.post('/auth/login',    auth.login)
router.get ('/auth/me',       authMiddleware, auth.me)
router.post('/auth/logout',   authMiddleware, auth.logout)

// All below require auth
router.use(authMiddleware)

// Dashboard
const dash = require('../controllers/dashboardController')
router.get('/dashboard', dash.getStats)

// Clients
const cl = require('../controllers/clientsController')
router.get   ('/clients',     cl.getAll)
router.get   ('/clients/:id', cl.getById)
router.post  ('/clients',     cl.create)
router.put   ('/clients/:id', cl.update)
router.delete('/clients/:id', cl.remove)

// Projects
const pr = require('../controllers/projectsController')
router.get   ('/projects',                         pr.getAll)
router.get   ('/projects/:id',                     pr.getById)
router.post  ('/projects',                         pr.create)
router.put   ('/projects/:id',                     pr.update)
router.delete('/projects/:id',                     pr.remove)
router.post  ('/projects/:id/tasks',               pr.addTask)
router.put   ('/projects/:id/tasks/:taskId',       pr.updateTask)
router.delete('/projects/:id/tasks/:taskId',       pr.deleteTask)
router.post  ('/projects/:id/problems',            pr.addProblem)
router.put   ('/projects/:id/problems/:problemId', pr.updateProblem)

// Planning ← NOUVEAU
const pl = require('../controllers/planningController')
router.get   ('/planning',     pl.getAll)
router.post  ('/planning',     pl.create)
router.put   ('/planning/:id', pl.update)
router.delete('/planning/:id', pl.remove)

// Finance
const fi = require('../controllers/financeController')
router.get   ('/finance/offertes',              fi.getOffertes)
router.post  ('/finance/offertes',              fi.createOfferte)
router.put   ('/finance/offertes/:id',          fi.updateOfferte)
router.delete('/finance/offertes/:id',          fi.deleteOfferte)
router.get   ('/finance/facturen',              fi.getFacturen)
router.post  ('/finance/facturen',              fi.createFactuur)
router.put   ('/finance/facturen/:id',          fi.updateFactuur)
router.post  ('/finance/facturen/:id/payments', fi.addPayment)
router.get   ('/finance/uitgaven',              fi.getUitgaven)
router.post  ('/finance/uitgaven',              fi.createUitgave)
router.put   ('/finance/uitgaven/:id',          fi.updateUitgave)
router.delete('/finance/uitgaven/:id',          fi.deleteUitgave)
router.get   ('/finance/stats',                 fi.getStats)

// Time tracking
const tt = require('../controllers/timetrackingController')
router.get   ('/timetracking/workers',             tt.getWorkers)
router.post  ('/timetracking/workers',             tt.createWorker)
router.put   ('/timetracking/workers/:id',         tt.updateWorker)
router.delete('/timetracking/workers/:id',         tt.deleteWorker)
router.get   ('/timetracking/entries',             tt.getEntries)
router.post  ('/timetracking/entries',             tt.createEntry)
router.put   ('/timetracking/entries/:id',         tt.updateEntry)
router.patch ('/timetracking/entries/:id/approve', tt.approveEntry)
router.delete('/timetracking/entries/:id',         tt.deleteEntry)
router.get   ('/timetracking/report',              tt.getReport)

// Tasks
const ta = require('../controllers/tasksController')
router.get   ('/tasks',            ta.getAll)
router.post  ('/tasks',            ta.create)
router.put   ('/tasks/:id',        ta.update)
router.patch ('/tasks/:id/status', ta.setStatus)
router.delete('/tasks/:id',        ta.remove)

// Stock
const st = require('../controllers/stockController')
router.get   ('/stock/items',              st.getItems)
router.post  ('/stock/items',              st.createItem)
router.put   ('/stock/items/:id',          st.updateItem)
router.patch ('/stock/items/:id/quantity', st.updateQuantity)
router.get   ('/stock/orders',             st.getOrders)
router.post  ('/stock/orders',             st.createOrder)
router.patch ('/stock/orders/:id/receive', st.receiveOrder)
router.get   ('/stock/suppliers',          st.getSuppliers)
router.post  ('/stock/suppliers',          st.createSupplier)

// CRM
const crm = require('../controllers/crmController')
router.get   ('/crm/client/:id',   crm.getClient360)
router.get   ('/crm/notes',        crm.getNotes)
router.post  ('/crm/notes',        crm.createNote)
router.patch ('/crm/notes/:id',    crm.updateNote)
router.delete('/crm/notes/:id',    crm.deleteNote)
router.get   ('/crm/contacts',     crm.getContacts)
router.post  ('/crm/contacts',     crm.createContact)
router.delete('/crm/contacts/:id', crm.deleteContact)

// Werkbon ← NOUVEAU
const wb = require('../controllers/werkbonController')
router.get   ('/werkbon',          wb.getAll)
router.get   ('/werkbon/:id',      wb.getById)
router.post  ('/werkbon',          wb.create)
router.put   ('/werkbon/:id',      wb.update)
router.delete('/werkbon/:id',      wb.remove)
router.post  ('/werkbon/:id/sign', wb.sign)

// Checklist ← NOUVEAU
const ck = require('../controllers/checklistController')
router.get   ('/checklist',                           ck.getAll)
router.post  ('/checklist',                           ck.create)
router.delete('/checklist/:id',                       ck.remove)
router.post  ('/checklist/:instanceId/check/:itemId', ck.toggleCheck)

module.exports = router