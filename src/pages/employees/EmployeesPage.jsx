import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Award,
  Building2,
  Calendar,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  Wrench,
  X,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Monitor,
  Save,
  Sliders,
  ShoppingBag,
} from "lucide-react"

import { getReport } from "../../features/reports/reports.api"
import { getBranches } from "../../features/branches/branches.api"
import { createIncentiveAccountConfigurationVersion } from "../../features/incentives/incentives.api"
import IncentiveProgramRulesSettingsV2 from "../../features/incentives/IncentiveProgramRulesSettingsV2"
import IncentiveProgramSchedulesSettingsV2 from "../../features/incentives/IncentiveProgramSchedulesSettingsV2"
import { exportReportExcel, exportReportPdf } from "../../utils/businessDocumentExport"
import { getRoleLabel } from "../../constants/roles"
import SaleReceiptModal from "../../components/sales/SaleReceiptModal"
import JobOrderReceiptModal from "../../components/services/JobOrderReceiptModal"
import QuotationDetailDialog from "../../components/quotations/QuotationDetailDialog"

function peso(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function number(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  })
}

function formatDate(value, withTime = false) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(withTime
      ? {
        hour: "2-digit",
        minute: "2-digit",
      }
      : {}),
  })
}

export default function EmployeesPage({ selectedBranch, user }) {
  const isSuperOwner = user?.role === "SUPER_OWNER"
  const [records, setRecords] = useState([])
  const [totals, setTotals] = useState({})
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState(
    selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  )
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activePreset, setActivePreset] = useState("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [modalTab, setModalTab] = useState("sales")
  const [modalSearch, setModalSearch] = useState("")
  const [previewSale, setPreviewSale] = useState(null)
  const [previewJob, setPreviewJob] = useState(null)
  const [previewQuotation, setPreviewQuotation] = useState(null)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const canManageIncentives = ["SUPER_OWNER", "ADMIN"].includes(user?.role)
  const [activeHubTab, setActiveHubTab] = useState("performance")
  const [editingIncentiveStaff, setEditingIncentiveStaff] = useState(null)
  const [incentiveForm, setIncentiveForm] = useState({
    soloSaleEnabled: false,
    soloSaleRatePercent: "2",
    ordinaryRepairEnabled: false,
    ordinaryRepairRatePercent: "5",
    boardRepairEnabled: false,
    boardRepairRatePercent: "10",
    pcBuildEnabled: false,
    pcBuildRatePercent: "2",
    notes: "",
  })
  const [isSavingIncentive, setIsSavingIncentive] = useState(false)
  const [incentiveModalError, setIncentiveModalError] = useState("")
  const [incentiveModalSuccess, setIncentiveModalSuccess] = useState("")

  const handleOpenIncentiveRules = (staff) => {
    setEditingIncentiveStaff(staff)
    setIncentiveModalError("")
    setIncentiveModalSuccess("")
    const config = staff.incentiveConfig || {}
    setIncentiveForm({
      soloSaleEnabled: Boolean(config.soloSaleEnabled ?? (staff.soloIncentivePercent > 0)),
      soloSaleRatePercent: String(config.soloSaleRatePercent ?? (staff.soloIncentivePercent || "2")),
      ordinaryRepairEnabled: Boolean(config.ordinaryRepairEnabled ?? (staff.serviceIncentivePercent > 0)),
      ordinaryRepairRatePercent: String(config.ordinaryRepairRatePercent ?? (staff.serviceIncentivePercent || "5")),
      boardRepairEnabled: Boolean(config.boardRepairEnabled ?? (staff.boardIncentivePercent > 0)),
      boardRepairRatePercent: String(config.boardRepairRatePercent ?? (staff.boardIncentivePercent || "10")),
      pcBuildEnabled: Boolean(config.pcBuildEnabled ?? (staff.pcBuildIncentivePercent > 0)),
      pcBuildRatePercent: String(config.pcBuildRatePercent ?? (staff.pcBuildIncentivePercent || "2")),
      notes: config.notes || "",
    })
  }

  const handleSaveIncentiveRules = async (e) => {
    e.preventDefault()
    if (!editingIncentiveStaff || isSavingIncentive) return
    setIncentiveModalError("")
    setIncentiveModalSuccess("")

    const validateRate = (enabled, rateStr, label) => {
      if (!enabled) return { ok: true, value: null }
      const num = Number(rateStr)
      if (Number.isNaN(num) || num <= 0 || num > 100) {
        return { ok: false, message: `${label} rate must be between 0.01% and 100% when enabled.` }
      }
      return { ok: true, value: num }
    }

    const solo = validateRate(incentiveForm.soloSaleEnabled, incentiveForm.soloSaleRatePercent, "Solo Product Sales")
    if (!solo.ok) {
      setIncentiveModalError(solo.message)
      return
    }

    const ordinary = validateRate(incentiveForm.ordinaryRepairEnabled, incentiveForm.ordinaryRepairRatePercent, "Ordinary Repair")
    if (!ordinary.ok) {
      setIncentiveModalError(ordinary.message)
      return
    }

    const board = validateRate(incentiveForm.boardRepairEnabled, incentiveForm.boardRepairRatePercent, "Board-Level Repair")
    if (!board.ok) {
      setIncentiveModalError(board.message)
      return
    }

    const pcBuild = validateRate(incentiveForm.pcBuildEnabled, incentiveForm.pcBuildRatePercent, "PC Build")
    if (!pcBuild.ok) {
      setIncentiveModalError(pcBuild.message)
      return
    }

    const payload = {
      soloSaleEnabled: Boolean(incentiveForm.soloSaleEnabled),
      soloSaleRatePercent: solo.value,
      itemEnabled: Boolean(incentiveForm.soloSaleEnabled),
      itemRatePercent: solo.value,
      ordinaryRepairEnabled: Boolean(incentiveForm.ordinaryRepairEnabled),
      ordinaryRepairRatePercent: ordinary.value,
      boardRepairEnabled: Boolean(incentiveForm.boardRepairEnabled),
      boardRepairRatePercent: board.value,
      pcBuildEnabled: Boolean(incentiveForm.pcBuildEnabled),
      pcBuildRatePercent: pcBuild.value,
      notes: incentiveForm.notes?.trim() || null,
    }

    try {
      setIsSavingIncentive(true)
      await createIncentiveAccountConfigurationVersion(editingIncentiveStaff.id, payload)
      setIncentiveModalSuccess("Incentive rules updated successfully!")
      await loadData()
      setTimeout(() => {
        setEditingIncentiveStaff(null)
      }, 700)
    } catch (err) {
      setIncentiveModalError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "Failed to save incentive rules."
      )
    } finally {
      setIsSavingIncentive(false)
    }
  }

  useEffect(() => {
    if (!isSuperOwner) return
    let active = true
    const loadBranches = async () => {
      try {
        const response = await getBranches()
        if (active) {
          setBranches(
            Array.isArray(response?.data)
              ? response.data.filter((b) => b.status === "ACTIVE")
              : []
          )
        }
      } catch {
        if (active) setBranches([])
      }
    }
    loadBranches()
    return () => {
      active = false
    }
  }, [isSuperOwner])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await getReport("staff", {
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      })

      const staffRecords = response?.data?.records || []
      const reportTotals = response?.data?.report?.totals || {}
      setRecords(staffRecords)
      setTotals(reportTotals)

      setSelectedStaff((curr) => {
        if (!curr) return null
        return staffRecords.find((s) => s.id === curr.id) || curr
      })
    } catch (error) {
      setRecords([])
      setTotals({})
      setErrorMessage(
        error?.response?.data?.message ||
        error?.message ||
        "Could not load employee performance data."
      )
    } finally {
      setIsLoading(false)
    }
  }, [dateFrom, dateTo, roleFilter, search, selectedBranchId, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(loadData, search.trim() ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [loadData, search])

  const setDatePreset = (preset) => {
    setActivePreset(preset)
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
    } else {
      setDateFrom("")
      setDateTo("")
    }
  }

  const handleExportExcel = () => {
    setIsExportingExcel(true)
    try {
      const exportColumns = [
        ["Staff Member", (row) => row.fullName],
        ["Employee Code", (row) => row.employeeCode || "—"],
        ["Role", (row) => getRoleLabel(row.role)],
        ["Branch", (row) => row.branch?.code || "Global"],
        ["Status", (row) => row.status],
        ["Completed Sales", (row) => number(row.completedSales)],
        ["Sales Revenue", (row) => peso(row.salesRevenue)],
        ["Solo Sales %", (row) => `${row.soloIncentivePercent ?? 0}%`],
        ["Solo Commission", (row) => peso(row.soloIncentiveAmount)],
        ["Completed Services", (row) => number(row.completedServices)],
        ["Service Revenue", (row) => peso(row.serviceRevenue)],
        ["Service Commission", (row) => peso(row.serviceIncentiveAmount)],
        ["Total Incentives Earned", (row) => peso(row.totalIncentiveAmount)],
      ]

      const activeBranchObj = branches.find((b) => b.id === selectedBranchId)

      exportReportExcel({
        label: "Employee & Staff Performance Summary",
        columns: exportColumns,
        records,
        totals: [
          ["Total Staff Count", number(records.length)],
          ["Total Sales Revenue", peso(totals.salesRevenue || 0)],
          ["Total Solo Commission", peso(totals.totalSoloIncentiveAmount || 0)],
          ["Total Services Revenue", peso(totals.serviceRevenue || 0)],
          ["Total Service Commission", peso(totals.totalServiceIncentiveAmount || 0)],
          ["Total Combined Incentives", peso(totals.totalIncentiveAmount || 0)],
        ],
        branch: activeBranchObj,
        generatedBy: user,
        filters: [
          ["Search", search.trim() || "All Staff"],
          ["Role", roleFilter || "All Roles"],
          ["Period", activePreset],
          ["Date Range", dateFrom ? `${dateFrom} to ${dateTo || "Present"}` : "All Time"],
        ],
        filename: `Employee-Performance-${new Date().toISOString().slice(0, 10)}`,
      })
    } finally {
      setIsExportingExcel(false)
    }
  }

  const handleExportPdf = () => {
    setIsExportingPdf(true)
    try {
      const exportColumns = [
        ["Staff Member", (row) => row.fullName],
        ["Role", (row) => getRoleLabel(row.role)],
        ["Branch", (row) => row.branch?.code || "Global"],
        ["Sales", (row) => `${number(row.completedSales)} (${peso(row.salesRevenue)})`],
        ["Solo %", (row) => `${row.soloIncentivePercent ?? 0}%`],
        ["Solo Comm.", (row) => peso(row.soloIncentiveAmount)],
        ["Services", (row) => `${number(row.completedServices)} (${peso(row.serviceRevenue)})`],
        ["Svc Comm.", (row) => peso(row.serviceIncentiveAmount)],
        ["Total Incentives", (row) => peso(row.totalIncentiveAmount)],
      ]

      const activeBranchObj = branches.find((b) => b.id === selectedBranchId)

      exportReportPdf({
        label: "Employee & Staff Performance Directory",
        columns: exportColumns,
        records,
        totals: [
          ["Total Staff Count", number(records.length)],
          ["Total Sales Revenue", peso(totals.salesRevenue || 0)],
          ["Total Solo Commission", peso(totals.totalSoloIncentiveAmount || 0)],
          ["Total Services Revenue", peso(totals.serviceRevenue || 0)],
          ["Total Service Commission", peso(totals.totalServiceIncentiveAmount || 0)],
          ["Total Combined Incentives", peso(totals.totalIncentiveAmount || 0)],
        ],
        branch: activeBranchObj,
        generatedBy: user,
        filters: [
          ["Search", search.trim() || "All Staff"],
          ["Role", roleFilter || "All Roles"],
          ["Period", activePreset],
          ["Date Range", dateFrom ? `${dateFrom} to ${dateTo || "Present"}` : "All Time"],
        ],
        filename: `Employee-Performance-${new Date().toISOString().slice(0, 10)}`,
      })
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Filtered lists for the Employee Transactions Modal
  const filteredModalSales = useMemo(() => {
    const list = selectedStaff?.recentSales || []
    if (!modalSearch.trim()) return list
    const q = modalSearch.toLowerCase().trim()
    return list.filter((s) => {
      const cust = String(s.customerName || "").toLowerCase()
      const code = String(s.saleCode || s.receiptCode || "").toLowerCase()
      const pay = String(s.paymentMethod || "").toLowerCase()
      return cust.includes(q) || code.includes(q) || pay.includes(q)
    })
  }, [selectedStaff?.recentSales, modalSearch])

  const filteredModalServices = useMemo(() => {
    const list = selectedStaff?.recentServices || []
    if (!modalSearch.trim()) return list
    const q = modalSearch.toLowerCase().trim()
    return list.filter((j) => {
      const cust = String(j.customerName || "").toLowerCase()
      const code = String(j.jobCode || "").toLowerCase()
      const dev = String(j.deviceDescription || "").toLowerCase()
      const prob = String(j.problemDescription || "").toLowerCase()
      return cust.includes(q) || code.includes(q) || dev.includes(q) || prob.includes(q)
    })
  }, [selectedStaff?.recentServices, modalSearch])

  const filteredModalQuotations = useMemo(() => {
    const list = selectedStaff?.recentQuotations || []
    if (!modalSearch.trim()) return list
    const q = modalSearch.toLowerCase().trim()
    return list.filter((qItem) => {
      const cust = String(qItem.customerName || "").toLowerCase()
      const code = String(qItem.quotationCode || "").toLowerCase()
      return cust.includes(q) || code.includes(q)
    })
  }, [selectedStaff?.recentQuotations, modalSearch])

  return (
    <div className="min-w-0 space-y-6">
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-maroon)]">
              Staff Performance & Activity Hub
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-[var(--color-text-strong)]">
            Employee & Staff Module
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-xs font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)] disabled:opacity-50"
            disabled={isLoading}
            onClick={loadData}
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={15} />
            Refresh
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50"
            disabled={isExportingExcel || records.length === 0}
            onClick={handleExportExcel}
            type="button"
          >
            <FileSpreadsheet size={15} />
            {isExportingExcel ? "Exporting Excel..." : "Export Excel (.xlsx)"}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-maroon-hover)] disabled:opacity-50"
            disabled={isExportingPdf || records.length === 0}
            onClick={handleExportPdf}
            type="button"
          >
            <Download size={15} />
            {isExportingPdf ? "Exporting PDF..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Hub Mode Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black transition ${
            activeHubTab === "performance"
              ? "bg-[var(--color-maroon)] text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
          onClick={() => setActiveHubTab("performance")}
          type="button"
        >
          <Users size={16} />
          Staff Performance & Commissions
        </button>

        {canManageIncentives ? (
          <button
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black transition ${
              activeHubTab === "program-rules"
                ? "bg-[var(--color-maroon)] text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
            onClick={() => setActiveHubTab("program-rules")}
            type="button"
          >
            <Sliders size={16} />
            Program Rules & Schedules (6 Settings)
          </button>
        ) : null}
      </div>

      {activeHubTab === "performance" ? (
        <>
          {/* 2. Top Summary KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
              Active Staff Members
            </p>
            <div className="grid size-9 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <Users size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-[var(--color-text-strong)]">
            {number(records.length)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Mga empleyado at technicians
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
              Total Staff Sales Revenue
            </p>
            <div className="grid size-9 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ShoppingCart size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-700">
            {peso(totals.salesRevenue || 0)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Mula sa {number(totals.completedSales || 0)} naisarang benta
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
              Total Services Revenue
            </p>
            <div className="grid size-9 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <Wrench size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-amber-700">
            {peso(totals.serviceRevenue || 0)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Mula sa {number(totals.completedServices || 0)} completed jobs
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
              Total Commissions Earned
            </p>
            <div className="grid size-9 place-items-center rounded-2xl bg-purple-50 text-purple-700">
              <Award size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-purple-700">
            {peso(totals.totalIncentiveAmount || 0)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Solo Sales: {peso(totals.totalSoloIncentiveAmount || 0)} · Svc: {peso(totals.totalServiceIncentiveAmount || 0)}
          </p>
        </div>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Period Presets */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[var(--color-soft)] p-1">
            {[
              ["ALL", "All Time"],
              ["TODAY", "Today"],
              ["WEEK", "7 Days"],
              ["MONTH", "30 Days"],
            ].map(([val, lbl]) => (
              <button
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${activePreset === val
                    ? "bg-white text-[var(--color-maroon)] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
                  }`}
                key={val}
                onClick={() => setDatePreset(val)}
                type="button"
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[var(--color-muted)]">From:</span>
            <input
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-1.5 font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
              onChange={(e) => {
                setActivePreset("CUSTOM")
                setDateFrom(e.target.value)
              }}
              type="date"
              value={dateFrom}
            />
            <span className="font-bold text-[var(--color-muted)]">To:</span>
            <input
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-1.5 font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
              onChange={(e) => {
                setActivePreset("CUSTOM")
                setDateTo(e.target.value)
              }}
              type="date"
              value={dateTo}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-[var(--color-border)]">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} />
            <input
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] py-2.5 pl-10 pr-4 text-xs font-bold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff name, code, or username..."
              value={search}
            />
          </div>

          {/* Branch Filter (if Super Owner) */}
          {isSuperOwner ? (
            <select
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2.5 text-xs font-bold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
              onChange={(e) => setSelectedBranchId(e.target.value)}
              value={selectedBranchId}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-2.5 text-xs font-bold text-[var(--color-muted)]">
              {user?.branch?.code || "Assigned Branch"}
            </div>
          )}

          {/* Status Filter */}
          <select
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2.5 text-xs font-bold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active Accounts</option>
            <option value="PENDING">Pending Approval</option>
            <option value="DISABLED">Disabled Accounts</option>
          </select>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {/* 4. Main Employee Directory & Performance Table */}
      <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft)] uppercase tracking-wider text-[var(--color-muted)] font-black">
              <tr>
                <th className="px-5 py-4">Employee / Staff</th>
                <th className="px-4 py-4">Role & Branch</th>
                <th className="px-4 py-4 text-right">Total Sales</th>
                <th className="px-4 py-4 text-center">Solo %</th>
                <th className="px-4 py-4 text-right">Solo Commission</th>
                <th className="px-4 py-4 text-right">Services Done</th>
                <th className="px-4 py-4 text-right">Service Commission</th>
                <th className="px-5 py-4 text-right">Total Incentives</th>
                <th className="px-5 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] font-medium">
              {isLoading ? (
                <tr>
                  <td className="px-5 py-12 text-center text-sm font-bold text-[var(--color-muted)]" colSpan={9}>
                    <RefreshCw className="mx-auto size-6 animate-spin text-[var(--color-maroon)]" />
                    <p className="mt-2">Loading employee performance records...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-sm font-bold text-[var(--color-muted)]" colSpan={9}>
                    No employee performance records found for the selected filter.
                  </td>
                </tr>
              ) : (
                records.map((staff) => (
                  <tr className="transition hover:bg-[var(--color-soft)]/50" key={staff.id}>
                    {/* Name & Avatar */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon)] text-white font-black text-xs">
                          {staff.fullName ? staff.fullName.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[var(--color-text-strong)]">{staff.fullName}</p>
                          <p className="text-[11px] text-[var(--color-muted)]">
                            @{staff.username} {staff.employeeCode ? `· ${staff.employeeCode}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role & Branch */}
                    <td className="px-4 py-4">
                      <span className="inline-block rounded-full bg-[var(--color-soft)] px-2.5 py-1 text-[10px] font-black uppercase text-[var(--color-text-strong)]">
                        {getRoleLabel(staff.role)}
                      </span>
                      <p className="mt-1 text-[11px] text-[var(--color-muted)] font-bold">
                        {staff.branch?.code || "Global Branch"}
                      </p>
                    </td>

                    {/* Total Sales */}
                    <td className="px-4 py-4 text-right">
                      <p className="font-black text-sm text-[var(--color-text-strong)]">{peso(staff.salesRevenue)}</p>
                      <p className="text-[11px] text-emerald-700 font-bold">{number(staff.completedSales)} receipts closed</p>
                    </td>

                    {/* Solo Sales Rate % */}
                    <td className="px-4 py-4 text-center">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
                        {staff.soloIncentivePercent ?? 0}%
                      </span>
                    </td>

                    {/* Solo Commission Amount */}
                    <td className="px-4 py-4 text-right">
                      <span className="font-black text-sm text-amber-800">{peso(staff.soloIncentiveAmount)}</span>
                    </td>

                    {/* Completed Services */}
                    <td className="px-4 py-4 text-right">
                      <p className="font-black text-sm text-[var(--color-text-strong)]">{peso(staff.serviceRevenue)}</p>
                      <p className="text-[11px] text-blue-700 font-bold">{number(staff.completedServices)} jobs done</p>
                    </td>

                    {/* Service Commission */}
                    <td className="px-4 py-4 text-right">
                      <span className="font-black text-sm text-blue-800">{peso(staff.serviceIncentiveAmount)}</span>
                    </td>

                    {/* Total Incentives */}
                    <td className="px-5 py-4 text-right">
                      <span className="font-black text-sm text-[var(--color-maroon)]">{peso(staff.totalIncentiveAmount)}</span>
                    </td>

                    {/* View Action Buttons */}
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-maroon)]"
                          onClick={() => {
                            setSelectedStaff(staff)
                            setModalTab("sales")
                          }}
                          type="button"
                        >
                          <Eye size={13} />
                          Transactions
                        </button>
                        {canManageIncentives ? (
                          <button
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-maroon)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-maroon)] shadow-xs transition hover:bg-[var(--color-maroon)] hover:text-white"
                            onClick={() => handleOpenIncentiveRules(staff)}
                            title="Set custom incentive % and programs for this employee"
                            type="button"
                          >
                            <Sliders size={13} />
                            Incentive Rules
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        /* Program Rules & Schedules Tab (6 Settings) */
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-maroon)] text-white">
                <Sliders size={18} />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900">Incentive Program Rules & Schedules</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pamahalaan ang eligible price tiers, repair cost pools, at cutoff schedules para sa Item Sales, Ordinary Repairs, at Board-Level Repairs.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Program Rules: Item Sale, Ordinary Repair, Board Level Repair */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="mb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--color-maroon)]">
                1 - 3. Program Rules (Price Tiers & Repair Cost Split)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Eligible Price Tiers (Item Sale) • Repair Cost Pool % (Ordinary Repair) • Repair Cost Pool % (Board Level Repair)
              </p>
            </div>
            <IncentiveProgramRulesSettingsV2 canManage={canManageIncentives} />
          </div>

          {/* 3 Program Schedules: Item Sale Schedule, Ordinary Repair Schedule, Board Level Repair Schedule */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="mb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--color-maroon)]">
                4 - 6. Program Schedules (Frequencies & Claim Windows)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Item Sale Schedule • Ordinary Repair Schedule • Board Level Repair Schedule
              </p>
            </div>
            <IncentiveProgramSchedulesSettingsV2 canManage={canManageIncentives} />
          </div>
        </div>
      )}

      {/* 6. Employee Specific Incentive Rules Modal */}
      {editingIncentiveStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-7 place-items-center rounded-lg bg-[var(--color-maroon)] text-white">
                    <Sliders size={15} />
                  </span>
                  <h2 className="text-base font-black text-white">{editingIncentiveStaff.fullName}</h2>
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                    {getRoleLabel(editingIncentiveStaff.role)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Configure specific incentive programs and commission % for @{editingIncentiveStaff.username} ({editingIncentiveStaff.branch?.code || "Global Branch"})
                </p>
              </div>

              <button
                className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                onClick={() => setEditingIncentiveStaff(null)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form className="flex-1 overflow-y-auto p-6 space-y-5" onSubmit={handleSaveIncentiveRules}>
              {incentiveModalError ? (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <span>{incentiveModalError}</span>
                </div>
              ) : null}

              {incentiveModalSuccess ? (
                <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="shrink-0 mt-0.5" size={16} />
                  <span>{incentiveModalSuccess}</span>
                </div>
              ) : null}

              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 leading-relaxed font-medium">
                I-toggle ang mga specific incentive programs na eligible makuha ng empleyadong ito. Kapag naka-ON (Enabled), ilagay ang percentage (%) na ikakaltas/ikukwenta sa kanyang benta o completed jobs.
              </div>

              {/* 4 Incentive Program Toggles */}
              <div className="space-y-3.5">
                {/* 1. Solo Product Sales */}
                <div className={`rounded-2xl border p-4 transition ${incentiveForm.soloSaleEnabled ? "border-[var(--color-maroon)]/40 bg-[var(--color-soft)]/25" : "border-slate-200 bg-slate-50/50"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${incentiveForm.soloSaleEnabled ? "bg-[var(--color-maroon)] text-white" : "bg-slate-200 text-slate-500"}`}>
                        <ShoppingBag size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[var(--color-text-strong)]">Solo Product Sales Commission</p>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          Komisyon sa direct closed retail at computer product sales.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={incentiveForm.soloSaleEnabled}
                        onChange={(e) => setIncentiveForm((prev) => ({ ...prev, soloSaleEnabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-maroon)]"></div>
                    </label>
                  </div>

                  {incentiveForm.soloSaleEnabled ? (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-200/70 flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Commission Rate (%):</label>
                      <div className="relative max-w-[140px]">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          value={incentiveForm.soloSaleRatePercent}
                          onChange={(e) => setIncentiveForm((prev) => ({ ...prev, soloSaleRatePercent: e.target.value }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-7 text-xs font-black text-slate-900 outline-none focus:border-[var(--color-maroon)]"
                          placeholder="2.0"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">ng kabuuang benta ng produkto</span>
                    </div>
                  ) : null}
                </div>

                {/* 2. Ordinary Repair / Service */}
                <div className={`rounded-2xl border p-4 transition ${incentiveForm.ordinaryRepairEnabled ? "border-[var(--color-maroon)]/40 bg-[var(--color-soft)]/25" : "border-slate-200 bg-slate-50/50"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${incentiveForm.ordinaryRepairEnabled ? "bg-[var(--color-maroon)] text-white" : "bg-slate-200 text-slate-500"}`}>
                        <Wrench size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[var(--color-text-strong)]">Ordinary Repair / Service Jobs</p>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          Komisyon sa karaniwang repairs, formatting, cleaning, at service jobs.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={incentiveForm.ordinaryRepairEnabled}
                        onChange={(e) => setIncentiveForm((prev) => ({ ...prev, ordinaryRepairEnabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-maroon)]"></div>
                    </label>
                  </div>

                  {incentiveForm.ordinaryRepairEnabled ? (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-200/70 flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Commission Rate (%):</label>
                      <div className="relative max-w-[140px]">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          value={incentiveForm.ordinaryRepairRatePercent}
                          onChange={(e) => setIncentiveForm((prev) => ({ ...prev, ordinaryRepairRatePercent: e.target.value }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-7 text-xs font-black text-slate-900 outline-none focus:border-[var(--color-maroon)]"
                          placeholder="5.0"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">ng labor/service fee</span>
                    </div>
                  ) : null}
                </div>

                {/* 3. Board Level Repair */}
                <div className={`rounded-2xl border p-4 transition ${incentiveForm.boardRepairEnabled ? "border-[var(--color-maroon)]/40 bg-[var(--color-soft)]/25" : "border-slate-200 bg-slate-50/50"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${incentiveForm.boardRepairEnabled ? "bg-[var(--color-maroon)] text-white" : "bg-slate-200 text-slate-500"}`}>
                        <Cpu size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[var(--color-text-strong)]">Board Level Repair</p>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          Komisyon sa micro-soldering, motherboard level, at complex chip repair.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={incentiveForm.boardRepairEnabled}
                        onChange={(e) => setIncentiveForm((prev) => ({ ...prev, boardRepairEnabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-maroon)]"></div>
                    </label>
                  </div>

                  {incentiveForm.boardRepairEnabled ? (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-200/70 flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Commission Rate (%):</label>
                      <div className="relative max-w-[140px]">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          value={incentiveForm.boardRepairRatePercent}
                          onChange={(e) => setIncentiveForm((prev) => ({ ...prev, boardRepairRatePercent: e.target.value }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-7 text-xs font-black text-slate-900 outline-none focus:border-[var(--color-maroon)]"
                          placeholder="10.0"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">ng board repair revenue</span>
                    </div>
                  ) : null}
                </div>

                {/* 4. PC Build */}
                <div className={`rounded-2xl border p-4 transition ${incentiveForm.pcBuildEnabled ? "border-[var(--color-maroon)]/40 bg-[var(--color-soft)]/25" : "border-slate-200 bg-slate-50/50"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${incentiveForm.pcBuildEnabled ? "bg-[var(--color-maroon)] text-white" : "bg-slate-200 text-slate-500"}`}>
                        <Monitor size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[var(--color-text-strong)]">Custom PC Build & Assembly</p>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          Komisyon sa pag-assemble at build ng sold PC systems.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={incentiveForm.pcBuildEnabled}
                        onChange={(e) => setIncentiveForm((prev) => ({ ...prev, pcBuildEnabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-maroon)]"></div>
                    </label>
                  </div>

                  {incentiveForm.pcBuildEnabled ? (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-200/70 flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Commission Rate (%):</label>
                      <div className="relative max-w-[140px]">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          value={incentiveForm.pcBuildRatePercent}
                          onChange={(e) => setIncentiveForm((prev) => ({ ...prev, pcBuildRatePercent: e.target.value }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-7 text-xs font-black text-slate-900 outline-none focus:border-[var(--color-maroon)]"
                          placeholder="2.0"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">ng system build total</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Notes (Optional)</label>
                <input
                  type="text"
                  value={incentiveForm.notes}
                  onChange={(e) => setIncentiveForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Hal. Promoted rate or special incentive agreement"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSavingIncentive}
                  onClick={() => setEditingIncentiveStaff(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingIncentive}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[var(--color-maroon-hover)] disabled:opacity-50"
                >
                  <Save size={14} />
                  {isSavingIncentive ? "Saving Rules..." : "Save Incentive Rules"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}


      {/* 5. Comprehensive Employee Transactions & Activity Modal */}
      {selectedStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">{selectedStaff.fullName}</h2>
                  <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                    {getRoleLabel(selectedStaff.role)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  @{selectedStaff.username} {selectedStaff.employeeCode ? `· ID: ${selectedStaff.employeeCode}` : ""} · Branch: {selectedStaff.branch?.code || "Global"}
                </p>
              </div>
              <button
                className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition"
                onClick={() => setSelectedStaff(null)}
                title="Close"
                type="button"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 border-b border-slate-200">
              <div className="rounded-xl bg-white p-3 border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sales Closed</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-900">{peso(selectedStaff.salesRevenue)}</p>
                <p className="text-[10px] text-slate-400">{number(selectedStaff.completedSales)} transactions</p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Solo Commission ({selectedStaff.soloIncentivePercent ?? 0}%)</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-900">{peso(selectedStaff.soloIncentiveAmount)}</p>
                <p className="text-[10px] text-slate-400">Rate applied per sale</p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Services Handled</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-900">{peso(selectedStaff.serviceRevenue)}</p>
                <p className="text-[10px] text-slate-400">{number(selectedStaff.completedServices)} repair jobs</p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Incentives</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-900">{peso(selectedStaff.totalIncentiveAmount)}</p>
                <p className="text-[10px] text-slate-400">Solo + Service labor share</p>
              </div>
            </div>

            {/* Modal Tabs & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
              <div className="flex text-xs">
                {[
                  ["sales", `Sales & Invoices (${filteredModalSales.length})`],
                  ["services", `Service Jobs & Repairs (${filteredModalServices.length})`],
                  ["quotations", `Quotations Prepared (${filteredModalQuotations.length})`],
                ].map(([key, label]) => (
                  <button
                    className={`border-b-2 px-4 py-3 font-bold transition ${modalTab === key
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    key={key}
                    onClick={() => setModalTab(key)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Customer Search Bar */}
              <div className="relative py-2 min-w-[240px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 pl-7 pr-7 text-xs text-slate-800 outline-none focus:border-slate-700 focus:bg-white placeholder:text-slate-400 font-medium"
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search customer name or code…"
                  value={modalSearch}
                />
                {modalSearch ? (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setModalSearch("")}
                    type="button"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="flex-1 overflow-y-auto p-5 text-xs">
              {modalTab === "sales" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">
                      Recorded Sales & Invoices ({filteredModalSales.length})
                    </h3>
                    {modalSearch ? (
                      <span className="text-[11px] text-slate-500">
                        Filtering by: &ldquo;<strong className="text-slate-800">{modalSearch}</strong>&rdquo;
                      </span>
                    ) : null}
                  </div>
                  {filteredModalSales.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400 font-medium">
                      {modalSearch
                        ? `No sales found matching customer "${modalSearch}".`
                        : "No recorded sales found for this staff in the selected period."}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-3.5 py-2.5">Receipt Code</th>
                            <th className="px-3.5 py-2.5">Date & Time</th>
                            <th className="px-3.5 py-2.5">Customer</th>
                            <th className="px-3.5 py-2.5">Payment</th>
                            <th className="px-3.5 py-2.5 text-right">Total Amount</th>
                            <th className="px-3.5 py-2.5 text-right">Solo Commission ({selectedStaff.soloIncentivePercent ?? 0}%)</th>
                            <th className="px-3.5 py-2.5 text-right">Document</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredModalSales.map((s) => (
                            <tr className="hover:bg-slate-50 transition" key={s.id}>
                              <td className="px-3.5 py-2.5">
                                <button
                                  className="font-mono font-bold text-slate-900 hover:underline text-left"
                                  onClick={() => setPreviewSale(s)}
                                  type="button"
                                >
                                  {s.saleCode || s.receiptCode}
                                </button>
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-500">{formatDate(s.saleDate, true)}</td>
                              <td className="px-3.5 py-2.5 font-medium text-slate-800">{s.customerName}</td>
                              <td className="px-3.5 py-2.5">
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                  {s.paymentMethod || "CASH"}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">{peso(s.grandTotal)}</td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-700">{peso(s.commission || 0)}</td>
                              <td className="px-3.5 py-2.5 text-right">
                                <button
                                  className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-black transition"
                                  onClick={() => setPreviewSale(s)}
                                  type="button"
                                >
                                  View Receipt
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {modalTab === "services" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">
                      Service & Repair Jobs ({filteredModalServices.length})
                    </h3>
                    {modalSearch ? (
                      <span className="text-[11px] text-slate-500">
                        Filtering by: &ldquo;<strong className="text-slate-800">{modalSearch}</strong>&rdquo;
                      </span>
                    ) : null}
                  </div>
                  {filteredModalServices.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400 font-medium">
                      {modalSearch
                        ? `No service jobs found matching customer "${modalSearch}".`
                        : "No recorded service jobs found for this staff in the selected period."}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-3.5 py-2.5">Job Code</th>
                            <th className="px-3.5 py-2.5">Received Date</th>
                            <th className="px-3.5 py-2.5">Customer</th>
                            <th className="px-3.5 py-2.5">Device / Problem</th>
                            <th className="px-3.5 py-2.5">Status</th>
                            <th className="px-3.5 py-2.5 text-right">Service Charge</th>
                            <th className="px-3.5 py-2.5 text-right">Labor Commission</th>
                            <th className="px-3.5 py-2.5 text-right">Document</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredModalServices.map((j) => (
                            <tr className="hover:bg-slate-50 transition" key={j.id}>
                              <td className="px-3.5 py-2.5">
                                <button
                                  className="font-mono font-bold text-slate-900 hover:underline text-left"
                                  onClick={() => setPreviewJob(j)}
                                  type="button"
                                >
                                  {j.jobCode}
                                </button>
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-500">{formatDate(j.receivedAt)}</td>
                              <td className="px-3.5 py-2.5 font-medium text-slate-800">{j.customerName}</td>
                              <td className="px-3.5 py-2.5">
                                <p className="font-semibold text-slate-900">{j.deviceDescription}</p>
                                <p className="text-[10px] text-slate-400">{j.problemDescription}</p>
                              </td>
                              <td className="px-3.5 py-2.5">
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                  {j.status}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">{peso(j.finalServiceCharge)}</td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-700">{peso(j.commission || 0)}</td>
                              <td className="px-3.5 py-2.5 text-right">
                                <button
                                  className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-black transition"
                                  onClick={() => setPreviewJob(j)}
                                  type="button"
                                >
                                  View Job Order
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {modalTab === "quotations" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">
                      Quotations Prepared ({filteredModalQuotations.length})
                    </h3>
                    {modalSearch ? (
                      <span className="text-[11px] text-slate-500">
                        Filtering by: &ldquo;<strong className="text-slate-800">{modalSearch}</strong>&rdquo;
                      </span>
                    ) : null}
                  </div>
                  {filteredModalQuotations.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400 font-medium">
                      {modalSearch
                        ? `No quotations found matching customer "${modalSearch}".`
                        : "No recorded quotations found in the selected period."}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-3.5 py-2.5">Quote Code</th>
                            <th className="px-3.5 py-2.5">Date</th>
                            <th className="px-3.5 py-2.5">Customer</th>
                            <th className="px-3.5 py-2.5">Status</th>
                            <th className="px-3.5 py-2.5 text-right">Grand Total</th>
                            <th className="px-3.5 py-2.5 text-right">Document</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredModalQuotations.map((q) => (
                            <tr className="hover:bg-slate-50 transition" key={q.id}>
                              <td className="px-3.5 py-2.5">
                                <button
                                  className="font-mono font-bold text-slate-900 hover:underline text-left"
                                  onClick={() => setPreviewQuotation(q)}
                                  type="button"
                                >
                                  {q.quotationCode}
                                </button>
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-500">{formatDate(q.createdAt)}</td>
                              <td className="px-3.5 py-2.5 font-medium text-slate-800">{q.customerName}</td>
                              <td className="px-3.5 py-2.5">
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                  {q.status}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">{peso(q.grandTotal)}</td>
                              <td className="px-3.5 py-2.5 text-right">
                                <button
                                  className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-black transition"
                                  onClick={() => setPreviewQuotation(q)}
                                  type="button"
                                >
                                  View Quotation
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-5 py-3 shrink-0">
              <button
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-black transition"
                onClick={() => setSelectedStaff(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Official Receipt & Document Preview Modals */}
      {previewSale ? (
        <SaleReceiptModal
          onClose={() => setPreviewSale(null)}
          sale={previewSale}
          saleId={previewSale.id}
        />
      ) : null}

      {previewJob ? (
        <JobOrderReceiptModal
          job={previewJob}
          jobId={previewJob.id}
          onClose={() => setPreviewJob(null)}
        />
      ) : null}

      {previewQuotation ? (
        <QuotationDetailDialog
          onClose={() => setPreviewQuotation(null)}
          quotation={previewQuotation}
        />
      ) : null}
    </div>
  )
}
