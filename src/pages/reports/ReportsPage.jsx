import { useCallback, useEffect, useMemo, useState } from "react"

import { getReport } from "../../features/reports/reports.api"
import { getBranches } from "../../features/branches/branches.api"
import FinancialSummaryPanel from "./FinancialSummaryPanel"
import { exportReportPdf } from "../../utils/businessDocumentExport"
import { getRoleLabel } from "../../constants/roles"

function formatWord(value) {
  if (!value) return "—"
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

const REPORTS = Object.freeze({
  financial: {
    label: "Unified Financial Summary",
    statuses: [],
    columns: [
      ["Event", (row) => formatWord(row.eventType)],
      ["Manila date", (row) => formatDate(row.eventDate)],
      ["Source", (row) => row.sourceCode || row.sourceId],
      ["Branch", (row) => row.branch?.code],
      ["Revenue effect", (row) => peso(row.revenueEffect)],
      ["Settlement effect", (row) => peso(row.settlementEffect)],
      ["Cash effect", (row) => peso(row.cashEffect)],
      ["AR originated", (row) => peso(row.arOriginatedEffect)],
      ["AR collection effect", (row) => peso(row.arCollectionEffect)],
    ],
  },
  sales: {
    label: "External Product / Overall Sales",
    statuses: ["COMPLETED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"],
    columns: [
      ["Receipt", (row) => row.receiptCode],
      ["Date", (row) => formatDate(row.saleDate)],
      ["Branch", (row) => row.branch?.code],
      ["Customer", (row) => row.customer?.fullName || "Walk-in"],
      ["Status", (row) => formatWord(row.status)],
      ["Product", (row) => peso(row.netProductRevenue)],
      ["Branch COGS", (row) => peso(row.netOperationalProductCost)],
      ["Branch margin", (row) => peso(row.branchProductMargin)],
      ["Acquisition COGS", (row) => peso(row.netAcquisitionProductCost)],
      ["Company margin", (row) => peso(row.consolidatedProductMargin)],
      ["Service", (row) => peso(row.netServiceRevenue)],
      ["Refunded", (row) => peso(row.totalRefundAmount)],
      ["Net overall", (row) => peso(row.netGrandTotal)],
    ],
  },
  services: {
    label: "Services / Job Orders",
    statuses: ["PENDING", "IN_PROGRESS", "READY_FOR_RELEASE", "COMPLETED", "CANCELLED"],
    columns: [
      ["Job", (row) => row.jobCode],
      ["Received", (row) => formatDate(row.receivedAt)],
      ["Customer", (row) => row.customer?.fullName || "Walk-in"],
      ["Received by", (row) => row.receivedBy?.fullName || "Unrecorded"],
      ["Assigned", (row) => row.assignedTechnician?.fullName || "Unassigned"],
      ["Quick", (row) => row.isQuickService ? "YES" : "NO"],
      ["Status", (row) => formatWord(row.status)],
      ["Release outcome", (row) => formatWord(row.releaseOutcome) || "Not released"],
      ["Payment", (row) => formatWord(row.paymentState)],
      ["Last action", (row) => row.lastAction?.actor?.fullName
        ? `${formatWord(row.lastAction.action)} · ${row.lastAction.actor.fullName}`
        : formatWord(row.lastAction?.action)],
      ["Service charge", (row) => peso(row.finalServiceCharge)],
    ],
  },
  inventory: {
    label: "Inventory",
    statuses: ["ACTIVE", "INACTIVE", "DISCONTINUED"],
    supportsSearch: true,
    columns: [
      ["Item", (row) => `${row.itemCode} — ${row.itemName}`],
      ["Branch", (row) => row.branch?.code],
      ["Available", (row) => number(row.quantityAvailable)],
      ["Batches", (row) => number(row.batchCount)],
      ["Serials", (row) => number(row.serialCount)],
      ["Stock state", (row) => (row.isZeroStock ? "Out of stock" : row.isLowStock ? "Low stock" : "Healthy")],
    ],
  },
  warranty: {
    label: "Warranty",
    statuses: ["IN", "CHECKING", "SENT_TO_SUPPLIER", "APPROVED", "REJECTED", "REPAIRED", "REPLACED", "OUT"],
    columns: [
      ["Claim", (row) => row.claimCode],
      ["Received", (row) => formatDate(row.receivedAt)],
      ["Item", (row) => row.item?.itemName || "Unlinked item"],
      ["Customer", (row) => row.customer?.fullName || "Walk-in"],
      ["Supplier", (row) => row.supplierName || "—"],
      ["Status", (row) => formatWord(row.status)],
    ],
  },
  cash: {
    label: "Cash",
    statuses: ["POSTED", "CANCELLED"],
    columns: [
      ["Transaction", (row) => row.transactionCode],
      ["Date", (row) => formatDate(row.transactionDate)],
      ["Branch", (row) => row.branch?.code],
      ["Type", (row) => formatWord(row.type)],
      ["Status", (row) => formatWord(row.status)],
      ["Amount", (row) => peso(row.amount)],
    ],
  },
  credits: {
    label: "Credits / Installments",
    statuses: ["ACTIVE", "PAID", "CANCELLED", "DEFAULTED"],
    supportsSearch: true,
    columns: [
      ["Credit", (row) => row.creditCode],
      ["Customer", (row) => row.customer?.fullName],
      ["Branch", (row) => row.branch?.code],
      ["Next due", (row) => formatDate(row.nextDueDate)],
      ["Status", (row) => row.isOverdue ? "Overdue" : formatWord(row.status)],
      ["Remaining", (row) => peso(row.remainingBalance)],
    ],
  },
  incentives: {
    label: "Incentives",
    statuses: ["POSTED", "REVERSED"],
    filterLabel: "All ledger statuses",
    columns: [
      ["Source", (row) => row.sourceCode],
      ["Date", (row) => formatDate(row.sourceDate)],
      ["Staff", (row) => row.staff?.fullName],
      ["Branch", (row) => row.branch?.code],
      ["Type", (row) => formatWord(row.sourceType)],
      ["Status", (row) => formatWord(row.status)],
      ["Incentive", (row) => peso(row.amount)],
    ],
  },
  incentiveClaims: {
    label: "Incentive Claims",
    statuses: ["UNCLAIMED", "CLAIMED", "APPROVED", "PAID", "EXPIRED"],
    columns: [
      ["Period", (row) => row.cycle?.periodCode || row.cycle?.cycleCode],
      ["Employee", (row) => row.staff?.fullName],
      ["Branch", (row) => row.branch?.code],
      ["Classification", (row) => formatWord(row.classification) || "Mixed"],
      ["Product basis", (row) => peso(row.productBasis)],
      ["Product incentive", (row) => peso(row.productIncentive)],
      ["Service basis", (row) => peso(row.serviceBasis)],
      ["Service incentive", (row) => peso(row.serviceIncentive)],
      ["Total", (row) => peso(row.totalIncentive)],
      ["Claim status", (row) => formatWord(row.status)],
      ["Claimed", (row) => formatDate(row.claimedAt)],
      ["Approved by", (row) => row.approvedBy?.fullName || "—"],
      ["Paid", (row) => formatDate(row.paidAt)],
    ],
  },
  staff: {
    label: "Staff Sales & Solo Incentive Performance",
    statuses: ["ACTIVE", "PENDING", "DISABLED", "REJECTED"],
    supportsSearch: true,
    columns: [
      ["Staff Member", (row) => row.fullName],
      ["Role", (row) => getRoleLabel(row.role)],
      ["Branch", (row) => row.branch?.code || "—"],
      ["Completed Sales", (row) => number(row.completedSales)],
      ["Total Gross Sales", (row) => peso(row.salesRevenue)],
      ["Solo Incentive %", (row) => `${row.soloIncentivePercent ?? 1}%`],
      ["Solo Incentive Earned", (row) => peso(row.soloIncentiveAmount)],
      ["Completed Services", (row) => number(row.completedServices)],
      ["Total Attributed Revenue", (row) => peso(row.totalAttributedRevenue)],
    ],
  },
  suppliers: {
    label: "Supplier Purchases",
    statuses: ["ACTIVE", "INACTIVE"],
    supportsSearch: true,
    columns: [
      ["Supplier", (row) => `${row.supplierCode} — ${row.name}`],
      ["Branch", (row) => row.branch?.code || "Global"],
      ["Status", (row) => formatWord(row.status)],
      ["PO count", (row) => number(row.totalPurchaseOrders)],
      ["PO value", (row) => peso(row.totalPoGrandTotal)],
      ["Received value", (row) => peso(row.totalReceivingGrandTotal)],
    ],
  },
  purchaseOrders: {
    label: "Purchase Orders",
    statuses: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
    supportsSearch: true,
    columns: [
      ["PO", (row) => row.poCode],
      ["Date", (row) => formatDate(row.orderDate)],
      ["Supplier", (row) => row.supplier?.name || row.supplierNameSnapshot],
      ["Branch", (row) => row.branch?.code],
      ["Status", (row) => formatWord(row.status)],
      ["Total", (row) => peso(row.grandTotal)],
    ],
  },
  receivings: {
    label: "Receiving / Deliveries",
    statuses: ["DRAFT", "POSTED", "CANCELLED"],
    supportsSearch: true,
    columns: [
      ["Receiving", (row) => row.receivingCode],
      ["Date", (row) => formatDate(row.receivingDate)],
      ["Supplier", (row) => row.supplier?.name || row.supplierNameSnapshot],
      ["Branch", (row) => row.branch?.code],
      ["Status", (row) => formatWord(row.status)],
      ["Total", (row) => peso(row.grandTotal)],
    ],
  },
  transfers: {
    label: "Stock Transfers",
    statuses: ["DRAFT", "REQUESTED", "APPROVED", "REJECTED", "POSTED", "CANCELLED"],
    supportsSearch: true,
    columns: [
      ["Transfer", (row) => row.transferCode],
      ["Date", (row) => formatDate(row.transferDate)],
      ["From", (row) => row.fromBranch?.code],
      ["To", (row) => row.toBranch?.code],
      ["Status", (row) => formatWord(row.status)],
      ["Quantity", (row) => number(row.totalQuantity)],
      ["Agreed value", (row) => peso(row.totalAgreedAmount)],
      ["Transfer sale", (row) => peso(row.outgoingTransferSales)],
      ["Transfer purchase", (row) => peso(row.incomingTransferPurchases)],
      ["Acquisition cost", (row) => peso(row.totalAcquisitionCost)],
      ["Source margin", (row) => peso(row.sourceInternalMargin)],
    ],
  },
})

const MONEY_KEY = /(amount|charge|subtotal|discount|grandtotal|cashmovement|value|balance|remaining|revenue|collected|basis|incentive|cost|margin|price|outgoingtransfersales|incomingtransferpurchases|elimination)/i

function number(value) {
  return Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })
}

