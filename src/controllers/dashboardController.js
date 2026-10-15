const { query } = require('../db/pool')

exports.getStats = async (req, res, next) => {
  try {
    const [clients, projects, tasks, stock, revenue, expenses, openInv, activeProj] =
      await Promise.all([
        query(`SELECT COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE status='active')  AS active,
                 COUNT(*) FILTER (WHERE status='prospect') AS prospect
               FROM clients`),

        query(`SELECT COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE status='in_progress') AS active
               FROM projects`),

        query(`SELECT COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE status!='done')                     AS open,
                 COUNT(*) FILTER (WHERE priority='urgent' AND status!='done') AS urgent
               FROM tasks`),

        query(`SELECT
                 COUNT(*) FILTER (WHERE quantity<=min_stock AND min_stock>0) AS low_stock,
                 COUNT(*) FILTER (WHERE quantity=0)                          AS out_of_stock
               FROM stock_items WHERE active=true`),

        query(`SELECT COALESCE(SUM(fl.qty*fl.unit_price*(1+fl.btw/100)),0) AS total
               FROM factuur_lines fl JOIN facturen f ON fl.factuur_id=f.id`),

        query(`SELECT COALESCE(SUM(amount),0) AS total FROM uitgaven WHERE status='betaald'`),

        query(`SELECT COUNT(*) AS count,
                 COALESCE(SUM(fl.qty*fl.unit_price*(1+fl.btw/100)),0) AS total
               FROM facturen f JOIN factuur_lines fl ON f.id=fl.factuur_id
               WHERE f.status != 'betaald'`),

        query(`SELECT p.id, p.name, p.client_name, p.budget, p.spent_budget, p.status,
                 COUNT(pt.id)                              AS task_total,
                 COUNT(pt.id) FILTER (WHERE pt.done=true) AS task_done
               FROM projects p
               LEFT JOIN project_tasks pt ON p.id=pt.project_id
               WHERE p.status='in_progress'
               GROUP BY p.id
               ORDER BY p.created_at DESC
               LIMIT 5`),
      ])

    const totalRevenue  = +revenue.rows[0].total
    const totalExpenses = +expenses.rows[0].total

    res.json({
      clients: {
        total:   +clients.rows[0].total,
        active:  +clients.rows[0].active,
        prospect:+clients.rows[0].prospect,
      },
      projects: {
        total:  +projects.rows[0].total,
        active: +projects.rows[0].active,
      },
      tasks: {
        total:  +tasks.rows[0].total,
        open:   +tasks.rows[0].open,
        urgent: +tasks.rows[0].urgent,
      },
      stock: {
        lowStock:   +stock.rows[0].low_stock,
        outOfStock: +stock.rows[0].out_of_stock,
      },
      finance: {
        totalRevenue,
        totalExpenses,
        result:           totalRevenue - totalExpenses,
        openInvoices:     +openInv.rows[0].count,
        openInvoiceTotal: +openInv.rows[0].total,
      },
      activeProjects: activeProj.rows,
    })
  } catch (err) { next(err) }
}
