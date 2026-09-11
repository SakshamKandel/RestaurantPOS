import { useEffect, useMemo, useState } from 'react'
import { BadgePercent } from 'lucide-react'
import { CheckCircle2 } from 'lucide-react'
import Sidebar, { type View } from './components/Sidebar'
import OrderPanel, {
  type CartLine,
  type PaymentMethod,
} from './components/OrderPanel'
import LoginScreen from './components/LoginScreen'
import PaymentModal from './components/PaymentModal'
import ReceiptModal from './components/ReceiptModal'
import DashboardPage from './pages/DashboardPage'
import MenuPage from './pages/MenuPage'
import PrintersPage from './pages/PrintersPage'
import ShiftPage from './pages/ShiftPage'
import CustomersPage from './pages/CustomersPage'
import TransactionsPage from './pages/TransactionsPage'
import ReportPage from './pages/ReportPage'
import SettingsPage from './pages/SettingsPage'
import InfoPage from './pages/InfoPage'
import StaffPage from './pages/StaffPage'
import {
  LINE_ORDERS,
  type Category,
  type CategoryId,
  type Customer,
  type MenuItem,
  type OrderStatus,
  type Role,
  type Staff,
} from './data/menu'
import {
  appVersion,
  backupNow,
  checkForUpdates,
  detectPrinters,
  initialState,
  installUpdate,
  loadPersisted,
  onUpdateAvailable,
  onUpdateDownloaded,
  persist,
  printDocument,
  timeAgo,
  type DetectedPrinter,
  type Discount,
  type DocType,
  type HeldOrder,
  type MovementType,
  type OrderType,
  type PlacedOrder,
  type PosState,
  type PrintJob,
  type PrinterRole,
  type Shift,
  type UpdateInfo,
} from './store'
import { kickHtml, kitchenHtml, receiptHtml, testHtml } from './print/docs'
import type { DisplayOrder } from './components/OrderLine'
import type { CartMap } from './components/MenuSection'

const uid = () => Math.random().toString(36).slice(2, 10)

const TYPE_LABEL: Record<OrderType, string> = {
  'take-away': 'Take Away',
  collection: 'Collection',
  delivery: 'Delivery',
}

