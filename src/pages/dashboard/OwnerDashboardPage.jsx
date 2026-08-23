import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  BadgePercent,
  Banknote,
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Wrench,
} from "lucide-react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"
import { getAlertSummary, getReport } from "../../features/reports/reports.api"

const quickActions = [
  ["Open POS", "Start a sales transaction and record payment.", "pos", ShoppingCart],
  ["New Quotation", "Prepare a customer quotation with validated prices.", "quotations", ClipboardList],
  ["Inventory", "Check branch stock, serials, and item availability.", "inventory", PackageSearch],
  ["Stock Transfer", "Request, approve, or monitor branch movement.", "stock-transfers", Truck],
  ["Cash Box", "Review cash collections and handover workflow.", "cash-box", CreditCard],
  ["Credits", "Monitor installment balances, collections, and overdue accounts.", "credits", CreditCard],
  ["Services / Job Orders", "Receive, assign, release, and print service job orders.", "services", Wrench],
  ["Incentives", "Review source-linked product and service incentives.", "incentives", BadgePercent],
  ["Reports", "Open live sales, stock, cash, warranty, and service reports.", "reports", BarChart3],
]

function peso(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH")
}

export default function OwnerDashboardPage({ user, selectedBranch, onNavigate }) {
  const [dashboard, setDashboard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const branchCode = selectedBranch?.code || user?.branch?.code || "ALL"
  const isSuperOwner = user?.role === "SUPER_OWNER"

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    const params = { ...(branchId ? { branchId } : {}), limit: 5 }

    try {
      const [sales, services, inventory, cash, transfers, alerts, allBranchSales] = await Promise.all([
        getReport("sales", params),
        getReport("services", params),
        getReport("inventory", params),
        getReport("cash", params),
        getReport("transfers", params),
        getAlertSummary(params),
        isSuperOwner
          ? getReport("sales", { limit: 1 })
          : Promise.resolve(null),
      ])

      setDashboard({
        sales: sales?.data || {},
        services: services?.data || {},
        inventory: inventory?.data || {},
        cash: cash?.data || {},
        transfers: transfers?.data || {},
        alerts: alerts?.data || {},
        allBranchSales: allBranchSales?.data || {},
      })
    } catch (error) {
      setDashboard(null)
      setErrorMessage(
        error?.response?.data?.message ||
          error?.response?.data?.error?.message ||
          "Could not load live dashboard metrics.",
      )
    } finally {
      setIsLoading(false)
    }
  }, [branchId, isSuperOwner])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const salesTotals = dashboard?.sales?.report?.totals || {}
  const serviceTotals = dashboard?.services?.report?.totals || {}
  const inventoryTotals = dashboard?.inventory?.report?.totals || {}
  const cashTotals = dashboard?.cash?.report?.totals || {}
  const transferTotals = dashboard?.transfers?.report?.totals || {}
  const alertTotals = dashboard?.alerts?.report?.totals || {}

  const summaryCards = [
    ["Overall sales", peso(salesTotals.totalGrandTotal), `${salesTotals.totalSales || 0} sale record(s); cancellations and returns netted`, ReceiptText],
    ["Product revenue", peso(salesTotals.totalProductRevenue), "Product lines remain separate from service revenue", ShoppingCart],
    ["Branch product margin", peso(salesTotals.totalBranchProductMargin), `${peso(salesTotals.totalOperationalProductCost)} operational COGS after returns`, BarChart3],
    ["Company product margin", peso(salesTotals.totalConsolidatedProductMargin), `${peso(salesTotals.totalAcquisitionProductCost)} original acquisition COGS`, BarChart3],
    ["POS service revenue", peso(salesTotals.totalServiceRevenue), "Custom/service lines and recorded sale service charges", Wrench],
    ["Service job income", peso(serviceTotals.totalPaidAmount), `${serviceTotals.totalPaidJobs || 0} paid service job(s)`, Wrench],
    ["Open job orders", String((serviceTotals.statusCounts?.PENDING || 0) + (serviceTotals.statusCounts?.IN_PROGRESS || 0) + (serviceTotals.statusCounts?.READY_FOR_RELEASE || 0)), `${serviceTotals.totalQuickJobs || 0} quick · ${serviceTotals.statusCounts?.READY_FOR_RELEASE || 0} ready`, Wrench],
    ["Released job orders", String(serviceTotals.totalReleasedJobs || 0), `${serviceTotals.totalReleasedUnrepairedJobs || 0} released unrepaired; ${serviceTotals.totalEnteredToday || 0} entered today`, Wrench],
    ["Internal transfers", peso(transferTotals.totalPostedTransferAmount), `${peso(transferTotals.outgoingTransferSales)} outgoing · ${peso(transferTotals.incomingTransferPurchases)} incoming`, Truck],
    ["Net cash movement", peso(cashTotals.netCashMovement), `${cashTotals.totalPosted || 0} posted cash transaction(s)`, Banknote],
    ["Low / zero stock", String((inventoryTotals.lowStockItems || 0) + (inventoryTotals.zeroStockItems || 0)), `${inventoryTotals.totalQuantityAvailable || 0} total units available`, AlertTriangle],
    ["Pending transfers", String(alertTotals.stockTransferAlerts || 0), "Requested, approved, or draft transfer actions", Boxes],
    ["Warranty actions", String(alertTotals.warrantyAlerts || 0), "Claims awaiting operational follow-up", ShieldCheck],
    ["Overdue credits", String(alertTotals.overdueCreditAlerts || 0), "Active installment accounts past their next due date", CreditCard],
  ]

  const recentSales = dashboard?.sales?.records || []
  const alertGroups = dashboard?.alerts?.alerts || {}
  const branchComparison = Object.values(
    dashboard?.allBranchSales?.report?.totals?.branchTotals || {},
  ).sort((left, right) => (left.branch?.code || "").localeCompare(right.branch?.code || ""))

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge tone="maroon">Owner/Admin Monitoring</Badge>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-[var(--color-text-strong)]">Arunafeltz Computer Business Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Live monitoring branch: <span className="font-black text-[var(--color-text-strong)]">{branchCode}</span></p>
        </div>
        <button className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold disabled:opacity-60" disabled={isLoading} onClick={loadDashboard} type="button">{isLoading ? "Refreshing..." : "Refresh dashboard"}</button>
      </div>

      {errorMessage ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{errorMessage}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map(([title, value, note, Icon]) => (
          <Card key={title}>
            <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-semibold text-[var(--color-muted)]">{title}</p><p className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">{isLoading ? "…" : value}</p></div><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-soft)] text-[var(--color-maroon)]"><Icon className="size-5" /></div></div>
            <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{note}</p>
          </Card>
        ))}
      </section>

      {isSuperOwner ? (
        <Card>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-strong)]">Branch sales comparison</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">Completed product, POS service, and overall sales across active operating data.</p>
            </div>
            <button className="text-xs font-black text-[var(--color-maroon)]" onClick={() => onNavigate("reports")} type="button">Open all-branch reports</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {branchComparison.map((row) => (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4" key={row.branch?.id || "unassigned"}>
                <div className="flex items-center justify-between gap-3"><p className="font-black text-[var(--color-text-strong)]">{row.branch?.code || "Unassigned"}</p><span className="text-xs font-bold text-[var(--color-muted)]">{row.totalSales || 0} sale(s)</span></div>
                <p className="mt-3 text-xl font-black text-[var(--color-maroon)]">{peso(row.totalGrandTotal)}</p>
                <p className="mt-2 text-xs text-[var(--color-muted)]">Products {peso(row.totalProductRevenue)} · branch margin {peso(row.branchProductMargin)} · POS services {peso(row.totalServiceRevenue)}</p>
              </div>
            ))}
            {!isLoading && branchComparison.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No completed branch sales are available for comparison.</p> : null}
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <h2 className="text-lg font-black text-[var(--color-text-strong)]">Quick actions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {quickActions.map(([title, description, pageKey, Icon]) => (
              <button className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-left transition hover:border-[var(--color-maroon)] hover:bg-white" key={pageKey} onClick={() => onNavigate(pageKey)} type="button">
                <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-[var(--color-maroon)]"><Icon className="size-4" /></div><div><p className="font-black text-[var(--color-text-strong)]">{title}</p><p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{description}</p></div></div>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between"><h2 className="text-lg font-black text-[var(--color-text-strong)]">Alerts needing attention</h2><button className="text-xs font-black text-[var(--color-maroon)]" onClick={() => onNavigate("alerts")} type="button">View all</button></div>
          <div className="mt-4 space-y-3">
            {Object.entries(alertGroups).map(([key, group]) => (
              <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4" key={key}><span className="font-bold text-[var(--color-text-strong)]">{key.replace(/([A-Z])/g, " $1")}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--color-maroon)]">{group.total || 0}</span></div>
            ))}
            {!isLoading && Object.keys(alertGroups).length === 0 ? <p className="text-sm text-[var(--color-muted)]">No current alerts.</p> : null}
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-[var(--color-text-strong)]">Recent sales</h2><p className="mt-1 text-sm text-[var(--color-muted)]">Latest real transactions for the selected branch.</p></div><button className="text-xs font-black text-[var(--color-maroon)]" onClick={() => onNavigate("pos")} type="button">Open sales</button></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[var(--color-soft)] text-xs uppercase text-[var(--color-muted)]"><tr><th className="px-4 py-3">Receipt</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Net total</th></tr></thead><tbody>{recentSales.map((sale) => <tr className="border-t" key={sale.id}><td className="px-4 py-3 font-black">{sale.receiptCode}</td><td className="px-4 py-3">{formatDate(sale.saleDate)}</td><td className="px-4 py-3">{sale.customer?.fullName || "Walk-in"}</td><td className="px-4 py-3">{sale.status}</td><td className="px-4 py-3 text-right font-black">{peso(sale.netGrandTotal)}</td></tr>)}{!isLoading && recentSales.length === 0 ? <tr><td className="px-4 py-6 text-center text-[var(--color-muted)]" colSpan={5}>No recent sales.</td></tr> : null}</tbody></table></div>
      </Card>
    </div>
  )
}
