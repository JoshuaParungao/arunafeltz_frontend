import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Calendar,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  User,
} from "lucide-react"

import {
  getQuotationById,
  getQuotations,
  updateQuotationStatus,
} from "../../features/quotations/quotations.api"
import QuotationDetailDialog from "../../components/quotations/QuotationDetailDialog"

function money(value) {
  const amount = Number(value || 0)
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getQuotationRows(response) {
  const result = response?.data ?? response ?? {}
  if (Array.isArray(result)) return result
  if (Array.isArray(result.items)) return result.items
  if (Array.isArray(result.data)) return result.data
  if (Array.isArray(result.records)) return result.records
  if (Array.isArray(result.quotations)) return result.quotations
  return []
}

function getItemCount(quotation) {
  if (Number.isFinite(quotation?.itemCount)) return quotation.itemCount
  if (Number.isFinite(quotation?.totalItems)) return quotation.totalItems
  if (Array.isArray(quotation?.items)) return quotation.items.length
  return 0
}

function formatStatusBadge(status) {
  const upper = String(status || "").toUpperCase()
  if (upper === "CONVERTED") {
    return {
      label: "CONVERTED TO SALE",
      className: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
    }
  }
  if (upper === "CANCELLED" || upper === "REJECTED") {
    return {
      label: "CANCELLED",
      className: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800",
    }
  }
  return {
    label: "QUOTED",
    className: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  }
}

export default function QuotationsPage({ selectedBranch, user }) {
  const branchName = selectedBranch?.name || user?.branch?.name || "Selected Branch"
  const branchId = selectedBranch?.id || user?.branch?.id || user?.branchId || ""

  const [quotations, setQuotations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedQuotation, setSelectedQuotation] = useState(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false)

  const loadQuotations = useCallback(async () => {
    setIsLoading(true)
    setMessage("")
    try {
      const params = branchId ? { branchId, limit: 100 } : { limit: 100 }
      const response = await getQuotations(params)
      const rows = getQuotationRows(response)
      setQuotations(rows)
      if (rows.length === 0) {
        setMessage("No quotations recorded yet for this branch.")
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not load quotations."
      setQuotations([])
      setMessage(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadQuotations()
  }, [loadQuotations])

  const filteredQuotations = useMemo(() => {
    let list = quotations

    if (statusFilter === "QUOTED") {
      list = list.filter((q) => q.status === "DRAFT" || q.status === "APPROVED" || q.status === "QUOTED")
    } else if (statusFilter === "CONVERTED") {
      list = list.filter((q) => q.status === "CONVERTED")
    } else if (statusFilter === "CANCELLED") {
      list = list.filter((q) => q.status === "CANCELLED")
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((item) => {
        const code = String(item.quotationCode || "").toLowerCase()
        const customer = String(item.customer?.fullName || item.customerName || "").toLowerCase()
        const prepared = String(item.preparedBy?.fullName || item.preparedByName || "").toLowerCase()
        return code.includes(q) || customer.includes(q) || prepared.includes(q)
      })
    }

    return list
  }, [quotations, statusFilter, searchQuery])

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalQuotedAmount = 0
    let quotedCount = 0
    let convertedCount = 0

    quotations.forEach((q) => {
      const amt = Number(q.grandTotal || q.totalAmount || 0)
      if (q.status === "DRAFT" || q.status === "APPROVED" || q.status === "QUOTED") {
        totalQuotedAmount += amt
        quotedCount += 1
      } else if (q.status === "CONVERTED") {
        convertedCount += 1
      }
    })

    return {
      totalCount: quotations.length,
      totalQuotedAmount,
      quotedCount,
      convertedCount,
    }
  }, [quotations])

  const handleOpenView = async (quotation) => {
    setIsLoadingDetails(true)
    try {
      const response = await getQuotationById(quotation.id)
      const detailed = response?.data || quotation
      setSelectedQuotation(detailed)
      setIsPrintPreviewOpen(true)
    } catch {
      setSelectedQuotation(quotation)
      setIsPrintPreviewOpen(true)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleDeleteQuotation = async (quotation) => {
    if (!quotation?.id) return
    const ok = window.confirm(
      `Are you sure you want to delete / cancel Quotation ${quotation.quotationCode || ""}? This action cannot be undone.`
    )
    if (!ok) return

    try {
      await updateQuotationStatus(quotation.id, {
        status: "CANCELLED",
        remarks: "Cancelled/Deleted from quotation records archive",
      })
      await loadQuotations()
    } catch (err) {
      alert(err?.response?.data?.message || err?.response?.data?.error?.message || "Failed to delete quotation.")
    }
  }

  return (
    <section className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-soft)]/40 to-[var(--color-card)] p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-[var(--color-maroon)]/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
                Quotation Records
              </span>
              <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-[var(--color-text-strong)]">
                {branchName}
              </span>
            </div>
            <h1 className="mt-2.5 text-3xl font-black tracking-tight text-[var(--color-text-strong)]">
              Quotation History & Archive
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Historical archive of quotations generated from POS Cashiering. View itemized lines, print official quotation copies, or delete records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
              disabled={isLoading}
              onClick={loadQuotations}
              type="button"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
              {isLoading ? "Refreshing..." : "Refresh Records"}
            </button>
          </div>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <FileSpreadsheet size={20} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
                Total Quotations
              </p>
              <p className="mt-1 font-mono text-2xl font-black text-[var(--color-text-strong)]">
                {metrics.totalCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-amber-600 text-white">
              <FileText size={20} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Active Quoted Total
              </p>
              <p className="mt-1 font-mono text-2xl font-black text-[var(--color-text-strong)]">
                ₱{money(metrics.totalQuotedAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-emerald-600 text-white">
              <FileCheck2 size={20} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Converted to Sales
              </p>
              <p className="mt-1 font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {metrics.convertedCount} Quotation{metrics.convertedCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Records Table Container */}
      <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
        {/* Filters Header */}
        <div className="grid gap-3 border-b border-[var(--color-border)] p-4 md:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} />
            <input
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-3 pl-10 pr-4 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quotation number, customer name, encoder..."
              value={searchQuery}
            />
          </label>

          <select
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="ALL">All Statuses</option>
            <option value="QUOTED">Quoted</option>
            <option value="CONVERTED">Converted to Sale</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {message && quotations.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-[var(--color-muted)]">
            {message}
          </div>
        ) : null}

        {isLoading ? (
          <div className="p-8 text-center text-sm font-semibold text-[var(--color-muted)]">
            Loading quotation records...
          </div>
        ) : null}

        {!isLoading && filteredQuotations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[var(--color-soft)] text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="px-5 py-4">Quotation No.</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-center">Items</th>
                  <th className="px-5 py-4">Prepared By</th>
                  <th className="px-5 py-4 text-right">Grand Total</th>
                  <th className="px-5 py-4">Date Quoted</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredQuotations.map((quotation) => {
                  const badge = formatStatusBadge(quotation.status)
                  return (
                    <tr
                      className="transition hover:bg-[var(--color-soft)]/50"
                      key={quotation.id}
                    >
                      <td className="px-5 py-4 font-mono font-bold text-sm text-[var(--color-text-strong)]">
                        {quotation.quotationCode || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-sm text-[var(--color-text-strong)]">
                          {quotation.customer?.fullName || quotation.customerName || "Walk-in Customer"}
                        </p>
                        {quotation.customer?.mobileNo ? (
                          <p className="text-xs text-[var(--color-muted)]">{quotation.customer.mobileNo}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-mono font-bold text-xs text-[var(--color-text-strong)]">
                        {getItemCount(quotation)}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-[var(--color-muted)]">
                        <div className="flex items-center gap-1.5">
                          <User size={13} />
                          <span>{quotation.preparedBy?.fullName || quotation.preparedByName || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-black text-sm text-[var(--color-text-strong)]">
                        ₱{money(quotation.grandTotal || quotation.totalAmount)}
                      </td>
                      <td className="px-5 py-4 text-xs text-[var(--color-muted)]">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} />
                          <span>{formatDate(quotation.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
                            disabled={isLoadingDetails}
                            onClick={() => handleOpenView(quotation)}
                            title="View quotation details"
                            type="button"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>

                          <button
                            className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
                            disabled={isLoadingDetails}
                            onClick={() => handleOpenView(quotation)}
                            title="Print quotation copy"
                            type="button"
                          >
                            <Printer size={13} />
                            <span>Print</span>
                          </button>

                          {quotation.status !== "CANCELLED" && quotation.status !== "CONVERTED" ? (
                            <button
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                              onClick={() => handleDeleteQuotation(quotation)}
                              title="Delete / Cancel quotation"
                              type="button"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoading && quotations.length > 0 && filteredQuotations.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-[var(--color-muted)]">
            No quotations match the selected status or search filter.
          </div>
        ) : null}
      </div>

      {/* VIEW & PRINT MODAL */}
      {isPrintPreviewOpen && selectedQuotation ? (
        <QuotationDetailDialog
          onClose={() => setIsPrintPreviewOpen(false)}
          quotation={selectedQuotation}
        />
      ) : null}
    </section>
  )
}
