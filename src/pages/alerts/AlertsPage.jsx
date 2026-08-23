import { useCallback, useEffect, useState } from "react"

import { getAlertSummary } from "../../features/reports/reports.api"

const CATEGORY_LABELS = {
  inventory: "Inventory",
  stockTransfers: "Stock transfers",
  warrantyClaims: "Warranty claims",
  purchaseOrders: "Purchase orders",
  purchaseReceivings: "Purchase receiving",
  cashHandovers: "Cash handovers",
  creditAccounts: "Overdue credits",
}

function recordTitle(category, record) {
  if (record.message) return record.message
  if (category === "stockTransfers") return `${record.transferCode} — ${record.status}`
  if (category === "warrantyClaims") return `${record.claimCode} — ${record.status}`
  if (category === "purchaseOrders") return `${record.poCode} — ${record.status}`
  if (category === "purchaseReceivings") return `${record.receivingCode} — ${record.status}`
  if (category === "cashHandovers") return `${record.handoverCode} — ₱${Number(record.amount || 0).toLocaleString("en-PH")}`
  if (category === "creditAccounts") return `${record.creditCode} — ₱${Number(record.remainingBalance || 0).toLocaleString("en-PH")}`
  return record.id
}

function recordContext(category, record) {
  if (category === "inventory") return `${record.branch?.code || "—"} • ${record.item?.itemCode || ""}`
  if (category === "stockTransfers") return `${record.fromBranch?.code || "—"} → ${record.toBranch?.code || "—"}`
  if (category === "warrantyClaims") return `${record.branch?.code || "—"} • ${record.item?.itemName || "Unlinked item"}`
  if (category === "purchaseOrders" || category === "purchaseReceivings") return `${record.branch?.code || "—"} • ${record.supplier?.name || record.supplierNameSnapshot || "Supplier"}`
  if (category === "cashHandovers") return `${record.branch?.code || "—"} • ${record.cashBox?.name || "Cash box"}`
  if (category === "creditAccounts") return `${record.branch?.code || "—"} • ${record.customer?.fullName || "Customer"} • due ${record.nextDueDate ? new Date(record.nextDueDate).toLocaleDateString("en-PH") : "—"}`
  return ""
}

export default function AlertsPage({ selectedBranch, user, onNavigate }) {
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""

  const loadAlerts = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await getAlertSummary({ ...(branchId ? { branchId } : {}), limit: 15 })
      setResult(response?.data || null)
    } catch (error) {
      setResult(null)
      setErrorMessage(
        error?.response?.data?.message ||
          error?.response?.data?.error?.message ||
          "Could not load alerts.",
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

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">Monitoring</p>
            <h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Action alerts</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Live operational conditions that need review—no mock notifications.</p>
          </div>
          <button className="rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60" disabled={isLoading} onClick={loadAlerts} type="button">
            {isLoading ? "Refreshing..." : "Refresh alerts"}
          </button>
        </div>
      </section>

      {errorMessage ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{errorMessage}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total alerts", totals.totalAlerts],
          ["Inventory", totals.inventoryAlerts],
          ["Transfers", totals.stockTransferAlerts],
          ["Warranty", totals.warrantyAlerts],
          ["Purchase orders", totals.purchaseOrderAlerts],
          ["Receiving", totals.purchaseReceivingAlerts],
          ["Cash handovers", totals.cashHandoverAlerts],
          ["Overdue credits", totals.overdueCreditAlerts],
        ].map(([label, value]) => (
          <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card" key={label}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-black text-[var(--color-text-strong)]">{Number(value || 0)}</p>
          </div>
        ))}
      </section>

      {isLoading ? <div className="rounded-3xl border bg-white p-8 text-center text-sm text-[var(--color-muted)]">Loading live alerts...</div> : null}
      {!isLoading && Number(totals.totalAlerts || 0) === 0 ? <div className="rounded-3xl border border-dashed bg-white p-8 text-center text-sm text-[var(--color-muted)]">No current operational alerts for this branch.</div> : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {Object.entries(alertGroups).map(([category, group]) => (
          <div className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card" key={category}>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
              <h2 className="font-black text-[var(--color-text-strong)]">{CATEGORY_LABELS[category] || category}</h2>
              <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-black text-[var(--color-maroon)]">{group.total || 0}</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {(group.records || []).map((record) => (
                <div className="p-4" key={record.id}>
                  <p className="font-bold text-[var(--color-text-strong)]">{recordTitle(category, record)}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{recordContext(category, record)}</p>
                </div>
              ))}
              {(group.records || []).length === 0 ? <p className="p-5 text-sm text-[var(--color-muted)]">Nothing currently needs attention.</p> : null}
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {[
          ["inventory", "Open inventory"],
          ["stock-transfers", "Open transfers"],
          ["warranty", "Open warranty"],
          ["purchase-orders", "Open purchase orders"],
          ["receivings", "Open receiving"],
          ["cash-box", "Open cash box"],
          ["credits", "Open credits"],
        ].map(([page, label]) => (
          <button className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text-strong)]" key={page} onClick={() => onNavigate(page)} type="button">{label}</button>
        ))}
      </div>
    </div>
  )
}
