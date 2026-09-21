import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  Layers,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Repeat,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UserCheck,
  X,
} from "lucide-react"

import { exportReportExcel } from "../../utils/businessDocumentExport"

// --- Helper Date & Format Functions ---
function dateTime(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-PH")
}

function dateOnly(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PH")
}

function calculateAgingDays(dateValue) {
  if (!dateValue) return 0
  const start = new Date(dateValue).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)))
}

function formatStatus(status) {
  if (!status) return "—"
  return String(status)
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function statusTone(status) {
  if (status === "OUT") return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
  if (["REPAIRED", "REPLACED", "APPROVED"].includes(status))
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
  if (status === "REJECTED")
    return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
  if (status === "SENT_TO_SUPPLIER")
    return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800"
  if (status === "CHECKING")
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
  return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800"
}

// Preset Timeframe Options
const TIMEFRAME_OPTIONS = [
  { id: "TODAY", label: "Today" },
  { id: "YESTERDAY", label: "Yesterday" },
  { id: "THIS_WEEK", label: "This Week" },
  { id: "THIS_MONTH", label: "This Month" },
  { id: "THIS_YEAR", label: "This Year" },
  { id: "ALL", label: "All Time" },
  { id: "CUSTOM", label: "Custom Range" },
]

function getTimeframeRange(timeframe, customFrom, customTo) {
  const now = new Date()
  let dateFrom = null
  let dateTo = null

  if (timeframe === "TODAY") {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    dateFrom = start.toISOString()
    dateTo = end.toISOString()
  } else if (timeframe === "YESTERDAY") {
    const start = new Date(now)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    dateFrom = start.toISOString()
    dateTo = end.toISOString()
  } else if (timeframe === "THIS_WEEK") {
    const start = new Date(now)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1) // Monday start
    start.setDate(diff)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    dateFrom = start.toISOString()
    dateTo = end.toISOString()
  } else if (timeframe === "THIS_MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    dateFrom = start.toISOString()
    dateTo = end.toISOString()
  } else if (timeframe === "THIS_YEAR") {
    const start = new Date(now.getFullYear(), 0, 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    dateFrom = start.toISOString()
    dateTo = end.toISOString()
  } else if (timeframe === "CUSTOM") {
    if (customFrom) {
      const start = new Date(customFrom)
      start.setHours(0, 0, 0, 0)
      dateFrom = start.toISOString()
    }
    if (customTo) {
      const end = new Date(customTo)
      end.setHours(23, 59, 59, 999)
      dateTo = end.toISOString()
    }
  }

  return { dateFrom, dateTo }
}

// Resolution Categorizer for Financial & Audit Classification
function categorizeResolution(c) {
  const remarks = (c.remarks || "").toLowerCase()
  const actionTaken = (c.actionTaken || "").toLowerCase()

  if (c.status === "SENT_TO_SUPPLIER") return "PENDING_SUPPLIER"
  if (remarks.includes("credit memo") || actionTaken.includes("credit memo") || remarks.includes(" cm ")) return "SUPPLIER_CREDIT_MEMO"
  if (c.status === "REJECTED" && (c.sentToSupplierAt || remarks.includes("shrinkage"))) return "SHRINKAGE_WRITE_OFF"
  if (c.status === "REJECTED") return "CUSTOMER_REJECTED"
  if (c.status === "REPLACED" && c.sentToSupplierAt) return "REPLACED_BY_SUPPLIER"
  if (c.replacementSerialId || c.replacementSerialNumber || c.status === "REPLACED") return "IMMEDIATE_SWAP"
  if (c.status === "REPAIRED" && c.sentToSupplierAt) return "REPAIRED_BY_SUPPLIER"
  if (c.status === "REPAIRED") return "REPAIRED_IN_HOUSE"
  if (["IN", "CHECKING", "APPROVED"].includes(c.status)) return "IN_STORE_PROCESSING"
  if (c.status === "OUT") return "RELEASED_TO_CUSTOMER"
  return "OTHER"
}

function resolutionLabel(category) {
  switch (category) {
    case "PENDING_SUPPLIER":
      return "With Supplier (RMA In-Progress)"
    case "REPLACED_BY_SUPPLIER":
      return "Replaced by Supplier"
    case "REPAIRED_BY_SUPPLIER":
      return "Repaired by Supplier"
    case "SUPPLIER_CREDIT_MEMO":
      return "Supplier Credit Memo (CM)"
    case "IMMEDIATE_SWAP":
      return "Immediate Replacement (Swap)"
    case "SHRINKAGE_WRITE_OFF":
      return "Supplier Rejected (Shrinkage Loss)"
    case "CUSTOMER_REJECTED":
      return "Customer Claim Rejected"
    case "REPAIRED_IN_HOUSE":
      return "Repaired In-Store"
    case "IN_STORE_PROCESSING":
      return "In-Store Diagnostics"
    case "RELEASED_TO_CUSTOMER":
      return "Released to Customer"
    default:
      return "Standard Resolution"
  }
}

export default function WarrantyReportView({
  branchId,
  selectedBranch,
  user,
  getWarrantyClaimsApi,
  onOpenDetail,
  onImmediateReplace,
  onDispatchSupplier,
  onResolveSupplier,
  onCustomerReject,
  onRelease,
}) {
  // 1. Timeframe & Filter States
  const [timeframe, setTimeframe] = useState("THIS_MONTH")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [resolutionFilter, setResolutionFilter] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("")

  // 2. View Mode (SUMMARY vs SUPPLIER_RMA)
  const [viewMode, setViewMode] = useState("SUMMARY") // "SUMMARY" | "SUPPLIER_RMA"

  // 3. Data & Loading States
  const [rawClaims, setRawClaims] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [fetchError, setFetchError] = useState("")

  // 4. Fetch claims whenever branch or timeframe changes
  const fetchReportData = useCallback(async () => {
    setIsLoading(true)
    setFetchError("")
    try {
      const { dateFrom, dateTo } = getTimeframeRange(timeframe, customDateFrom, customDateTo)
      let allRecords = []
      let page = 1
      let totalPages = 1

      do {
        const response = await getWarrantyClaimsApi({
          ...(branchId ? { branchId } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          page,
          limit: 100,
        })
        const list = Array.isArray(response?.data) ? response.data : []
        allRecords = allRecords.concat(list)
        totalPages = Number(response?.meta?.totalPages || response?.meta?.total_pages || 1)
        page += 1
      } while (page <= totalPages && page <= 50)

      setRawClaims(allRecords)
    } catch (err) {
      console.error("Failed to load warranty claims report records:", err)
      setFetchError(err?.message || "Failed to load warranty report.")
    } finally {
      setIsLoading(false)
    }
  }, [branchId, timeframe, customDateFrom, customDateTo, getWarrantyClaimsApi])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  // 5. Unique suppliers dynamically aggregated from data
  const availableSuppliers = useMemo(() => {
    const set = new Set()
    rawClaims.forEach((c) => {
      if (c.supplierName && c.supplierName.trim()) {
        set.add(c.supplierName.trim())
      }
    })
    return Array.from(set).sort()
  }, [rawClaims])

  // 6. Processed & Augmented Claims Data
  const processedClaims = useMemo(() => {
    return rawClaims.map((c) => {
      const agingDays = calculateAgingDays(c.receivedAt || c.createdAt)
      const supplierAgingDays = c.sentToSupplierAt ? calculateAgingDays(c.sentToSupplierAt) : 0
      const resolution = categorizeResolution(c)
      const resolutionName = resolutionLabel(resolution)

      const customerName = c.customer?.fullName || "Walk-in Customer"
      const customerContact = c.customer?.mobileNumber || "—"
      const itemName = c.item?.itemName || c.saleItem?.itemNameSnapshot || "Unlinked Item"
      const itemCode = c.item?.itemCode || c.saleItem?.itemCodeSnapshot || "—"
      const serialNumber = c.serial?.serialNumber || "No serial"
      const receiptCode = c.sale?.receiptCode || "—"
      const saleDate = c.sale?.saleDate ? dateOnly(c.sale.saleDate) : "—"

      const isOverdueSupplier = c.status === "SENT_TO_SUPPLIER" && supplierAgingDays > 14
      const isCriticalSupplier = c.status === "SENT_TO_SUPPLIER" && supplierAgingDays > 30

      return {
        ...c,
        agingDays,
        supplierAgingDays,
        resolution,
        resolutionName,
        customerName,
        customerContact,
        itemName,
        itemCode,
        serialNumber,
        receiptCode,
        saleDate,
        isOverdueSupplier,
        isCriticalSupplier,
      }
    })
  }, [rawClaims])

  // 7. Multi-Faceted Filter Pipeline
  const filteredClaims = useMemo(() => {
    const q = search.trim().toLowerCase()

    return processedClaims.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false
      if (resolutionFilter && c.resolution !== resolutionFilter) return false
      if (supplierFilter) {
        if (c.supplierName?.toLowerCase() !== supplierFilter.toLowerCase()) return false
      }

      if (q) {
        const matches = [
          c.claimCode,
          c.customerName,
          c.customerContact,
          c.itemName,
          c.itemCode,
          c.serialNumber,
          c.receiptCode,
          c.supplierName,
          c.supplierReferenceNo,
          c.issueDescription,
          c.diagnosis,
          c.actionTaken,
          c.remarks,
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q))

        if (!matches) return false
      }

      return true
    })
  }, [processedClaims, search, statusFilter, resolutionFilter, supplierFilter])

  // Filtered rows for Supplier RMA view (only claims associated with a supplier)
  const supplierRmaRows = useMemo(() => {
    return filteredClaims.filter((c) => c.status === "SENT_TO_SUPPLIER" || c.sentToSupplierAt || Boolean(c.supplierName))
  }, [filteredClaims])

  // 8. Executive KPI Calculations (POS Cashiering Standard)
  const kpis = useMemo(() => {
    const total = filteredClaims.length
    let inStoreActive = 0
    let withSuppliers = 0
    let immediateSwaps = 0
    let readyForRelease = 0
    let releasedOut = 0
    let supplierReplaced = 0
    let supplierRepaired = 0
    let supplierCreditMemo = 0
    let shrinkageWriteOff = 0
    let customerRejected = 0
    let overdueSupplierCount = 0

    filteredClaims.forEach((c) => {
      if (["IN", "CHECKING", "APPROVED"].includes(c.status)) {
        inStoreActive += 1
      }
      if (c.status === "SENT_TO_SUPPLIER") {
        withSuppliers += 1
        if (c.supplierAgingDays > 14) overdueSupplierCount += 1
      }
      if (c.resolution === "IMMEDIATE_SWAP" || c.replacementSerialId || c.replacementSerialNumber) {
        immediateSwaps += 1
      }
      if (["REPAIRED", "REPLACED"].includes(c.status) && !c.releasedAt) {
        readyForRelease += 1
      }
      if (c.status === "OUT" || Boolean(c.releasedAt)) {
        releasedOut += 1
      }
      if (c.resolution === "REPLACED_BY_SUPPLIER") supplierReplaced += 1
      if (c.resolution === "REPAIRED_BY_SUPPLIER") supplierRepaired += 1
      if (c.resolution === "SUPPLIER_CREDIT_MEMO") supplierCreditMemo += 1
      if (c.resolution === "SHRINKAGE_WRITE_OFF") shrinkageWriteOff += 1
      if (c.resolution === "CUSTOMER_REJECTED") customerRejected += 1
    })

    return {
      total,
      inStoreActive,
      withSuppliers,
      immediateSwaps,
      readyForRelease,
      releasedOut,
      supplierReplaced,
      supplierRepaired,
      supplierCreditMemo,
      shrinkageWriteOff,
      customerRejected,
      overdueSupplierCount,
    }
  }, [filteredClaims])

  // 9. Excel Exporters
  const handleExportSummaryExcel = () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        ["Timeframe Range", TIMEFRAME_OPTIONS.find((t) => t.id === timeframe)?.label || timeframe],
        ["Search Query", search.trim() || "All"],
        ["Claim Status", statusFilter ? formatStatus(statusFilter) : "All Statuses"],
        ["Resolution Outcome", resolutionFilter ? resolutionLabel(resolutionFilter) : "All Outcomes"],
        ["Supplier Filter", supplierFilter || "All Suppliers"],
        ["Branch", selectedBranch?.name || "All Branches"],
      ]

      const summaryTotals = [
        ["Total Warranty Claims In Period", kpis.total],
        ["Active In-Store Diagnostics", kpis.inStoreActive],
        ["With Suppliers (Distributor RMA)", kpis.withSuppliers],
        ["Immediate Stock Replacements (Swaps)", kpis.immediateSwaps],
        ["Ready for Customer Pickup / Release", kpis.readyForRelease],
        ["Successfully Released & Concluded", kpis.releasedOut],
        ["Supplier Replacements Received", kpis.supplierReplaced],
        ["Supplier Repaired Units", kpis.supplierRepaired],
        ["Supplier Credit Memo (CM)", kpis.supplierCreditMemo],
        ["Shrinkage Loss Write-Offs", kpis.shrinkageWriteOff],
        ["Customer Claims Rejected", kpis.customerRejected],
      ]

      const columns = [
        ["Claim Code", (row) => row.claimCode],
        ["Date Received", (row) => dateOnly(row.receivedAt || row.createdAt)],
        ["Customer Name", (row) => row.customerName],
        ["Customer Contact", (row) => row.customerContact],
        ["Reference Invoice", (row) => row.receiptCode],
        ["Original Purchase Date", (row) => row.saleDate],
        ["Item Description", (row) => row.itemName],
        ["Item Code", (row) => row.itemCode],
        ["Defective Serial No.", (row) => row.serialNumber],
        ["Reported Issue", (row) => row.issueDescription || "—"],
        ["Technical Diagnosis", (row) => row.diagnosis || "—"],
        ["Lifecycle Status", (row) => formatStatus(row.status)],
        ["Supplier Name", (row) => row.supplierName || "—"],
        ["Supplier RMA Ref No.", (row) => row.supplierReferenceNo || "—"],
        ["Date Dispatched to Supplier", (row) => dateOnly(row.sentToSupplierAt)],
        ["Supplier Turnaround (Days)", (row) => row.supplierAgingDays || 0],
        ["Resolution Outcome", (row) => row.resolutionName],
        ["Replacement Serial No.", (row) => row.replacementSerialNumber || row.replacementSerial?.serialNumber || "—"],
        ["Replacement Terms", (row) => row.replacementWarrantyDuration || "—"],
        ["Date Released to Customer", (row) => dateOnly(row.releasedAt)],
        ["Handled / Released By", (row) => row.releasedBy?.fullName || row.statusUpdatedBy?.fullName || row.createdBy?.fullName || "—"],
        ["Action Taken & Remarks", (row) => `${row.actionTaken ? row.actionTaken + ". " : ""}${row.remarks || ""}`.trim() || "—"],
      ]

      exportReportExcel({
        title: `WARRANTY & CUSTOMER CLAIMS SUMMARY REPORT (${selectedBranch?.name || "ALL BRANCHES"})`,
        filename: `Warranty-Claims-Summary-${timeframe}-${new Date().toISOString().slice(0, 10)}`,
        columns,
        records: filteredClaims,
        branch: selectedBranch,
        generatedBy: user,
        filters: activeFilters,
        totals: summaryTotals,
      })
    } catch (err) {
      console.error("Export warranty summary excel failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportSupplierRmaExcel = () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        ["Timeframe Range", TIMEFRAME_OPTIONS.find((t) => t.id === timeframe)?.label || timeframe],
        ["Search Query", search.trim() || "All"],
        ["Supplier Filter", supplierFilter || "All Suppliers"],
        ["Total Dispatched RMA Records", supplierRmaRows.length],
        ["Branch", selectedBranch?.name || "All Branches"],
      ]

      const supplierTotals = [
        ["Total Supplier RMA Records", supplierRmaRows.length],
        ["Currently With Suppliers (Pending)", kpis.withSuppliers],
        ["Turnaround Overdue (>14 Days)", kpis.overdueSupplierCount],
        ["Supplier Replacements Replenished", kpis.supplierReplaced],
        ["Supplier Repaired Units", kpis.supplierRepaired],
        ["Supplier Credit Memo (CM)", kpis.supplierCreditMemo],
        ["Supplier RMA Shrinkage Losses", kpis.shrinkageWriteOff],
      ]

      const columns = [
        ["Claim Code", (row) => row.claimCode],
        ["Date Sent to Supplier", (row) => dateOnly(row.sentToSupplierAt)],
        ["Supplier / Distributor", (row) => row.supplierName || "—"],
        ["Supplier RMA Reference No.", (row) => row.supplierReferenceNo || "—"],
        ["Item Description", (row) => row.itemName],
        ["Dispatched Serial No.", (row) => row.serialNumber],
        ["Days with Supplier", (row) => row.supplierAgingDays],
        ["RMA Status / Outcome", (row) => row.status === "SENT_TO_SUPPLIER" ? "PENDING WITH SUPPLIER" : row.resolutionName],
        ["Replacement Serial Received", (row) => row.replacementSerialNumber || row.replacementSerial?.serialNumber || "—"],
        ["Customer Owner", (row) => row.customerName],
        ["Customer Contact", (row) => row.customerContact],
        ["Original Invoice Ref", (row) => row.receiptCode],
        ["Supplier Action & Notes", (row) => `${row.actionTaken ? row.actionTaken + ". " : ""}${row.remarks || ""}`.trim() || "—"],
      ]

      exportReportExcel({
        title: `SUPPLIER RMA LOGISTICS & RESOLUTION AUDIT REPORT (${selectedBranch?.name || "ALL BRANCHES"})`,
        filename: `Supplier-RMA-Audit-${timeframe}-${new Date().toISOString().slice(0, 10)}`,
        columns,
        records: supplierRmaRows,
        branch: selectedBranch,
        generatedBy: user,
        filters: activeFilters,
        totals: supplierTotals,
      })
    } catch (err) {
      console.error("Export supplier RMA excel failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. EXECUTIVE FINANCIAL & OPERATIONAL KPI CARDS (POS Cashiering Standard) */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Card 1: Total Claims Volume */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Claims In Period
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-[var(--color-maroon)]/10 text-[var(--color-maroon)]">
              <ShieldCheck size={18} />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-[var(--color-text-strong)]">
            {kpis.total}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{kpis.releasedOut} released</span>
            <span>•</span>
            <span>{kpis.total - kpis.releasedOut} active</span>
          </div>
        </div>

        {/* Card 2: In-Store Active */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              In-Store Pipeline
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock3 size={18} />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
            {kpis.inStoreActive}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Undergoing inspection / diagnostic
          </p>
        </div>

        {/* Card 3: With Suppliers for RMA */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              With Suppliers (RMA)
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Truck size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="font-mono text-2xl font-black text-violet-600 dark:text-violet-400">
              {kpis.withSuppliers}
            </p>
            {kpis.overdueSupplierCount > 0 && (
              <span className="inline-flex items-center rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-black text-rose-600 dark:text-rose-400">
                {kpis.overdueSupplierCount} &gt;14d
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Dispatched for distributor RMA
          </p>
        </div>

        {/* Card 4: Immediate Replacements / Swaps */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Immediate Swaps
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Repeat size={18} />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-sky-600 dark:text-sky-400">
            {kpis.immediateSwaps}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Units swapped from store inventory
          </p>
        </div>

        {/* Card 5: Ready for Customer Release */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Ready for Release
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PackageCheck size={18} />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {kpis.readyForRelease}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Repaired / replaced awaiting customer
          </p>
        </div>

        {/* Card 6: Supplier Resolution & Shrinkage Breakdown */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              RMA Outcomes
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-300">
              <FileCheck2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="font-mono text-xl font-black text-[var(--color-text-strong)]">
              {kpis.supplierReplaced + kpis.supplierRepaired + kpis.supplierCreditMemo}
            </p>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">resolved</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <span className="text-rose-600 dark:text-rose-400 font-semibold">{kpis.shrinkageWriteOff} write-offs</span>
            <span>•</span>
            <span>{kpis.customerRejected} rejected</span>
          </div>
        </div>
      </div>

      {/* 2. ADVANCED TIME & MULTI-FACETED FILTER SUITE */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-card space-y-4">
        {/* Top: Preset Timeframe Pills & Custom Range */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-[var(--color-border)] pb-3.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="flex items-center gap-1 text-xs font-bold text-[var(--color-muted)] mr-1">
              <Calendar size={14} /> Timeframe:
            </span>
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTimeframe(opt.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  timeframe === opt.id
                    ? "bg-[var(--color-maroon)] text-white shadow-soft"
                    : "bg-[var(--color-soft)] text-[var(--color-text-strong)] hover:bg-[var(--color-border)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {timeframe === "CUSTOM" && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1 text-xs font-bold text-[var(--color-muted)]">
                From:
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                />
              </label>
              <label className="flex items-center gap-1 text-xs font-bold text-[var(--color-muted)]">
                To:
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                />
              </label>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={fetchReportData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-text-strong)] shadow-xs transition hover:bg-[var(--color-soft)] cursor-pointer"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={13} />
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Bottom: Search & Deep Filters */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3.5 top-3 text-[var(--color-muted)]" size={16} />
            <input
              type="text"
              placeholder="Search Claim #, Customer, Serial, Item, Supplier, RMA Ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] py-2.5 pl-10 pr-3.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] placeholder:font-normal placeholder:text-[var(--color-muted)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-[var(--color-muted)] hover:text-[var(--color-text-strong)] cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Claim Lifecycle Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 py-2.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="">All Claim Statuses</option>
              <option value="IN">Received (In Store)</option>
              <option value="CHECKING">Diagnostic / Checking</option>
              <option value="SENT_TO_SUPPLIER">With Supplier (RMA Hub)</option>
              <option value="APPROVED">Approved for Fix / Swap</option>
              <option value="REPAIRED">Repaired (Ready Release)</option>
              <option value="REPLACED">Replaced (Ready Release)</option>
              <option value="OUT">Released (Concluded)</option>
              <option value="REJECTED">Rejected Claim</option>
            </select>
          </div>

          {/* Resolution Outcome Filter */}
          <div>
            <select
              value={resolutionFilter}
              onChange={(e) => setResolutionFilter(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 py-2.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="">All Resolution Outcomes</option>
              <option value="PENDING_SUPPLIER">Pending with Supplier</option>
              <option value="IMMEDIATE_SWAP">Immediate Swap / Store Replacement</option>
              <option value="REPLACED_BY_SUPPLIER">Replaced by Supplier</option>
              <option value="REPAIRED_BY_SUPPLIER">Repaired by Supplier</option>
              <option value="SUPPLIER_CREDIT_MEMO">Supplier Credit Memo (CM)</option>
              <option value="SHRINKAGE_WRITE_OFF">Shrinkage Loss (Supplier Rejected)</option>
              <option value="CUSTOMER_REJECTED">Customer Claim Rejected</option>
              <option value="REPAIRED_IN_HOUSE">Repaired In-House</option>
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 py-2.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="">All Suppliers ({availableSuppliers.length})</option>
              {availableSuppliers.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Indicator */}
        {(search || statusFilter || resolutionFilter || supplierFilter) && (
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="font-medium text-[var(--color-muted)]">
              Filtered: <strong className="text-[var(--color-text-strong)]">{filteredClaims.length}</strong> of {rawClaims.length} claims match active criteria
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setStatusFilter("")
                setResolutionFilter("")
                setSupplierFilter("")
              }}
              className="text-xs font-bold text-[var(--color-maroon)] hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </section>

      {/* 3. DUAL TABLE MODE SWITCHER & EXCEL EXPORT BUTTONS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Table View Mode Selector */}
        <div className="inline-flex rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)]/50 p-1">
          <button
            type="button"
            onClick={() => setViewMode("SUMMARY")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition cursor-pointer ${
              viewMode === "SUMMARY"
                ? "bg-[var(--color-card)] text-[var(--color-text-strong)] shadow-xs"
                : "text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
            }`}
          >
            <Layers size={15} />
            All Warranty Claims ({filteredClaims.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("SUPPLIER_RMA")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition cursor-pointer ${
              viewMode === "SUPPLIER_RMA"
                ? "bg-[var(--color-card)] text-violet-700 dark:text-violet-300 shadow-xs"
                : "text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
            }`}
          >
            <Truck size={15} />
            Supplier RMA &amp; Logistics Audit ({supplierRmaRows.length})
          </button>
        </div>

        {/* Export Excel Trigger */}
        <div className="flex items-center gap-2">
          {viewMode === "SUMMARY" ? (
            <button
              type="button"
              disabled={isExporting || filteredClaims.length === 0}
              onClick={handleExportSummaryExcel}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-2.5 text-xs font-black text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-600/20 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              {isExporting ? "Exporting Excel..." : "Export Claims Summary (.xlsx)"}
            </button>
          ) : (
            <button
              type="button"
              disabled={isExporting || supplierRmaRows.length === 0}
              onClick={handleExportSupplierRmaExcel}
              className="inline-flex items-center gap-2 rounded-2xl border border-violet-600/30 bg-violet-600/10 px-4 py-2.5 text-xs font-black text-violet-700 dark:text-violet-300 transition hover:bg-violet-600/20 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              {isExporting ? "Exporting Excel..." : "Export Supplier RMA Audit (.xlsx)"}
            </button>
          )}
        </div>
      </div>

      {/* 4. ERROR NOTICE */}
      {fetchError && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <CircleAlert className="mt-0.5 shrink-0" size={15} />
          <span>{fetchError}</span>
        </div>
      )}

      {/* 5. DATA GRIDS */}
      {isLoading ? (
        <div className="grid h-64 place-items-center rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-card">
          <div className="flex flex-col items-center gap-3 text-[var(--color-muted)]">
            <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={32} />
            <p className="text-xs font-bold">Aggregating warranty reports and claims data...</p>
          </div>
        </div>
      ) : viewMode === "SUMMARY" ? (
        /* MODE 1: ALL WARRANTY CLAIMS & LIFECYCLE TRACKING */
        <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs text-[var(--color-text)]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 text-[11px] font-black uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-4 py-3.5">Claim Details</th>
                  <th className="px-4 py-3.5">Customer / Invoice</th>
                  <th className="px-4 py-3.5">Item &amp; Serial Number</th>
                  <th className="px-4 py-3.5">Reported Issue &amp; Diagnosis</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Supplier RMA Tracking</th>
                  <th className="px-4 py-3.5">Aging</th>
                  <th className="px-4 py-3.5">Resolution / Swap</th>
                  <th className="px-4 py-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs font-semibold text-[var(--color-muted)]">
                      No warranty claims found matching the current timeframe and filters.
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((c) => (
                    <tr key={c.id} className="transition hover:bg-[var(--color-soft)]/30">
                      {/* Claim Code & Date */}
                      <td className="px-4 py-3.5 align-top">
                        <span className="font-mono text-xs font-black text-[var(--color-maroon)] block">
                          {c.claimCode}
                        </span>
                        <span className="text-[10px] text-[var(--color-muted)] font-medium block mt-0.5">
                          Recv: {dateOnly(c.receivedAt || c.createdAt)}
                        </span>
                        {c.branch?.name && (
                          <span className="inline-block mt-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-muted)]">
                            {c.branch.name}
                          </span>
                        )}
                      </td>

                      {/* Customer / Invoice */}
                      <td className="px-4 py-3.5 align-top">
                        <span className="font-bold text-[var(--color-text-strong)] block">
                          {c.customerName}
                        </span>
                        <span className="text-[11px] text-[var(--color-muted)] font-mono block">
                          {c.customerContact}
                        </span>
                        {c.receiptCode !== "—" && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono text-[var(--color-muted)]">
                            Ref: <strong>{c.receiptCode}</strong>
                          </span>
                        )}
                      </td>

                      {/* Item & Serial */}
                      <td className="px-4 py-3.5 align-top max-w-[220px]">
                        <span className="font-bold text-[var(--color-text-strong)] line-clamp-2 block leading-snug">
                          {c.itemName}
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            SN: {c.serialNumber}
                          </span>
                        </div>
                      </td>

                      {/* Issue & Diagnosis */}
                      <td className="px-4 py-3.5 align-top max-w-[220px]">
                        <p className="text-xs text-[var(--color-text-strong)] font-medium line-clamp-2">
                          {c.issueDescription || "No reported issue provided."}
                        </p>
                        {c.diagnosis && (
                          <p className="mt-1 text-[10px] text-[var(--color-muted)] italic line-clamp-2">
                            Diag: {c.diagnosis}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${statusTone(c.status)}`}>
                          {formatStatus(c.status)}
                        </span>
                        {c.releasedAt && (
                          <span className="block mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Released: {dateOnly(c.releasedAt)}
                          </span>
                        )}
                      </td>

                      {/* Supplier RMA Tracking */}
                      <td className="px-4 py-3.5 align-top max-w-[180px]">
                        {c.supplierName ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-[var(--color-text-strong)] block">
                              {c.supplierName}
                            </span>
                            {c.supplierReferenceNo && (
                              <span className="font-mono text-[10px] text-violet-700 dark:text-violet-400 block font-semibold">
                                RMA #{c.supplierReferenceNo}
                              </span>
                            )}
                            {c.sentToSupplierAt && (
                              <span className="text-[10px] text-[var(--color-muted)] block">
                                Sent: {dateOnly(c.sentToSupplierAt)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[var(--color-muted)] font-medium italic">—</span>
                        )}
                      </td>

                      {/* Aging */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <div className="flex flex-col">
                          <span
                            className={`font-mono text-xs font-black ${
                              c.agingDays > 14
                                ? "text-rose-600 dark:text-rose-400"
                                : c.agingDays > 7
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-[var(--color-text-strong)]"
                            }`}
                          >
                            {c.agingDays} {c.agingDays === 1 ? "day" : "days"}
                          </span>
                          {c.status === "SENT_TO_SUPPLIER" && (
                            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                              {c.supplierAgingDays}d with RMA
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Resolution / Swap */}
                      <td className="px-4 py-3.5 align-top max-w-[180px]">
                        <span className="inline-block text-[11px] font-bold text-[var(--color-text-strong)]">
                          {c.resolutionName}
                        </span>
                        {(c.replacementSerialNumber || c.replacementSerial?.serialNumber) && (
                          <div className="mt-1">
                            <span className="inline-flex items-center rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                              Swap SN: {c.replacementSerialNumber || c.replacementSerial?.serialNumber}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Quick Actions (Interconnected with Modals) */}
                      <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="View Full Claim Dossier"
                            onClick={() => onOpenDetail?.(c)}
                            className="inline-flex size-7.5 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] cursor-pointer"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Action button based on state */}
                          {c.status === "CHECKING" && (
                            <button
                              type="button"
                              title="Dispatch to Supplier"
                              onClick={() => onDispatchSupplier?.(c)}
                              className="inline-flex size-7.5 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 transition hover:bg-violet-500/20 cursor-pointer"
                            >
                              <Truck size={13} />
                            </button>
                          )}

                          {["IN", "CHECKING", "APPROVED"].includes(c.status) && (
                            <button
                              type="button"
                              title="Immediate Replacement Swap"
                              onClick={() => onImmediateReplace?.(c)}
                              className="inline-flex size-7.5 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 transition hover:bg-sky-500/20 cursor-pointer"
                            >
                              <Repeat size={13} />
                            </button>
                          )}

                          {c.status === "SENT_TO_SUPPLIER" && (
                            <button
                              type="button"
                              title="Resolve Supplier RMA"
                              onClick={() => onResolveSupplier?.(c)}
                              className="inline-flex size-7.5 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-500/20 cursor-pointer"
                            >
                              <CheckCircle2 size={13} />
                            </button>
                          )}

                          {["REPAIRED", "REPLACED", "REJECTED"].includes(c.status) && !c.releasedAt && (
                            <button
                              type="button"
                              title="Release to Customer"
                              onClick={() => onRelease?.(c)}
                              className="inline-flex size-7.5 items-center justify-center rounded-xl border border-emerald-600/30 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-600/25 cursor-pointer"
                            >
                              <PackageCheck size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MODE 2: SUPPLIER RMA & RESOLUTION AUDIT (DISTRIBUTOR LOGISTICS & ACCOUNTING) */
        <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs text-[var(--color-text)]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-violet-500/10 text-[11px] font-black uppercase tracking-wider text-violet-900 dark:text-violet-200">
                  <th className="px-4 py-3.5">Claim Ref &amp; Sent Date</th>
                  <th className="px-4 py-3.5">Supplier / Distributor</th>
                  <th className="px-4 py-3.5">Supplier RMA Tracking #</th>
                  <th className="px-4 py-3.5">Dispatched Item &amp; Serial</th>
                  <th className="px-4 py-3.5">Days with Supplier</th>
                  <th className="px-4 py-3.5">RMA Resolution Outcome</th>
                  <th className="px-4 py-3.5">Replacement Serial Returned</th>
                  <th className="px-4 py-3.5">Customer Owner</th>
                  <th className="px-4 py-3.5 text-right">RMA Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {supplierRmaRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs font-semibold text-[var(--color-muted)]">
                      No supplier RMA records found for the selected timeframe and filters.
                    </td>
                  </tr>
                ) : (
                  supplierRmaRows.map((c) => (
                    <tr key={c.id} className="transition hover:bg-[var(--color-soft)]/30">
                      {/* Claim & Sent Date */}
                      <td className="px-4 py-3.5 align-top">
                        <span className="font-mono text-xs font-black text-[var(--color-maroon)] block">
                          {c.claimCode}
                        </span>
                        <span className="text-[10px] text-[var(--color-muted)] font-medium block mt-0.5">
                          Sent: {dateOnly(c.sentToSupplierAt) || "—"}
                        </span>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3.5 align-top">
                        <span className="font-bold text-[var(--color-text-strong)] block">
                          {c.supplierName || "—"}
                        </span>
                      </td>

                      {/* Supplier RMA Ref */}
                      <td className="px-4 py-3.5 align-top">
                        {c.supplierReferenceNo ? (
                          <span className="font-mono text-xs font-bold text-violet-700 dark:text-violet-300">
                            {c.supplierReferenceNo}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--color-muted)] italic">No Ref #</span>
                        )}
                      </td>

                      {/* Item & Serial */}
                      <td className="px-4 py-3.5 align-top max-w-[220px]">
                        <span className="font-bold text-[var(--color-text-strong)] line-clamp-2 block leading-snug">
                          {c.itemName}
                        </span>
                        <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-1">
                          SN: {c.serialNumber}
                        </span>
                      </td>

                      {/* Days with Supplier */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono text-xs font-black ${
                              c.supplierAgingDays > 30
                                ? "text-rose-600 dark:text-rose-400"
                                : c.supplierAgingDays > 14
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-[var(--color-text-strong)]"
                            }`}
                          >
                            {c.supplierAgingDays} days
                          </span>
                          {c.supplierAgingDays > 30 && (
                            <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-black text-rose-600 dark:text-rose-400">
                              OVERDUE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* RMA Outcome */}
                      <td className="px-4 py-3.5 align-top">
                        {c.status === "SENT_TO_SUPPLIER" ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800">
                            In-Transit / Under Supplier RMA
                          </span>
                        ) : (
                          <span className="font-bold text-[var(--color-text-strong)] block">
                            {c.resolutionName}
                          </span>
                        )}
                        {c.actionTaken && (
                          <span className="text-[10px] text-[var(--color-muted)] line-clamp-1 mt-0.5 block">
                            {c.actionTaken}
                          </span>
                        )}
                      </td>

                      {/* Replacement Serial Returned */}
                      <td className="px-4 py-3.5 align-top">
                        {(c.replacementSerialNumber || c.replacementSerial?.serialNumber) ? (
                          <span className="inline-flex items-center rounded bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            {c.replacementSerialNumber || c.replacementSerial?.serialNumber}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--color-muted)] font-medium italic">—</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5 align-top">
                        <span className="font-bold text-[var(--color-text-strong)] block">
                          {c.customerName}
                        </span>
                        <span className="text-[10px] text-[var(--color-muted)] font-mono block">
                          {c.customerContact}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenDetail?.(c)}
                            title="View Claim Dossier"
                            className="inline-flex size-7.5 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] cursor-pointer"
                          >
                            <Eye size={13} />
                          </button>

                          {c.status === "SENT_TO_SUPPLIER" && (
                            <button
                              type="button"
                              onClick={() => onResolveSupplier?.(c)}
                              className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-soft transition hover:bg-violet-700 cursor-pointer"
                            >
                              <CheckCircle2 size={12} />
                              Resolve RMA
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
