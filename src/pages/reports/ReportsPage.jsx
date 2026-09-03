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
    label: "All Accounts Sales & Service Activity Maintenance",
    statuses: ["ACTIVE", "PENDING", "DISABLED", "REJECTED"],
    supportsSearch: true,
    columns: [
      ["Staff Member", (row) => row.fullName],
      ["Role", (row) => getRoleLabel(row.role)],
      ["Branch", (row) => row.branch?.code || "—"],
      ["Total Sales", (row) => `${number(row.completedSales)} (${peso(row.salesRevenue)})`],
      ["Solo Sales %", (row) => `${row.soloIncentivePercent ?? 0}%`],
      ["Solo Commission", (row) => peso(row.soloIncentiveAmount)],
      ["Total Services", (row) => `${number(row.completedServices)} (${peso(row.serviceRevenue)})`],
      ["Service Commission", (row) => peso(row.serviceIncentiveAmount)],
      ["Total Incentives", (row) => peso(row.totalIncentiveAmount)],
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
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [staffModalTab, setStaffModalTab] = useState("sales")

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

const REPORT_CATEGORIES = [
  {
    id: "staff",
    label: "Staff & Incentives",
    icon: "👥",
    reports: [
      { key: "staff", label: "Staff Sales & Solo Incentives" },
      { key: "incentives", label: "Incentive Ledger" },
      { key: "incentiveClaims", label: "Incentive Claims & Payouts" },
    ],
  },
  {
    id: "sales_finance",
    label: "Sales & Financials",
    icon: "💰",
    reports: [
      { key: "sales", label: "Product & Overall Sales" },
      { key: "financial", label: "Unified Financial Summary" },
      { key: "credits", label: "Credits & Installments (AR)" },
      { key: "cash", label: "Cash Box Transactions" },
    ],
  },
  {
    id: "services",
    label: "Services & Warranty",
    icon: "🛠️",
    reports: [
      { key: "services", label: "Service Jobs & Repairs" },
      { key: "warranty", label: "Warranty Claims" },
    ],
  },
  {
    id: "inventory_supply",
    label: "Inventory & Purchasing",
    icon: "📦",
    reports: [
      { key: "inventory", label: "Inventory Stock" },
      { key: "purchaseOrders", label: "Purchase Orders" },
      { key: "receivings", label: "Receiving Deliveries" },
      { key: "transfers", label: "Stock Transfers" },
      { key: "suppliers", label: "Supplier Purchases" },
    ],
  },
]

  const activeCategory =
    REPORT_CATEGORIES.find((cat) =>
      cat.reports.some((r) => r.key === reportKey)
    ) || REPORT_CATEGORIES[0]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* 1. Clean Minimalist Navigation Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{config.label}</span>
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              {reportBranchId
                ? branches.find((b) => b.id === reportBranchId)?.name || selectedBranch?.name || user?.branch?.name || "Selected branch"
                : isSuperOwner
                  ? "All Branches Summary"
                  : selectedBranch?.name || user?.branch?.name || "Branch Report"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
              disabled={isLoading || isExportingPdf}
              onClick={handleExportPdf}
              type="button"
            >
              {isExportingPdf ? "Exporting..." : "Export PDF"}
            </button>

            <button
              className="rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition shadow-2xs"
              disabled={isLoading || isExportingPdf}
              onClick={loadReport}
              type="button"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Primary Category Switcher (Clean Segmented Bar) */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/70 rounded-2xl w-fit">
            {REPORT_CATEGORIES.map((cat) => {
              const isCatActive = cat.id === activeCategory.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    const firstReport = cat.reports[0].key
                    setReportKey(firstReport)
                    setStatus("")
                    setSearch("")
                    setPage(1)
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    isCatActive
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>

          {/* Sub-report Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {activeCategory.reports.map((r) => {
              const isSelected = reportKey === r.key
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    setReportKey(r.key)
                    setStatus("")
                    setSearch("")
                    setPage(1)
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-[var(--color-maroon)] text-white shadow-2xs font-bold"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
                  }`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 2. Sleek Filter Strip */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Range Pills */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">Period:</span>
            {[
              { label: "Today", days: 0 },
              { label: "7 Days", days: 7 },
              { label: "30 Days", days: 30 },
              { label: "All Time", days: -1 },
            ].map((preset) => {
              const isActive =
                preset.days === -1
                  ? !dateFrom && !dateTo
                  : preset.days === 0
                    ? dateFrom === new Date().toISOString().slice(0, 10) && dateTo === new Date().toISOString().slice(0, 10)
                    : false
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    if (preset.days === -1) {
                      setDateFrom("")
                      setDateTo("")
                    } else if (preset.days === 0) {
                      const today = new Date().toISOString().slice(0, 10)
                      setDateFrom(today)
                      setDateTo(today)
                    } else {
                      const end = new Date()
                      const start = new Date()
                      start.setDate(start.getDate() - preset.days)
                      setDateFrom(start.toISOString().slice(0, 10))
                      setDateTo(end.toISOString().slice(0, 10))
                    }
                    setPage(1)
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          {/* Controls: Branch, Status, Search */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            {isSuperOwner ? (
              <select
                aria-label="Report branch"
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                onChange={(e) => { setReportBranchId(e.target.value); setPage(1) }}
                value={reportBranchId}
              >
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
              </select>
            ) : null}

            {config.statuses.length > 0 ? (
              <select
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                value={status}
              >
                <option value="">{config.filterLabel || "All Statuses"}</option>
                {config.statuses.map((v) => <option key={v} value={v}>{formatWord(v)}</option>)}
              </select>
            ) : null}

            {config.supportsSearch ? (
              <input
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)] placeholder:text-slate-400 min-w-[180px]"
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search records..."
                type="text"
                value={search}
              />
            ) : null}
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {/* 3. Financial Summary Special Panel */}
      {reportKey === "financial" && result?.data?.report ? (
        <FinancialSummaryPanel report={result.data.report} />
      ) : null}

      {/* 4. Minimalist Metric Cards */}
      {reportKey !== "financial" && primitiveTotals.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {primitiveTotals.map(([key, value]) => (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs" key={key}>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {labelForKey(key)}
              </p>
              <p className="mt-1 text-xl font-black text-slate-900 tracking-tight">
                {MONEY_KEY.test(key) ? peso(value) : number(value)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* 5. Clean Modern Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800 text-sm">{config.label}</h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {meta.totalItems || records.length} records
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Page {meta.page || page} of {meta.totalPages || 1}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">
              <tr>
                {config.columns.map(([label]) => (
                  <th className="px-4 py-3" key={label}>
                    {label}
                  </th>
                ))}
                {reportKey === "staff" ? (
                  <th className="px-4 py-3 text-right">Details</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400 font-semibold" colSpan={config.columns.length + (reportKey === "staff" ? 1 : 0)}>
                    Loading report data...
                  </td>
                </tr>
              ) : null}
              {!isLoading && records.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400 font-semibold" colSpan={config.columns.length + (reportKey === "staff" ? 1 : 0)}>
                    No records found for the selected criteria.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? records.map((row) => (
                    <tr
                      className={`transition ${reportKey === "staff" ? "cursor-pointer hover:bg-slate-50/80" : "hover:bg-slate-50/50"}`}
                      key={row.id}
                      onClick={() => {
                        if (reportKey === "staff") {
                          setSelectedStaff(row)
                          setStaffModalTab("sales")
                        }
                      }}
                    >
                      {config.columns.map(([label, render]) => (
                        <td className="px-4 py-3 font-medium text-slate-700" key={label}>
                          {render(row) ?? "—"}
                        </td>
                      ))}
                      {reportKey === "staff" ? (
                        <td className="px-4 py-3 text-right">
                          <button
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedStaff(row)
                              setStaffModalTab("sales")
                            }}
                            type="button"
                          >
                            View
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/30">
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition"
            disabled={!meta.hasPreviousPage}
            onClick={() => setPage((v) => Math.max(v - 1, 1))}
            type="button"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-500 font-medium">
            Page {meta.page || page} of {meta.totalPages || 1}
          </span>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition"
            disabled={!meta.hasNextPage}
            onClick={() => setPage((v) => v + 1)}
            type="button"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Staff Detailed Sales & Services Activity Modal */}
      {selectedStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-red-50 via-white to-slate-50 p-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-[var(--color-maroon)] px-2.5 py-0.5 text-xs font-black uppercase text-white tracking-wider">
                    Staff Activity Breakdown
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {selectedStaff.branch?.name || "Global Branch"}
                  </span>
                </div>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  {selectedStaff.fullName}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {getRoleLabel(selectedStaff.role)} · Username: {selectedStaff.username} {selectedStaff.employeeCode ? `· ID: ${selectedStaff.employeeCode}` : ""}
                </p>
              </div>
              <button
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition"
                onClick={() => setSelectedStaff(null)}
                type="button"
              >
                ✕
              </button>
            </div>

            {/* Top KPI Metrics Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 bg-slate-50/70 border-b border-slate-100">
              <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-black uppercase text-slate-500">🛒 Naibenta (Sales)</p>
                <p className="mt-1 text-lg font-black text-slate-900">{peso(selectedStaff.salesRevenue)}</p>
                <p className="text-[11px] text-slate-500 font-semibold">{number(selectedStaff.completedSales)} transaction(s)</p>
              </div>
              <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-black uppercase text-slate-500">🛠️ Sinervice (Repairs)</p>
                <p className="mt-1 text-lg font-black text-slate-900">{peso(selectedStaff.serviceRevenue)}</p>
                <p className="text-[11px] text-slate-500 font-semibold">{number(selectedStaff.completedServices)} service job(s)</p>
              </div>
              <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-black uppercase text-slate-500">🎁 Solo Incentive</p>
                <p className="mt-1 text-lg font-black text-green-700">{peso(selectedStaff.soloIncentiveAmount)}</p>
                <p className="text-[11px] text-slate-500 font-semibold">Rate: {selectedStaff.soloIncentivePercent ?? 0}%</p>
              </div>
              <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-black uppercase text-slate-500">💰 Total Komisyon</p>
                <p className="mt-1 text-lg font-black text-[var(--color-maroon)]">{peso(selectedStaff.totalIncentiveAmount)}</p>
                <p className="text-[11px] text-slate-500 font-semibold">Service Rate: {selectedStaff.serviceIncentivePercent ?? 0}%</p>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-slate-200 bg-white px-6 pt-3 gap-2">
              <button
                className={`pb-3 text-xs font-black transition border-b-2 px-3 ${staffModalTab === "sales" ? "border-[var(--color-maroon)] text-[var(--color-maroon)]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setStaffModalTab("sales")}
                type="button"
              >
                🛒 Lahat ng Benta ({selectedStaff.recentSales?.length || 0})
              </button>
              <button
                className={`pb-3 text-xs font-black transition border-b-2 px-3 ${staffModalTab === "services" ? "border-[var(--color-maroon)] text-[var(--color-maroon)]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setStaffModalTab("services")}
                type="button"
              >
                🛠️ Lahat ng Sinervice ({selectedStaff.recentServices?.length || 0})
              </button>
            </div>

            {/* Activity Table Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {staffModalTab === "sales" ? (
                <div>
                  {selectedStaff.recentSales?.length === 0 ? (
                    <p className="text-center text-xs font-bold text-slate-400 py-8">
                      Walang recorded na benta ang account na ito sa piniling date range.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Sale Code</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Gross Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedStaff.recentSales.map((s) => (
                            <tr className="hover:bg-slate-50/50" key={s.id}>
                              <td className="px-4 py-3 font-bold text-[var(--color-maroon)]">{s.saleCode}</td>
                              <td className="px-4 py-3 font-semibold text-slate-600">{formatDate(s.saleDate)}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{s.customerName}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-green-50 text-green-700 px-2 py-0.5 text-[10px] font-black uppercase">
                                  {s.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-slate-900">{peso(s.grandTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {selectedStaff.recentServices?.length === 0 ? (
                    <p className="text-center text-xs font-bold text-slate-400 py-8">
                      Walang recorded na service / repair jobs ang account na ito sa piniling date range.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Job Code</th>
                            <th className="px-4 py-3">Date Received</th>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Device & Problem</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Labor / Service Fee</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedStaff.recentServices.map((j) => (
                            <tr className="hover:bg-slate-50/50" key={j.id}>
                              <td className="px-4 py-3 font-bold text-[var(--color-maroon)]">{j.jobCode}</td>
                              <td className="px-4 py-3 font-semibold text-slate-600">{formatDate(j.receivedAt)}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{j.customerName}</td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-800">{j.itemSummary}</p>
                                <p className="text-[11px] text-slate-500">{j.defectSummary}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-black uppercase">
                                  {j.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-slate-900">{peso(j.finalServiceCharge)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                onClick={() => setSelectedStaff(null)}
                type="button"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

