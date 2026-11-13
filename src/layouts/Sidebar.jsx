import { useEffect, useState } from "react"
import {
  ArrowLeftRight,
  Award,
  Banknote,
  BarChart3,
  BellRing,
  Boxes,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  History,
  Layers,
  Monitor,
  PackageCheck,
  PackageSearch,
  PackageX,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Tags,
  Truck,
  UserCheck,
  UserCog,
  UsersRound,
  Wrench,
  X,
} from "lucide-react"

const ICONS = {
  pos: ShoppingCart,
  quotations: ClipboardList,
  "pc-builds": Monitor,
  services: Wrench,
  warranty: ShieldCheck,
  inventory: Boxes,
  serials: PackageSearch,
  "stock-transfers": ArrowLeftRight,
  "purchase-orders": FileSpreadsheet,
  receivings: PackageCheck,
  "supplier-returns": PackageX,
  "cash-box": Banknote,
  credits: CreditCard,
  incentives: Award,
  items: Tags,
  categories: Layers,
  "services-maintenance": Layers,
  customers: UsersRound,
  employees: UserCheck,
  suppliers: Truck,
  users: UserCog,
  settings: SlidersHorizontal,
  reports: BarChart3,
  alerts: BellRing,
  "audit-logs": History,
}

const STORAGE_KEY = "arunafeltz_sidebar_open_groups"

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

  const activeGroup = modules.find((item) => item.key === activePage)?.group

  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === "object") {
          return parsed
        }
      }
    } catch {
      // ignore storage errors
    }
    return {
      Operations: true,
      "Inventory & Purchasing": true,
      "Finance & Credits": false,
      "File Maintenance": false,
      "Reports & Audit": false,
      ...(activeGroup ? { [activeGroup]: true } : {}),
    }
  })

  // Ensure the group containing the active page is expanded when navigating
  useEffect(() => {
    if (activeGroup) {
      setOpenGroups((prev) => {
        if (prev[activeGroup]) return prev
        const next = { ...prev, [activeGroup]: true }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    }
  }, [activeGroup])

  const toggleGroup = (groupName) => {
    setOpenGroups((prev) => {
      const isCurrentlyOpen = prev[groupName] ?? true
      const next = {
        ...prev,
        [groupName]: !isCurrentlyOpen,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const handleChangePage = (pageKey) => {
    onChangePage(pageKey)
    if (onClose) onClose()
  }

  return (
    <aside
      className={`h-svh shrink-0 overflow-y-auto border-r border-white/8 bg-[var(--color-sidebar)] py-3.5 text-white transition-all duration-200 select-none ${
        isCollapsed ? "w-16 px-2" : "w-58 px-3"
      } ${className}`}
    >
      {/* Compact Minimalist Brand Header */}
      <div
        className={`flex items-center border-b border-white/8 pb-3 ${
          isCollapsed ? "justify-center px-0" : "gap-2.5 px-1.5"
        }`}
      >
        <img
          alt="Arunafeltz Computer Logo"
          className="size-8 shrink-0 rounded-xl bg-white/10 p-1 object-contain shadow-xs"
          src="/arunafeltzlogo.png"
        />

        {!isCollapsed ? (
          <div className="min-w-0 flex-1">
            <p className="brand-text text-sm font-bold leading-tight tracking-tight text-white">
              Arunafeltz
            </p>
            <p className="truncate text-[11px] font-medium text-slate-400">
              Enterprise POS & ERP
            </p>
          </div>
        ) : null}

        {onClose ? (
          <button
            className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg bg-white/8 text-slate-300 hover:bg-white/15 hover:text-white lg:hidden"
            onClick={onClose}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Minimalist Navigation List */}
      <nav className="mt-3 space-y-3">
        {Object.entries(groups).map(([group, items]) => {
          const isOpen = isCollapsed ? true : (openGroups[group] ?? true)
          const hasActiveItem = items.some((item) => item.key === activePage)

          return (
            <div key={group}>
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className={`mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                    hasActiveItem
                      ? "text-slate-300 hover:bg-white/5 hover:text-white"
                      : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                  }`}
                >
                  <span className="truncate">{group}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isOpen && hasActiveItem ? (
                      <span className="size-1.5 rounded-full bg-[var(--color-maroon)]" />
                    ) : null}
                    <ChevronDown
                      className={`size-3 text-slate-500 transition-transform duration-200 ${
                        isOpen ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                  </div>
                </button>
              ) : (
                <div className="my-1.5 border-t border-white/6" />
              )}

              {isOpen ? (
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = ICONS[item.key] || ShoppingCart
                    const isActive = activePage === item.key

                    return (
                      <button
                        className={`group relative flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[12.5px] font-medium transition cursor-pointer ${
                          isCollapsed ? "justify-center px-0 py-2" : ""
                        } ${
                          isActive
                            ? "bg-[var(--color-maroon)] text-white font-semibold shadow-xs"
                            : "text-slate-300/85 hover:bg-white/7 hover:text-white"
                        }`}
                        key={item.key}
                        onClick={() => handleChangePage(item.key)}
                        title={item.label}
                        type="button"
                      >
                        <Icon
                          className={`size-4 shrink-0 transition ${
                            isActive
                              ? "text-white"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                        {!isCollapsed ? (
                          <span className="truncate leading-snug">{item.label}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
