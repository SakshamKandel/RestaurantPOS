import {
  ArrowLeftRight,
  Info,
  LayoutDashboard,
  LineChart,
  LogOut,
  Printer,
  Settings,
  UserCog,
  Users,
  UtensilsCrossed,
  Vault,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '../data/menu'
import logoIcon from '../assets/icon.png'

export type View =
  | 'dashboard'
  | 'customers'
  | 'menu'
  | 'report'
  | 'transactions'
  | 'printers'
  | 'shift'
  | 'staff'
  | 'settings'
  | 'info'

interface NavItem {
  view: View
  label: string
  icon: LucideIcon
  roles: Role[]
}

const MAIN_NAV: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['cashier', 'kitchen', 'manager'] },
  { view: 'customers', label: 'Customers', icon: Users, roles: ['cashier', 'manager'] },
  { view: 'menu', label: 'Menu', icon: UtensilsCrossed, roles: ['manager'] },
  { view: 'printers', label: 'Printers', icon: Printer, roles: ['cashier', 'manager'] },
  { view: 'shift', label: 'Shift', icon: Vault, roles: ['cashier', 'manager'] },
  { view: 'report', label: 'Report', icon: LineChart, roles: ['manager'] },
  { view: 'transactions', label: 'Transaction', icon: ArrowLeftRight, roles: ['cashier', 'manager'] },
]

const OTHER_NAV: { view: View; label: string; icon: LucideIcon; roles: Role[] }[] = [
  { view: 'staff', label: 'Staff', icon: UserCog, roles: ['manager'] },
  { view: 'settings', label: 'Settings', icon: Settings, roles: ['manager'] },
  { view: 'info', label: 'Info', icon: Info, roles: ['cashier', 'kitchen', 'manager'] },
]

interface Props {
  view: View
  role: Role
  userName: string
  onNavigate: (v: View) => void
  onLogout: () => void
}

function NavButton({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate: (v: View) => void
}) {
  const Icon = item.icon
  return (
    <button
      onClick={() => onNavigate(item.view)}
      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
        active
          ? 'bg-primary text-white shadow-lg shadow-orange-500/25'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
      }`}
    >
      <Icon size={17} strokeWidth={2.2} />
      {item.label}
    </button>
  )
}

export default function Sidebar({ view, role, userName, onNavigate, onLogout }: Props) {
  return (
    <aside className="flex w-[212px] shrink-0 flex-col border-r border-neutral-200/70 bg-white px-4 py-6">
      <div className="mb-8 flex items-center gap-2.5 px-1.5">
        <img src={logoIcon} alt="KhadkaPOS" className="h-9 w-9 object-contain" />
        <span className="text-[19px] font-extrabold tracking-tight">Khadka</span>
      </div>

      <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.18em] text-neutral-300">
        MENU
      </p>
      <nav className="flex flex-col gap-1">
        {MAIN_NAV.filter((n) => n.roles.includes(role)).map((item) => (
          <NavButton key={item.view} item={item} active={view === item.view} onNavigate={onNavigate} />
        ))}
      </nav>

      <p className="mt-8 mb-2 px-2 text-[10px] font-bold tracking-[0.18em] text-neutral-300">
        ANOTHER MENU
      </p>
      <nav className="flex flex-col gap-1">
        {OTHER_NAV.filter((n) => n.roles.includes(role)).map((item) => (
          <NavButton key={item.view} item={item} active={view === item.view} onNavigate={onNavigate} />
        ))}
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-red-500 transition-colors hover:bg-red-50"
        >
          <LogOut size={17} strokeWidth={2.2} />
          Log Out
        </button>
      </nav>

      <div className="mt-auto rounded-2xl bg-primary-soft p-3.5">
        <p className="text-[12px] font-bold text-primary">Signed in</p>
        <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
          {userName} · Register 01
        </p>
      </div>
    </aside>
  )
}
