import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ClockAlert,
  Coins,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  HandCoins,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  Tag,
  User,
  X,
} from "lucide-react"

import { getAlertSummary } from "../../features/reports/reports.api"

const CATEGORY_META = {
  inventory: {
    label: "Inventory",
    page: "inventory",
    icon: Boxes,
    color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/50",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300",
  },
  stockTransfers: {
    label: "Transfers",
    page: "stock-transfers",
    icon: ArrowLeftRight,
    color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-900/50",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300",
  },
  warrantyClaims: {
    label: "Warranty",
    page: "warranty",
    icon: ShieldAlert,
    color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/50",
    badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300",
  },
  purchaseOrders: {
    label: "Purchase Orders",
    page: "purchase-orders",
    icon: FileSpreadsheet,
    color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/50",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
  },
  purchaseReceivings: {
    label: "Receiving",
    page: "receivings",
    icon: PackageCheck,
    color: "text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-400 border-teal-200 dark:border-teal-900/50",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300",
  },
  cashHandovers: {
    label: "Cash Handovers",
    page: "cash-box",
    icon: HandCoins,
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
  },
  creditAccounts: {
    label: "Overdue Credits",
    page: "credits",
    icon: ClockAlert,
    color: "text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900/50",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300",
  },
}

function peso(val) {
  return `₱${Number(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(val) {
  if (!val) return "—"
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

export default function AlertsPage({ selectedBranch, user, onNavigate }) {
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeModalItem, setActiveModalItem] = useState(null)

  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""

  const loadAlerts = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await getAlertSummary({ ...(branchId ? { branchId } : {}), limit: 50 })
      setResult(response?.data || null)
    } catch (error) {
      setResult(null)
      setErrorMessage(
        error?.response?.data?.message ||
          error?.response?.data?.error?.message ||
          "Could not load action alerts.",
      )
    } finally {
      setIsLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    const timer = window.setTimeout(loadAlerts, 0)
    return () => window.clearTimeout(timer)
  }, [loadAlerts])

  const totals = result?.report?.totals || {}
  const alertGroups = result?.alerts || {}
  const totalAlerts = Number(totals.totalAlerts || 0)

  // Flatten and normalize records for filtering and search
  const allAlertList = useMemo(() => {
    const items = []
    Object.entries(alertGroups).forEach(([catKey, group]) => {
      const meta = CATEGORY_META[catKey] || { label: catKey, page: "dashboard" }
      ;(group.records || []).forEach((record) => {
        let title = record.message || record.id
        let subtitle = ""
        let statusBadge = record.status || (record.type === "ZERO_STOCK" ? "ZERO STOCK" : "LOW STOCK")
        let isCritical = record.type === "ZERO_STOCK" || record.status === "CHECKING" || catKey === "creditAccounts" || catKey === "cashHandovers"

        if (catKey === "inventory") {
          title = record.item?.itemName || record.message || "Item Alert"
          subtitle = `Code: ${record.item?.itemCode || "—"} • Available: ${record.item?.quantityAvailable ?? 0} (Min: ${record.item?.minimumStock ?? 0})`
        } else if (catKey === "stockTransfers") {
          title = `Transfer ${record.transferCode}`
          subtitle = `${record.fromBranch?.code || "—"} → ${record.toBranch?.code || "—"} • Date: ${formatDate(record.transferDate)}`
        } else if (catKey === "warrantyClaims") {
          title = `Claim ${record.claimCode}`
          subtitle = `${record.item?.itemName || "Item"} • Customer: ${record.customer?.fullName || "—"}`
        } else if (catKey === "purchaseOrders") {
          title = `PO ${record.poCode}`
          subtitle = `Supplier: ${record.supplier?.name || record.supplierNameSnapshot || "Supplier"} • Date: ${formatDate(record.orderDate)}`
        } else if (catKey === "purchaseReceivings") {
          title = `Receiving ${record.receivingCode}`
          subtitle = `Supplier: ${record.supplier?.name || record.supplierNameSnapshot || "Supplier"} • ${formatDate(record.receivingDate)}`
        } else if (catKey === "cashHandovers") {
          title = `Handover ${record.handoverCode}`
          subtitle = `${peso(record.amount)} • Cash Box: ${record.cashBox?.name || "Box"} • From: ${record.fromUser?.fullName || record.fromUser?.username || "Staff"}`
        } else if (catKey === "creditAccounts") {
          title = `Overdue Account ${record.creditCode}`
          subtitle = `Customer: ${record.customer?.fullName || "—"} • Balance: ${peso(record.remainingBalance)} • Due: ${formatDate(record.nextDueDate)}`
        }

        items.push({
          id: record.id,
          categoryKey: catKey,
          categoryLabel: meta.label,
          targetPage: meta.page,
          title,
          subtitle,
          statusBadge,
          isCritical,
          rawRecord: record,
        })
      })
    })
    return items
  }, [alertGroups])

  // Filtered by selected category and search query
  const filteredAlertList = useMemo(() => {
    return allAlertList.filter((item) => {
      if (selectedCategory !== "ALL" && item.categoryKey !== selectedCategory) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const text = `${item.title} ${item.subtitle} ${item.statusBadge} ${item.categoryLabel}`.toLowerCase()
        return text.includes(q)
      }
      return true
    })
  }, [allAlertList, selectedCategory, searchQuery])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              <ShieldAlert size={13} className="shrink-0" />
              Live Operational Monitoring
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Action Alerts & Critical Review
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Real-time operational alerts across inventory levels, warranties, purchase orders, transfers, and finances.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#5c131d] transition disabled:opacity-50 cursor-pointer"
              disabled={isLoading}
              onClick={loadAlerts}
              type="button"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>{isLoading ? "Refreshing..." : "Refresh Alerts"}</span>
            </button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage}
        </div>
      ) : null}

      {/* 8 Metric Summary Cards (from Screenshot) */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            key: "ALL",
            label: "Total Alerts",
            value: totals.totalAlerts,
            icon: Bell,
            color: "text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200",
            page: null,
          },
          {
            key: "inventory",
            label: "Inventory",
            value: totals.inventoryAlerts,
            icon: Boxes,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200",
            page: "inventory",
          },
          {
            key: "stockTransfers",
            label: "Transfers",
            value: totals.stockTransferAlerts,
            icon: ArrowLeftRight,
            color: "text-purple-600 bg-purple-50 dark:bg-purple-950/50 dark:text-purple-400 border-purple-200",
            page: "stock-transfers",
          },
          {
            key: "warrantyClaims",
            label: "Warranty",
            value: totals.warrantyAlerts,
            icon: ShieldAlert,
            color: "text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200",
            page: "warranty",
          },
          {
            key: "purchaseOrders",
            label: "Purchase Orders",
            value: totals.purchaseOrderAlerts,
            icon: FileSpreadsheet,
            color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200",
            page: "purchase-orders",
          },
          {
            key: "purchaseReceivings",
            label: "Receiving",
            value: totals.purchaseReceivingAlerts,
            icon: PackageCheck,
            color: "text-teal-600 bg-teal-50 dark:bg-teal-950/50 dark:text-teal-400 border-teal-200",
            page: "receivings",
          },
          {
            key: "cashHandovers",
            label: "Cash Handovers",
            value: totals.cashHandoverAlerts,
            icon: HandCoins,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200",
            page: "cash-box",
          },
          {
            key: "creditAccounts",
            label: "Overdue Credits",
            value: totals.overdueCreditAlerts,
            icon: ClockAlert,
            color: "text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400 border-red-200",
            page: "credits",
          },
        ].map((card) => {
          const IconComp = card.icon
          const count = Number(card.value || 0)
          const isSelected = selectedCategory === card.key

          return (
            <div
              className={`group relative flex flex-col justify-between rounded-3xl border bg-white p-5 shadow-xs transition cursor-pointer dark:bg-slate-900 ${
                isSelected
                  ? "border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon)]/20 shadow-md"
                  : "border-slate-200/90 hover:border-slate-300 dark:border-slate-800"
              }`}
              key={card.key}
              onClick={() => setSelectedCategory(card.key)}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`grid size-9 place-items-center rounded-2xl ${card.color}`}>
                    <IconComp size={18} />
                  </span>
                  {count > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                      <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                      Attention
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400 dark:bg-slate-800">
                      Clear
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {card.label}
                </p>
                <p className="mt-1 font-mono text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {count}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  {isSelected ? "Filtering list" : "Click to filter"}
                </span>
                {card.page ? (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-[var(--color-maroon)] hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigate?.(card.page)
                    }}
                    type="button"
                  >
                    <span>Open</span>
                    <ArrowRight size={12} />
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </section>

      {/* Filter and Search Bar */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Quick Category Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                selectedCategory === "ALL"
                  ? "bg-[var(--color-maroon)] text-white shadow-xs"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
              onClick={() => setSelectedCategory("ALL")}
              type="button"
            >
              All Alerts ({totalAlerts})
            </button>
            {Object.entries(CATEGORY_META).map(([key, meta]) => {
              const count = Number(alertGroups[key]?.total || 0)
              const isActive = selectedCategory === key
              return (
                <button
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? "bg-[var(--color-maroon)] text-white shadow-xs"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  type="button"
                >
                  <span>{meta.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, item, customer..."
              type="text"
              value={searchQuery}
            />
          </div>
        </div>
      </section>

      {/* Detailed Alert Records List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">
            {selectedCategory === "ALL" ? "All Operational Alerts" : CATEGORY_META[selectedCategory]?.label || "Category Alerts"}{" "}
            ({filteredAlertList.length})
          </h2>
          {filteredAlertList.length > 0 && (
            <span className="text-xs font-semibold text-slate-400">
              Click &quot;View Details&quot; to inspect or &quot;Go to Module&quot; to resolve
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            <RefreshCw className="mx-auto size-6 animate-spin text-[var(--color-maroon)] mb-2" />
            Loading live operational alerts...
          </div>
        ) : filteredAlertList.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <CheckCircle2 className="mx-auto size-10 text-emerald-500 mb-2" />
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
              No active operational alerts found!
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Everything in this category is running smoothly and requires no immediate attention.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredAlertList.map((item) => {
              const meta = CATEGORY_META[item.categoryKey] || {}
              const IconComp = meta.icon || Bell

              return (
                <div
                  className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  key={`${item.categoryKey}-${item.id}`}
                >
                  <div>
                    {/* Top Tag Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-bold ${meta.color}`}>
                        <IconComp size={12} />
                        <span>{meta.label}</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          item.isCritical
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {item.isCritical && <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />}
                        {item.statusBadge}
                      </span>
                    </div>

                    {/* Headline */}
                    <h3 className="mt-3 text-base font-black tracking-tight text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.subtitle}
                    </p>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                      onClick={() => setActiveModalItem(item)}
                      type="button"
                    >
                      <Eye size={13} />
                      <span>View Details</span>
                    </button>

                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#5c131d] transition cursor-pointer shadow-2xs"
                      onClick={() => onNavigate?.(item.targetPage)}
                      type="button"
                    >
                      <span>Go to Module</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Quick Navigation Footer Links */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
          Direct Module Shortcuts
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            ["inventory", "Open Inventory", Boxes],
            ["stock-transfers", "Open Transfers", ArrowLeftRight],
            ["warranty", "Open Warranty", ShieldAlert],
            ["purchase-orders", "Open Purchase Orders", FileSpreadsheet],
            ["receivings", "Open Receiving", PackageCheck],
            ["cash-box", "Open Cash Box", HandCoins],
            ["credits", "Open Credits", ClockAlert],
          ].map(([page, label, Icon]) => (
            <button
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:border-[var(--color-maroon)] hover:bg-rose-50/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
              key={page}
              onClick={() => onNavigate?.(page)}
              type="button"
            >
              <Icon size={14} className="text-[var(--color-maroon)]" />
              <span>{label}</span>
              <ExternalLink size={11} className="text-slate-400" />
            </button>
          ))}
        </div>
      </section>

      {/* Alert Detail Modal Dialog */}
      {activeModalItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-700 uppercase tracking-wider dark:bg-rose-950 dark:text-rose-300">
                  {activeModalItem.categoryLabel} Alert
                </span>
                <h3 className="mt-1.5 text-lg font-black text-slate-900 dark:text-white">
                  {activeModalItem.title}
                </h3>
              </div>
              <button
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition cursor-pointer"
                onClick={() => setActiveModalItem(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - Key-Value Grid */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Alert Details & Attributes
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Category:</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{activeModalItem.categoryLabel}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Status / Severity:</span>
                    <p className="font-bold text-rose-600 dark:text-rose-400">{activeModalItem.statusBadge}</p>
                  </div>

                  {activeModalItem.categoryKey === "inventory" && (
                    <>
                      <div>
                        <span className="text-slate-400">Item Code:</span>
                        <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.item?.itemCode || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Available Stock:</span>
                        <p className="font-mono font-black text-rose-600">
                          {activeModalItem.rawRecord.item?.quantityAvailable ?? 0}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Minimum Stock Level:</span>
                        <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.item?.minimumStock ?? 0}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Reorder Level:</span>
                        <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.item?.reorderLevel ?? 0}
                        </p>
                      </div>
                    </>
                  )}

                  {activeModalItem.categoryKey === "warrantyClaims" && (
                    <>
                      <div>
                        <span className="text-slate-400">Customer:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.customer?.fullName || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Contact Number:</span>
                        <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.customer?.mobileNumber || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Serial Number:</span>
                        <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.serial?.serialNumber || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Received Date:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {formatDate(activeModalItem.rawRecord.receivedAt)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">Issue Description:</span>
                        <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                          {activeModalItem.rawRecord.issueDescription || "No issue description provided."}
                        </p>
                      </div>
                    </>
                  )}

                  {activeModalItem.categoryKey === "purchaseOrders" && (
                    <>
                      <div>
                        <span className="text-slate-400">Supplier:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.supplier?.name || activeModalItem.rawRecord.supplierNameSnapshot || "Supplier"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Order Date:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {formatDate(activeModalItem.rawRecord.orderDate)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Expected Delivery:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {formatDate(activeModalItem.rawRecord.expectedDate)}
                        </p>
                      </div>
                    </>
                  )}

                  {activeModalItem.categoryKey === "cashHandovers" && (
                    <>
                      <div>
                        <span className="text-slate-400">Handover Amount:</span>
                        <p className="font-mono font-black text-emerald-600">
                          {peso(activeModalItem.rawRecord.amount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Cash Box:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.cashBox?.name || "Cash box"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">From User:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.fromUser?.fullName || activeModalItem.rawRecord.fromUser?.username || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">To User:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.toUser?.fullName || activeModalItem.rawRecord.toUser?.username || "—"}
                        </p>
                      </div>
                    </>
                  )}

                  {activeModalItem.categoryKey === "creditAccounts" && (
                    <>
                      <div>
                        <span className="text-slate-400">Customer:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {activeModalItem.rawRecord.customer?.fullName || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Remaining Balance:</span>
                        <p className="font-mono font-black text-rose-600">
                          {peso(activeModalItem.rawRecord.remainingBalance)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Monthly Due:</span>
                        <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {peso(activeModalItem.rawRecord.monthlyDueAmount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Overdue Date:</span>
                        <p className="font-bold text-rose-600">
                          {formatDate(activeModalItem.rawRecord.nextDueDate)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Instructions / Resolution Notice */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={14} />
                  <span>Resolution Guide</span>
                </div>
                <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                  Pindutin ang &quot;Open in {activeModalItem.categoryLabel} Module&quot; upang direktang makarating sa kaukulang page at ma-aksyunan ang alert na ito (hal. mag-reorder ng stock, mag-update ng warranty claim status, o mag-follow-up sa customer).
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                onClick={() => setActiveModalItem(null)}
                type="button"
              >
                Close
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#5c131d] transition cursor-pointer"
                onClick={() => {
                  const target = activeModalItem.targetPage
                  setActiveModalItem(null)
                  onNavigate?.(target)
                }}
                type="button"
              >
                <span>Open in {activeModalItem.categoryLabel} Module</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