export default function App() {
  const [user, setUser] = useState<Staff | null>(null)
  const [view, setView] = useState<View>('dashboard')
  const [state, setState] = useState<PosState>(initialState)
  const [loaded, setLoaded] = useState(false)

  // Current draft order
  const [cart, setCart] = useState<CartMap>({
    'tuna-nigiri': { qty: 1 },
    'matcha-latte': { qty: 1 },
  })
  const [discount, setDiscount] = useState<Discount>(null)
  const [orderNote, setOrderNote] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('take-away')
  const [customerId, setCustomerId] = useState('c5')
  const [category, setCategory] = useState<CategoryId>('sushi')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('scan')
  const [payOpen, setPayOpen] = useState(false)
  const [receipt, setReceipt] = useState<PlacedOrder | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [printers, setPrinters] = useState<DetectedPrinter[]>([])
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [version, setVersion] = useState('')

  const refreshPrinters = () => detectPrinters().then(setPrinters)
  useEffect(() => {
    refreshPrinters()
    appVersion().then(setVersion)
    onUpdateAvailable((i) => flash(`Downloading update v${i.version}…`))
    onUpdateDownloaded((info) => setUpdate(info))
  }, [])

  // Load persisted state once
  useEffect(() => {
    loadPersisted().then((saved) => {
      if (saved) {
        setState({
          ...initialState,
          ...saved,
          // jobs that were mid-flight when the app closed show as failed → retryable
          printJobs: (saved.printJobs ?? []).map((j) =>
            j.status === 'pending' ? { ...j, status: 'failed' as const } : j,
          ),
        })
      }
      setLoaded(true)
    })
  }, [])

  // Persist on every change after load (main process auto-rotates backups)
  useEffect(() => {
    if (loaded) persist(state)
  }, [state, loaded])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const audit = (action: string, detail: string) =>
    setState((s) => ({
      ...s,
      audit: [
        { id: uid(), at: Date.now(), actor: user?.name ?? 'system', action, detail },
        ...s.audit,
      ].slice(0, 200),
    }))

  // ---------- Print queue → real printers when detected, simulated otherwise ----------
  const markJob = (id: string, status: PrintJob['status']) =>
    setState((s) => ({
      ...s,
      printJobs: s.printJobs.map((j) => (j.id === id ? { ...j, status } : j)),
    }))

  const processJob = (job: PrintJob, order?: PlacedOrder) => {
    const s = state.settings
    const deviceName = job.role === 'kitchen' ? s.kitchenPrinter : s.billingPrinter
    const html =
      job.docType === 'KITCHEN TICKET' && order
        ? kitchenHtml(order, s)
        : job.docType === 'RECEIPT' && order
          ? receiptHtml(order, s, job.copy)
          : job.docType === 'TEST'
            ? testHtml(job.role, s)
            : kickHtml(s)

    const detected = printers.some((p) => p.name === deviceName)
    const real = detected ? printDocument(deviceName, html, Number(s.paperWidth)) : null

    if (real) {
      real
        .then((res) => markJob(job.id, res.ok ? 'printed' : 'failed'))
        .catch(() => markJob(job.id, 'failed'))
    } else {
      // no matching physical printer — simulate spooler accept
      window.setTimeout(
        () => markJob(job.id, 'printed'),
        job.role === 'kitchen' ? 900 : 1500,
      )
    }
  }

  const enqueueJobs = (order: PlacedOrder, extra: PrintJob[] = []) => {
    const jobs: PrintJob[] = [
      { id: uid(), orderNumber: order.number, docType: 'KITCHEN TICKET', role: 'kitchen', status: 'pending', copy: false, createdAt: Date.now() },
      { id: uid(), orderNumber: order.number, docType: 'RECEIPT', role: 'billing', status: 'pending', copy: false, createdAt: Date.now() },
      ...extra,
    ]
    setState((s) => ({ ...s, printJobs: [...jobs, ...s.printJobs] }))
    jobs.forEach((j) => processJob(j, order))
  }

  const queueJob = (docType: DocType, role: PrinterRole, orderNumber = '—') => {
    const job: PrintJob = {
      id: uid(),
      orderNumber,
      docType,
      role,
      status: 'pending',
      copy: false,
      createdAt: Date.now(),
    }
    setState((s) => ({ ...s, printJobs: [job, ...s.printJobs] }))
    processJob(job)
  }

  const openDrawer = (reason: string) => {
    if (!state.settings.cashDrawer) {
      flash('Cash drawer disabled in Settings')
      return
    }
    queueJob('DRAWER KICK', 'billing')
    audit('drawer.open', reason)
    flash(`Drawer kicked via ${state.settings.billingPrinter}`)
  }

  const testPrint = (role: PrinterRole) => {
    queueJob('TEST', role)
    audit('printer.test', role)
    flash(`Test page queued → ${role === 'kitchen' ? state.settings.kitchenPrinter : state.settings.billingPrinter}`)
  }

  const retryJob = (id: string) => {
    const job = state.printJobs.find((j) => j.id === id)
    if (!job) return
    const order = state.orders.find((o) => o.number === job.orderNumber)
    markJob(id, 'pending')
    processJob(job, order)
  }

  const reprintReceipt = (o: PlacedOrder) => {
    const job: PrintJob = {
      id: uid(),
      orderNumber: o.number,
      docType: 'RECEIPT',
      role: 'billing',
      status: 'pending',
      copy: true,
      createdAt: Date.now(),
    }
    setState((s) => ({ ...s, printJobs: [job, ...s.printJobs] }))
    processJob(job, o)
    flash(`COPY receipt queued → ${state.settings.billingPrinter}`)
  }

  // ---------- Cart ----------
  const add = (id: string) => setCart((c) => ({ ...c, [id]: { qty: 1 } }))
  const increment = (id: string) =>
    setCart((c) => ({ ...c, [id]: { ...c[id], qty: (c[id]?.qty ?? 0) + 1 } }))
  const decrement = (id: string) =>
    setCart((c) => {
      const next = { ...c }
      const q = (next[id]?.qty ?? 0) - 1
      if (q <= 0) delete next[id]
      else next[id] = { ...next[id], qty: q }
      return next
    })
  const lineQty = (id: string, delta: number) =>
    delta > 0 ? increment(id) : decrement(id)
  const setLineNote = (id: string, note: string) =>
    setCart((c) => (c[id] ? { ...c, [id]: { ...c[id], note: note || undefined } } : c))
  const removeLine = (id: string) =>
    setCart((c) => {
      const next = { ...c }
      delete next[id]
      return next
    })
  const clearCart = () => {
    setCart({})
    setDiscount(null)
    setOrderNote('')
  }

  const lines: CartLine[] = useMemo(
    () =>
      state.menu.filter((m) => cart[m.id]).map((m) => ({
        item: m,
        qty: cart[m.id].qty,
        note: cart[m.id].note,
      })),
    [cart, state.menu],
  )
  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0)
  const discountCents = !discount
    ? 0
    : discount.type === 'percent'
      ? Math.round((subtotal * Math.min(discount.value, 100)) / 100)
      : Math.min(Math.round(discount.value), subtotal)
  const tax = Math.round((subtotal - discountCents) * state.settings.taxRate)
  const total = subtotal - discountCents + tax

  const todaySales = state.orders
    .filter(
      (o) =>
        o.status !== 'refunded' &&
        new Date(o.createdAt).toDateString() === new Date().toDateString(),
    )
    .reduce((s, o) => s + o.total, 0)

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) return state.menu.filter((m) => m.name.toLowerCase().includes(q))
    return state.menu.filter((m) => m.category === category)
  }, [category, query, state.menu])

  // ---------- Order line strip (seeded + live orders) ----------
  const liveLineOrders: DisplayOrder[] = state.orders
    .filter((o) => o.status !== 'refunded')
    .map((o) => ({
      number: o.number.replace('#', ''),
      tag: TYPE_LABEL[o.type],
      item: o.lines[0]?.name ?? 'Order',
      qty: o.lines.reduce((n, l) => n + l.qty, 0),
      time: timeAgo(o.createdAt),
      status: (o.status === 'new' ? 'waiting' : o.status) as OrderStatus,
      liveId: o.id,
    }))
  const allLineOrders = [...liveLineOrders, ...LINE_ORDERS]

  // ---------- Actions ----------
  const placeOrder = (method: PaymentMethod, tendered: number, change: number) => {
    const customer = state.customers.find((c) => c.id === customerId)
    const order: PlacedOrder = {
      id: uid(),
      number: `#${state.settings.orderPrefix}${state.seq}`,
      type: orderType,
      customer: customer?.name ?? 'Walk-in',
      lines: lines.map((l) => ({ name: l.item.name, qty: l.qty, price: l.item.price, note: l.note })),
      subtotal,
      discount: discountCents,
      tax,
      total,
      note: orderNote || undefined,
      payment: method,
      tendered,
      change,
      status: 'new',
      createdAt: Date.now(),
      cashier: user?.name ?? 'Unknown',
    }
    setState((s) => ({
      ...s,
      orders: [order, ...s.orders],
      seq: s.seq + 1,
      customers: s.customers.map((c) =>
        c.id === customerId
          ? { ...c, visits: c.visits + 1, spent: c.spent + total }
          : c,
      ),
    }))
    const kick: PrintJob[] =
      method === 'cash' && state.settings.drawerOnCash && state.settings.cashDrawer
        ? [{ id: uid(), orderNumber: order.number, docType: 'DRAWER KICK', role: 'billing', status: 'pending', copy: false, createdAt: Date.now() }]
        : []
    enqueueJobs(order, kick) // kitchen ticket → chef printer, receipt (+drawer kick) → billing printer
    audit('order.completed', `${order.number} · ${method} · ${(total / 100).toFixed(2)}`)
    setCart({})
    setDiscount(null)
    setOrderNote('')
    setPayOpen(false)
    setReceipt(order)
    flash('Kitchen ticket → chef printer · receipt → billing printer')
  }

  const holdOrder = () => {
    const customer = state.customers.find((c) => c.id === customerId)
    const held: HeldOrder = {
      id: uid(),
      label: `${customer?.name ?? 'Order'} ${state.seq}`,
      type: orderType,
      customer: customer?.name ?? 'Walk-in',
      lines: lines.map((l) => ({ itemId: l.item.id, qty: l.qty, note: l.note })),
      createdAt: Date.now(),
    }
    setState((s) => ({ ...s, held: [held, ...s.held] }))
    setCart({})
    flash('Order parked — recall it from Held')
  }

  const recallHeld = (id: string) => {
    const h = state.held.find((x) => x.id === id)
    if (!h) return
    const next: CartMap = {}
    h.lines.forEach((l) => (next[l.itemId] = { qty: l.qty, note: l.note }))
    setCart(next)
    setOrderType(h.type)
    const cust = state.customers.find((c) => c.name === h.customer)
    if (cust) setCustomerId(cust.id)
    setState((s) => ({ ...s, held: s.held.filter((x) => x.id !== id) }))
    flash('Held order recalled')
  }

  const advanceOrder = (id: string) =>
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === id
          ? { ...o, status: o.status === 'new' ? 'ready' : o.status === 'ready' ? 'served' : o.status }
          : o,
      ),
    }))

  const refundOrder = (id: string) => {
    const o = state.orders.find((x) => x.id === id)
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'refunded' } : o)),
    }))
    audit('order.refunded', o ? `${o.number} · ${(o.total / 100).toFixed(2)}` : id)
  }

  // ---------- Shift & cash drawer ----------
  const openShift = (float: number) => {
    const shift: Shift = {
      id: uid(),
      openedAt: Date.now(),
      closedAt: null,
      openedBy: user?.name ?? 'Unknown',
      float,
      counted: null,
      movements: [{ id: uid(), type: 'float', amount: float, reason: 'Opening float', at: Date.now(), actor: user?.name ?? 'Unknown' }],
    }
    setState((s) => ({ ...s, shifts: [shift, ...s.shifts] }))
    audit('shift.open', `float ${(float / 100).toFixed(2)}`)
    flash('Shift opened — drawer ready')
  }

  const closeShift = () => {
    const current = state.shifts.find((s) => s.closedAt === null)
    if (!current) return
    const lastCount = current.movements.filter((m) => m.type === 'count').at(-1)?.amount ?? null
    setState((s) => ({
      ...s,
      shifts: s.shifts.map((sh) =>
        sh.id === current.id ? { ...sh, closedAt: Date.now(), counted: lastCount } : sh,
      ),
    }))
    audit('shift.close', `expected drawer reconciled`)
    flash('Shift closed — Z report recorded')
  }

  const addMovement = (type: MovementType, amount: number, reason: string) => {
    const current = state.shifts.find((s) => s.closedAt === null)
    if (!current) {
      flash('Open a shift first')
      return
    }
    const mv = { id: uid(), type, amount, reason, at: Date.now(), actor: user?.name ?? 'Unknown' }
    setState((s) => ({
      ...s,
      shifts: s.shifts.map((sh) =>
        sh.id === current.id ? { ...sh, movements: [...sh.movements, mv] } : sh,
      ),
    }))
    audit(`drawer.${type}`, `${reason} · ${(amount / 100).toFixed(2)}`)
    if (type !== 'count') flash(`${reason} recorded`)
    else flash('Cash count recorded')
  }

  const addCustomer = (c: Omit<Customer, 'id' | 'visits' | 'spent'>) =>
    setState((s) => ({
      ...s,
      customers: [...s.customers, { ...c, id: uid(), visits: 0, spent: 0 }],
    }))

  const saveMenuItem = (item: MenuItem) =>
    setState((s) => ({
      ...s,
      menu: s.menu.some((m) => m.id === item.id)
        ? s.menu.map((m) => (m.id === item.id ? item : m))
        : [...s.menu, item],
    }))

  const deleteMenuItem = (id: string) =>
    setState((s) => ({ ...s, menu: s.menu.filter((m) => m.id !== id) }))

  const toggleMenuItem = (id: string) =>
    setState((s) => ({
      ...s,
      menu: s.menu.map((m) => (m.id === id ? { ...m, available: !m.available } : m)),
    }))

  const saveCategory = (c: Category) =>
    setState((s) => ({
      ...s,
      categories: s.categories.some((x) => x.id === c.id)
        ? s.categories.map((x) => (x.id === c.id ? c : x))
        : [...s.categories, c],
    }))

  const deleteCategory = (id: string) => {
    if (state.menu.some((m) => m.category === id)) {
      flash('Move items out of the category first')
      return
    }
    setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }))
    if (category === id) setCategory(state.categories[0]?.id ?? 'sushi')
  }

  const orderNumber = `#${state.settings.orderPrefix}${state.seq}`

  // ---------- Staff management ----------
  const STAFF_COLORS = [
    'from-amber-400 to-orange-500',
    'from-violet-400 to-purple-600',
    'from-emerald-400 to-teal-600',
    'from-sky-400 to-blue-600',
    'from-rose-400 to-pink-600',
  ]

  const addStaff = (data: { name: string; role: Role; pin: string }) => {
    const member: Staff = {
      id: uid(),
      name: data.name,
      role: data.role,
      pin: data.pin,
      initials: data.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      color: STAFF_COLORS[state.staff.length % STAFF_COLORS.length],
      active: true,
      mustChangePin: false,
    }
    setState((s) => ({ ...s, staff: [...s.staff, member] }))
    audit('staff.added', `${member.name} (${member.role})`)
    flash(`${member.name} added as ${member.role}`)
  }

  const updateStaff = (id: string, patch: Partial<Staff>) =>
    setState((s) => ({
      ...s,
      staff: s.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))

  const resetStaffPin = (id: string): string => {
    const temp = String(Math.floor(1000 + Math.random() * 9000))
    const member = state.staff.find((m) => m.id === id)
    updateStaff(id, { pin: temp, mustChangePin: true })
    audit('staff.pin_reset', member?.name ?? id)
    return temp
  }

  const toggleStaffActive = (id: string) => {
    const member = state.staff.find((m) => m.id === id)
    updateStaff(id, { active: !member?.active })
    audit(member?.active ? 'staff.deactivated' : 'staff.activated', member?.name ?? id)
  }

  if (!user)
    return (
      <LoginScreen
        staff={state.staff}
        onSetup={(name, pin) => {
          const admin: Staff = {
            id: uid(),
            name,
            role: 'manager',
            pin,
            initials: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'A',
            color: STAFF_COLORS[1],
            active: true,
            mustChangePin: false,
          }
          setState((st) => ({
            ...st,
            staff: [admin, ...st.staff],
            audit: [
              { id: uid(), at: Date.now(), actor: name, action: 'staff.admin_setup', detail: 'first-boot admin account created' },
              ...st.audit,
            ].slice(0, 200),
          }))
          setUser(admin)
          setView('staff')
          flash(`Welcome, ${name} — add your staff`)
        }}
        onLogin={(s, newPin) => {
          const firstSetup = !!newPin
          const member = newPin ? { ...s, pin: newPin, mustChangePin: false } : s
          if (newPin) updateStaff(s.id, { pin: newPin, mustChangePin: false })
          setUser(member)
          setState((st) => ({
            ...st,
            audit: [
              { id: uid(), at: Date.now(), actor: member.name, action: 'auth.login', detail: `${member.role} signed in${firstSetup ? ' (PIN set)' : ''}` },
              ...st.audit,
            ].slice(0, 200),
          }))
          if (firstSetup && member.role === 'manager') {
            setView('staff')
            flash('PIN saved — now add your staff')
          }
        }}
      />
    )

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas">
      <Sidebar
        view={view}
        role={user.role}
        userName={user.name}
        onNavigate={setView}
        onLogout={() => {
          setUser(null)
          setView('dashboard')
        }}
      />

      {view === 'dashboard' && (
        <>
          <main className="thin-scroll flex min-w-0 flex-1 flex-col overflow-y-auto px-6">
            <DashboardPage
              user={user}
              items={visibleItems}
              categories={state.categories}
              category={category}
              onCategory={(c) => {
                setCategory(c)
                setQuery('')
              }}
              cart={cart}
              onAdd={add}
              onIncrement={increment}
              onDecrement={decrement}
              lineOrders={allLineOrders}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              onAdvanceOrder={advanceOrder}
              query={query}
              onQuery={setQuery}
              held={state.held}
              onRecall={recallHeld}
              todaySales={todaySales}
            />
          </main>
          <OrderPanel
            orderNumber={orderNumber}
            lines={lines}
            subtotal={subtotal}
            discount={discountCents}
            tax={tax}
            total={total}
            paymentMethod={payment}
            orderType={orderType}
            customerId={customerId}
            customers={state.customers}
            heldCount={state.held.length}
            discountInput={discount}
            orderNote={orderNote}
            onPaymentChange={setPayment}
            onTypeChange={setOrderType}
            onCustomerChange={setCustomerId}
            onLineQty={lineQty}
            onLineNote={setLineNote}
            onRemoveLine={removeLine}
            onClear={clearCart}
            onDiscountChange={setDiscount}
            onOrderNote={setOrderNote}
            onHold={holdOrder}
            onPrint={() => flash('Receipt sent to billing printer')}
            onOrder={() => setPayOpen(true)}
            drawerEnabled={state.settings.cashDrawer}
            onOpenDrawer={() => {
              openDrawer('No-sale open from order screen')
              addMovement('no-sale', 0, 'No-sale drawer open')
            }}
          />
        </>
      )}

      {view === 'menu' && (
        <MenuPage
          menu={state.menu}
          categories={state.categories}
          onSave={saveMenuItem}
          onDelete={deleteMenuItem}
          onToggle={toggleMenuItem}
          onSaveCategory={saveCategory}
          onDeleteCategory={deleteCategory}
        />
      )}
      {view === 'printers' && (
        <PrintersPage
          jobs={state.printJobs}
          orders={state.orders}
          settings={state.settings}
          printers={printers}
          onRetry={retryJob}
        />
      )}
      {view === 'customers' && (
        <CustomersPage
          customers={state.customers}
          onAdd={addCustomer}
          onNewOrder={(c) => {
            setCustomerId(c.id)
            setView('dashboard')
            flash(`New order for ${c.name}`)
          }}
        />
      )}
      {view === 'transactions' && (
        <TransactionsPage
          orders={state.orders}
          onRefund={refundOrder}
          onAdvance={advanceOrder}
          onReprint={reprintReceipt}
        />
      )}
      {view === 'shift' && (
        <ShiftPage
          shifts={state.shifts}
          orders={state.orders}
          drawerEnabled={state.settings.cashDrawer}
          userName={user.name}
          onOpenShift={openShift}
          onCloseShift={closeShift}
          onMovement={addMovement}
          onOpenDrawer={openDrawer}
        />
      )}
      {view === 'report' && <ReportPage orders={state.orders} />}
      {view === 'staff' && (
        <StaffPage
          staff={state.staff}
          currentUserId={user.id}
          onAdd={addStaff}
          onUpdate={updateStaff}
          onResetPin={resetStaffPin}
          onToggleActive={toggleStaffActive}
        />
      )}
      {view === 'settings' && (
        <SettingsPage
          settings={state.settings}
          printers={printers}
          onRefreshPrinters={refreshPrinters}
          onChange={(settings) => setState((s) => ({ ...s, settings }))}
          onSaved={() => {
            audit('settings.saved', 'store/device configuration updated')
            flash('Settings saved')
          }}
          onTestPrint={testPrint}
          onOpenDrawer={openDrawer}
        />
      )}
      {view === 'info' && (
        <InfoPage
          settings={state.settings}
          orderCount={state.orders.length}
          audit={state.audit}
          printers={printers}
          version={version}
          onCheckUpdates={() =>
            checkForUpdates().then(() => flash('Checking for updates…'))
          }
          onBackup={() =>
            backupNow(state).then((f) => {
              audit('backup.created', f ?? 'unknown location')
              flash(f ? `Backup written to ${f}` : 'Backup failed')
            })
          }
        />
      )}

      {payOpen && (
        <PaymentModal
          total={total}
          method={payment}
          onMethodChange={setPayment}
          onClose={() => setPayOpen(false)}
          onComplete={placeOrder}
        />
      )}
      {receipt && (
        <ReceiptModal
          order={receipt}
          settings={state.settings}
          onPrint={() => {
            reprintReceipt(receipt)
          }}
          onClose={() => setReceipt(null)}
        />
      )}

      {/* Update modal — deferrable for 3 days, then forced */}
      {update && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[400px] rounded-3xl bg-white p-7 text-center shadow-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <BadgePercent size={26} />
            </span>
            <p className="mt-4 text-[17px] font-extrabold">
              Update v{update.version} is ready
            </p>
            <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-neutral-400">
              {update.forced
                ? 'The deferral window has ended — the update installs automatically. Your data was backed up first.'
                : `Restart now to update, or keep working — this update installs automatically after ${new Date(update.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}.`}
            </p>
            <div className="mt-5 flex gap-2.5">
              {!update.forced && (
                <button
                  onClick={() => setUpdate(null)}
                  className="flex-1 rounded-xl border border-neutral-200 py-3 text-[13px] font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Later
                </button>
              )}
              <button
                onClick={() => installUpdate()}
                className={`flex-1 rounded-xl py-3 text-[13px] font-extrabold text-white ${
                  update.forced ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-dark'
                }`}
              >
                {update.forced ? 'Installing…' : 'Restart & Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[12.5px] font-bold text-white shadow-xl">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  )
}
