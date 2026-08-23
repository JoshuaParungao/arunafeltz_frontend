import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wrench,
  X,
} from "lucide-react"

const ICONS = {
  "owner-dashboard": LayoutDashboard,
  "staff-dashboard": LayoutDashboard,
  pos: ShoppingCart,
  quotations: ClipboardList,
  inventory: PackageSearch,
  items: Boxes,
  customers: Users,
  services: Wrench,
  warranty: ShieldCheck,
  serials: PackageSearch,
  suppliers: Users,
  "purchase-orders": ClipboardList,
  receivings: ReceiptText,
  "stock-transfers": Boxes,
  "cash-box": ReceiptText,
  credits: ReceiptText,
  incentives: BarChart3,
  reports: BarChart3,
  alerts: ShieldCheck,
  "audit-logs": ShieldCheck,
  settings: ShieldCheck,
  users: Users,
}

function Sidebar({
  activePage,
  modules,
  onChangePage,
  isCollapsed = false,
  onClose,
  className = "",
}) {
  const groups = modules.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  const handleChangePage = (pageKey) => {
    onChangePage(pageKey)
    if (onClose) onClose()
  }

  return (
    <aside
      className={`h-svh shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-sidebar)] py-5 text-white ${isCollapsed ? "w-20 px-3" : "w-72 px-4"} ${className}`}
    >
      <div className="flex items-center gap-3 px-1">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon)] text-lg font-bold shadow-soft">
          A
        </div>

        {!isCollapsed ? (
          <div className="min-w-0">
            <p className="brand-text text-base font-bold tracking-tight">Arunafeltz Computer</p>
            <p className="truncate text-xs text-white/60">Enterprise POS</p>
          </div>
        ) : null}

        {onClose ? (
          <button
            className="ml-auto grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white lg:hidden"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <nav className="mt-7 space-y-6">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            {!isCollapsed ? (
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
                {group}
              </p>
            ) : null}

            <div className="space-y-1">
              {items.map((item) => {
                const Icon = ICONS[item.key] || LayoutDashboard
                const isActive = activePage === item.key

                return (
                  <button
                    className={`flex w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                      isCollapsed ? "justify-center" : ""
                    } ${
                      isActive
                        ? "bg-[var(--color-maroon)] text-white shadow-soft"
                        : "text-white/72 hover:bg-white/10 hover:text-white"
                    }`}
                    key={item.key}
                    onClick={() => handleChangePage(item.key)}
                    title={item.label}
                    type="button"
                  >
                    <Icon className="size-4 shrink-0" />
                    {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
