require('dotenv').config()
const bcrypt = require('bcryptjs')
const { pool } = require('./pool')

async function seed() {
  const cl = await pool.connect()
  console.log('\n🌱  Seeding database...\n')
  try {
    await cl.query('BEGIN')

    // ── Users ────────────────────────────────────────────────────────────────
    const hash = await bcrypt.hash('admin', 10)
    await cl.query(`
      INSERT INTO users (name, email, password, role, avatar)
      VALUES ('Jan de Vries', 'admin@marsbouw.nl', $1, 'admin', 'JD')
      ON CONFLICT (email) DO NOTHING
    `, [hash])
    console.log('  ✓ Users')

    // ── Clients ──────────────────────────────────────────────────────────────
    const { rows: clients } = await cl.query(`
      INSERT INTO clients (type,subtype,first_name,last_name,company_name,address,postal_code,city,phone1,phone2,email,website,kvk,vat_number,contact_person,preferred_contact,status,created_at)
      VALUES
        ('company','restaurant','Mohamed','El Amrani','Restaurant De Gouden Tulp','Kalverstraat 58','1012 NX','Amsterdam','+31 20 123 4567','','info@goudentulp.nl','www.goudentulp.nl','12345678','NL123456789B01','Mohamed El Amrani','email','active','2024-03-10'),
        ('individual','residential','Anke','Visser','','Vondelstraat 14','2512 AB','Den Haag','+31 70 987 6543','+31 6 12345678','a.visser@gmail.com','','','','Anke Visser','phone','active','2024-05-22'),
        ('organisation','school','Pieter','Janssen','Basisschool De Regenboog','Schoollaan 3','3012 GH','Rotterdam','+31 10 456 7890','','directie@regenboogschool.nl','www.regenboogschool.nl','87654321','','Pieter Janssen','email','prospect','2024-07-01'),
        ('company','hotel','Sara','de Boer','Hotel Amstelzicht BV','Amsteldijk 200','1079 LK','Amsterdam','+31 20 555 0100','+31 6 98765432','s.deboer@amstelzicht.nl','www.amstelzicht.nl','23456789','NL234567890B02','Sara de Boer','whatsapp','active','2024-01-15'),
        ('company','office','Lars','Hendriks','TechStart Solutions BV','Zuidas 101','1082 PP','Amsterdam','+31 20 888 2222','','l.hendriks@techstart.nl','www.techstart.nl','34567890','NL345678901B03','Lars Hendriks','email','inactive','2023-11-08')
      ON CONFLICT DO NOTHING
      RETURNING id, company_name, first_name, last_name
    `)
    console.log('  ✓ Clients')

    const cid  = (i) => clients[i]?.id
    const cname = (i) => clients[i]
      ? (clients[i].company_name || `${clients[i].first_name} ${clients[i].last_name}`)
      : ''

    // ── Workers ──────────────────────────────────────────────────────────────
    await cl.query(`
      INSERT INTO workers (name,role,hourly_rate,overtime_rate,phone,email,status,color) VALUES
        ('Jan de Vries','Uitvoerder', 55.00,82.50,'+31 6 12 34 56 78','j.devries@marsbouw.nl','actief','#1A3E6F'),
        ('Piet Bakker',  'Elektricien',52.00,78.00,'+31 6 23 45 67 89','p.bakker@marsbouw.nl', 'actief','#2D6BB5'),
        ('Kees Smit',    'Dakdekker',  48.00,72.00,'+31 6 34 56 78 90','k.smit@marsbouw.nl',   'actief','#2E7D32'),
        ('Ali Karim',    'Tegelzetter',46.00,69.00,'+31 6 45 67 89 01','a.karim@marsbouw.nl',  'actief','#E65100'),
        ('Hassan Bouri', 'Schilder',   44.00,66.00,'+31 6 56 78 90 12','h.bouri@marsbouw.nl',  'actief','#7B1FA2')
      ON CONFLICT DO NOTHING
    `)
    console.log('  ✓ Workers')

    // ── Projects ─────────────────────────────────────────────────────────────
    const { rows: projects } = await cl.query(`
      INSERT INTO projects (client_id,client_name,name,status,priority,start_date,estimated_end_date,budget,spent_budget,address,description,notes)
      VALUES
        ($1,$2,'Renovatie Restaurant De Gouden Tulp','in_progress','high','2024-09-01','2024-11-30',85000,42000,'Kalverstraat 58, 1012 NX Amsterdam','Volledige renovatie interieur.','Werken buiten openingstijden.'),
        ($3,$4,'Uitbouw achterzijde woning Visser',  'planning',   'medium','2024-12-01','2025-02-28',32000,0,    'Vondelstraat 14, 2512 AB Den Haag','Glazen serre 18m².','Vergunning in behandeling.'),
        ($5,$6,'Dakrenovatie Basisschool De Regenboog','completed','urgent','2024-07-01','2024-08-31',58000,55400,'Schoollaan 3, 3012 GH Rotterdam','Dakbedekking vervangen.','Afgerond.'),
        ($7,$8,'Kamers Hotel Amstelzicht 3e & 4e verd','in_progress','high','2024-10-01','2025-01-31',210000,68000,'Amsteldijk 200, 1079 LK Amsterdam','24 hotelkamers in 2 fases.','Werk per 6 kamers.')
      RETURNING id
    `, [cid(0),cname(0), cid(1),cname(1), cid(2),cname(2), cid(3),cname(3)])
    const pids = projects.map(p => p.id)
    console.log('  ✓ Projects')

    // Project tasks
    const taskSets = [
      [pids[0],[['Sloopwerk begane grond',true],['Asbestverwijdering',true],['Nieuwe leidingen aanleggen',false],['Elektriciteitsinstallatie',false],['Keuken plaatsen',false]]],
      [pids[1],[['Omgevingsvergunning aanvragen',false],['Fundering uitgraven',false],['Constructie plaatsen',false]]],
      [pids[2],[['Oud dakmateriaal verwijderen',true],['Isolatieplaten aanbrengen',true],['Nieuwe dakbedekking leggen',true],['Oplevering inspectie',true]]],
      [pids[3],[['Sloopwerk kamers 301-312',true],['Sloopwerk kamers 401-412',false],['Nieuwe leidingen sanitair',false],['Badkamers betegelen',false]]],
    ]
    for (const [pid, tasks] of taskSets) {
      for (const [i, [text, done]] of tasks.entries()) {
        await cl.query(
          'INSERT INTO project_tasks (project_id,text,done,sort_order) VALUES ($1,$2,$3,$4)',
          [pid, text, done, i]
        )
      }
    }
    console.log('  ✓ Project tasks')

    // ── Tasks (todo list) ─────────────────────────────────────────────────────
    await cl.query(`
      INSERT INTO tasks (title,project_id,project_name,assignee,due_date,priority,status) VALUES
        ('Offerte opstellen voor klant Visser',     $1,$2,'Jan de Vries','2024-10-15','high','todo'),
        ('Materialen bestellen elektrawerk',         $3,$4,'Piet Bakker', '2024-09-28','urgent','in_progress'),
        ('Veiligheidsplan opstellen werf',           NULL,'','Jan de Vries','2024-10-20','high','todo'),
        ('Facturatie september versturen',           NULL,'','Jan de Vries','2024-10-05','urgent','done'),
        ('Aanvraag vergunning aanbouw Visser',       $1,$2,'Jan de Vries','2024-10-08','high','in_progress')
    `, [pids[1],cname(1), pids[0],cname(0)])
    console.log('  ✓ Tasks')

    // ── Suppliers + Stock ─────────────────────────────────────────────────────
    const { rows: sups } = await cl.query(`
      INSERT INTO suppliers (name,contact,phone,email) VALUES
        ('Bouwmaterialen Hendriks BV','info@hendriks-bouw.nl',   '+31 20 111 2222','info@hendriks-bouw.nl'),
        ('IsoTech Nederland',          'verkoop@isotech.nl',       '+31 30 333 4444','verkoop@isotech.nl'),
        ('ElektroPro Groothandel',     'orders@elektropro.nl',     '+31 10 555 6666','orders@elektropro.nl'),
        ('Sanitair & Installatie BV',  'info@sanitairinstallatie.nl','+31 40 777 8888','info@sanitairinstallatie.nl')
      RETURNING id
    `)
    const sids = sups.map(s => s.id)

    await cl.query(`
      INSERT INTO stock_items (name,sku,category,unit,quantity,min_stock,max_stock,location,supplier_id,supplier_name,purchase_price) VALUES
        ('Cementmortel 25kg',         'MAT-CEM-001','bouwmaterialen','zak',  45,20,100,'Magazijn A',$1,'Bouwmaterialen Hendriks BV',8.50),
        ('Isolatieplaat 60mm PIR',    'MAT-ISO-002','isolatie',      'm²',    8,15, 80,'Magazijn B',$2,'IsoTech Nederland',22.00),
        ('Elektriciteitskabel NYM',   'ELE-KAB-003','elektra',       'meter',320,100,500,'Magazijn A',$3,'ElektroPro Groothandel',1.85),
        ('PVC buis 50mm',             'SAN-PVC-004','sanitair',      'meter',  5, 20,100,'Magazijn C',$4,'Sanitair & Installatie BV',3.20),
        ('Gipskartonplaat 12.5mm',    'MAT-GKP-005','bouwmaterialen','plaat', 60, 30,150,'Magazijn B',$1,'Bouwmaterialen Hendriks BV',9.80),
        ('Vloertegel 60x60 Grijs Mat','AFW-TEG-006','afwerking',     'm²',    0,  10, 50,'Magazijn D',NULL,'',18.50)
      ON CONFLICT (sku) DO NOTHING
    `, sids)
    console.log('  ✓ Suppliers + Stock')

    // ── Time entries ──────────────────────────────────────────────────────────
    const { rows: workers } = await cl.query('SELECT id FROM workers ORDER BY id')
    const wids = workers.map(w => w.id)

    // Insert each entry separately to avoid parameter confusion
    const timeEntries = [
      [wids[0], pids[0], cname(0), '2024-09-02','07:30','16:00',30,'normaal','Sloopwerk begane grond','goedgekeurd','Jan de Vries'],
      [wids[1], pids[0], cname(0), '2024-09-02','08:00','17:00',30,'normaal','Inspectie elektrische installatie','goedgekeurd','Jan de Vries'],
      [wids[0], pids[0], cname(0), '2024-09-03','07:30','17:30',30,'normaal','Sloopwerk vervolg','goedgekeurd','Jan de Vries'],
      [wids[2], pids[2], cname(2), '2024-09-03','07:00','16:00',30,'normaal','Oud dak verwijderen','goedgekeurd','Jan de Vries'],
      [wids[0], pids[0], cname(0), '2024-09-04','07:30','18:00',30,'overwerk','Asbestverwijdering start','goedgekeurd','Jan de Vries'],
      [wids[1], pids[0], cname(0), '2024-09-11','08:00','18:30',30,'overwerk','Verdeelkast plaatsen','goedgekeurd','Jan de Vries'],
      [wids[3], pids[3], cname(3), '2024-09-10','08:00','17:00',30,'normaal','Badkamer opbreken kamers 301-303','goedgekeurd','Jan de Vries'],
      [wids[4], pids[1], cname(1), '2024-09-12','08:30','16:30',30,'normaal','Muren voorbereiden schilderwerk','wacht_goedkeuring',null],
      [wids[0], pids[3], cname(3), '2024-09-18','07:30','17:00',30,'normaal','Coördinatie teams 3e verdieping','wacht_goedkeuring',null],
    ]
    for (const e of timeEntries) {
      await cl.query(`
        INSERT INTO time_entries (worker_id,project_id,project_name,date,start_time,end_time,break_minutes,work_type,description,status,approved_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, e)
    }
    console.log('  ✓ Time entries')

    // ── Offertes ──────────────────────────────────────────────────────────────
    const { rows: [off1] } = await cl.query(`
      INSERT INTO offertes (offerte_number,client_id,client_name,client_address,date,valid_days,status,project_name,converted_to_invoice)
      VALUES ('MB-64',$1,$2,'Heer Halewijnstraat 20, Amsterdam','2026-09-03',15,'goedgekeurd','Renovatie Badkamer',true)
      RETURNING id
    `, [cid(0) || null, cname(0)])

    await cl.query(`
      INSERT INTO offerte_lines (offerte_id,description,qty,unit,unit_price,btw,sort_order) VALUES
        ($1,'Achter wand lijm en oude stuk slopen',1,'stuk',250,21,1),
        ($1,'Achter wand helemaal op nieuwe stuken met cement',1,'stuk',175,21,2),
        ($1,'Leiding installatie vernieuwing van de badkamer',1,'stuk',1250,21,3),
        ($1,'Tegels plinten slopen samen met randen vloertegels',1,'stuk',350,21,4),
        ($1,'Randen van de vloer tegels op nieuwe tegelen',1,'stuk',450,21,5),
        ($1,'Car verzekering',1,'stuk',250,21,6)
    `, [off1.id])
    console.log('  ✓ Offertes')

    // ── Facturen ──────────────────────────────────────────────────────────────
    const { rows: [fac1] } = await cl.query(`
      INSERT INTO facturen (factuur_number,client_id,client_name,client_address,date,due_date,status,project_name,notes)
      VALUES ('F-137',$1,'MARIEKE VAN RIESSEN','Lijnbaansgracht 11-3, 1015 GM Amsterdam','2026-08-24','2026-09-07','betaald','Stukwerk en schilderwerk incl materiaal','t.n.v. Mars Bouw')
      RETURNING id
    `, [cid(0) || null])

    await cl.query(`
      INSERT INTO factuur_lines (factuur_id,description,qty,unit,unit_price,btw,sort_order) VALUES
        ($1,'Timmerwerkzaamheden',1,'1',1095,21,1),
        ($1,'Loodgieterwerk',    1,'1', 250,21,2),
        ($1,'Schilderwerk',      1,'1', 950,21,3),
        ($1,'Afplak materiaal',  1,'1', 150,21,4),
        ($1,'Lucht ventilatie kap 2x',1,'1',75,21,5)
    `, [fac1.id])

    await cl.query(`
      INSERT INTO payments (factuur_id,date,amount,method,note) VALUES
        ($1,'2026-08-25',1524.60,'overschrijving','50% aanbetaling'),
        ($1,'2026-09-05',1524.60,'overschrijving','Eindbetaling')
    `, [fac1.id])

    const { rows: [fac2] } = await cl.query(`
      INSERT INTO facturen (factuur_number,client_id,client_name,client_address,date,due_date,status,project_name)
      VALUES ('F-138',$1,'LEA KLARENBEEK','Heer Halewijnstraat 20, Amsterdam','2026-09-20','2026-10-04','gedeeltelijk','Renovatie Badkamer')
      RETURNING id
    `, [cid(0) || null])

    await cl.query(`
      INSERT INTO factuur_lines (factuur_id,description,qty,unit,unit_price,btw,sort_order) VALUES
        ($1,'Achter wand lijm en oude stuk slopen',1,'stuk',250,21,1),
        ($1,'Achter wand op nieuwe stuken met cement',1,'stuk',175,21,2),
        ($1,'Leiding installatie vernieuwing badkamer',1,'stuk',1250,21,3),
        ($1,'Tegels plinten slopen met randen vloertegels',1,'stuk',350,21,4),
        ($1,'Randen van vloer tegels op nieuwe tegelen',1,'stuk',450,21,5),
        ($1,'Car verzekering',1,'stuk',250,21,6)
    `, [fac2.id])

    await cl.query(`INSERT INTO payments (factuur_id,date,amount,method) VALUES ($1,'2026-09-21',1648.63,'overschrijving')`, [fac2.id])
    console.log('  ✓ Facturen + Payments')

    // ── Uitgaven ──────────────────────────────────────────────────────────────
    await cl.query(`
      INSERT INTO uitgaven (date,description,category,project_id,project_name,supplier,amount,btw,btw_amount,payment_method,status) VALUES
        ('2026-09-05','Cementmortel en gipskarton','materialen',$1,$2,'Bouwmaterialen Hendriks BV',451.00,21,94.71,'pin','betaald'),
        ('2026-09-12','Brandstof werkbus','transport',NULL,'','Shell Amsterdam',87.50,21,18.38,'pin','betaald'),
        ('2026-09-18','Elektriciteitskabels NYM 200m','materialen',$1,$2,'ElektroPro Groothandel',370.00,21,77.70,'overschrijving','betaald'),
        ('2026-09-20','Gereedschap huur steigerbouw','gereedschap',$3,$4,'Steiger & Lift BV',320.00,21,67.20,'overschrijving','te_betalen')
    `, [pids[0],cname(0), pids[3],cname(3)])
    console.log('  ✓ Uitgaven')

    // ── Subcontractors ────────────────────────────────────────────────────────
    const { rows: subs } = await cl.query(`
      INSERT INTO subcontractors (name,specialty,contact_person,phone,email,kvk,btw,iban,address,rating,status,notes) VALUES
        ('ElektroBouw Janssen BV','elektra','Henk Janssen','+31 20 234 5678','h.janssen@elektrobouw.nl','11223344','NL112233440B01','NL12ABNA0123456789','Amstelweg 12, Amsterdam',4,'actief','Betrouwbare elektricien.'),
        ('Sanitair Xpert BV','sanitair','Marco de Wit','+31 10 345 6789','marco@sanitairxpert.nl','22334455','NL223344550B01','NL34RABO0234567890','Pleinweg 44, Rotterdam',5,'actief','Gespecialiseerd in badkamers.'),
        ('Dak & Gevel Smeets','dakwerk','Johan Smeets','+31 40 456 7890','info@dakengevelmeets.nl','33445566','NL334455660B01','NL56INGB0345678901','Industrieweg 8, Eindhoven',4,'actief','Gecertificeerd voor asbest.')
      RETURNING id
    `)
    const sub_ids = subs.map(s => s.id)

    await cl.query(`
      INSERT INTO subcontractor_orders (subcontractor_id,subcontractor_name,project_id,project_name,type,order_number,description,amount,btw,status,sent_date,payment_status) VALUES
        ($1,'ElektroBouw Janssen BV',$4,$5,'opdracht','SO-001','Elektriciteitsinstallatie volledige renovatie',8500,21,'goedgekeurd','2024-09-05','gedeeltelijk'),
        ($2,'Sanitair Xpert BV',     $4,$5,'opdracht','SO-002','Sanitair installatie keuken en toiletten',    5200,21,'in_uitvoering','2024-09-10','te_betalen'),
        ($3,'Dak & Gevel Smeets',    $6,$7,'opdracht','SO-003','Dakbedekking 800m² + isolatie',             18500,21,'afgerond',     '2024-06-20','betaald')
    `, [sub_ids[0],sub_ids[1],sub_ids[2], pids[0],cname(0), pids[2],cname(2)])
    console.log('  ✓ Subcontractors + Orders')

    // ── CRM ───────────────────────────────────────────────────────────────────
    await cl.query(`
      INSERT INTO crm_notes (client_id,date,type,author,content,follow_up,follow_up_done) VALUES
        ($1,'2024-08-15','gesprek',   'Jan de Vries','Eerste gesprek over renovatie. Klant wil uitgebreid renoveren voor heropening in december.','2024-08-22',true),
        ($1,'2024-08-22','email',     'Jan de Vries','Offerte verstuurd. Klant vraagt aanpassing verlichting keuken.','2024-09-01',true),
        ($1,'2024-09-01','telefoon',  'Jan de Vries','Offerte goedgekeurd. Start werkzaamheden bevestigd.',NULL,false),
        ($1,'2024-09-12','probleem',  'Jan de Vries','Asbest aangetroffen. Extra kosten besproken.','2024-09-15',false),
        ($2,'2024-09-05','vergadering','Jan de Vries','Kick-off meeting hotel. 24 kamers in 2 fases. Planning besproken.','2024-10-01',true)
    `, [cid(0), cid(3)])

    await cl.query(`
      INSERT INTO crm_contacts (client_id,name,role,phone,email,primary_contact) VALUES
        ($1,'Mohamed El Amrani','Eigenaar / Opdrachtgever','+31 20 123 4567','info@goudentulp.nl',true),
        ($2,'Sara de Boer',     'Directeur',               '+31 20 555 0100','s.deboer@amstelzicht.nl',true),
        ($2,'Peter Kuijpers',   'Technisch beheerder',     '+31 6 12345678', 'p.kuijpers@amstelzicht.nl',false)
    `, [cid(0), cid(3)])
    console.log('  ✓ CRM notes + contacts')

    await cl.query('COMMIT')
    console.log('\n✅  Seed complete!\n')
    console.log('   Login → admin@marsbouw.nl  /  admin\n')
  } catch (err) {
    await cl.query('ROLLBACK')
    console.error('\n❌  Seed failed:', err.message)
    process.exit(1)
  } finally {
    cl.release()
    await pool.end()
  }
}

seed()