import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Award,
  BadgePercent,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react"

import {
  getIncentiveClaims,
  getIncentiveCycles,
  getIncentives,
} from "../../features/incentives/incentives.api"
import { getUsers } from "../../features/users/users.api"
import { exportReportExcel } from "../../utils/businessDocumentExport"
import ExportExcelButton from "../../components/common/ExportExcelButton"

const TYPES = [
  { value: "", label: "All incentive types" },
  { value: "SALE_ITEM", label: "Product sale" },
  { value: "QUOTATION_SERVICE", label: "Quotation service" },
  { value: "SERVICE_JOB", label: "Service job" },
]

const CLASSIFICATION_LABELS = {
  NONE: "Standard Staff",
  SALES_AGENT: "Sales Agent",
  SENIOR_SALES_AGENT: "Senior Sales Agent",
  TECHNICIAN: "Technician",
  SENIOR_TECHNICIAN: "Senior Technician",
}

function money(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function dateLabel(value) {
  if (!value) return "—"
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
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

function typeLabel(value) {
  return TYPES.find((option) => option.value === value)?.label || String(value || "—").replaceAll("_", " ")
}

function classificationLabel(value) {
  return CLASSIFICATION_LABELS[value] || (value ? String(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : "Staff")
}

function phaseTone(status) {
  return (
    {
      EARNING: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
      CUT_OFF: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      CLAIMABLE: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      CLOSED: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    }[status] || "bg-slate-100 text-slate-700 border-slate-200"
  )
}

function claimTone(status) {
  return (
    {
      CLAIMED: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      APPROVED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
      PAID: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      EXPIRED: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    }[status] || "bg-slate-100 text-slate-700 border-slate-200"
  )
}

export default function IncentivesReportView({
  branchId,
  selectedBranch,
  user,
  staff = [],
  onRefresh,
}) {
  const branchName = selectedBranch?.name || user?.branch?.name || "All Branches"

  // Active Audit Mode
  const [activeTab, setActiveTab] = useState("STAFF_SUMMARY") // "STAFF_SUMMARY" | "TRANSACTIONS" | "CYCLES" | "CLAIMS"

  // Date Range Filtering
  const [timeframe, setTimeframe] = useState("THIS_MONTH") // "ALL" | "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_30_DAYS" | "CUSTOM"
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Filter Selectors
  const [selectedStaffFilter, setSelectedStaffFilter] = useState("ALL")
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("")
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("POSTED")
  const [searchQuery, setSearchQuery] = useState("")

  // Data states
  const [entries, setEntries] = useState([])
  const [totals, setTotals] = useState({})
  const [cycles, setCycles] = useState([])
  const [claims, setClaims] = useState([])
  const [staffList, setStaffList] = useState(staff || [])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [expandedCycleId, setExpandedCycleId] = useState(null)
  const [selectedStaffDetail, setSelectedStaffDetail] = useState(null)

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

  // Load Staff if not provided
  useEffect(() => {
    if (staffList.length > 0) return
    let active = true
    async function fetchStaff() {
      try {
        const res = await getUsers({
          ...(branchId ? { branchId } : {}),
          status: "ACTIVE",
          limit: 100,
        })
        const items = Array.isArray(res?.data) ? res.data : res?.data?.data || []
        if (active) setStaffList(items)
      } catch {
        // ignore
      }
    }
    fetchStaff()
    return () => {
      active = false
    }
  }, [branchId, staffList.length])

  // Load Report Data
  const loadReportData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = {
        ...(branchId ? { branchId } : {}),
        ...(selectedTypeFilter ? { type: selectedTypeFilter } : {}),
        ...(selectedStatusFilter ? { status: selectedStatusFilter } : {}),
        ...(selectedStaffFilter !== "ALL" ? { staffId: selectedStaffFilter } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        limit: 500,
      }

      const [incentivesRes, cyclesRes, claimsRes] = await Promise.all([
        getIncentives(params),
        getIncentiveCycles({ ...(branchId ? { branchId } : {}), limit: 50 }),
        getIncentiveClaims({ ...(branchId ? { branchId } : {}), limit: 100 }),
      ])

      const incResult = incentivesRes?.data || {}
      setEntries(Array.isArray(incResult.entries) ? incResult.entries : [])
      setTotals(incResult.totals || {})
      setCycles(cyclesRes?.data?.cycles || [])
      setClaims(claimsRes?.data?.claims || [])
    } catch (err) {
      console.error("Could not load incentives report:", err)
      setEntries([])
      setTotals({})
      setCycles([])
      setClaims([])
    } finally {
      setIsLoading(false)
    }
  }, [branchId, dateFrom, dateTo, selectedStaffFilter, selectedStatusFilter, selectedTypeFilter])

  useEffect(() => {
    const timer = window.setTimeout(loadReportData, 50)
    return () => window.clearTimeout(timer)
  }, [loadReportData])

  // Filtered Entries (Transactions Ledger)
  const filteredEntries = useMemo(() => {
    let result = entries

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((e) => {
        const code = String(e.sourceCode || e.sourceId || "").toLowerCase()
        const staffName = String(e.staff?.fullName || "").toLowerCase()
        const attribution = String(e.attribution || "").toLowerCase()
        const reason = String(e.reversalReason || "").toLowerCase()
        return code.includes(q) || staffName.includes(q) || attribution.includes(q) || reason.includes(q)
      })
    }

    return result
  }, [entries, searchQuery])

  // Per-Staff Aggregations (Staff Performance & Payout Matrix)
  const staffMatrix = useMemo(() => {
    const map = new Map()

    // Aggregate from entries
    entries.forEach((e) => {
      const sid = e.staff?.id || "unassigned"
      if (!map.has(sid)) {
        map.set(sid, {
          staffId: sid,
          fullName: e.staff?.fullName || "Unassigned / General Pool",
          employeeCode: e.staff?.employeeCode || "—",
          role: e.staff?.role || "—",
          classification: e.classification || e.staff?.incentiveClassification || "NONE",
          productBasis: 0,
          productIncentive: 0,
          productCount: 0,
          serviceBasis: 0,
          serviceIncentive: 0,
          serviceCount: 0,
          totalBasis: 0,
          totalIncentive: 0,
          totalEntries: 0,
          reversedCount: 0,
          reversedAmount: 0,
          sources: [],
        })
      }

      const rec = map.get(sid)
      const isReversed = e.status === "REVERSED"
      const basis = Number(e.basisAmount || 0)
      const amt = Number(e.amount || 0)

      rec.sources.push(e)
      rec.totalEntries += 1

      if (isReversed) {
        rec.reversedCount += 1
        rec.reversedAmount += amt
      } else {
        if (e.sourceType === "SALE_ITEM") {
          rec.productBasis += basis
          rec.productIncentive += amt
          rec.productCount += 1
        } else {
          rec.serviceBasis += basis
          rec.serviceIncentive += amt
          rec.serviceCount += 1
        }
        rec.totalBasis += basis
        rec.totalIncentive += amt
      }
    })

    // Also enrich with staff list who might have 0 entries
    staffList.forEach((s) => {
      if (!map.has(s.id)) {
        map.set(s.id, {
          staffId: s.id,
          fullName: s.fullName,
          employeeCode: s.employeeCode || "—",
          role: s.role,
          classification: s.incentiveClassification || "NONE",
          productBasis: 0,
          productIncentive: 0,
          productCount: 0,
          serviceBasis: 0,
          serviceIncentive: 0,
          serviceCount: 0,
          totalBasis: 0,
          totalIncentive: 0,
          totalEntries: 0,
          reversedCount: 0,
          reversedAmount: 0,
          sources: [],
        })
      }
    })

    let list = Array.from(map.values())

    // Search query on staff
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          String(s.employeeCode || "").toLowerCase().includes(q) ||
          classificationLabel(s.classification).toLowerCase().includes(q)
      )
    }

    // Filter by staff dropdown
    if (selectedStaffFilter !== "ALL") {
      list = list.filter((s) => s.staffId === selectedStaffFilter)
    }

    // Sort descending by total incentive
    list.sort((a, b) => b.totalIncentive - a.totalIncentive)

    return list
  }, [entries, staffList, searchQuery, selectedStaffFilter])

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    let list = claims
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (c) =>
          String(c.staff?.fullName || "").toLowerCase().includes(q) ||
          String(c.cycle?.periodCode || "").toLowerCase().includes(q) ||
          String(c.status || "").toLowerCase().includes(q)
      )
    }
    if (selectedStaffFilter !== "ALL") {
      list = list.filter((c) => c.staff?.id === selectedStaffFilter)
    }
    return list
  }, [claims, searchQuery, selectedStaffFilter])

  // Filtered Cycles
  const filteredCycles = useMemo(() => {
    let list = cycles
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (c) =>
          String(c.periodCode || "").toLowerCase().includes(q) ||
          String(c.status || "").toLowerCase().includes(q) ||
          (c.employees || []).some((emp) => emp.staff?.fullName?.toLowerCase().includes(q))
      )
    }
    return list
  }, [cycles, searchQuery])

  // Executive KPI summary calculations
  const kpis = useMemo(() => {
    const totalAmount = Number(totals.totalAmount || 0)
    const itemAmount = Number(totals.itemAmount || 0)
    const serviceAmount = Number(totals.serviceAmount || 0)
    const totalBasis = Number(totals.totalBasis || 0)
    const postedEntries = Number(totals.postedEntries || 0)
    const reversedEntries = Number(totals.reversedEntries || 0)

    // Calculate active earners
    const activeStaff = staffMatrix.filter((s) => s.totalIncentive > 0)
    const totalClaimsCount = claims.length
    const paidClaimsCount = claims.filter((c) => c.status === "PAID").length
    const claimSettlementRate = totalClaimsCount > 0 ? (paidClaimsCount / totalClaimsCount) * 100 : 0

    return {
      totalAmount,
      itemAmount,
      serviceAmount,
      totalBasis,
      postedEntries,
      reversedEntries,
      activeStaffCount: activeStaff.length,
      totalClaimsCount,
      paidClaimsCount,
      claimSettlementRate,
    }
  }, [totals, staffMatrix, claims])

  // Pagination for current view
  const currentItems = useMemo(() => {
    if (activeTab === "STAFF_SUMMARY") {
      const start = (page - 1) * pageSize
      return staffMatrix.slice(start, start + pageSize)
    }
    if (activeTab === "TRANSACTIONS") {
      const start = (page - 1) * pageSize
      return filteredEntries.slice(start, start + pageSize)
    }
    if (activeTab === "CYCLES") {
      const start = (page - 1) * pageSize
      return filteredCycles.slice(start, start + pageSize)
    }
    if (activeTab === "CLAIMS") {
      const start = (page - 1) * pageSize
      return filteredClaims.slice(start, start + pageSize)
    }
    return []
  }, [activeTab, page, staffMatrix, filteredEntries, filteredCycles, filteredClaims])

  const totalPages = useMemo(() => {
    let total = 0
    if (activeTab === "STAFF_SUMMARY") total = staffMatrix.length
    if (activeTab === "TRANSACTIONS") total = filteredEntries.length
    if (activeTab === "CYCLES") total = filteredCycles.length
    if (activeTab === "CLAIMS") total = filteredClaims.length
    return Math.max(1, Math.ceil(total / pageSize))
  }, [activeTab, staffMatrix.length, filteredEntries.length, filteredCycles.length, filteredClaims.length])

  // Professional Multi-Perspective Excel Export
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        { label: "Branch", value: branchName },
        { label: "Timeframe", value: timeframe.replace(/_/g, " ") },
      ]
      if (dateFrom || dateTo) {
        activeFilters.push({ label: "Date Range", value: `${dateFrom || "Start"} to ${dateTo || "End"}` })
      }
      if (selectedStaffFilter !== "ALL") {
        const found = staffList.find((s) => s.id === selectedStaffFilter)
        activeFilters.push({ label: "Staff", value: found?.fullName || selectedStaffFilter })
      }
      if (selectedTypeFilter) {
        activeFilters.push({ label: "Incentive Type", value: typeLabel(selectedTypeFilter) })
      }
      if (selectedStatusFilter) {
        activeFilters.push({ label: "Ledger Status", value: selectedStatusFilter })
      }

      if (activeTab === "STAFF_SUMMARY") {
        const headers = [
          "Staff Name",
          "Employee Code",
          "Role",
          "Classification",
          "Product Sales Basis (₱)",
          "Product Commission (₱)",
          "Service Jobs Basis (₱)",
          "Technician Incentive (₱)",
          "Total Commission Payout (₱)",
          "Attributed Transactions",
        ]

        const rows = staffMatrix.map((s) => [
          s.fullName,
          s.employeeCode,
          s.role,
          classificationLabel(s.classification),
          s.productBasis,
          s.productIncentive,
          s.serviceBasis,
          s.serviceIncentive,
          s.totalIncentive,
          s.totalEntries,
        ])

        exportReportExcel({
          title: "STAFF COMMISSIONS & INCENTIVES PERFORMANCE REPORT",
          branchName,
          generatedBy: user?.fullName || user?.username || "Management",
          filenamePrefix: "staff_commissions_summary",
          headers,
          rows,
          activeFilters,
        })
      } else if (activeTab === "TRANSACTIONS") {
        const headers = [
          "Source Code",
          "Source Type",
          "Attribution / Role",
          "Staff Name",
          "Classification",
          "Branch",
          "Source Date",
          "Status",
          "Basis Amount (₱)",
          "Rate (%)",
          "Net Incentive (₱)",
          "Reversal Reason",
        ]

        const rows = filteredEntries.map((e) => [
          e.sourceCode || e.sourceId || "—",
          typeLabel(e.sourceType),
          e.attribution || "—",
          e.staff?.fullName || "Unassigned",
          classificationLabel(e.classification),
          e.branch?.code || e.branch?.name || branchName,
          dateLabel(e.sourceDate),
          e.status || "—",
          Number(e.basisAmount || 0),
          Number(e.percent || 0),
          Number(e.amount || 0),
          e.reversalReason || "—",
        ])

        exportReportExcel({
          title: "ITEMIZED INCENTIVE ATTRIBUTION TRANSACTION LEDGER",
          branchName,
          generatedBy: user?.fullName || user?.username || "Management",
          filenamePrefix: "incentive_transactions_ledger",
          headers,
          rows,
          activeFilters,
        })
      } else if (activeTab === "CYCLES") {
        const headers = [
          "Period Code",
          "Start Date",
          "End Date",
          "Cutoff Date",
          "Claim Window",
          "Cycle Status",
          "Eligible Employees",
          "Product Incentives (₱)",
          "Service Incentives (₱)",
          "Total Cycle Payout (₱)",
        ]

        const rows = filteredCycles.map((c) => {
          const empList = c.employees || []
          const prodSum = empList.reduce((acc, emp) => acc + Number(emp.productIncentive || 0), 0)
          const servSum = empList.reduce((acc, emp) => acc + Number(emp.serviceIncentive || 0), 0)
          const totSum = empList.reduce((acc, emp) => acc + Number(emp.totalIncentive || 0), 0)
          return [
            c.periodCode || "—",
            dateLabel(c.startDate),
            dateLabel(c.endDate),
            dateLabel(c.cutoffDate),
            `${dateLabel(c.claimOpenDate)} to ${dateLabel(c.claimCloseDate)}`,
            c.status?.replaceAll("_", " ") || "—",
            empList.length,
            prodSum,
            servSum,
            totSum,
          ]
        })

        exportReportExcel({
          title: "INCENTIVE SCHEDULE & CUTOFF CYCLES AUDIT REPORT",
          branchName,
          generatedBy: user?.fullName || user?.username || "Management",
          filenamePrefix: "incentive_cycles_audit",
          headers,
          rows,
          activeFilters,
        })
      } else if (activeTab === "CLAIMS") {
        const headers = [
          "Claim ID",
          "Employee Name",
          "Cycle Period",
          "Claim Status",
          "Frozen Line Count",
          "Product Incentive (₱)",
          "Service Incentive (₱)",
          "Total Claimed Amount (₱)",
          "Submitted At",
        ]

        const rows = filteredClaims.map((c) => [
          c.id || "—",
          c.staff?.fullName || "Employee",
          c.cycle?.periodCode || "—",
          c.status || "—",
          c.lines?.length || 0,
          Number(c.productIncentive || 0),
          Number(c.serviceIncentive || 0),
          Number(c.totalIncentive || 0),
          dateTime(c.createdAt),
        ])

        exportReportExcel({
          title: "INCENTIVE CLAIMS & DISBURSEMENTS AUDIT REPORT",
          branchName,
          generatedBy: user?.fullName || user?.username || "Management",
          filenamePrefix: "incentive_claims_audit",
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

  // Top 3 earners for podium
  const topEarners = useMemo(() => {
    return staffMatrix.filter((s) => s.totalIncentive > 0).slice(0, 3)
  }, [staffMatrix])

  return (
    <div className="space-y-6">
      {/* 1. EXECUTIVE KPI SUMMARY CARDS */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Commission Payout */}
        <div className="relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-[var(--color-maroon)] text-white shadow-md">
              <CircleDollarSign size={22} />
            </span>
            <span className="rounded-full bg-rose-100 dark:bg-rose-950/60 px-2.5 py-0.5 text-xs font-black text-[var(--color-maroon)] dark:text-rose-300">
              Net Payable
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Total Commission Payout
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-[var(--color-text-strong)]">
              {money(kpis.totalAmount)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {kpis.postedEntries} active payable incentive record(s)
            </p>
          </div>
        </div>

        {/* Sales Agent Product Commission */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-md">
              <UserRound size={22} />
            </span>
            <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-black text-blue-800 dark:text-blue-300">
              Product Sales
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Sales Product Commission
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-blue-600 dark:text-blue-400">
              {money(kpis.itemAmount)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Retail item sales & solo commission pool
            </p>
          </div>
        </div>

        {/* Technician Service Incentives */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <Wrench size={22} />
            </span>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-black text-emerald-800 dark:text-emerald-300">
              Service Jobs
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Technician Labor Incentive
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {money(kpis.serviceAmount)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Diagnostics, bench work & board-level repairs
            </p>
          </div>
        </div>

        {/* Eligible Revenue Basis & Active Staff */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-amber-500 text-white shadow-md">
              <ShieldCheck size={22} />
            </span>
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-black text-amber-800 dark:text-amber-300">
              {kpis.activeStaffCount} Earners
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Eligible Revenue Basis
            </p>
            <p className="mt-1 font-mono text-2xl font-black text-[var(--color-text-strong)]">
              {money(kpis.totalBasis)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Claim Settlement: {kpis.paidClaimsCount}/{kpis.totalClaimsCount} claims paid ({kpis.claimSettlementRate.toFixed(0)}%)
            </p>
          </div>
        </div>
      </section>

      {/* 2. CONTROLS: TIMEFRAMES, FILTERS & EXPORT */}
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
                activeTab === "STAFF_SUMMARY"
                  ? staffMatrix.length
                  : activeTab === "TRANSACTIONS"
                  ? filteredEntries.length
                  : activeTab === "CYCLES"
                  ? filteredCycles.length
                  : filteredClaims.length
              }
              isExporting={isExporting}
              onClick={handleExportExcel}
            />
          </div>
        </div>

        {/* Filter Row: Dates, Staff, Type, Status & Search */}
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

          {/* Filter by Staff */}
          <div>
            <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
              Staff / Recipient
            </label>
            <select
              value={selectedStaffFilter}
              onChange={(e) => {
                setSelectedStaffFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="ALL">All Staff Members ({staffList.length})</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({classificationLabel(s.incentiveClassification)})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Incentive Type */}
          <div>
            <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
              Incentive Type
            </label>
            <select
              value={selectedTypeFilter}
              onChange={(e) => {
                setSelectedTypeFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Ledger Status */}
          <div>
            <label className="text-[10px] font-bold uppercase text-[var(--color-muted)] block mb-1">
              Ledger Status
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="POSTED">Posted (Active Payable)</option>
              <option value="REVERSED">Reversed Only</option>
              <option value="">All Ledger Statuses</option>
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
                placeholder="Search staff, receipt #, job order #..."
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
      <div className="flex border-b border-[var(--color-border)] text-xs font-black">
        {[
          { id: "STAFF_SUMMARY", label: "Staff Performance & Payout Summary", icon: Users, count: staffMatrix.length },
          { id: "TRANSACTIONS", label: "Itemized Attribution Ledger", icon: Layers, count: filteredEntries.length },
          { id: "CYCLES", label: "Pay Periods & Cutoff Cycles", icon: Clock3, count: filteredCycles.length },
          { id: "CLAIMS", label: "Claims & Disbursements Audit", icon: Award, count: filteredClaims.length },
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
              className={`flex items-center gap-2 border-b-2 px-5 py-3 transition ${
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
          <p className="mt-3 text-xs font-bold">Aggregating staff commissions and incentive cycles…</p>
        </div>
      ) : (
        <>
          {/* TAB 1: STAFF SUMMARY & LEADERBOARD */}
          {activeTab === "STAFF_SUMMARY" && (
            <div className="space-y-6">
              {/* Leaderboard Podium (Top 3) */}
              {topEarners.length > 0 && !searchQuery && selectedStaffFilter === "ALL" && (
                <section className="grid gap-4 sm:grid-cols-3">
                  {topEarners.map((earner, idx) => {
                    const medalColors = [
                      "border-amber-400/50 bg-gradient-to-br from-amber-400/15 to-[var(--color-card)] text-amber-800 dark:text-amber-300",
                      "border-slate-300/60 bg-gradient-to-br from-slate-300/15 to-[var(--color-card)] text-slate-800 dark:text-slate-200",
                      "border-orange-400/50 bg-gradient-to-br from-orange-400/15 to-[var(--color-card)] text-orange-800 dark:text-orange-300",
                    ]
                    const badges = ["🥇 Rank 1", "🥈 Rank 2", "🥉 Rank 3"]

                    return (
                      <div
                        key={earner.staffId}
                        className={`relative overflow-hidden rounded-3xl border p-5 shadow-card ${medalColors[idx]}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-white/80 dark:bg-black/30 px-2.5 py-0.5 text-xs font-black">
                            {badges[idx]}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                            {classificationLabel(earner.classification)}
                          </span>
                        </div>
                        <div className="mt-3">
                          <h4 className="text-base font-black text-[var(--color-text-strong)] truncate">
                            {earner.fullName}
                          </h4>
                          <p className="text-[11px] text-[var(--color-muted)] font-mono">
                            {earner.employeeCode}
                          </p>
                        </div>
                        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                          <p className="text-[10px] font-bold uppercase text-[var(--color-muted)]">
                            Total Incentive Payout
                          </p>
                          <p className="font-mono text-xl font-black text-[var(--color-maroon)]">
                            {money(earner.totalIncentive)}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-[var(--color-muted)] block text-[10px]">Product</span>
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                {money(earner.productIncentive)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[var(--color-muted)] block text-[10px]">Service</span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {money(earner.serviceIncentive)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </section>
              )}

              {/* Staff Payout Table */}
              <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                      <tr>
                        <th className="px-4 py-3.5">Staff Member</th>
                        <th className="px-4 py-3.5">Role / Classification</th>
                        <th className="px-4 py-3.5 text-right">Product Sales Basis</th>
                        <th className="px-4 py-3.5 text-right">Product Commission</th>
                        <th className="px-4 py-3.5 text-right">Service Charge Basis</th>
                        <th className="px-4 py-3.5 text-right">Technician Incentive</th>
                        <th className="px-4 py-3.5 text-right">Total Net Commission</th>
                        <th className="px-4 py-3.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] font-medium">
                      {currentItems.map((staffMember) => {
                        const hasEarnings = staffMember.totalIncentive > 0
                        return (
                          <tr
                            key={staffMember.staffId}
                            className={`hover:bg-[var(--color-soft)]/40 transition ${
                              hasEarnings ? "" : "opacity-60"
                            }`}
                          >
                            <td className="px-4 py-3.5">
                              <p className="font-bold text-[var(--color-text-strong)]">
                                {staffMember.fullName}
                              </p>
                              <p className="text-[10px] font-mono text-[var(--color-muted)]">
                                {staffMember.employeeCode}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex rounded-full bg-[var(--color-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-text-strong)] border border-[var(--color-border)]">
                                {classificationLabel(staffMember.classification)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono text-[var(--color-muted)]">
                              {money(staffMember.productBasis)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                              {money(staffMember.productIncentive)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono text-[var(--color-muted)]">
                              {money(staffMember.serviceBasis)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {money(staffMember.serviceIncentive)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono font-black text-base text-[var(--color-maroon)]">
                              {money(staffMember.totalIncentive)}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => setSelectedStaffDetail(staffMember)}
                                type="button"
                                className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-border)]"
                              >
                                <Eye size={12} />
                                Details ({staffMember.totalEntries})
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {staffMatrix.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-[var(--color-muted)]">
                            <Users size={32} className="mx-auto text-[var(--color-muted)]/50" />
                            <p className="mt-2 text-xs font-bold text-[var(--color-text-strong)]">
                              No staff records matching active criteria
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

          {/* TAB 2: ITEMIZED TRANSACTIONS LEDGER */}
          {activeTab === "TRANSACTIONS" && (
            <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-4 py-3.5">Source Ref / Type</th>
                      <th className="px-4 py-3.5">Beneficiary Staff</th>
                      <th className="px-4 py-3.5">Branch</th>
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Eligible Basis</th>
                      <th className="px-4 py-3.5 text-right">Rate</th>
                      <th className="px-4 py-3.5 text-right">Net Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] font-medium">
                    {currentItems.map((entry) => {
                      const isReversed = entry.status === "REVERSED"
                      return (
                        <tr
                          key={entry.id}
                          className={`hover:bg-[var(--color-soft)]/40 transition ${
                            isReversed ? "bg-rose-50/30 dark:bg-rose-950/20" : ""
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <p className="font-mono font-bold text-[var(--color-text-strong)]">
                              {entry.sourceCode || entry.sourceId}
                            </p>
                            <p className="text-[10px] text-[var(--color-muted)]">
                              {typeLabel(entry.sourceType)} · {entry.attribution || "Standard"}
                            </p>
                            {entry.reversalReason && (
                              <p className="text-[10px] font-bold text-rose-600 mt-0.5">
                                Reversal: {entry.reversalReason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-[var(--color-text-strong)]">
                              {entry.staff?.fullName || "Unassigned"}
                            </p>
                            <p className="text-[10px] text-[var(--color-muted)]">
                              {classificationLabel(entry.classification)}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 text-[var(--color-muted)] font-semibold">
                            {entry.branch?.code || entry.branch?.name || branchName}
                          </td>
                          <td className="px-4 py-3.5 text-[var(--color-muted)]">
                            {dateLabel(entry.sourceDate)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                isReversed
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                              }`}
                            >
                              {entry.status || "POSTED"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-[var(--color-text-strong)]">
                            {money(entry.basisAmount)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-[var(--color-muted)]">
                            {Number(entry.percent || 0).toFixed(2)}%
                          </td>
                          <td
                            className={`px-4 py-3.5 text-right font-mono font-black text-sm ${
                              isReversed
                                ? "text-rose-600 line-through"
                                : "text-[var(--color-maroon)]"
                            }`}
                          >
                            {money(entry.amount)}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredEntries.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-[var(--color-muted)]">
                          <Layers size={32} className="mx-auto text-[var(--color-muted)]/50" />
                          <p className="mt-2 text-xs font-bold text-[var(--color-text-strong)]">
                            No matching incentive transactions
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SCHEDULE & CUTOFF CYCLES */}
          {activeTab === "CYCLES" && (
            <div className="space-y-4">
              {filteredCycles.map((cycle) => {
                const isExpanded = expandedCycleId === cycle.id
                const empList = cycle.employees || []
                const totalCyclePayout = empList.reduce((acc, e) => acc + Number(e.totalIncentive || 0), 0)
                const totalCycleBasis = empList.reduce((acc, e) => acc + Number(e.productBasis || 0) + Number(e.serviceBasis || 0), 0)

                return (
                  <article
                    key={cycle.id}
                    className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card transition"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-black border ${phaseTone(cycle.status)}`}>
                            {cycle.status?.replaceAll("_", " ")}
                          </span>
                          <span className="font-mono text-xs font-bold text-[var(--color-muted)]">
                            {cycle.periodCode || "Pay Period"}
                          </span>
                        </div>
                        <h4 className="mt-1.5 text-lg font-black text-[var(--color-text-strong)]">
                          {dateLabel(cycle.startDate)} — {dateLabel(cycle.endDate)}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
                          <span>Cutoff: <strong className="text-[var(--color-text-strong)]">{dateLabel(cycle.cutoffDate)}</strong></span>
                          <span>•</span>
                          <span>Claim Window: <strong className="text-[var(--color-text-strong)]">{dateLabel(cycle.claimOpenDate)} – {dateLabel(cycle.claimCloseDate)}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Total Cycle Payout</p>
                          <p className="font-mono text-xl font-black text-[var(--color-maroon)]">{money(totalCyclePayout)}</p>
                          <p className="text-[10px] text-[var(--color-muted)]">{empList.length} staff member(s)</p>
                        </div>
                        <button
                          onClick={() => setExpandedCycleId(isExpanded ? null : cycle.id)}
                          type="button"
                          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-2.5 text-[var(--color-text-strong)] hover:bg-[var(--color-border)] transition"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Employee Cycle Roster */}
                    {isExpanded && (
                      <div className="mt-5 border-t border-[var(--color-border)] pt-4 space-y-3">
                        <h5 className="text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
                          Attributed Staff in this Cycle
                        </h5>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {empList.map((emp) => (
                            <div
                              key={emp.staff?.id}
                              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3.5 text-xs"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-bold text-[var(--color-text-strong)]">{emp.staff?.fullName}</p>
                                  <p className="text-[10px] text-[var(--color-muted)]">{classificationLabel(emp.classification)}</p>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${claimTone(emp.claimStatus)}`}>
                                  {emp.claimStatus || "UNCLAIMED"}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-2 text-[11px]">
                                <div>
                                  <span className="text-[10px] text-[var(--color-muted)] block">Product</span>
                                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{money(emp.productIncentive)}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-[var(--color-muted)] block">Service</span>
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{money(emp.serviceIncentive)}</span>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center justify-between pt-1 font-mono">
                                <span className="text-[10px] text-[var(--color-muted)]">Total Payout:</span>
                                <span className="font-black text-sm text-[var(--color-maroon)]">{money(emp.totalIncentive)}</span>
                              </div>
                            </div>
                          ))}
                          {empList.length === 0 && (
                            <p className="text-xs text-[var(--color-muted)] p-3">
                              No employees with recorded incentives for this period.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
              {filteredCycles.length === 0 && (
                <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center text-[var(--color-muted)] shadow-card">
                  <Clock3 size={32} className="mx-auto text-[var(--color-muted)]/50" />
                  <p className="mt-2 text-xs font-bold text-[var(--color-text-strong)]">No incentive cycles found</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CLAIMS & DISBURSEMENTS AUDIT */}
          {activeTab === "CLAIMS" && (
            <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-4 py-3.5">Employee Name</th>
                      <th className="px-4 py-3.5">Cycle Period</th>
                      <th className="px-4 py-3.5">Frozen Lines</th>
                      <th className="px-4 py-3.5 text-right">Product Incentive</th>
                      <th className="px-4 py-3.5 text-right">Service Incentive</th>
                      <th className="px-4 py-3.5 text-right">Total Claimed Amount</th>
                      <th className="px-4 py-3.5 text-center">Claim Status</th>
                      <th className="px-4 py-3.5">Submission Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] font-medium">
                    {currentItems.map((claim) => (
                      <tr key={claim.id} className="hover:bg-[var(--color-soft)]/40 transition">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-[var(--color-text-strong)]">
                            {claim.staff?.fullName || "Employee"}
                          </p>
                          <p className="text-[10px] font-mono text-[var(--color-muted)]">
                            ID: {claim.id?.slice(-8)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-[var(--color-text-strong)]">
                            {claim.cycle?.periodCode || "—"}
                          </span>
                          <p className="text-[10px] text-[var(--color-muted)]">
                            {dateLabel(claim.cycle?.startDate)} – {dateLabel(claim.cycle?.endDate)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-[var(--color-muted)]">
                          {claim.lines?.length || 0} transaction(s)
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-blue-600 dark:text-blue-400">
                          {money(claim.productIncentive)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {money(claim.serviceIncentive)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-black text-sm text-[var(--color-maroon)]">
                          {money(claim.totalIncentive)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black border ${claimTone(claim.status)}`}>
                            {claim.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[var(--color-muted)]">
                          {dateTime(claim.createdAt)}
                        </td>
                      </tr>
                    ))}
                    {filteredClaims.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-[var(--color-muted)]">
                          <Award size={32} className="mx-auto text-[var(--color-muted)]/50" />
                          <p className="mt-2 text-xs font-bold text-[var(--color-text-strong)]">No submitted incentive claims yet</p>
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

      {/* 6. STAFF DETAIL MODAL / DRAWER */}
      {selectedStaffDetail && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-rose-50 text-[var(--color-maroon)] dark:bg-rose-950/40 dark:text-rose-300">
                  <User size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedStaffDetail.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {classificationLabel(selectedStaffDetail.classification)} · {selectedStaffDetail.employeeCode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaffDetail(null)}
                type="button"
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
              {/* Stat Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Product Sales</span>
                  <p className="mt-1 font-mono text-base font-black text-blue-600 dark:text-blue-400">
                    {money(selectedStaffDetail.productIncentive)}
                  </p>
                  <span className="text-[10px] text-slate-400">Basis {money(selectedStaffDetail.productBasis)}</span>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Service Jobs</span>
                  <p className="mt-1 font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                    {money(selectedStaffDetail.serviceIncentive)}
                  </p>
                  <span className="text-[10px] text-slate-400">Basis {money(selectedStaffDetail.serviceBasis)}</span>
                </div>
                <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 p-3 border border-rose-100 dark:border-rose-900">
                  <span className="text-[10px] font-bold uppercase text-[var(--color-maroon)] block">Total Commission</span>
                  <p className="mt-1 font-mono text-lg font-black text-[var(--color-maroon)] dark:text-rose-300">
                    {money(selectedStaffDetail.totalIncentive)}
                  </p>
                  <span className="text-[10px] text-slate-400">{selectedStaffDetail.totalEntries} entries</span>
                </div>
              </div>

              {/* Transactions list */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                  Itemized Transactions ({selectedStaffDetail.sources.length})
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Source Ref</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5 text-right">Basis</th>
                        <th className="px-3 py-2.5 text-right">Rate</th>
                        <th className="px-3 py-2.5 text-right">Incentive</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedStaffDetail.sources.map((src) => (
                        <tr key={src.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                            {src.sourceCode || src.sourceId}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {typeLabel(src.sourceType)}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{dateLabel(src.sourceDate)}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                            {money(src.basisAmount)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500">
                            {Number(src.percent || 0).toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-black text-[var(--color-maroon)] dark:text-rose-300">
                            {money(src.amount)}
                          </td>
                        </tr>
                      ))}
                      {selectedStaffDetail.sources.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-xs text-slate-400">
                            No attributed transactions found for this staff member in selected range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 px-6 py-3">
              <button
                onClick={() => setSelectedStaffDetail(null)}
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
