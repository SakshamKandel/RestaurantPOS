import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgePercent } from 'lucide-react'
import { CheckCircle2 } from 'lucide-react'
import Sidebar, { type View } from './components/Sidebar'
import OrderPanel, {
  type CartLine,
  type PaymentMethod,
} from './components/OrderPanel'
import LoginScreen from './components/LoginScreen'
import ModifierModal from './components/ModifierModal'
import PaymentModal from './components/PaymentModal'
import ReceiptModal from './components/ReceiptModal'
import RefundModal from './components/RefundModal'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import MenuPage from './pages/MenuPage'
import PrintersPage from './pages/PrintersPage'
import ShiftPage from './pages/ShiftPage'
import TransactionsPage from './pages/TransactionsPage'
import ReportPage from './pages/ReportPage'
import SettingsPage from './pages/SettingsPage'
import InfoPage from './pages/InfoPage'
import StaffPage from './pages/StaffPage'
import {
  assignableRoles,
  canManage,
  formatMoney,
  lineKey,
  migrateSettings,
  modsTotal,
  SUPER_ADMIN,
  type Category,
  type CategoryId,
  type Customer,
  type MenuItem,
  type OrderStatus,
  type Role,
  type SelectedMod,
  type Staff,
} from './data/menu'
import {
  appVersion,
  backupNow,
  detectPrinters,
  initialState,
  installUpdate,
  isDesktop,
  loadPersisted,
  onUpdateAvailable,
  onUpdateChecking,
  onUpdateDownloaded,
  onUpdateError,
  onUpdateNone,
  persist,
  printDocument,
  printRaw,
  drawerKickBytes,
  setPinSecure,
  timeAgo,
  verifyLogin,
  type DetectedPrinter,
  type Discount,
  type DocType,
  type HeldOrder,
  type MovementType,
  type OrderType,
  type PaymentRecord,
  type PlacedOrder,
  type RefundRecord,
  type PosState,
  type PrintJob,
  type PrinterRole,
  type Shift,
  type UpdateInfo,
} from './store'
import { kitchenHtml, receiptHtml, testHtml } from './print/docs'
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
  const [cart, setCart] = useState<CartMap>({})
  const [discount, setDiscount] = useState<Discount>(null)
  const [orderNote, setOrderNote] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('take-away')
  const [customerId, setCustomerId] = useState('c5')
  const [category, setCategory] = useState<CategoryId>('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('scan')
  const [payOpen, setPayOpen] = useState(false)
  const [receipt, setReceipt] = useState<PlacedOrder | null>(null)
  const [refundFor, setRefundFor] = useState<PlacedOrder | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded
  const [printers, setPrinters] = useState<DetectedPrinter[]>([])
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [version, setVersion] = useState('')
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null)

  const refreshPrinters = () => detectPrinters().then(setPrinters)
  useEffect(() => {
    refreshPrinters()
    appVersion().then(setVersion)
    onUpdateChecking(() => flash('Checking for updates…'))
    onUpdateAvailable((i) => flash(`Update v${i.version} found — downloading…`))
    onUpdateNone((i) => flash(`You're on the latest version (v${i.version})`))
    onUpdateError(() => flash("Couldn't check for updates — offline or GitHub unreachable"))
    onUpdateDownloaded((info) => setUpdate(info))
  }, [])

  // Load persisted state once
  useEffect(() => {
    loadPersisted().then((saved) => {
      if (saved) {
        setState({
          ...initialState,
          ...saved,
          settings: migrateSettings(saved.settings ?? {}),
          // jobs that were mid-flight when the app closed show as failed → retryable
          printJobs: (saved.printJobs ?? []).map((j) =>
            j.status === 'pending' ? { ...j, status: 'failed' as const } : j,
          ),
        })
      }
      setLoaded(true)
    })
  }, [])

  // Debounced persist — SQLite commit diffs rows, and rapid renderer updates
  // (typing, cart edits) batch into one IPC call. flushPersist() forces the
  // pending write through immediately (sign-out, window close) so auth always
  // sees the latest staff PINs.
  const persistDirty = useRef(false)
  const flushPersist = () => {
    if (loadedRef.current && persistDirty.current) {
      persistDirty.current = false
      persist(stateRef.current)
    }
  }
  useEffect(() => {
    if (!loaded) return
    persistDirty.current = true
    const t = window.setTimeout(() => {
      persistDirty.current = false
      persist(stateRef.current)
    }, 400)
    return () => window.clearTimeout(t)
  }, [state, loaded])
  useEffect(() => {
    window.addEventListener('beforeunload', flushPersist)
    return () => window.removeEventListener('beforeunload', flushPersist)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the active category valid as categories are created/renamed/deleted
  useEffect(() => {
    if (!state.categories.some((c) => c.id === category))
      setCategory(state.categories[0]?.id ?? '')
  }, [state.categories, category])

  const flash = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
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
  const markJob = (id: string, status: PrintJob['status'], error?: string) =>
    setState((s) => ({
      ...s,
      printJobs: s.printJobs.map((j) => (j.id === id ? { ...j, status, error } : j)),
    }))

  const deviceFor = (role: PrinterRole) =>
    role === 'kitchen' ? state.settings.kitchenPrinter : state.settings.billingPrinter
  const paperFor = (role: PrinterRole) =>
    Number(role === 'kitchen' ? state.settings.kitchenPaper : state.settings.billingPaper)
  const isDetected = (name: string) => !!name && printers.some((p) => p.name === name)

  /** Why a role can't print right now, or null if it's ready. */
  const roleProblem = (role: PrinterRole): string | null => {
    const dev = deviceFor(role)
    if (!dev) return 'No printer assigned in Settings'
    if (!isDetected(dev)) return `"${dev}" is not installed on this PC`
    return null
  }

  /** Send one job to hardware. Never fakes success: a job is 'printed' only
   *  when the Windows spooler accepted it, otherwise 'failed' with the reason. */
  const processJob = (job: PrintJob, order?: PlacedOrder) => {
    const s = state.settings
    const deviceName = deviceFor(job.role)
    const problem = roleProblem(job.role)
    if (problem) return markJob(job.id, 'failed', problem)

    const send =
      job.docType === 'DRAWER KICK'
        ? printRaw(deviceName, drawerKickBytes(s.drawerPin))
        : printDocument(
            deviceName,
            job.docType === 'KITCHEN TICKET' && order
              ? kitchenHtml(order, s)
              : job.docType === 'RECEIPT' && order
                ? receiptHtml(order, s, job.copy)
                : testHtml(job.role, s),
            paperFor(job.role),
          )

    if (!send) return markJob(job.id, 'failed', 'Printing is only available in the desktop app')
    send
      .then((res) => markJob(job.id, res.ok ? 'printed' : 'failed', res.ok ? undefined : res.reason ?? 'Unknown printer error'))
      .catch((e) => markJob(job.id, 'failed', String(e?.message ?? e)))
  }

  const makeJob = (docType: DocType, role: PrinterRole, orderNumber = '—', copy = false): PrintJob => ({
    id: uid(),
    orderNumber,
    docType,
    role,
    status: 'pending',
    copy,
    createdAt: Date.now(),
    device: deviceFor(role) || undefined,
  })

  /** Post-sale documents, honouring per-role settings:
   *  kitchen ticket (if kitchen printing on) · receipt (if auto-print on) · drawer pulse (cash). */
  const enqueueJobs = (order: PlacedOrder, kickDrawer: boolean) => {
    const s = state.settings
    const jobs: PrintJob[] = []
    if (s.kitchenEnabled) jobs.push(makeJob('KITCHEN TICKET', 'kitchen', order.number))
    if (s.billingEnabled && s.billingAutoPrint) jobs.push(makeJob('RECEIPT', 'billing', order.number))
    if (kickDrawer) jobs.push(makeJob('DRAWER KICK', 'billing', order.number))
    if (!jobs.length) return
    setState((st) => ({ ...st, printJobs: [...jobs, ...st.printJobs] }))
    jobs.forEach((j) => processJob(j, order))
  }

  const queueJob = (docType: DocType, role: PrinterRole, orderNumber = '—') => {
    const job = makeJob(docType, role, orderNumber)
    setState((s) => ({ ...s, printJobs: [job, ...s.printJobs] }))
    processJob(job)
    return job
  }

  const openDrawer = (reason: string) => {
    const s = state.settings
    if (!s.cashDrawer) return flash('Cash drawer is turned off in Settings')
    const problem = roleProblem('billing')
    if (problem) return flash(`Can't open drawer — ${problem}`)
    queueJob('DRAWER KICK', 'billing')
    audit('drawer.open', reason)
    flash(`Drawer pulse sent → ${s.billingPrinter}`)
  }

  const testPrint = (role: PrinterRole) => {
    const problem = roleProblem(role)
    if (problem) return flash(`Can't test ${role} printer — ${problem}`)
    queueJob('TEST', role)
    audit('printer.test', role)
    flash(`Test page sent → ${deviceFor(role)}`)
  }

  const retryJob = (id: string) => {
    const job = state.printJobs.find((j) => j.id === id)
    if (!job) return
    const order = state.orders.find((o) => o.number === job.orderNumber)
    if (!order && (job.docType === 'KITCHEN TICKET' || job.docType === 'RECEIPT'))
      return markJob(id, 'failed', 'Original order no longer exists')
    setState((s) => ({
      ...s,
      printJobs: s.printJobs.map((j) =>
        j.id === id ? { ...j, status: 'pending', error: undefined, device: deviceFor(j.role) || undefined } : j,
      ),
    }))
    processJob(job, order)
  }

  const reprintReceipt = (o: PlacedOrder) => {
    const problem = roleProblem('billing')
    if (problem) return flash(`Can't print — ${problem}`)
    const job = makeJob('RECEIPT', 'billing', o.number, true)
    setState((s) => ({ ...s, printJobs: [job, ...s.printJobs] }))
    processJob(job, o)
    flash(`COPY receipt sent → ${state.settings.billingPrinter}`)
  }

  // ---------- Cart ----------
  const [modItem, setModItem] = useState<MenuItem | null>(null)

  const add = (id: string) => {
    const item = state.menu.find((m) => m.id === id)
    if (!item) return
    if (item.stock === 0) return flash(`${item.name} is out of stock`)
    if (item.modifiers?.length) return setModItem(item)
    setCart((c) => {
      const next = (c[id]?.qty ?? 0) + 1
      if (item.stock !== undefined && next > item.stock) {
        flash(`Only ${item.stock} × ${item.name} left in stock`)
        return c
      }
      return { ...c, [id]: { itemId: id, qty: next } }
    })
  }
  /** Confirmed modifier selection → its own cart line (same combo merges). */
  const addWithMods = (item: MenuItem, mods: SelectedMod[]) => {
    const key = lineKey(item.id, mods)
    setCart((c) => {
      const next = (c[key]?.qty ?? 0) + 1
      if (item.stock !== undefined && next > item.stock) {
        flash(`Only ${item.stock} × ${item.name} left in stock`)
        return c
      }
      return { ...c, [key]: { itemId: item.id, qty: next, mods } }
    })
    setModItem(null)
  }
  const increment = (id: string) =>
    setCart((c) => {
      const entry = c[id]
      if (!entry) return c
      const item = state.menu.find((m) => m.id === entry.itemId)
      if (item?.stock !== undefined && entry.qty + 1 > item.stock) {
        flash(`Only ${item.stock} × ${item.name} left in stock`)
        return c
      }
      return { ...c, [id]: { ...entry, qty: entry.qty + 1 } }
    })
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
      Object.entries(cart).flatMap(([key, l]) => {
        const item = state.menu.find((m) => m.id === l.itemId)
        return item ? [{ key, item, qty: l.qty, note: l.note, mods: l.mods }] : []
      }),
    [cart, state.menu],
  )
  const lineGross = (l: CartLine) => (l.item.price + modsTotal(l.mods)) * l.qty
  const subtotal = lines.reduce((s, l) => s + lineGross(l), 0)
  const discountCents = !discount
    ? 0
    : discount.type === 'percent'
      ? Math.round((subtotal * Math.min(discount.value, 100)) / 100)
      : Math.min(Math.round(discount.value), subtotal)

  // Per-item tax classes: the post-discount net is distributed across lines in
  // exact cents (largest remainder), then each line is taxed at its own rate.
  const netTotal = subtotal - discountCents
  const lineNets = useMemo(() => {
    if (!subtotal) return lines.map(() => 0)
    const raw = lines.map((l) => (lineGross(l) * netTotal) / subtotal)
    const nets = raw.map(Math.floor)
    let rem = netTotal - nets.reduce((a, b) => a + b, 0)
    const order = raw
      .map((r, i) => [r - nets[i], i] as const)
      .sort((a, b) => b[0] - a[0])
    for (let k = 0; rem > 0 && order.length; k = (k + 1) % order.length) {
      nets[order[k][1]]++
      rem--
    }
    return nets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, subtotal, netTotal])
  const rateFor = (item: MenuItem) =>
    state.settings.taxClasses.find((t) => t.id === item.taxClass)?.rate ??
    state.settings.taxRate
  const lineTaxes = lines.map((l, i) => Math.round(lineNets[i] * rateFor(l.item)))
  const tax = lineTaxes.reduce((a, b) => a + b, 0)
  const taxBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; rate: number; amount: number }>()
    lines.forEach((l, i) => {
      const cls = state.settings.taxClasses.find((t) => t.id === l.item.taxClass)
      const name = cls?.name ?? 'Standard'
      const rate = cls?.rate ?? state.settings.taxRate
      const cur = map.get(`${name}|${rate}`) ?? { name, rate, amount: 0 }
      cur.amount += lineTaxes[i]
      map.set(`${name}|${rate}`, cur)
    })
    return [...map.values()].filter((t) => t.amount > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, lineTaxes, state.settings.taxClasses, state.settings.taxRate])
  const total = subtotal - discountCents + tax

  const notifications = useMemo(() => {
    const n: { id: string; title: string; sub: string; tone: 'warn' | 'info' }[] = []
    const failed = state.printJobs.filter((j) => j.status === 'failed').length
    const pending = state.printJobs.filter((j) => j.status === 'pending').length
    if (failed) n.push({ id: 'jf', title: `${failed} print job${failed > 1 ? 's' : ''} failed`, sub: 'Open Printers to retry', tone: 'warn' })
    if (pending) n.push({ id: 'jp', title: `${pending} job${pending > 1 ? 's' : ''} printing`, sub: 'Queued to thermal printers', tone: 'info' })
    if (user && !state.shifts.some((s) => s.closedAt === null))
      n.push({ id: 'shift', title: 'No shift open', sub: 'Open a shift to track the cash drawer', tone: 'warn' })
    const lowStock = state.menu.filter((m) => m.stock !== undefined && m.stock <= (m.lowStockAt ?? 5))
    if (lowStock.length)
      n.push({
        id: 'stock',
        title: `${lowStock.length} item${lowStock.length > 1 ? 's' : ''} low on stock`,
        sub: lowStock.slice(0, 3).map((m) => `${m.name} (${m.stock} left)`).join(', ') + (lowStock.length > 3 ? '…' : ''),
        tone: 'warn',
      })
    state.audit.slice(0, 3).forEach((e) =>
      n.push({ id: e.id, title: e.action, sub: `${e.detail} · ${e.actor}`, tone: 'info' }),
    )
    return n
  }, [state.printJobs, state.shifts, state.audit, state.menu, user])

  const todaySales = state.orders
    .filter(
      (o) =>
        o.status !== 'refunded' &&
        new Date(o.createdAt).toDateString() === new Date().toDateString(),
    )
    .reduce((s, o) => s + o.total, 0)

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    state.menu.forEach((m) => {
      counts[m.category] = (counts[m.category] ?? 0) + 1
    })
    return counts
  }, [state.menu])

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
  const allLineOrders = liveLineOrders

  // ---------- Actions ----------
  const placeOrder = (method: PaymentMethod, tendered: number, change: number, payments: PaymentRecord[]) => {
    const customer = state.customers.find((c) => c.id === customerId)
    const order: PlacedOrder = {
      id: uid(),
      number: `#${state.settings.orderPrefix}${String(state.seq).padStart(3, '0')}`,
      type: orderType,
      customer: customer?.name ?? 'Walk-in',
      lines: lines.map((l, i) => ({
        name: l.item.name,
        qty: l.qty,
        price: l.item.price,
        note: l.note,
        mods: l.mods,
        taxClass: l.item.taxClass,
        taxRate: rateFor(l.item),
        itemId: l.item.id,
        tax: lineTaxes[i],
        net: lineNets[i],
      })),
      subtotal,
      discount: discountCents,
      tax,
      taxBreakdown,
      total,
      note: orderNote || undefined,
      payment: method,
      tendered,
      change,
      payments,
      status: 'new',
      createdAt: Date.now(),
      cashier: user?.name ?? 'Unknown',
    }
    setState((s) => ({
      ...s,
      orders: [order, ...s.orders],
      seq: s.seq + 1,
      // deduct tracked stock; hitting 0 auto-marks the item sold out
      menu: s.menu.map((m) => {
        const sold = lines.filter((l) => l.item.id === m.id).reduce((n, l) => n + l.qty, 0)
        if (m.stock === undefined || !sold) return m
        const stock = Math.max(0, m.stock - sold)
        return { ...m, stock, available: stock === 0 ? false : m.available }
      }),
      customers: s.customers.map((c) =>
        c.id === customerId
          ? { ...c, visits: c.visits + 1, spent: c.spent + total }
          : c,
      ),
    }))
    const st = state.settings
    const kick = payments.some((p) => p.method === 'cash') && st.cashDrawer && st.drawerOnCash
    enqueueJobs(order, kick) // kitchen ticket → chef printer · receipt (+drawer pulse) → billing printer
    setLastOrder(order)
    audit('order.completed', `${order.number} · ${payments.length > 1 ? `split(${payments.map((p) => p.method).join('+')})` : method} · ${(total / 100).toFixed(2)}`)
    setCart({})
    setDiscount(null)
    setOrderNote('')
    setPayOpen(false)
    setReceipt(order)
    const sent = [
      st.kitchenEnabled && 'kitchen ticket',
      st.billingEnabled && st.billingAutoPrint && 'receipt',
      kick && 'drawer',
    ].filter(Boolean)
    flash(sent.length ? `Order ${order.number} paid · ${sent.join(' + ')} sent` : `Order ${order.number} paid`)
  }

  const holdOrder = () => {
    if (!lines.length) return flash('Nothing to hold — the order is empty')
    const customer = state.customers.find((c) => c.id === customerId)
    const held: HeldOrder = {
      id: uid(),
      label: `${customer && customer.id !== 'c5' ? customer.name : TYPE_LABEL[orderType]} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      type: orderType,
      customer: customer?.name ?? 'Walk-in',
      lines: lines.map((l) => ({ itemId: l.item.id, qty: l.qty, note: l.note, mods: l.mods })),
      createdAt: Date.now(),
    }
    setState((s) => ({ ...s, held: [held, ...s.held] }))
    setCart({})
    flash('Order parked — recall it from Held')
  }

  const recallHeld = (id: string) => {
    const h = state.held.find((x) => x.id === id)
    if (!h) return
    // Merge into whatever is already in the cart; drop lines whose item was deleted
    const next: CartMap = { ...cart }
    let dropped = 0
    h.lines.forEach((l) => {
      if (!state.menu.some((m) => m.id === l.itemId)) return void dropped++
      const key = lineKey(l.itemId, l.mods)
      const cur = next[key]
      next[key] = { itemId: l.itemId, qty: (cur?.qty ?? 0) + l.qty, note: l.note ?? cur?.note, mods: l.mods ?? cur?.mods }
    })
    setCart(next)
    setOrderType(h.type)
    const cust = state.customers.find((c) => c.name === h.customer)
    if (cust) setCustomerId(cust.id)
    setState((s) => ({ ...s, held: s.held.filter((x) => x.id !== id) }))
    flash(dropped ? `Held order recalled · ${dropped} deleted item${dropped > 1 ? 's' : ''} skipped` : 'Held order recalled')
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

  /** Refund selected line quantities. Full refund = every refundable unit. */
  const refundOrder = (id: string, sel: { index: number; qty: number }[], reason?: string) => {
    const o = state.orders.find((x) => x.id === id)
    if (!o || o.status === 'refunded') return
    const picked = sel.filter((s) => s.qty > 0 && o.lines[s.index])
    if (!picked.length) return

    const effRate = o.subtotal - o.discount > 0 ? o.tax / (o.subtotal - o.discount) : 0
    const detail = picked.map(({ index, qty }) => {
      const l = o.lines[index]
      const gross = (l.price + modsTotal(l.mods)) * l.qty
      const net = l.net ?? Math.round((gross * Math.max(0, o.subtotal - o.discount)) / Math.max(1, o.subtotal))
      const lt = l.tax ?? Math.round(net * (l.taxRate ?? effRate))
      const q = Math.min(qty, l.qty - (l.refundedQty ?? 0))
      return { index, name: l.name, qty: q, amount: Math.round(((net + lt) * q) / l.qty) }
    })
    const amount = detail.reduce((s, d) => s + d.amount, 0)
    const record: RefundRecord = {
      id: uid(),
      at: Date.now(),
      actor: user?.name ?? 'Unknown',
      lines: detail,
      amount,
      reason: reason || undefined,
    }
    const fullyRefunded = o.lines.every(
      (l, i) => (l.refundedQty ?? 0) + (detail.find((d) => d.index === i)?.qty ?? 0) >= l.qty,
    )

    setState((s) => ({
      ...s,
      orders: s.orders.map((x) =>
        x.id === id
          ? {
              ...x,
              status: fullyRefunded ? 'refunded' : 'partial-refund',
              refunds: [...(x.refunds ?? []), record],
              lines: x.lines.map((l, i) => ({
                ...l,
                refundedQty: (l.refundedQty ?? 0) + (detail.find((d) => d.index === i)?.qty ?? 0),
              })),
            }
          : x,
      ),
      // stock comes back onto the shelf; re-list items that had sold out at 0
      menu: s.menu.map((m) => {
        const back = detail
          .filter((d) => o.lines[d.index].itemId === m.id)
          .reduce((n, d) => n + d.qty, 0)
        if (!back || m.stock === undefined) return m
        const stock = m.stock + back
        return { ...m, stock, available: m.stock === 0 ? true : m.available }
      }),
      // roll back the customer's lifetime stats so reports stay truthful
      customers: s.customers.map((c) =>
        c.name === o.customer && c.id !== 'c5'
          ? {
              ...c,
              visits: fullyRefunded ? Math.max(0, c.visits - 1) : c.visits,
              spent: Math.max(0, c.spent - amount),
            }
          : c,
      ),
    }))
    audit(
      'order.refunded',
      `${o.number} · ${detail.map((d) => `${d.qty}× ${d.name}`).join(', ')} · ${formatMoney(amount)}${reason ? ` · ${reason}` : ''}`,
    )
    // cash refunds hand money back — open the drawer if one is connected
    const hadCash = (o.payments?.length ? o.payments : [{ method: o.payment } as PaymentRecord]).some(
      (p) => p.method === 'cash',
    )
    if (hadCash && state.settings.cashDrawer && !roleProblem('billing')) {
      queueJob('DRAWER KICK', 'billing', o.number)
      flash(`${o.number} refunded · drawer opened for ${formatMoney(amount)} cash back`)
    } else {
      flash(`${o.number} refunded · ${formatMoney(amount)}`)
    }
    setRefundFor(null)
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
    const cashSales = state.orders
      .filter((o) => o.createdAt >= current.openedAt && o.status !== 'refunded' && o.payment === 'cash')
      .reduce((s, o) => s + o.total, 0)
    const inOut = current.movements.reduce(
      (s, m) => s + (m.type === 'paid-in' ? m.amount : m.type === 'paid-out' ? -m.amount : 0),
      0,
    )
    const expected = current.float + cashSales + inOut
    setState((s) => ({
      ...s,
      shifts: s.shifts.map((sh) =>
        sh.id === current.id ? { ...sh, closedAt: Date.now(), counted: lastCount } : sh,
      ),
    }))
    audit(
      'shift.close',
      lastCount === null
        ? `expected ${formatMoney(expected)} · not counted`
        : `expected ${formatMoney(expected)} · counted ${formatMoney(lastCount)} · variance ${formatMoney(lastCount - expected)}`,
    )
    flash(lastCount === null ? 'Shift closed without a cash count' : 'Shift closed — Z report recorded')
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


  const saveMenuItem = (item: MenuItem) =>
    setState((s) => ({
      ...s,
      menu: s.menu.some((m) => m.id === item.id)
        ? s.menu.map((m) => (m.id === item.id ? item : m))
        : [...s.menu, item],
    }))

  const deleteMenuItem = (id: string) =>
    setState((s) => ({ ...s, menu: s.menu.filter((m) => m.id !== id) }))

  const addCustomer = (c: Omit<Customer, 'id' | 'visits' | 'spent'>) =>
    setState((s) => ({
      ...s,
      customers: [...s.customers, { ...c, id: uid(), visits: 0, spent: 0 }],
    }))

  const updateCustomer = (id: string, patch: Partial<Customer>) =>
    setState((s) => ({
      ...s,
      customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))

  const deleteCustomer = (id: string) => {
    if (id === 'c5') return
    setState((s) => ({ ...s, customers: s.customers.filter((c) => c.id !== id) }))
    if (customerId === id) setCustomerId('c5')
  }

  const toggleMenuItem = (id: string) =>
    setState((s) => ({
      ...s,
      menu: s.menu.map((m) => (m.id === id ? { ...m, available: !m.available } : m)),
    }))

  /** Manual stock adjustment — auto marks sold-out at 0 / available when restocked. */
  const adjustStock = (id: string, delta: number, reason: string) => {
    const item = state.menu.find((m) => m.id === id)
    if (!item || item.stock === undefined) return
    const next = Math.max(0, item.stock + delta)
    setState((s) => ({
      ...s,
      menu: s.menu.map((m) =>
        m.id === id ? { ...m, stock: next, available: next === 0 ? false : m.available || next > 0 } : m,
      ),
    }))
    audit('stock.adjusted', `${item.name}: ${item.stock} → ${next} (${reason})`)
  }

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
    if (category === id) setCategory(state.categories.find((c) => c.id !== id)?.id ?? '')
  }

  const orderNumber = `#${state.settings.orderPrefix}${String(state.seq).padStart(3, '0')}`

  // ---------- Staff management ----------
  const STAFF_COLORS = [
    'from-amber-400 to-orange-500',
    'from-violet-400 to-purple-600',
    'from-emerald-400 to-teal-600',
    'from-sky-400 to-blue-600',
    'from-rose-400 to-pink-600',
  ]

  /** Server-side of the staff permission model (UI mirrors it). */
  const mayAdminister = (target: Staff | undefined, verb: string): target is Staff => {
    if (!user || !target) return false
    if (target.id === user.id) {
      flash(`You can't ${verb} your own account`)
      return false
    }
    if (!canManage(user.role, target.role)) {
      flash(`Only the administrator can ${verb} a ${target.role}`)
      return false
    }
    return true
  }

  const addStaff = (data: { name: string; role: Role; pin: string }) => {
    if (!user || !assignableRoles(user.role).includes(data.role))
      return flash(`You're not allowed to create ${data.role} accounts`)
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

  const editStaff = (id: string, patch: Partial<Staff>) => {
    const member = state.staff.find((m) => m.id === id)
    if (!mayAdminister(member, 'edit')) return
    if (patch.role && user && !assignableRoles(user.role).includes(patch.role))
      return flash(`You're not allowed to assign the ${patch.role} role`)
    updateStaff(id, patch)
    audit('staff.updated', `${member.name} → ${patch.name ?? member.name} (${patch.role ?? member.role})`)
  }

  const resetStaffPin = (id: string): string => {
    const member = state.staff.find((m) => m.id === id)
    if (!mayAdminister(member, 'reset the PIN of')) return ''
    const temp = String(Math.floor(1000 + Math.random() * 9000))
    updateStaff(id, { pin: temp, mustChangePin: true })
    audit('staff.pin_reset', `${member.name} (${member.role})`)
    return temp
  }

  const toggleStaffActive = (id: string) => {
    const member = state.staff.find((m) => m.id === id)
    if (!mayAdminister(member, member?.active ? 'deactivate' : 'activate')) return
    updateStaff(id, { active: !member.active })
    audit(member.active ? 'staff.deactivated' : 'staff.activated', member.name)
  }

  // Toasts + update modal must render even on the login screen — the automatic
  // update check completes before anyone logs in, so keep them out of the
  // early-return guard.
  const overlays = (
    <>
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
    </>
  )

  if (!user)
    return (
      <>
      <LoginScreen
        staff={state.staff}
        onVerify={(id, pin) => verifyLogin(id, pin, state.staff)}
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
          // On desktop the PIN goes straight to the main-process hash store;
          // plaintext never sits in renderer state. Browser preview keeps it
          // in state so its local verify works.
          const member = newPin
            ? { ...s, pin: isDesktop ? '' : newPin, mustChangePin: false }
            : s
          if (newPin) {
            if (isDesktop) void setPinSecure(s.id, newPin)
            updateStaff(s.id, isDesktop ? { mustChangePin: false } : { pin: newPin, mustChangePin: false })
          }
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
      {overlays}
      </>
    )

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas">
      <Sidebar
        view={view}
        role={user.role}
        userName={user.name}
        onNavigate={setView}
        onLogout={() => {
          flushPersist() // auth reads SQLite — land pending PIN/staff writes first
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
              itemCounts={itemCounts}
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
              notifications={notifications}
              onSignOut={() => {
                audit('auth.logout', `${user.name} signed out`)
                flushPersist()
                setUser(null)
              }}
              onOpenStaff={() => setView('staff')}
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
            hasLastOrder={!!lastOrder}
            onReprintLast={() => lastOrder && setReceipt(lastOrder)}
            drawerEnabled={state.settings.cashDrawer}
            onOpenDrawer={() => {
              openDrawer('No-sale open from order screen')
              addMovement('no-sale', 0, 'No-sale drawer open')
            }}
          />
        </>
      )}

      {view === 'customers' && (
        <CustomersPage
          customers={state.customers}
          onAdd={addCustomer}
          onUpdate={updateCustomer}
          onDelete={deleteCustomer}
          onNewOrder={(c) => {
            setCustomerId(c.id)
            setView('dashboard')
            flash(`New order for ${c.name}`)
          }}
        />
      )}
      {view === 'menu' && (
        <MenuPage
          menu={state.menu}
          categories={state.categories}
          taxClasses={state.settings.taxClasses}
          onSave={saveMenuItem}
          onDelete={deleteMenuItem}
          onToggle={toggleMenuItem}
          onSaveCategory={saveCategory}
          onDeleteCategory={deleteCategory}
          onStock={adjustStock}
        />
      )}
      {view === 'printers' && (
        <PrintersPage
          jobs={state.printJobs}
          orders={state.orders}
          settings={state.settings}
          printers={printers}
          onRetry={retryJob}
          onRetryAllFailed={() => {
            const failed = state.printJobs.filter((j) => j.status === 'failed')
            failed.forEach((j) => retryJob(j.id))
            flash(`Retrying ${failed.length} job${failed.length === 1 ? '' : 's'}`)
          }}
          onClearHistory={() => {
            setState((s) => ({ ...s, printJobs: s.printJobs.filter((j) => j.status === 'pending') }))
            flash('Print history cleared')
          }}
          onOpenSettings={() => setView('settings')}
        />
      )}
      {view === 'transactions' && (
        <TransactionsPage
          orders={state.orders}
          onRefund={setRefundFor}
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
          currentRole={user.role}
          onAdd={addStaff}
          onUpdate={editStaff}
          onResetPin={resetStaffPin}
          onToggleActive={toggleStaffActive}
          onAdminPin={(pin) => {
            void setPinSecure(SUPER_ADMIN.id, pin)
            audit('staff.admin_pin_changed', 'administrator PIN updated')
            flash('Administrator PIN updated')
          }}
        />
      )}
      {view === 'settings' && (
        <SettingsPage
          settings={state.settings}
          printers={printers}
          onRefreshPrinters={refreshPrinters}
          onSave={(settings) => {
            const prev = state.settings
            const changed = (Object.keys(settings) as (keyof typeof settings)[])
              .filter((k) => settings[k] !== prev[k])
              .join(', ')
            setState((s) => ({ ...s, settings }))
            audit('settings.saved', changed || 'no changes')
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
          onBackup={() =>
            backupNow(state).then((f) => {
              audit('backup.created', f ?? 'unknown location')
              flash(f ? `Backup written to ${f}` : 'Backup failed')
            })
          }
        />
      )}

      {modItem && (
        <ModifierModal
          item={modItem}
          onClose={() => setModItem(null)}
          onConfirm={(mods) => addWithMods(modItem, mods)}
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
      {refundFor && (
        <RefundModal
          order={refundFor}
          onClose={() => setRefundFor(null)}
          onConfirm={(sel, reason) => refundOrder(refundFor.id, sel, reason)}
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

      {overlays}
    </div>
  )
}
