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
} from "lucide-react"

import { getReport } from "../../features/reports/reports.api"
import { getBranches } from "../../features/branches/branches.api"
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
  const [previewSale, setPreviewSale] = useState(null)
  const [previewJob, setPreviewJob] = useState(null)
  const [previewQuotation, setPreviewQuotation] = useState(null)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

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
          <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
            Subaybayan ang lahat ng benta, serbisyo, job orders, quotations, at solo sales commissions ng bawat staff.
          </p>
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-[var(--color-border)]">
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

          {/* Role Filter */}
          <select
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2.5 text-xs font-bold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
            onChange={(e) => setRoleFilter(e.target.value)}
            value={roleFilter}
          >
            <option value="">All Roles</option>
            <option value="CASHIER">Cashier / Sales Encoder</option>
            <option value="TECHNICIAN">Technician / Repair Specialist</option>
            <option value="ADMIN">Branch Admin</option>
            <option value="BRANCH_OWNER">Branch Owner</option>
            <option value="SUPER_OWNER">Super Owner</option>
          </select>

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

                    {/* View Action Button */}
                    <td className="px-5 py-4 text-center">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Comprehensive Employee Transactions & Activity Modal */}
      {selectedStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-gradient-to-r from-slate-900 to-[#7a1f2b] p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="grid size-12 place-items-center rounded-2xl bg-white/10 text-white font-black text-lg backdrop-blur">
                  {selectedStaff.fullName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-white">{selectedStaff.fullName}</h2>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                      {getRoleLabel(selectedStaff.role)}
                    </span>
                  </div>
                  <p className="text-xs text-white/80">
                    @{selectedStaff.username} {selectedStaff.employeeCode ? `· ID: ${selectedStaff.employeeCode}` : ""} · Branch: {selectedStaff.branch?.code || "Global"}
                  </p>
                </div>
              </div>
              <button
                className="grid size-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                onClick={() => setSelectedStaff(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Mini KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[var(--color-soft)] p-4 border-b border-[var(--color-border)]">
              <div className="rounded-2xl bg-white p-3 border border-[var(--color-border)]">
                <p className="text-[10px] font-black uppercase text-[var(--color-muted)]">Sales Closed</p>
                <p className="mt-1 text-lg font-black text-emerald-700">{peso(selectedStaff.salesRevenue)}</p>
                <p className="text-[10px] text-[var(--color-muted)]">{number(selectedStaff.completedSales)} transactions</p>
              </div>
              <div className="rounded-2xl bg-white p-3 border border-[var(--color-border)]">
                <p className="text-[10px] font-black uppercase text-[var(--color-muted)]">Solo Commission ({selectedStaff.soloIncentivePercent ?? 0}%)</p>
                <p className="mt-1 text-lg font-black text-amber-700">{peso(selectedStaff.soloIncentiveAmount)}</p>
                <p className="text-[10px] text-[var(--color-muted)]">Rate applied per sale</p>
              </div>
              <div className="rounded-2xl bg-white p-3 border border-[var(--color-border)]">
                <p className="text-[10px] font-black uppercase text-[var(--color-muted)]">Services Completed</p>
                <p className="mt-1 text-lg font-black text-blue-700">{peso(selectedStaff.serviceRevenue)}</p>
                <p className="text-[10px] text-[var(--color-muted)]">{number(selectedStaff.completedServices)} repair jobs</p>
              </div>
              <div className="rounded-2xl bg-white p-3 border border-[var(--color-border)]">
                <p className="text-[10px] font-black uppercase text-[var(--color-muted)]">Total Combined Incentives</p>
                <p className="mt-1 text-lg font-black text-[var(--color-maroon)]">{peso(selectedStaff.totalIncentiveAmount)}</p>
                <p className="text-[10px] text-[var(--color-muted)]">Solo + Tech labor share</p>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-[var(--color-border)] bg-white px-6">
              {[
                ["sales", `Sales & Invoices (${selectedStaff.recentSales?.length || 0})`],
                ["services", `Service Jobs & Repairs (${selectedStaff.recentServices?.length || 0})`],
                ["quotations", `Quotations Prepared (${selectedStaff.recentQuotations?.length || 0})`],
              ].map(([key, label]) => (
                <button
                  className={`border-b-2 px-5 py-3 text-xs font-black transition ${modalTab === key
                      ? "border-[var(--color-maroon)] text-[var(--color-maroon)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
                    }`}
                  key={key}
                  onClick={() => setModalTab(key)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Modal Body Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {modalTab === "sales" ? (
                <div>
                  <h3 className="text-sm font-black text-[var(--color-text-strong)] mb-3">
                    Recorded Sales & Invoices for {selectedStaff.fullName}
                  </h3>
                  {(!selectedStaff.recentSales || selectedStaff.recentSales.length === 0) ? (
                    <div className="rounded-2xl bg-[var(--color-soft)] p-8 text-center text-xs font-bold text-[var(--color-muted)]">
                      No recorded sales found for this staff member in the selected period.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--color-soft)] text-[var(--color-muted)] font-black uppercase">
                          <tr>
                            <th className="p-3">Receipt Code</th>
                            <th className="p-3">Date & Time</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Payment</th>
                            <th className="p-3 text-right">Total Amount</th>
                            <th className="p-3 text-right">Solo Commission ({selectedStaff.soloIncentivePercent ?? 0}%)</th>
                            <th className="p-3 text-right">Official Document</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {selectedStaff.recentSales.map((s) => (
                            <tr className="hover:bg-[var(--color-soft)]/50" key={s.id}>
                              <td className="p-3">
                                <button
                                  className="font-bold text-[var(--color-maroon)] hover:underline flex items-center gap-1 text-left"
                                  onClick={() => setPreviewSale(s)}
                                  type="button"
                                >
                                  {s.saleCode || s.receiptCode}
                                </button>
                              </td>
                              <td className="p-3 text-[var(--color-muted)]">{formatDate(s.saleDate, true)}</td>
                              <td className="p-3 font-semibold">{s.customerName}</td>
                              <td className="p-3">
                                <span className="rounded-full bg-[var(--color-soft)] px-2 py-0.5 text-[10px] font-bold">
                                  {s.paymentMethod || "CASH"}
                                </span>
                              </td>
                              <td className="p-3 text-right font-black text-[var(--color-text-strong)]">{peso(s.grandTotal)}</td>
                              <td className="p-3 text-right font-black text-amber-700">{peso(s.commission || 0)}</td>
                              <td className="p-3 text-right">
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-maroon)] text-white px-2.5 py-1 text-[11px] font-bold hover:bg-[var(--color-maroon-hover)] shadow-xs transition"
                                  onClick={() => setPreviewSale(s)}
                                  type="button"
                                >
                                  <Printer size={12} /> View Receipt
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
                <div>
                  <h3 className="text-sm font-black text-[var(--color-text-strong)] mb-3">
                    Service & Repair Jobs Handled by {selectedStaff.fullName}
                  </h3>
                  {(!selectedStaff.recentServices || selectedStaff.recentServices.length === 0) ? (
                    <div className="rounded-2xl bg-[var(--color-soft)] p-8 text-center text-xs font-bold text-[var(--color-muted)]">
                      No recorded service jobs found for this technician in the selected period.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--color-soft)] text-[var(--color-muted)] font-black uppercase">
                          <tr>
                            <th className="p-3">Job Code</th>
                            <th className="p-3">Received Date</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Device / Problem</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Service Charge</th>
                            <th className="p-3 text-right">Labor Commission</th>
                            <th className="p-3 text-right">Official Document</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {selectedStaff.recentServices.map((j) => (
                            <tr className="hover:bg-[var(--color-soft)]/50" key={j.id}>
                              <td className="p-3">
                                <button
                                  className="font-bold text-blue-700 hover:underline flex items-center gap-1 text-left"
                                  onClick={() => setPreviewJob(j)}
                                  type="button"
                                >
                                  {j.jobCode}
                                </button>
                              </td>
                              <td className="p-3 text-[var(--color-muted)]">{formatDate(j.receivedAt)}</td>
                              <td className="p-3 font-semibold">{j.customerName}</td>
                              <td className="p-3">
                                <p className="font-bold text-[var(--color-text-strong)]">{j.deviceDescription}</p>
                                <p className="text-[11px] text-[var(--color-muted)]">{j.problemDescription}</p>
                              </td>
                              <td className="p-3">
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                  {j.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-black text-[var(--color-text-strong)]">{peso(j.finalServiceCharge)}</td>
                              <td className="p-3 text-right font-black text-blue-700">{peso(j.commission || 0)}</td>
                              <td className="p-3 text-right">
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg bg-blue-700 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-blue-800 shadow-xs transition"
                                  onClick={() => setPreviewJob(j)}
                                  type="button"
                                >
                                  <Printer size={12} /> View Job Order
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
                <div>
                  <h3 className="text-sm font-black text-[var(--color-text-strong)] mb-3">
                    Quotations Prepared by {selectedStaff.fullName}
                  </h3>
                  {(!selectedStaff.recentQuotations || selectedStaff.recentQuotations.length === 0) ? (
                    <div className="rounded-2xl bg-[var(--color-soft)] p-8 text-center text-xs font-bold text-[var(--color-muted)]">
                      No recorded quotations found in the selected period.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--color-soft)] text-[var(--color-muted)] font-black uppercase">
                          <tr>
                            <th className="p-3">Quote Code</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Grand Total</th>
                            <th className="p-3 text-right">Official Document</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {selectedStaff.recentQuotations.map((q) => (
                            <tr className="hover:bg-[var(--color-soft)]/50" key={q.id}>
                              <td className="p-3">
                                <button
                                  className="font-bold text-[var(--color-maroon)] hover:underline flex items-center gap-1 text-left"
                                  onClick={() => setPreviewQuotation(q)}
                                  type="button"
                                >
                                  {q.quotationCode}
                                </button>
                              </td>
                              <td className="p-3 text-[var(--color-muted)]">{formatDate(q.createdAt)}</td>
                              <td className="p-3 font-semibold">{q.customerName}</td>
                              <td className="p-3">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${q.status === "CONVERTED"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-amber-50 text-amber-800"
                                    }`}
                                >
                                  {q.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-black text-[var(--color-text-strong)]">{peso(q.grandTotal)}</td>
                              <td className="p-3 text-right">
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-black shadow-xs transition"
                                  onClick={() => setPreviewQuotation(q)}
                                  type="button"
                                >
                                  <FileText size={12} /> View Quotation
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
            <div className="flex items-center justify-end border-t border-[var(--color-border)] bg-[var(--color-soft)] px-6 py-3">
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
