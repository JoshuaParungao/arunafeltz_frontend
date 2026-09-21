import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  LoaderCircle,
  MapPin,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  X,
  XCircle,
} from "lucide-react"

import { getStockTransfers } from "../../features/stock-transfers/stockTransfers.api"
import { getReport } from "../../features/reports/reports.api"
import { getBranches } from "../../features/branches/branches.api"
import { exportReportExcel } from "../../utils/businessDocumentExport"
import ExportExcelButton from "../../components/common/ExportExcelButton"

function money(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function dateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
}

function dateLabel(value) {
  if (!value) return "—"
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

function statusTone(status, fulfillmentStatus) {
  if (fulfillmentStatus === "IN_TRANSIT" && status !== "CANCELLED") {
    return "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
  }
  return (
    {
      POSTED: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      APPROVED: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
      REQUESTED: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      DRAFT: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      REJECTED: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      CANCELLED: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    }[status] || "bg-slate-100 text-slate-700 border-slate-200"
  )
}

function formatStatus(status, fulfillmentStatus) {
  if (fulfillmentStatus === "IN_TRANSIT" && status !== "CANCELLED") {
    return "In Transit"
  }
  return String(status || "—")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function StockTransfersReportView({
  branchId,
  selectedBranch,
  user,
  onRefresh,
}) {
  const branchName = selectedBranch?.name || user?.branch?.name || "All Branches"

  // Active Audit Mode
  const [activeTab, setActiveTab] = useState("TRANSIT_OVERVIEW") // "TRANSIT_OVERVIEW" | "MANIFEST" | "RECONCILIATION" | "DISPOSITION_AUDIT"

  // Date Range Filtering
  const [timeframe, setTimeframe] = useState("THIS_MONTH") // "ALL" | "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_30_DAYS" | "CUSTOM"
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Filter Selectors
  const [directionFilter, setDirectionFilter] = useState("ALL") // "ALL" | "OUT" | "IN"
  const [statusFilter, setStatusFilter] = useState("")
  const [originBranchFilter, setOriginBranchFilter] = useState("ALL")
  const [destBranchFilter, setDestBranchFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  // Data states
  const [transfers, setTransfers] = useState([])
  const [branches, setBranches] = useState([])
  const [reportSummary, setReportSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedTransferDetail, setSelectedTransferDetail] = useState(null)

  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 25

  // Date range resolver
  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const d = now.getDate()

    const pad = (n) => String(n).padStart(2, "0")
    const fmt = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`

    if (timeframe === "TODAY") {
      const todayStr = fmt(now)
      setDateFrom(todayStr)
      setDateTo(todayStr)
    } else if (timeframe === "YESTERDAY") {
      const yest = new Date(y, m, d - 1)
      const yestStr = fmt(yest)
      setDateFrom(yestStr)
      setDateTo(yestStr)
    } else if (timeframe === "THIS_WEEK") {
      const dayOfWeek = now.getDay()
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(y, m, d + diffToMonday)
      setDateFrom(fmt(monday))
      setDateTo(fmt(now))
    } else if (timeframe === "THIS_MONTH") {
      const firstDay = new Date(y, m, 1)
      setDateFrom(fmt(firstDay))
      setDateTo(fmt(now))
    } else if (timeframe === "LAST_30_DAYS") {
      const prior = new Date(y, m, d - 29)
      setDateFrom(fmt(prior))
      setDateTo(fmt(now))
    } else if (timeframe === "ALL") {
      setDateFrom("")
      setDateTo("")
    }
    setPage(1)
  }, [timeframe])

  // Load Branches
  useEffect(() => {
    let active = true
    async function fetchBranches() {
      try {
        const res = await getBranches()
        const list = Array.isArray(res?.data) ? res.data : res || []
        if (active) setBranches(list)
      } catch {
        // ignore
      }
    }
    fetchBranches()
    return () => {
      active = false
    }
  }, [])

  // Load Transfer Data & Backend Report Summary
  const loadReportData = useCallback(async () => {
    setIsLoading(true)
    try {
      const queryParams = {
        limit: 500,
        page: 1,
        ...(statusFilter ? { status: statusFilter } : {}),
      }

      if (branchId) {
        if (directionFilter === "OUT") {
          queryParams.fromBranchId = branchId
        } else if (directionFilter === "IN") {
          queryParams.toBranchId = branchId
        } else {
          queryParams.branchId = branchId
        }
      }

      const reportParams = {
        ...(branchId ? { branchId } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }

      const [transfersRes, reportRes] = await Promise.all([
        getStockTransfers(queryParams),
        getReport("transfers", reportParams).catch(() => null),
      ])

      const transferList = transfersRes?.data?.items || transfersRes?.data || []
      setTransfers(Array.isArray(transferList) ? transferList : [])

      if (reportRes?.data?.report) {
        setReportSummary(reportRes.data.report)
      } else if (reportRes?.data) {
        setReportSummary(reportRes.data)
      }
    } catch (err) {
      console.error("Could not load stock transfers report:", err)
      setTransfers([])
      setReportSummary(null)
    } finally {
      setIsLoading(false)
    }
  }, [branchId, dateFrom, dateTo, directionFilter, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(loadReportData, 50)
    return () => window.clearTimeout(timer)
  }, [loadReportData])

  // Filtered Transfers
  const filteredTransfers = useMemo(() => {
    let list = transfers

    // Date range filter
    if (dateFrom || dateTo) {
      list = list.filter((t) => {
        const dtStr = (t.transferDate || t.createdAt || "").slice(0, 10)
        if (!dtStr) return true
        if (dateFrom && dtStr < dateFrom) return false
        if (dateTo && dtStr > dateTo) return false
        return true
      })
    }

    // Origin Branch filter
    if (originBranchFilter !== "ALL") {
      list = list.filter((t) => t.fromBranchId === originBranchFilter || t.fromBranch?.id === originBranchFilter)
    }

    // Destination Branch filter
    if (destBranchFilter !== "ALL") {
      list = list.filter((t) => t.toBranchId === destBranchFilter || t.toBranch?.id === destBranchFilter)
    }

    // Direction filter
    if (branchId && directionFilter !== "ALL") {
      if (directionFilter === "OUT") {
        list = list.filter((t) => t.fromBranchId === branchId || t.fromBranch?.id === branchId)
      } else if (directionFilter === "IN") {
        list = list.filter((t) => t.toBranchId === branchId || t.toBranch?.id === branchId)
      }
    }

    // Live search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((t) => {
        const code = String(t.transferCode || "").toLowerCase()
        const fromName = String(t.fromBranch?.name || t.fromBranch?.code || "").toLowerCase()
        const toName = String(t.toBranch?.name || t.toBranch?.code || "").toLowerCase()
        const notes = String(t.notes || "").toLowerCase()
        const itemsMatch = (t.items || []).some((it) => {
          const name = String(it.item?.itemName || it.description || "").toLowerCase()
          const code = String(it.item?.itemCode || "").toLowerCase()
          const serials = (it.serials || []).some((s) =>
            String(s.serialNumberSnapshot || s.itemSerial?.serialNumber || "").toLowerCase().includes(q)
          )
          return name.includes(q) || code.includes(q) || serials
        })
        return code.includes(q) || fromName.includes(q) || toName.includes(q) || notes.includes(q) || itemsMatch
      })
    }

    return list
  }, [transfers, dateFrom, dateTo, originBranchFilter, destBranchFilter, branchId, directionFilter, searchQuery])

  // Flattened Itemized Manifest
  const itemizedManifest = useMemo(() => {
    const rows = []
    filteredTransfers.forEach((t) => {
      (t.items || []).forEach((item, idx) => {
        const unitPrice = Number(item.agreedTransferUnitPrice ?? item.proposedTransferUnitPrice ?? 0)
        const qty = Number(item.quantity || 0)
        const lineTotal = Number(item.transferAmount || unitPrice * qty)
        const serialList = (item.serials || []).map(
          (s) => s.serialNumberSnapshot || s.itemSerial?.serialNumber || ""
        ).filter(Boolean)

        rows.push({
          id: `${t.id}-${item.id || idx}`,
          transferId: t.id,
          transferCode: t.transferCode,
          status: t.status,
          fulfillmentStatus: t.fulfillmentStatus,
          fulfillmentMethod: t.fulfillmentMethod,
          fromBranch: t.fromBranch,
          toBranch: t.toBranch,
          transferDate: t.transferDate || t.createdAt,
          itemCode: item.item?.itemCode || "—",
          itemName: item.item?.itemName || item.description || "Transferred Product",
          isSerialized: Boolean(item.item?.isSerialized || serialList.length > 0),
          quantity: qty,
          batchCode: item.fromBatch?.batchCode || "Standard",
          serials: serialList,
          unitPrice,
          lineTotal,
        })
      })
    })
    return rows
  }, [filteredTransfers])

  // Route Aggregation Matrix
  const routeMatrix = useMemo(() => {
    const map = new Map()

    filteredTransfers.forEach((t) => {
      const key = `${t.fromBranch?.code || "—"} → ${t.toBranch?.code || "—"}`
      if (!map.has(key)) {
        map.set(key, {
          routeKey: key,
          fromBranch: t.fromBranch,
          toBranch: t.toBranch,
          transferCount: 0,
          totalUnits: 0,
          totalValue: 0,
          inTransitCount: 0,
          completedCount: 0,
          transfers: [],
        })
      }

      const rec = map.get(key)
      rec.transferCount += 1
      rec.transfers.push(t)

      const transferUnits = (t.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0)
      const transferVal = (t.items || []).reduce(
        (s, it) => s + Number(it.transferAmount ?? (Number(it.agreedTransferUnitPrice || 0) * Number(it.quantity || 0))),
        0
      )

      rec.totalUnits += transferUnits
      rec.totalValue += transferVal

      if (t.fulfillmentStatus === "IN_TRANSIT") rec.inTransitCount += 1
      if (t.status === "POSTED") rec.completedCount += 1
    })

    const list = Array.from(map.values())
    list.sort((a, b) => b.totalValue - a.totalValue)
    return list
  }, [filteredTransfers])

  // Active In-Transit Watchboard
  const inTransitShipments = useMemo(() => {
    return filteredTransfers.filter((t) => t.fulfillmentStatus === "IN_TRANSIT" && t.status !== "CANCELLED")
  }, [filteredTransfers])

  // Branch Reconciliation Ledger
  const reconciliationData = useMemo(() => {
    const map = new Map()

    branches.forEach((b) => {
      map.set(b.id, {
        branchId: b.id,
        branchCode: b.code,
        branchName: b.name,
        outboundTransfers: 0,
        outboundUnits: 0,
        outboundSalesValue: 0,
        inboundTransfers: 0,
        inboundUnits: 0,
        inboundPurchaseValue: 0,
        netInterBranchBalance: 0,
      })
    })

    filteredTransfers.forEach((t) => {
      const transferUnits = (t.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0)
      const transferVal = (t.items || []).reduce(
        (s, it) => s + Number(it.transferAmount ?? (Number(it.agreedTransferUnitPrice || 0) * Number(it.quantity || 0))),
        0
      )

      // Outbound (fromBranch)
      const fromId = t.fromBranchId || t.fromBranch?.id
      if (map.has(fromId)) {
        const fromRec = map.get(fromId)
        fromRec.outboundTransfers += 1
        fromRec.outboundUnits += transferUnits
        fromRec.outboundSalesValue += transferVal
      }

      // Inbound (toBranch)
      const toId = t.toBranchId || t.toBranch?.id
      if (map.has(toId)) {
        const toRec = map.get(toId)
        toRec.inboundTransfers += 1
        toRec.inboundUnits += transferUnits
        toRec.inboundPurchaseValue += transferVal
      }
    })

    const list = Array.from(map.values())
    list.forEach((b) => {
      b.netInterBranchBalance = b.outboundSalesValue - b.inboundPurchaseValue
    })
    return list.filter((b) => b.outboundTransfers > 0 || b.inboundTransfers > 0)
  }, [branches, filteredTransfers])

  // Disposition Audit (Rejected & Cancelled)
  const dispositionRecords = useMemo(() => {
    return filteredTransfers.filter((t) => t.status === "REJECTED" || t.status === "CANCELLED")
  }, [filteredTransfers])

  // Executive Logistics KPIs
  const kpis = useMemo(() => {
    let totalMovementValue = 0
    let totalUnits = 0
    let totalSerials = 0
    let inTransitVal = 0
    let inTransitCount = 0
    let inTransitUnits = 0
    let completedVal = 0
    let completedCount = 0
    let pendingCount = 0

    filteredTransfers.forEach((t) => {
      const tUnits = (t.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0)
      const tSerials = (t.items || []).reduce((s, it) => s + (it.serials?.length || 0), 0)
      const tVal = (t.items || []).reduce(
        (s, it) => s + Number(it.transferAmount ?? (Number(it.agreedTransferUnitPrice || 0) * Number(it.quantity || 0))),
        0
      )

      totalUnits += tUnits
      totalSerials += tSerials
      totalMovementValue += tVal

      if (t.fulfillmentStatus === "IN_TRANSIT" && t.status !== "CANCELLED") {
        inTransitCount += 1
        inTransitVal += tVal
        inTransitUnits += tUnits
      } else if (t.status === "POSTED") {
        completedCount += 1
        completedVal += tVal
      } else if (t.status === "REQUESTED" || t.status === "APPROVED" || t.status === "DRAFT") {
        pendingCount += 1
      }
    })

    return {
      totalMovementValue,
      totalUnits,
      totalSerials,
      inTransitVal,
      inTransitCount,
      inTransitUnits,
      completedVal,
      completedCount,
      pendingCount,
      totalTransfers: filteredTransfers.length,
    }
  }, [filteredTransfers])

  // Pagination current items
  const currentItems = useMemo(() => {
    if (activeTab === "TRANSIT_OVERVIEW") {
      const start = (page - 1) * pageSize
      return routeMatrix.slice(start, start + pageSize)
    }
    if (activeTab === "MANIFEST") {
      const start = (page - 1) * pageSize
      return itemizedManifest.slice(start, start + pageSize)
    }
    if (activeTab === "RECONCILIATION") {
      const start = (page - 1) * pageSize
      return reconciliationData.slice(start, start + pageSize)
    }
    if (activeTab === "DISPOSITION_AUDIT") {
      const start = (page - 1) * pageSize
      return dispositionRecords.slice(start, start + pageSize)
    }
    return []
  }, [activeTab, page, routeMatrix, itemizedManifest, reconciliationData, dispositionRecords])

  const totalPages = useMemo(() => {
    let total = 0
    if (activeTab === "TRANSIT_OVERVIEW") total = routeMatrix.length
    if (activeTab === "MANIFEST") total = itemizedManifest.length
    if (activeTab === "RECONCILIATION") total = reconciliationData.length
    if (activeTab === "DISPOSITION_AUDIT") total = dispositionRecords.length
    return Math.max(1, Math.ceil(total / pageSize))
  }, [activeTab, routeMatrix.length, itemizedManifest.length, reconciliationData.length, dispositionRecords.length])

  // Professional Excel Export
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        { label: "Branch Context", value: branchName },
        { label: "Timeframe", value: timeframe.replace(/_/g, " ") },
      ]
      if (dateFrom || dateTo) {
        activeFilters.push({ label: "Date Range", value: `${dateFrom || "Start"} to ${dateTo || "End"}` })
      }
      if (directionFilter !== "ALL") {
        activeFilters.push({ label: "Transfer Direction", value: directionFilter === "OUT" ? "Outbound Only" : "Inbound Only" })
      }
      if (statusFilter) {
        activeFilters.push({ label: "Status", value: formatStatus(statusFilter) })
      }
      if (originBranchFilter !== "ALL") {
        const found = branches.find((b) => b.id === originBranchFilter)
        activeFilters.push({ label: "Origin Branch", value: found?.name || originBranchFilter })
      }
      if (destBranchFilter !== "ALL") {
        const found = branches.find((b) => b.id === destBranchFilter)
        activeFilters.push({ label: "Destination Branch", value: found?.name || destBranchFilter })
      }

      if (activeTab === "TRANSIT_OVERVIEW") {
        const headers = [
          "Transfer Route",
          "Origin Branch",
          "Destination Branch",
          "Total Transfers",
          "Total Units Moved",
          "Active In-Transit",
          "Completed / Received",
          "Total Cargo Valuation (₱)",
        ]

        const rows = routeMatrix.map((r) => [
          r.routeKey,
          r.fromBranch?.name || r.fromBranch?.code || "—",
          r.toBranch?.name || r.toBranch?.code || "—",
          r.transferCount,
          r.totalUnits,
          r.inTransitCount,
          r.completedCount,
          r.totalValue,
        ])

        exportReportExcel({
          title: "INTER-BRANCH LOGISTICS & ROUTE TRANSIT OVERVIEW",
          branchName,
          generatedBy: user?.fullName || user?.username || "Management",
          filenamePrefix: "stock_transfers_logistics",
          headers,
          rows,
          activeFilters,
        })
      } else if (activeTab === "MANIFEST") {
        const headers = [
          "Transfer Code",
          "Route",
          "Date",
          "Status",
          "Item Code",
          "Product Description",
          "Quantity",
          "Batch Code",
          "Serial Numbers Attached",
          "Agreed Unit Price (₱)",
          "Extended Amount (₱)",
        ]

        const rows = itemizedManifest.map((m) => [
          m.transferCode,
          `${m.fromBranch?.code || "—"} → ${m.toBranch?.code || "—"}`,
          dateLabel(m.transferDate),
          formatStatus(m.status, m.fulfillmentStatus),
          m.itemCode,
          m.itemName,
          m.quantity,
          m.batchCode,
          m.serials.length > 0 ? m.serials.join(", ") : "Non-serialized",
          m.unitPrice,
          m.lineTotal,
        ])

        exportReportExcel({
          title: "ITEMIZED TRANSFER MANIFEST & SERIAL TRACEABILITY LEDGER",
          branchName,
          generatedBy: user?.fullName || user?.username || "Management",
          filenamePrefix: "transfer_itemized_manifest",
          headers,
          rows,
          activeFilters,
        })
      } else if (activeTab === "RECONCILIATION") {
        const headers = [
          "Branch Code",
          "Branch Name",
          "Outbound Transfers Count",
          "Outbound Units Shipped",
          "Outbound Transfer Sales (₱)",
          "Inbound Transfers Count",
          "Inbound Units Received",
          "Inbound Transfer Purchases (₱)",
          "Net Inter-Branch Balance (₱)",
        ]

        const rows = reconciliationData.map((b) => [
          b.branchCode,
          b.branchName,
          b.outboundTransfers,
          b.outboundUnits,
          b.outboundSalesValue,
          b.inboundTransfers,
          b.inboundUnits,
          b.inboundPurchaseValue,
          b.netInterBranchBalance,
        ])

        exportReportExcel({
          title: "INTER-BRANCH RECONCILIATION & INTERNAL VALUATION REPORT",
          branchName,
          generatedBy: user?.fullName || user?.username || "Management",
          filenamePrefix: "interbranch_reconciliation",
          headers,
          rows,
          activeFilters,
        })
      } else if (activeTab === "DISPOSITION_AUDIT") {
        const headers = [
          "Transfer Code",
          "Origin Branch",
          "Destination Branch",
          "Date Requested",
          "Disposition Status",
          "Reason Provided",
          "Processed By",
          "Prevented Cargo Value (₱)",
        ]

        const rows = dispositionRecords.map((d) => {
          const val = (d.items || []).reduce(
            (s, it) => s + Number(it.transferAmount ?? (Number(it.agreedTransferUnitPrice || 0) * Number(it.quantity || 0))),
            0
          )
          const reason = d.status === "REJECTED" ? d.rejectionReason : d.cancellationReason
          const handler = d.status === "REJECTED" ? d.rejectedBy?.fullName : d.cancelledBy?.fullName
          return [
            d.transferCode,
            d.fromBranch?.name || d.fromBranch?.code || "—",
            d.toBranch?.name || d.toBranch?.code || "—",
            dateLabel(d.requestedAt || d.createdAt),
            d.status,
            reason || "No explicit reason stated",
            handler || "Supervisor",
            val,
          ]
        })

        exportReportExcel({
          title: "REJECTED & CANCELLED STOCK TRANSFERS AUDIT REPORT",
          branchName,
          generatedBy: user?.fullName || user?.username || "Management",
          filenamePrefix: "transfer_disposition_audit",
          headers,
          rows,
          activeFilters,
        })
      }
    } catch (err) {
      console.error("Export error:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. EXECUTIVE LOGISTICS KPI METRIC CARDS */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Stock Movement Value */}
        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-indigo-600 text-white shadow-md">
              <Coins size={22} />
            </span>
            <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/60 px-2.5 py-0.5 text-xs font-black text-indigo-800 dark:text-indigo-300">
              Total Cargo
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Stock Movement Value
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-[var(--color-text-strong)]">
              {money(kpis.totalMovementValue)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {kpis.totalUnits.toLocaleString()} units across {kpis.totalTransfers} transfer(s)
            </p>
          </div>
        </div>

        {/* Active In-Transit */}
        <div className="relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-sky-600 text-white shadow-md">
              <Truck size={22} />
            </span>
            <span className="rounded-full bg-sky-100 dark:bg-sky-950/60 px-2.5 py-0.5 text-xs font-black text-sky-800 dark:text-sky-300">
              On the Road
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              In-Transit Cargo
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-sky-600 dark:text-sky-400">
              {money(kpis.inTransitVal)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {kpis.inTransitCount} active shipment(s) · {kpis.inTransitUnits} units
            </p>
          </div>
        </div>

        {/* Completed & Received */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <PackageCheck size={22} />
            </span>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-black text-emerald-800 dark:text-emerald-300">
              Replenished
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Completed Deliveries
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {money(kpis.completedVal)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {kpis.completedCount} posted & verified transfer(s)
            </p>
          </div>
        </div>

        {/* Pending Requests & Dispatches */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-amber-500 text-white shadow-md">
              <Clock size={22} />
            </span>
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-black text-amber-800 dark:text-amber-300">
              Action Needed
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Pending Approvals
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
              {kpis.pendingCount} Transfers
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Requested or approved awaiting dispatch
            </p>
          </div>
        </div>

        {/* Serialized Units in Motion */}
        <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-purple-600 text-white shadow-md">
              <Boxes size={22} />
            </span>
            <span className="rounded-full bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 text-xs font-black text-purple-800 dark:text-purple-300">
              Hardware
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Serialized Hardware
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-purple-600 dark:text-purple-400">
              {kpis.totalSerials.toLocaleString()} Serials
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Assigned barcodes & serials tracked
            </p>
          </div>
        </div>
      </section>

      {/* 2. CONTROLS: TIMEFRAMES, DIRECTION, FILTERS & EXPORT */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card space-y-4">
        {/* Quick Timeframe Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-bold text-[var(--color-muted)] flex items-center gap-1">
              <Calendar size={13} /> Timeframe:
            </span>
            {[
              { id: "TODAY", label: "Today" },
              { id: "YESTERDAY", label: "Yesterday" },
              { id: "THIS_WEEK", label: "This Week" },
              { id: "THIS_MONTH", label: "This Month" },
              { id: "LAST_30_DAYS", label: "Last 30 Days" },
              { id: "ALL", label: "All Time" },
              { id: "CUSTOM", label: "Custom Range" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setTimeframe(btn.id)}
                type="button"
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  timeframe === btn.id
                    ? "bg-[var(--color-maroon)] text-white shadow-xs"
                    : "bg-[var(--color-soft)] text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadReportData}
              disabled={isLoading}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-border)] disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            <ExportExcelButton
              count={
                activeTab === "TRANSIT_OVERVIEW"
                  ? routeMatrix.length
                  : activeTab === "MANIFEST"
                  ? itemizedManifest.length
                  : activeTab === "RECONCILIATION"
                  ? reconciliationData.length
                  : dispositionRecords.length
              }
              isExporting={isExporting}
              onClick={handleExportExcel}
            />
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Custom Date Range */}
          {timeframe === "CUSTOM" && (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-medium text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-medium text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                />
              </div>
            </>
          )}

          {/* Direction Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
              Transfer Direction
            </label>
            <select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="ALL">All Directions (In & Out)</option>
              <option value="OUT">Outbound (Transfer Out)</option>
              <option value="IN">Inbound (Transfer In)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
              Fulfillment Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="">All Statuses</option>
              <option value="POSTED">Posted (Received & Completed)</option>
              <option value="APPROVED">Approved (Ready to Dispatch)</option>
              <option value="REQUESTED">Requested (Pending Approval)</option>
              <option value="DRAFT">Draft</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Origin Branch Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
              Origin Branch (Source)
            </label>
            <select
              value={originBranchFilter}
              onChange={(e) => {
                setOriginBranchFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="ALL">All Origins ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Branch Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
              Destination Branch (Target)
            </label>
            <select
              value={destBranchFilter}
              onChange={(e) => {
                setDestBranchFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="ALL">All Destinations ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className={timeframe === "CUSTOM" ? "sm:col-span-2 lg:col-span-5" : ""}>
            <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
              Live Search
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" />
              <input
                type="text"
                placeholder="Search transfer #, item name, serial, notes..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] pl-9 pr-8 py-2 text-xs font-medium text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)] placeholder:text-[var(--color-muted)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  type="button"
                  className="absolute right-2.5 top-2.5 text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. AUDIT PERSPECTIVE TABS */}
      <div className="flex border-b border-[var(--color-border)] text-xs font-black overflow-x-auto">
        {[
          { id: "TRANSIT_OVERVIEW", label: "Inter-Branch Route & Logistics Overview", icon: Truck, count: routeMatrix.length },
          { id: "MANIFEST", label: "Itemized Transfer Manifest & Serials", icon: Layers, count: itemizedManifest.length },
          { id: "RECONCILIATION", label: "Branch Reconciliation & Internal Valuation", icon: Coins, count: reconciliationData.length },
          { id: "DISPOSITION_AUDIT", label: "Disposition Audit (Rejected & Cancelled)", icon: ShieldAlert, count: dispositionRecords.length },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setPage(1)
              }}
              type="button"
              className={`flex items-center gap-2 border-b-2 px-5 py-3 transition whitespace-nowrap ${
                isActive
                  ? "border-[var(--color-maroon)] text-[var(--color-maroon)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${isActive ? "bg-[var(--color-maroon)]/10 text-[var(--color-maroon)]" : "bg-[var(--color-soft)] text-[var(--color-muted)]"}`}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 4. TAB CONTENTS */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-[var(--color-muted)]">
          <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={32} />
          <p className="mt-3 text-xs font-bold">Synchronizing inter-branch stock logistics and manifests…</p>
        </div>
      ) : (
        <>
          {/* TAB 1: ROUTE & TRANSIT OVERVIEW */}
          {activeTab === "TRANSIT_OVERVIEW" && (
            <div className="space-y-6">
              {/* Active In-Transit Watchboard */}
              {inTransitShipments.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400">
                      <Truck size={14} />
                    </span>
                    <h3 className="text-sm font-black text-[var(--color-text-strong)]">
                      Active In-Transit Watchboard ({inTransitShipments.length} Cargo En Route)
                    </h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {inTransitShipments.map((shipment) => {
                      const units = (shipment.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0)
                      const val = (shipment.items || []).reduce(
                        (s, it) => s + Number(it.transferAmount ?? (Number(it.agreedTransferUnitPrice || 0) * Number(it.quantity || 0))),
                        0
                      )

                      return (
                        <div
                          key={shipment.id}
                          className="rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-[var(--color-text-strong)]">
                              {shipment.transferCode}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-950/60 px-2.5 py-0.5 text-[10px] font-black text-sky-800 dark:text-sky-300">
                              <Truck size={11} /> In Transit
                            </span>
                          </div>

                          <div className="mt-3 flex items-center gap-2 text-sm font-black text-[var(--color-text-strong)]">
                            <span>{shipment.fromBranch?.code || "Origin"}</span>
                            <ArrowLeftRight size={14} className="text-[var(--color-muted)]" />
                            <span>{shipment.toBranch?.code || "Destination"}</span>
                          </div>
                          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                            {shipment.fromBranch?.name} → {shipment.toBranch?.name}
                          </p>

                          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3 text-xs">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-[var(--color-muted)] block">Cargo Units</span>
                              <span className="font-mono font-bold text-[var(--color-text-strong)]">{units} units</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase text-[var(--color-muted)] block">Cargo Value</span>
                              <span className="font-mono font-black text-[var(--color-maroon)]">{money(val)}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between pt-1">
                            <span className="text-[10px] text-[var(--color-muted)]">
                              Dispatched: {dateLabel(shipment.transferDate || shipment.createdAt)}
                            </span>
                            <button
                              onClick={() => setSelectedTransferDetail(shipment)}
                              type="button"
                              className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-strong)] hover:bg-[var(--color-border)] transition"
                            >
                              <Eye size={12} /> Inspect
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Route Summary Table */}
              <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-xs">
                    <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                      <tr>
                        <th className="px-4 py-3.5">Transfer Route</th>
                        <th className="px-4 py-3.5">Origin Branch</th>
                        <th className="px-4 py-3.5">Destination Branch</th>
                        <th className="px-4 py-3.5 text-center">Shipment Count</th>
                        <th className="px-4 py-3.5 text-right">Units Moved</th>
                        <th className="px-4 py-3.5 text-center">In-Transit</th>
                        <th className="px-4 py-3.5 text-center">Completed</th>
                        <th className="px-4 py-3.5 text-right">Total Cargo Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] font-medium">
                      {currentItems.map((route) => (
                        <tr key={route.routeKey} className="hover:bg-[var(--color-soft)]/40 transition">
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-soft)] px-3 py-1 font-mono font-bold text-[var(--color-text-strong)] border border-[var(--color-border)]">
                              {route.routeKey}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-[var(--color-text-strong)]">{route.fromBranch?.name || route.fromBranch?.code}</p>
                            <p className="text-[10px] text-[var(--color-muted)]">{route.fromBranch?.code}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-[var(--color-text-strong)]">{route.toBranch?.name || route.toBranch?.code}</p>
                            <p className="text-[10px] text-[var(--color-muted)]">{route.toBranch?.code}</p>
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-[var(--color-text-strong)]">
                            {route.transferCount}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-[var(--color-text-strong)]">
                            {route.totalUnits.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              route.inTransitCount > 0 ? "bg-sky-50 text-sky-700 border border-sky-200" : "text-[var(--color-muted)]"
                            }`}>
                              {route.inTransitCount}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                              {route.completedCount}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-black text-sm text-[var(--color-maroon)]">
                            {money(route.totalValue)}
                          </td>
                        </tr>
                      ))}
                      {routeMatrix.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-[var(--color-muted)]">
                            <Truck size={32} className="mx-auto text-[var(--color-muted)]/50" />
                            <p className="mt-2 text-xs font-bold text-[var(--color-text-strong)]">
                              No inter-branch routes matching active filters
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ITEMIZED TRANSFER MANIFEST & SERIALS */}
          {activeTab === "MANIFEST" && (
            <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-4 py-3.5">Transfer Code & Route</th>
                      <th className="px-4 py-3.5">Product Details</th>
                      <th className="px-4 py-3.5 text-center">Qty / Batch</th>
                      <th className="px-4 py-3.5">Serial Barcodes</th>
                      <th className="px-4 py-3.5 text-right">Unit Price</th>
                      <th className="px-4 py-3.5 text-right">Line Total</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] font-medium">
                    {currentItems.map((manifestRow) => (
                      <tr key={manifestRow.id} className="hover:bg-[var(--color-soft)]/40 transition">
                        <td className="px-4 py-3.5">
                          <p className="font-mono font-bold text-[var(--color-text-strong)]">
                            {manifestRow.transferCode}
                          </p>
                          <p className="text-[10px] text-[var(--color-muted)] font-semibold">
                            {manifestRow.fromBranch?.code || "—"} → {manifestRow.toBranch?.code || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-[var(--color-text-strong)] max-w-xs truncate">
                            {manifestRow.itemName}
                          </p>
                          <p className="text-[10px] font-mono text-[var(--color-muted)]">
                            {manifestRow.itemCode}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono">
                          <span className="font-bold text-[var(--color-text-strong)]">{manifestRow.quantity}</span>
                          <span className="text-[10px] text-[var(--color-muted)] block font-normal">{manifestRow.batchCode}</span>
                        </td>
                        <td className="px-4 py-3.5 max-w-xs">
                          {manifestRow.serials.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                              {manifestRow.serials.map((s, sidx) => (
                                <span
                                  key={sidx}
                                  className="inline-flex rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 text-[10px] font-mono font-bold"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--color-muted)] italic">Non-serialized SKU</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-[var(--color-text-strong)]">
                          {money(manifestRow.unitPrice)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-black text-sm text-[var(--color-maroon)]">
                          {money(manifestRow.lineTotal)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black border ${statusTone(manifestRow.status, manifestRow.fulfillmentStatus)}`}>
                            {formatStatus(manifestRow.status, manifestRow.fulfillmentStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[var(--color-muted)]">
                          {dateLabel(manifestRow.transferDate)}
                        </td>
                      </tr>
                    ))}
                    {itemizedManifest.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-[var(--color-muted)]">
                          <Layers size={32} className="mx-auto text-[var(--color-muted)]/50" />
                          <p className="mt-2 text-xs font-bold text-[var(--color-text-strong)]">
                            No items found in active manifest
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BRANCH RECONCILIATION & VALUATION */}
          {activeTab === "RECONCILIATION" && (
            <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-4 py-3.5">Branch</th>
                      <th className="px-4 py-3.5 text-center">Outbound Transfers</th>
                      <th className="px-4 py-3.5 text-right">Units Shipped</th>
                      <th className="px-4 py-3.5 text-right">Transfer Sales Value</th>
                      <th className="px-4 py-3.5 text-center">Inbound Transfers</th>
                      <th className="px-4 py-3.5 text-right">Units Received</th>
                      <th className="px-4 py-3.5 text-right">Transfer Purchase Cost</th>
                      <th className="px-4 py-3.5 text-right">Net Inter-Branch Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] font-medium">
                    {currentItems.map((recon) => {
                      const isPositive = recon.netInterBranchBalance >= 0
                      return (
                        <tr key={recon.branchId} className="hover:bg-[var(--color-soft)]/40 transition">
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-[var(--color-text-strong)]">{recon.branchName}</p>
                            <p className="text-[10px] font-mono text-[var(--color-muted)]">{recon.branchCode}</p>
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-amber-700 dark:text-amber-400">
                            {recon.outboundTransfers}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-[var(--color-muted)]">
                            {recon.outboundUnits.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                            {money(recon.outboundSalesValue)}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-sky-700 dark:text-sky-400">
                            {recon.inboundTransfers}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-[var(--color-muted)]">
                            {recon.inboundUnits.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-sky-700 dark:text-sky-400">
                            {money(recon.inboundPurchaseValue)}
                          </td>
                          <td className={`px-4 py-3.5 text-right font-mono font-black text-sm ${
                            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          }`}>
                            {isPositive ? `+${money(recon.netInterBranchBalance)}` : money(recon.netInterBranchBalance)}
                          </td>
                        </tr>
                      )
                    })}
                    {reconciliationData.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-[var(--color-muted)]">
                          <Coins size={32} className="mx-auto text-[var(--color-muted)]/50" />
                          <p className="mt-2 text-xs font-bold text-[var(--color-text-strong)]">
                            No branch transfer movements to reconcile
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DISPOSITION AUDIT (REJECTED & CANCELLED) */}
          {activeTab === "DISPOSITION_AUDIT" && (
            <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-4 py-3.5">Transfer Code</th>
                      <th className="px-4 py-3.5">Route</th>
                      <th className="px-4 py-3.5">Disposition</th>
                      <th className="px-4 py-3.5">Reason Given</th>
                      <th className="px-4 py-3.5">Responsible User</th>
                      <th className="px-4 py-3.5 text-right">Prevented Stock Value</th>
                      <th className="px-4 py-3.5">Date Processed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] font-medium">
                    {currentItems.map((disp) => {
                      const reason = disp.status === "REJECTED" ? disp.rejectionReason : disp.cancellationReason
                      const userObj = disp.status === "REJECTED" ? disp.rejectedBy : disp.cancelledBy
                      const val = (disp.items || []).reduce(
                        (s, it) => s + Number(it.transferAmount ?? (Number(it.agreedTransferUnitPrice || 0) * Number(it.quantity || 0))),
                        0
                      )

                      return (
                        <tr key={disp.id} className="hover:bg-[var(--color-soft)]/40 transition">
                          <td className="px-4 py-3.5 font-mono font-bold text-[var(--color-text-strong)]">
                            {disp.transferCode}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-[var(--color-text-strong)]">
                            {disp.fromBranch?.code || "—"} → {disp.toBranch?.code || "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black border ${statusTone(disp.status)}`}>
                              {disp.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-rose-700 dark:text-rose-300 font-medium max-w-sm">
                            {reason || "No explicit reason logged."}
                          </td>
                          <td className="px-4 py-3.5 text-[var(--color-text-strong)]">
                            {userObj?.fullName || userObj?.username || "Supervisor"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-black text-slate-700 dark:text-slate-300">
                            {money(val)}
                          </td>
                          <td className="px-4 py-3.5 text-[var(--color-muted)]">
                            {dateLabel(disp.status === "REJECTED" ? disp.rejectedAt : disp.cancelledAt || disp.updatedAt)}
                          </td>
                        </tr>
                      )
                    })}
                    {dispositionRecords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-[var(--color-muted)]">
                          <ShieldAlert size={32} className="mx-auto text-[var(--color-muted)]/50" />
                          <p className="mt-2 text-xs font-bold text-[var(--color-text-strong)]">
                            No rejected or cancelled transfers on record
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. PAGINATION FOOTER */}
          <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-xs text-[var(--color-muted)] shadow-xs">
            <p>
              Showing Page <strong className="text-[var(--color-text-strong)]">{page}</strong> of{" "}
              <strong className="text-[var(--color-text-strong)]">{totalPages}</strong>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                type="button"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-2 text-[var(--color-text-strong)] disabled:opacity-30 hover:bg-[var(--color-border)] transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                type="button"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-2 text-[var(--color-text-strong)] disabled:opacity-30 hover:bg-[var(--color-border)] transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        </>
      )}

      {/* 6. TRANSFER DETAIL INSPECT MODAL */}
      {selectedTransferDetail && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  <Truck size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedTransferDetail.transferCode}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedTransferDetail.fromBranch?.name || selectedTransferDetail.fromBranch?.code} → {selectedTransferDetail.toBranch?.name || selectedTransferDetail.toBranch?.code}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTransferDetail(null)}
                type="button"
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Status</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black mt-1 border ${statusTone(selectedTransferDetail.status, selectedTransferDetail.fulfillmentStatus)}`}>
                    {formatStatus(selectedTransferDetail.status, selectedTransferDetail.fulfillmentStatus)}
                  </span>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Date</span>
                  <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {dateLabel(selectedTransferDetail.transferDate || selectedTransferDetail.createdAt)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Items</span>
                  <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {(selectedTransferDetail.items || []).length} lines · {(selectedTransferDetail.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0)} units
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Cargo Valuation</span>
                  <p className="mt-1 font-mono text-sm font-black text-[var(--color-maroon)]">
                    {money((selectedTransferDetail.items || []).reduce(
                      (s, it) => s + Number(it.transferAmount ?? (Number(it.agreedTransferUnitPrice || 0) * Number(it.quantity || 0))),
                      0
                    ))}
                  </p>
                </div>
              </div>

              {selectedTransferDetail.notes && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 text-xs text-slate-600 dark:text-slate-300">
                  <strong className="block text-[10px] uppercase text-slate-400">Transfer Notes:</strong>
                  {selectedTransferDetail.notes}
                </div>
              )}

              {/* Items list */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                  Transferred Merchandise Items ({(selectedTransferDetail.items || []).length})
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Product</th>
                        <th className="px-3 py-2.5 text-center">Qty</th>
                        <th className="px-3 py-2.5">Batch</th>
                        <th className="px-3 py-2.5">Serials Attached</th>
                        <th className="px-3 py-2.5 text-right">Unit Price</th>
                        <th className="px-3 py-2.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(selectedTransferDetail.items || []).map((item, idx) => {
                        const unitPrice = Number(item.agreedTransferUnitPrice ?? item.proposedTransferUnitPrice ?? 0)
                        const qty = Number(item.quantity || 0)
                        const lineTot = Number(item.transferAmount ?? unitPrice * qty)
                        const sList = (item.serials || []).map((s) => s.serialNumberSnapshot || s.itemSerial?.serialNumber || "").filter(Boolean)

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-3 py-2">
                              <p className="font-bold text-slate-900 dark:text-white">
                                {item.item?.itemName || item.description || "Product"}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400">{item.item?.itemCode || "—"}</p>
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-200">
                              {qty}
                            </td>
                            <td className="px-3 py-2 text-[10px] text-slate-500 font-mono">
                              {item.fromBatch?.batchCode || "Standard"}
                            </td>
                            <td className="px-3 py-2 max-w-xs">
                              {sList.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {sList.map((s, si) => (
                                    <span key={si} className="rounded bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-1 py-0.5 text-[9px] font-mono font-bold">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">
                              {money(unitPrice)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-black text-[var(--color-maroon)]">
                              {money(lineTot)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 px-6 py-3">
              <button
                onClick={() => setSelectedTransferDetail(null)}
                type="button"
                className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
