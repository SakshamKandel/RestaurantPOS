import { useEffect, useMemo, useState } from 'react'
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
import CustomersPage from './pages/CustomersPage'
import TransactionsPage from './pages/TransactionsPage'
import ReportPage from './pages/ReportPage'
import SettingsPage from './pages/SettingsPage'
import InfoPage from './pages/InfoPage'
import {
  LINE_ORDERS,
  type CategoryId,
  type Customer,
  type MenuItem,
  type OrderStatus,
  type Staff,
} from './data/menu'
import {
  backupNow,
  initialState,
  loadPersisted,
  persist,
  timeAgo,
  type HeldOrder,
  type OrderType,
  type PlacedOrder,
  type PosState,
  type PrintJob,
} from './store'
import type { DisplayOrder } from './components/OrderLine'

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
  const [cart, setCart] = useState<Record<string, number>>({
    'tuna-nigiri': 1,
    'matcha-latte': 1,
  })
  const [orderType, setOrderType] = useState<OrderType>('take-away')
  const [customerId, setCustomerId] = useState('c5')
  const [category, setCategory] = useState<CategoryId>('sushi')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('scan')
  const [payOpen, setPayOpen] = useState(false)
  const [receipt, setReceipt] = useState<PlacedOrder | null>(null)
  const [toast, setToast] = useState<string | null>(null)

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

  // ---------- Print queue (simulated thermal printers) ----------
  const enqueueJobs = (orderNumber: string) => {
    const jobs: PrintJob[] = [
      { id: uid(), orderNumber, docType: 'KITCHEN TICKET', role: 'kitchen', status: 'pending', copy: false, createdAt: Date.now() },
      { id: uid(), orderNumber, docType: 'RECEIPT', role: 'billing', status: 'pending', copy: false, createdAt: Date.now() },
    ]
    setState((s) => ({ ...s, printJobs: [...jobs, ...s.printJobs] }))
    jobs.forEach((j) => {
      window.setTimeout(() => {
        setState((s) => ({
          ...s,
          printJobs: s.printJobs.map((p) =>
            p.id === j.id ? { ...p, status: 'printed' } : p,
          ),
        }))
      }, j.role === 'kitchen' ? 900 : 1500)
    })
  }

  const retryJob = (id: string) => {
    setState((s) => ({
      ...s,
      printJobs: s.printJobs.map((j) => (j.id === id ? { ...j, status: 'pending' } : j)),
    }))
    window.setTimeout(() => {
      setState((s) => ({
        ...s,
        printJobs: s.printJobs.map((j) => (j.id === id ? { ...j, status: 'printed' } : j)),
      }))
    }, 1200)
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
    window.setTimeout(() => {
      setState((s) => ({
        ...s,
        printJobs: s.printJobs.map((j) => (j.id === job.id ? { ...j, status: 'printed' } : j)),
      }))
    }, 1000)
    flash(`COPY receipt queued → ${state.settings.billingPrinter}`)
  }

  // ---------- Cart ----------
  const add = (id: string) => setCart((c) => ({ ...c, [id]: 1 }))
  const increment = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
  const decrement = (id: string) =>
    setCart((c) => {
      const next = { ...c }
      const q = (next[id] ?? 0) - 1
      if (q <= 0) delete next[id]
      else next[id] = q
      return next
    })
  const removeLine = (id: string) =>
    setCart((c) => {
      const next = { ...c }
      delete next[id]
      return next
    })

  const lines: CartLine[] = useMemo(
    () =>
      state.menu.filter((m) => cart[m.id]).map((m) => ({
        item: m,
        qty: cart[m.id],
      })),
    [cart, state.menu],
  )
  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0)
  const tax = Math.round(subtotal * state.settings.taxRate)
  const total = subtotal + tax

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
      lines: lines.map((l) => ({ name: l.item.name, qty: l.qty, price: l.item.price })),
      subtotal,
      tax,
      total,
      payment: method,
      tendered,
      change,
      status: 'new',
      createdAt: Date.now(),
      cashier: user?.name ?? 'Unknown',
    }
    setState((s) => ({ ...s, orders: [order, ...s.orders], seq: s.seq + 1 }))
    enqueueJobs(order.number) // kitchen ticket → chef printer, receipt → billing printer
    setCart({})
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
      lines: lines.map((l) => ({ itemId: l.item.id, qty: l.qty })),
      createdAt: Date.now(),
    }
    setState((s) => ({ ...s, held: [held, ...s.held] }))
    setCart({})
    flash('Order parked — recall it from Held')
  }

  const recallHeld = (id: string) => {
    const h = state.held.find((x) => x.id === id)
    if (!h) return
    const next: Record<string, number> = {}
    h.lines.forEach((l) => (next[l.itemId] = l.qty))
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

  const refundOrder = (id: string) =>
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'refunded' } : o)),
    }))

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

  const orderNumber = `#${state.settings.orderPrefix}${state.seq}`

  if (!user) return <LoginScreen onLogin={setUser} />

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
            tax={tax}
            total={total}
            paymentMethod={payment}
            orderType={orderType}
            customerId={customerId}
            customers={state.customers}
            heldCount={state.held.length}
            onPaymentChange={setPayment}
            onTypeChange={setOrderType}
            onCustomerChange={setCustomerId}
            onRemoveLine={removeLine}
            onHold={holdOrder}
            onPrint={() => flash('Receipt sent to billing printer')}
            onOrder={() => setPayOpen(true)}
          />
        </>
      )}

      {view === 'menu' && (
        <MenuPage
          menu={state.menu}
          onSave={saveMenuItem}
          onDelete={deleteMenuItem}
          onToggle={toggleMenuItem}
        />
      )}
      {view === 'printers' && (
        <PrintersPage
          jobs={state.printJobs}
          orders={state.orders}
          settings={state.settings}
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
      {view === 'report' && <ReportPage orders={state.orders} />}
      {view === 'settings' && (
        <SettingsPage
          settings={state.settings}
          onChange={(settings) => setState((s) => ({ ...s, settings }))}
          onSaved={() => flash('Settings saved')}
        />
      )}
      {view === 'info' && (
        <InfoPage
          settings={state.settings}
          orderCount={state.orders.length}
          onBackup={() =>
            backupNow(state).then((f) => flash(f ? `Backup written to ${f}` : 'Backup failed'))
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[12.5px] font-bold text-white shadow-xl">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  )
}