function peso(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })
}

function labelForKey(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase())
}

function apiError(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error?.message || fallback
}

export default function ReportsPage({ selectedBranch, user }) {
  const [reportKey, setReportKey] = useState("financial")
  const [status, setStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")
  const [isQuickService, setIsQuickService] = useState("")
  const [releaseOutcome, setReleaseOutcome] = useState("")
  const [releasedOnly, setReleasedOnly] = useState("")
  const [incentiveClassification, setIncentiveClassification] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [branches, setBranches] = useState([])
  const [reportBranchId, setReportBranchId] = useState(
    selectedBranch?.id || user?.branchId || user?.branch?.id || "",
  )

  const isSuperOwner = user?.role === "SUPER_OWNER"
  const config = REPORTS[reportKey]

  useEffect(() => {
    if (!isSuperOwner) return undefined
    let active = true
    const loadBranches = async () => {
      try {
        const response = await getBranches()
        if (active) setBranches(Array.isArray(response?.data) ? response.data.filter((branch) => branch.status === "ACTIVE") : [])
      } catch {
        if (active) setBranches([])
      }
    }
    loadBranches()
    return () => {
      active = false
    }
  }, [isSuperOwner])

  const loadReport = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await getReport(reportKey, {
        ...(reportBranchId ? { branchId: reportBranchId } : {}),
        ...(status ? { [config.statusParam || "status"]: status } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(config.supportsSearch && search.trim() ? { search: search.trim() } : {}),
        ...(reportKey === "services" && isQuickService ? { isQuickService } : {}),
        ...(reportKey === "services" && releaseOutcome ? { releaseOutcome } : {}),
        ...(reportKey === "services" && releasedOnly ? { releasedOnly } : {}),
        ...(reportKey === "incentiveClaims" && incentiveClassification
          ? { classification: incentiveClassification }
          : {}),
        page,
        limit: 20,
      })

      setResult({ data: response?.data || {}, meta: response?.meta || {} })
    } catch (error) {
      setResult(null)
      setErrorMessage(apiError(error, "Could not load the selected report."))
    } finally {
      setIsLoading(false)
    }
  }, [config.statusParam, config.supportsSearch, dateFrom, dateTo, incentiveClassification, isQuickService, page, releaseOutcome, releasedOnly, reportBranchId, reportKey, search, status])

  useEffect(() => {
    const timer = window.setTimeout(loadReport, 0)
    return () => window.clearTimeout(timer)
  }, [loadReport])

  const setDatePreset = (preset) => {
    const today = new Date()
    const formatDateStr = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      return `${year}-${month}-${day}`
    }

    if (preset === "TODAY") {
      const todayStr = formatDateStr(today)
      setDateFrom(todayStr)
      setDateTo(todayStr)
    } else if (preset === "WEEK") {
      const startOfWeek = new Date(today)
      const dayOfWeek = today.getDay()
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      startOfWeek.setDate(diff)
      setDateFrom(formatDateStr(startOfWeek))
      setDateTo(formatDateStr(today))
    } else if (preset === "MONTH") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      setDateFrom(formatDateStr(startOfMonth))
      setDateTo(formatDateStr(today))
    } else if (preset === "ALL") {
      setDateFrom("")
      setDateTo("")
    }
    setPage(1)
  }

  const primitiveTotals = useMemo(() => {
    const totals = result?.data?.report?.totals || {}
    return Object.entries(totals).filter(([, value]) => typeof value === "number").slice(0, 8)
  }, [result])

  const records = result?.data?.records || []
  const meta = result?.meta || {}

  const handleExportPdf = async () => {
    if (isExportingPdf) return

    setIsExportingPdf(true)
    setErrorMessage("")

    try {
      const exportRecords = []
      let exportPage = 1
      let exportTotalPages = 1
      let exportReportData = result?.data?.report || {}

      do {
        const response = await getReport(reportKey, {
          ...(reportBranchId ? { branchId: reportBranchId } : {}),
          ...(status ? { [config.statusParam || "status"]: status } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          ...(config.supportsSearch && search.trim()
            ? { search: search.trim() }
            : {}),
          ...(reportKey === "services" && isQuickService
            ? { isQuickService }
            : {}),
          ...(reportKey === "services" && releaseOutcome
            ? { releaseOutcome }
            : {}),
          ...(reportKey === "services" && releasedOnly
            ? { releasedOnly }
            : {}),
          ...(reportKey === "incentiveClaims" &&
          incentiveClassification
            ? { classification: incentiveClassification }
            : {}),
          page: exportPage,
          limit: 100,
        })

        const pageRecords = Array.isArray(
          response?.data?.records,
        )
          ? response.data.records
          : []

        exportRecords.push(...pageRecords)

        if (response?.data?.report) {
          exportReportData = response.data.report
        }

        exportTotalPages = Math.max(
          1,
          Number(response?.meta?.totalPages || 1),
        )

        exportPage += 1
      } while (exportPage <= exportTotalPages)

      const selectedReportBranch = reportBranchId
        ? branches.find(
            (branch) => branch.id === reportBranchId,
          ) ||
          (selectedBranch?.id === reportBranchId
            ? selectedBranch
            : user?.branch?.id === reportBranchId
              ? user.branch
              : null)
        : null

      const rawTotals = exportReportData?.totals || {}

      const exportTotals = Object.entries(rawTotals)
        .filter(([, value]) => typeof value === "number")
        .map(([key, value]) => [
          labelForKey(key),
          MONEY_KEY.test(key) ? peso(value) : number(value),
        ])

      const exportFilters = [
        [
          "Report",
          config.label,
        ],
        [
          "Status",
          status
            ? status.replaceAll("_", " ")
            : config.filterLabel || "All statuses",
        ],
        [
          "Date from",
          dateFrom || "Beginning",
        ],
        [
          "Date to",
          dateTo || "Latest",
        ],
      ]

      if (config.supportsSearch) {
        exportFilters.push([
          "Search",
          search.trim() || "All matching records",
        ])
      }

      if (reportKey === "services") {
        exportFilters.push(
          [
            "Service type",
            isQuickService === "true"
              ? "Quick services only"
              : isQuickService === "false"
                ? "Standard jobs only"
                : "All standard and quick jobs",
          ],
          [
            "Release outcome",
            releaseOutcome
              ? releaseOutcome.replaceAll("_", " ")
              : "All release outcomes",
          ],
          [
            "Release state",
            releasedOnly === "true"
              ? "Released only"
              : releasedOnly === "false"
                ? "Not released only"
                : "All release states",
          ],
        )
      }

      if (reportKey === "incentiveClaims") {
        exportFilters.push([
          "Incentive classification",
          incentiveClassification
            ? incentiveClassification.replaceAll("_", " ")
            : "All classifications",
        ])
      }

      exportFilters.push([
        "Matching records",
        number(exportRecords.length),
      ])

      exportReportPdf({
        label: config.label,
        columns: config.columns,
        records: exportRecords,
        totals: exportTotals,
        branch: selectedReportBranch,
        generatedBy: user,
        filters: exportFilters,
        filename: `${reportKey}-report-${new Date()
          .toISOString()
          .slice(0, 10)}`,
      })
    } catch (error) {
      setErrorMessage(
        apiError(
          error,
          "Could not export the selected report to PDF.",
        ),
      )
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-card">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">Monitoring</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-strong)]">Reports</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Live operational data with branch, status, and date filters.</p>
          </div>
          <p className="text-sm font-bold text-[var(--color-text-strong)]">
            {reportBranchId
              ? branches.find((branch) => branch.id === reportBranchId)?.name || selectedBranch?.name || user?.branch?.name || "Selected branch"
              : isSuperOwner
                ? "All branches"
                : selectedBranch?.name || user?.branch?.name || "Assigned branch"}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card">
        <div className={`grid gap-3 md:grid-cols-2 ${isSuperOwner ? "xl:grid-cols-7" : "xl:grid-cols-6"}`}>
          <select
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] xl:col-span-2"
            onChange={(event) => {
              setReportKey(event.target.value)
              setStatus("")
              setSearch("")
              setIsQuickService("")
              setReleaseOutcome("")
              setReleasedOnly("")
              setIncentiveClassification("")
              setPage(1)
            }}
            value={reportKey}
          >
            {Object.entries(REPORTS).map(([key, report]) => (
              <option key={key} value={key}>{report.label}</option>
            ))}
          </select>
          {isSuperOwner ? (
            <select
              aria-label="Report branch"
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
              onChange={(event) => { setReportBranchId(event.target.value); setPage(1) }}
              value={reportBranchId}
            >
              <option value="">All branches</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}
            </select>
          ) : null}
          {config.statuses.length > 0 ? (
            <select
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)] font-bold"
              onChange={(event) => { setStatus(event.target.value); setPage(1) }}
              value={status}
            >
              <option value="">{config.filterLabel || "All statuses"}</option>
              {config.statuses.map((value) => <option key={value} value={value}>{formatWord(value)}</option>)}
            </select>
          ) : null}
          <input
            aria-label="Report start date"
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
            onChange={(event) => { setDateFrom(event.target.value); setPage(1) }}
            type="date"
            value={dateFrom}
          />
          <input
            aria-label="Report end date"
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
            onChange={(event) => { setDateTo(event.target.value); setPage(1) }}
            type="date"
            value={dateTo}
          />
          <div className="flex min-w-0 gap-2">
            <button
              className="flex-1 rounded-2xl border border-[var(--color-maroon)] bg-[var(--color-card)] px-4 py-3 text-sm font-bold text-[var(--color-maroon)] hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading || isExportingPdf}
              onClick={handleExportPdf}
              type="button"
            >
              {isExportingPdf ? "Preparing PDF..." : "Export PDF"}
            </button>

            <button
              className="flex-1 rounded-2xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              disabled={isLoading || isExportingPdf}
              onClick={loadReport}
              type="button"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Date Presets Toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--color-border)]">
          <span className="text-xs font-bold text-[var(--color-muted)] mr-1">Quick Range:</span>
          <button
            type="button"
            onClick={() => setDatePreset("TODAY")}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-text-strong)] hover:border-[var(--color-maroon)] hover:text-[var(--color-maroon)] transition"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDatePreset("WEEK")}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-text-strong)] hover:border-[var(--color-maroon)] hover:text-[var(--color-maroon)] transition"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => setDatePreset("MONTH")}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-text-strong)] hover:border-[var(--color-maroon)] hover:text-[var(--color-maroon)] transition"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => setDatePreset("ALL")}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-text-strong)] hover:border-[var(--color-maroon)] hover:text-[var(--color-maroon)] transition"
          >
            All Time
          </button>
        </div>

        {config.supportsSearch ? (
          <input
            className="mt-3 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="Search this report"
            value={search}
          />
        ) : null}
        {reportKey === "services" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <select
              aria-label="Quick service filter"
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
              onChange={(event) => { setIsQuickService(event.target.value); setPage(1) }}
              value={isQuickService}
            >
              <option value="">All standard and quick jobs</option>
              <option value="true">Quick services only</option>
              <option value="false">Standard jobs only</option>
            </select>
            <select
              aria-label="Service release outcome"
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)] font-bold"
              onChange={(event) => { setReleaseOutcome(event.target.value); setPage(1) }}
              value={releaseOutcome}
            >
              <option value="">All release outcomes</option>
              {["REPAIRED", "SERVICE_COMPLETED", "UNREPAIRED", "CUSTOMER_PULL_OUT", "NO_FAULT_FOUND", "DECLINED", "OTHER"].map((value) => (
                <option key={value} value={value}>{formatWord(value)}</option>
              ))}
            </select>
            <select
              aria-label="Released job filter"
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
              onChange={(event) => { setReleasedOnly(event.target.value); setPage(1) }}
              value={releasedOnly}
            >
              <option value="">All release states</option>
              <option value="true">Released only</option>
              <option value="false">Not released only</option>
            </select>
          </div>
        ) : null}
        {reportKey === "incentiveClaims" ? (
          <select
            aria-label="Incentive classification"
            className="mt-3 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)] md:max-w-sm"
            onChange={(event) => { setIncentiveClassification(event.target.value); setPage(1) }}
            value={incentiveClassification}
          >
            <option value="">All incentive classifications</option>
            {[
              ["SALES_AGENT", "Sales Agent"],
              ["SENIOR_SALES_AGENT", "Senior Sales Agent"],
              ["TECHNICIAN", "Technician"],
              ["SENIOR_TECHNICIAN", "Senior Technician"],
            ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        ) : null}
      </section>

      {errorMessage ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{errorMessage}</div> : null}

      {reportKey === "financial" && result?.data?.report ? (
        <FinancialSummaryPanel report={result.data.report} />
      ) : null}

      {reportKey !== "financial" ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {primitiveTotals.map(([key, value]) => (
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card" key={key}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">{labelForKey(key)}</p>
            <p className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">
              {MONEY_KEY.test(key) ? peso(value) : number(value)}
            </p>
          </div>
        ))}
      </section> : null}

      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
        <div className="border-b border-[var(--color-border)] p-5">
          <h2 className="font-black text-[var(--color-text-strong)]">{config.label} records</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{meta.totalItems || 0} matching record(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
              <tr>{config.columns.map(([label]) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="px-4 py-8 text-center text-[var(--color-muted)]" colSpan={config.columns.length}>Loading report...</td></tr> : null}
              {!isLoading && records.length === 0 ? <tr><td className="px-4 py-8 text-center text-[var(--color-muted)]" colSpan={config.columns.length}>No records match the selected filters.</td></tr> : null}
              {!isLoading ? records.map((row) => (
                <tr className="border-t border-[var(--color-border)]" key={row.id}>
                  {config.columns.map(([label, render]) => <td className="px-4 py-4 font-semibold text-[var(--color-text-strong)]" key={label}>{render(row) ?? "—"}</td>)}
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--color-border)] p-4">
          <button className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-bold text-[var(--color-text-strong)] disabled:opacity-40" disabled={!meta.hasPreviousPage} onClick={() => setPage((value) => Math.max(value - 1, 1))} type="button">Previous</button>
          <span className="text-sm text-[var(--color-muted)]">Page {meta.page || page} of {meta.totalPages || 1}</span>
          <button className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-bold text-[var(--color-text-strong)] disabled:opacity-40" disabled={!meta.hasNextPage} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
        </div>
      </section>
    </div>
  )
}

