import React, { useState, useMemo, useEffect, useCallback } from "react"
import {
  BarChart3,
  Calendar,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Laptop,
  Banknote,
  Eye,
  Printer,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ArrowUpDown,
  UserCheck,
  Coins,
  ShieldAlert,
  ShieldCheck,
  Zap,
  RotateCcw,
  Wrench,
  Package,
  TrendingUp,
  DollarSign,
  Activity,
  Award,
} from "lucide-react"

import { exportReportExcel } from "../../utils/businessDocumentExport"
import ExportExcelButton from "../../components/common/ExportExcelButton"
import {
  extractServiceTasks,
  extractServiceParts,
  extractJobWarranty,
  extractBackjobRecord,
  formatWarrantyDuration,
  getEffectiveJobPaymentState,
  cleanUserNotes,
} from "./serviceJobForms"

const TIMEFRAME_OPTIONS = [
  { id: "TODAY", label: "Today" },
  { id: "YESTERDAY", label: "Yesterday" },
  { id: "THIS_WEEK", label: "This Week" },
  { id: "THIS_MONTH", label: "This Month" },
  { id: "THIS_YEAR", label: "This Year" },
  { id: "ALL", label: "All Records" },
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
    const end = new Date(now)
    end.setDate(end.getDate() - 1)
    end.setHours(23, 59, 59, 999)
    dateFrom = start.toISOString()
    dateTo = end.toISOString()
  } else if (timeframe === "THIS_WEEK") {
    const start = new Date(now)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1) // Monday
    start.setDate(diff)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    dateFrom = start.toISOString()
    dateTo = end.toISOString()
  } else if (timeframe === "THIS_MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    dateFrom = start.toISOString()
    dateTo = end.toISOString()
  } else if (timeframe === "THIS_YEAR") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
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

const peso = (val) => `₱${Number(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ServicesReportView({
  branchId,
  selectedBranch,
  user,
  technicians = [],
  serviceCatalog = [],
  servicePartsCatalog = [],
  getServiceJobsApi,
  onOpenDetail,
  onSendToPos,
  onPrint,
}) {
  // 1. Timeframe & Filter States
  const [timeframe, setTimeframe] = useState("THIS_MONTH")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("")
  const [repairTypeFilter, setRepairTypeFilter] = useState("")
  const [jobNatureFilter, setJobNatureFilter] = useState("") // "ALL", "QUICK", "BACKJOB", "STANDARD"
  const [technicianFilter, setTechnicianFilter] = useState("")

  // 2. View Mode (SUMMARY vs ITEMIZED)
  const [viewMode, setViewMode] = useState("SUMMARY") // "SUMMARY" | "ITEMIZED"

  // 3. Data & Loading States
  const [rawJobs, setRawJobs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [fetchError, setFetchError] = useState("")

  // 4. Fetch jobs whenever branch or timeframe changes
  const fetchReportData = useCallback(async () => {
    setIsLoading(true)
    setFetchError("")
    try {
      const { dateFrom, dateTo } = getTimeframeRange(timeframe, customDateFrom, customDateTo)
      let allRecords = []
      let page = 1
      let totalPages = 1

      do {
        const response = await getServiceJobsApi({
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
      } while (page <= totalPages && page <= 30)

      setRawJobs(allRecords)
    } catch (err) {
      console.error("Failed to load services report records:", err)
      setFetchError(err?.message || "Failed to load services report.")
    } finally {
      setIsLoading(false)
    }
  }, [branchId, timeframe, customDateFrom, customDateTo, getServiceJobsApi])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  // 5. Computed Processed Jobs with Task, Part, Warranty & Settlement metrics
  const processedJobs = useMemo(() => {
    return rawJobs.map((job) => {
      const tasks = extractServiceTasks(job)
      const parts = extractServiceParts(job)
      const warranty = extractJobWarranty(job)
      const backjob = extractBackjobRecord(job)
      const payment = getEffectiveJobPaymentState(job)

      const laborSum = tasks.reduce((sum, t) => sum + Number(t.amount || 0), 0)
      const partsSum = parts.reduce((sum, p) => sum + (Number(p.unitPrice || 0) * Number(p.quantity || 1)), 0)
      const partsCostSum = parts.reduce((sum, p) => sum + (Number(p.unitCost || 0) * Number(p.quantity || 1)), 0)
      const partsMarkupSum = Math.max(0, partsSum - partsCostSum)

      // Fallback baseServiceCharge if no tasks explicitly listed
      const baseLabor = laborSum > 0 ? laborSum : Number(job.baseServiceCharge || 0)
      const computedTotal = Number(job.finalServiceCharge || job.totalPrice || (baseLabor + partsSum))

      return {
        ...job,
        parsedTasks: tasks,
        parsedParts: parts,
        parsedWarranty: warranty,
        parsedBackjob: backjob,
        parsedPayment: payment,
        laborSum: baseLabor,
        partsSum,
        partsCostSum,
        partsMarkupSum,
        computedTotal,
      }
    })
  }, [rawJobs])

  // 6. Filtered Jobs based on active controls
  const filteredJobs = useMemo(() => {
    return processedJobs.filter((job) => {
      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchCode = (job.jobCode || "").toLowerCase().includes(q)
        const matchCust = (job.customerNameSnapshot || job.customer?.fullName || "").toLowerCase().includes(q)
        const matchContact = (job.customerContactSnapshot || job.customer?.mobileNumber || "").toLowerCase().includes(q)
        const matchDevice = (job.deviceDescription || "").toLowerCase().includes(q)
        const matchSerial = (job.serialNumber || "").toLowerCase().includes(q)
        const matchTitle = (job.jobTitle || "").toLowerCase().includes(q)
        const matchDiag = (job.diagnosis || job.problemDescription || "").toLowerCase().includes(q)
        if (!matchCode && !matchCust && !matchContact && !matchDevice && !matchSerial && !matchTitle && !matchDiag) {
          return false
        }
      }

      // Status
      if (statusFilter && job.status !== statusFilter) {
        return false
      }

      // Repair Type
      if (repairTypeFilter && job.repairType !== repairTypeFilter) {
        return false
      }

      // Payment State
      if (paymentFilter) {
        const pState = job.parsedPayment?.paymentState || "UNPAID"
        const isBilledPos = job.parsedPayment?.isBilledInPos
        if (paymentFilter === "PAID" && pState !== "PAID") return false
        if (paymentFilter === "PARTIALLY_PAID" && pState !== "PARTIALLY_PAID") return false
        if (paymentFilter === "UNPAID" && pState !== "UNPAID" && pState !== "NOT_DUE") return false
        if (paymentFilter === "BILLED_IN_POS" && !isBilledPos) return false
      }

      // Job Nature
      if (jobNatureFilter) {
        if (jobNatureFilter === "QUICK" && !job.isQuickService) return false
        if (jobNatureFilter === "BACKJOB" && !job.parsedBackjob?.isBackjob && !job.isBackjob) return false
        if (jobNatureFilter === "STANDARD" && (job.isQuickService || job.parsedBackjob?.isBackjob || job.isBackjob)) return false
      }

      // Technician
      if (technicianFilter) {
        const assignedId = job.assignedTechnicianId || job.assignedTechnician?.id
        const doneById = job.serviceDoneById || job.serviceDoneBy?.id
        if (assignedId !== technicianFilter && doneById !== technicianFilter) return false
      }

      return true
    })
  }, [processedJobs, search, statusFilter, repairTypeFilter, paymentFilter, jobNatureFilter, technicianFilter])

  // 7. Exploded Itemized Line Items (Tasks & Parts)
  const itemizedRows = useMemo(() => {
    const rows = []
    filteredJobs.forEach((job) => {
      const dateStr = job.receivedAt || job.createdAt
      const customerName = job.customerNameSnapshot || job.customer?.fullName || "Walk-in Customer"
      const customerContact = job.customerContactSnapshot || job.customer?.mobileNumber || "—"
      const device = job.deviceDescription || "—"
      const status = job.status
      const paymentState = job.parsedPayment?.paymentState || "UNPAID"
      const isBilledInPos = job.parsedPayment?.isBilledInPos
      const posInvoiceCode = job.parsedPayment?.posInvoiceCode || null

      // Tasks (Labor)
      if (job.parsedTasks && job.parsedTasks.length > 0) {
        job.parsedTasks.forEach((task, idx) => {
          rows.push({
            id: `${job.id}-task-${idx}`,
            jobId: job.id,
            jobCode: job.jobCode,
            date: dateStr,
            customerName,
            customerContact,
            deviceDescription: device,
            type: "LABOR",
            itemTypeLabel: "Labor Task",
            description: task.title || "Service / Labor Fee",
            catalogCode: "—",
            serialNumber: "—",
            quantity: 1,
            unitCost: 0,
            unitPrice: Number(task.amount || 0),
            markup: 0,
            lineTotal: Number(task.amount || 0),
            warrantyDuration: task.warrantyDuration || (task.warrantyDays ? `${task.warrantyDays} Days` : "—"),
            technicianName: task.technicianName || job.assignedTechnician?.fullName || job.serviceDoneBy?.fullName || "—",
            status,
            paymentState,
            isBilledInPos,
            posInvoiceCode,
            jobRef: job,
          })
        })
      } else if (Number(job.baseServiceCharge || 0) > 0) {
        rows.push({
          id: `${job.id}-task-primary`,
          jobId: job.id,
          jobCode: job.jobCode,
          date: dateStr,
          customerName,
          customerContact,
          deviceDescription: device,
          type: "LABOR",
          itemTypeLabel: "Labor Task",
          description: job.jobTitle || "Base Service Charge",
          catalogCode: "—",
          serialNumber: "—",
          quantity: 1,
          unitCost: 0,
          unitPrice: Number(job.baseServiceCharge || 0),
          markup: 0,
          lineTotal: Number(job.baseServiceCharge || 0),
          warrantyDuration: job.parsedWarranty?.warrantyDays ? `${job.parsedWarranty.warrantyDays} Days` : "—",
          technicianName: job.assignedTechnician?.fullName || job.serviceDoneBy?.fullName || "—",
          status,
          paymentState,
          isBilledInPos,
          posInvoiceCode,
          jobRef: job,
        })
      }

      // Parts (Hardware Replacements)
      if (job.parsedParts && job.parsedParts.length > 0) {
        job.parsedParts.forEach((part, idx) => {
          const qty = Number(part.quantity || 1)
          const uCost = Number(part.unitCost || 0)
          const uPrice = Number(part.unitPrice || 0)
          const markup = Math.max(0, uPrice - uCost) * qty
          const lineTotal = uPrice * qty

          rows.push({
            id: `${job.id}-part-${idx}`,
            jobId: job.id,
            jobCode: job.jobCode,
            date: dateStr,
            customerName,
            customerContact,
            deviceDescription: device,
            type: "PART",
            itemTypeLabel: "Replacement Part",
            description: part.partName || part.itemName || "Workshop Replacement Part",
            catalogCode: part.catalogPartId || part.itemCode || "—",
            serialNumber: part.serialNumber || "—",
            quantity: qty,
            unitCost: uCost,
            unitPrice: uPrice,
            markup,
            lineTotal,
            warrantyDuration: part.warrantyDuration || "None",
            technicianName: job.assignedTechnician?.fullName || job.serviceDoneBy?.fullName || "—",
            status,
            paymentState,
            isBilledInPos,
            posInvoiceCode,
            jobRef: job,
          })
        })
      }
    })
    return rows
  }, [filteredJobs])

  // 8. Executive KPI Calculations
  const kpis = useMemo(() => {
    const totalJobs = filteredJobs.length
    let completedCount = 0
    let releasedCount = 0
    let ongoingCount = 0
    let backjobCount = 0
    let quickCount = 0

    let totalGrossRevenue = 0
    let totalLaborRevenue = 0
    let totalPartsRevenue = 0
    let totalPartsCost = 0
    let totalPartsMarkup = 0

    let totalPaidCollected = 0
    let totalPosBilledAmount = 0
    let posBilledJobsCount = 0
    let totalRemainingBalance = 0

    const techPerfMap = {}

    filteredJobs.forEach((job) => {
      const isCompleted = job.status === "COMPLETED" || job.status === "READY_FOR_RELEASE"
      const isReleased = Boolean(job.releasedAt) || Boolean(job.releaseOutcome)
      if (isCompleted) completedCount += 1
      if (isReleased) releasedCount += 1
      if (job.status === "PENDING" || job.status === "IN_PROGRESS") ongoingCount += 1
      if (job.isQuickService) quickCount += 1
      if (job.parsedBackjob?.isBackjob || job.isBackjob) backjobCount += 1

      const jobTotal = Number(job.computedTotal || 0)
      totalGrossRevenue += jobTotal
      totalLaborRevenue += Number(job.laborSum || 0)
      totalPartsRevenue += Number(job.partsSum || 0)
      totalPartsCost += Number(job.partsCostSum || 0)
      totalPartsMarkup += Number(job.partsMarkupSum || 0)

      const payment = job.parsedPayment
      totalPaidCollected += Number(payment?.collectedAmount || 0)
      totalRemainingBalance += Number(payment?.remainingBalance || 0)

      if (payment?.isBilledInPos) {
        posBilledJobsCount += 1
        totalPosBilledAmount += Number(payment.posBilledAmount || jobTotal)
      }

      // Tech performance tracking
      const tech = job.assignedTechnician || job.serviceDoneBy
      const techName = tech?.fullName || "Unassigned"
      const techId = tech?.id || "unassigned"
      if (!techPerfMap[techId]) {
        techPerfMap[techId] = {
          id: techId,
          name: techName,
          jobsCount: 0,
          completedCount: 0,
          laborTotal: 0,
          classification: tech?.incentiveClassification || "TECHNICIAN",
        }
      }
      techPerfMap[techId].jobsCount += 1
      if (isCompleted) techPerfMap[techId].completedCount += 1
      techPerfMap[techId].laborTotal += Number(job.laborSum || 0)
    })

    const backjobRate = totalJobs > 0 ? ((backjobCount / totalJobs) * 100).toFixed(1) : "0.0"
    const techLeaderboard = Object.values(techPerfMap).sort((a, b) => b.laborTotal - a.laborTotal)
    const topTechnician = techLeaderboard.length > 0 && techLeaderboard[0].id !== "unassigned" ? techLeaderboard[0] : null

    return {
      totalJobs,
      completedCount,
      releasedCount,
      ongoingCount,
      backjobCount,
      backjobRate,
      quickCount,
      totalGrossRevenue,
      totalLaborRevenue,
      totalPartsRevenue,
      totalPartsCost,
      totalPartsMarkup,
      totalPaidCollected,
      totalPosBilledAmount,
      posBilledJobsCount,
      totalRemainingBalance,
      topTechnician,
      techLeaderboard,
    }
  }, [filteredJobs])

  // 9. Excel Export Handlers
  const handleExportSummaryExcel = () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        ["Timeframe Range", TIMEFRAME_OPTIONS.find((t) => t.id === timeframe)?.label || timeframe],
        ["Search Query", search.trim() || "All"],
        ["Service Status", statusFilter || "All Statuses"],
        ["Payment Status", paymentFilter || "All Payment States"],
        ["Repair Category", repairTypeFilter || "All Repair Types"],
        ["Job Nature", jobNatureFilter || "All Natures"],
        ["Technician", technicianFilter ? technicians.find((t) => t.id === technicianFilter)?.fullName || technicianFilter : "All Technicians"],
        ["Total Job Orders Listed", filteredJobs.length],
      ]

      const summaryTotals = [
        ["Total Job Orders Count", kpis.totalJobs],
        ["Total Gross Services Revenue", kpis.totalGrossRevenue],
        ["Total Labor Charges Generated", kpis.totalLaborRevenue],
        ["Total Replacement Parts Value", kpis.totalPartsRevenue],
        ["Total Cost of Parts (Puhunan)", kpis.totalPartsCost],
        ["Total Parts Gross Profit (Tubo)", kpis.totalPartsMarkup],
        ["Total Payments Collected", kpis.totalPaidCollected],
        ["Total Settle & Released in POS Cashiering", kpis.totalPosBilledAmount],
        ["Total Outstanding Balance (AR)", kpis.totalRemainingBalance],
        ["Completed & Released Jobs", kpis.releasedCount],
        ["Total Backjob Claims Recorded", kpis.backjobCount],
        ["Backjob Rate (%)", `${kpis.backjobRate}%`],
      ]

      const columns = [
        ["JO Code", (row) => row.jobCode],
        ["Date Encoded", (row) => row.receivedAt ? new Date(row.receivedAt).toLocaleString("en-PH") : "—"],
        ["Customer Name", (row) => row.customerNameSnapshot || row.customer?.fullName || "Walk-in Customer"],
        ["Contact Number", (row) => row.customerContactSnapshot || row.customer?.mobileNumber || "—"],
        ["Device / Model", (row) => row.deviceDescription || "—"],
        ["Serial Number", (row) => row.serialNumber || "—"],
        ["Problem / Diagnosis", (row) => row.diagnosis || row.problemDescription || "—"],
        ["Repair Type", (row) => row.repairType === "BOARD_LEVEL_REPAIR" ? "Specialized / Board-Level" : "Standard Repair"],
        ["Express Quick Service", (row) => row.isQuickService ? "YES" : "NO"],
        ["Is Backjob / Warranty Claim", (row) => row.parsedBackjob?.isBackjob ? `YES (Orig JO: ${row.parsedBackjob.originalJobCode || "—"})` : "NO"],
        ["Assigned Technician", (row) => row.assignedTechnician?.fullName || "Unassigned"],
        ["Service Done By", (row) => row.serviceDoneBy?.fullName || "—"],
        ["Service Status", (row) => row.status],
        ["Payment Status", (row) => row.parsedPayment?.paymentState || "UNPAID"],
        ["POS Cashiering Status", (row) => row.parsedPayment?.isBilledInPos ? `Billed in POS (Invoice #${row.parsedPayment.posInvoiceCode || "—"})` : "Not Billed in POS"],
        ["Labor Charges (₱)", (row) => Number(row.laborSum || 0)],
        ["Parts Consumed Total (₱)", (row) => Number(row.partsSum || 0)],
        ["Grand Total Price (₱)", (row) => Number(row.computedTotal || 0)],
        ["Amount Paid (₱)", (row) => Number(row.parsedPayment?.collectedAmount || 0)],
        ["Balance Due (₱)", (row) => Number(row.parsedPayment?.remainingBalance || 0)],
        ["Service Warranty Terms", (row) => row.parsedWarranty?.warrantyDays ? `${row.parsedWarranty.warrantyDays} Days (${row.parsedWarranty.isUnderWarranty ? `${row.parsedWarranty.daysRemaining}d left` : "Expired"})` : "None"],
        ["Release Outcome", (row) => row.releaseOutcome || "—"],
        ["Remarks / Notes", (row) => cleanUserNotes(row.serviceNotes) || row.releaseNotes || "—"],
      ]

      exportReportExcel({
        title: `SERVICE JOB ORDERS SUMMARY REPORT (${selectedBranch?.name || "ALL BRANCHES"})`,
        filename: `Service-Job-Orders-Summary-${timeframe}-${new Date().toISOString().slice(0, 10)}`,
        columns,
        records: filteredJobs,
        branch: selectedBranch,
        generatedBy: user,
        filters: activeFilters,
        totals: summaryTotals,
      })
    } catch (err) {
      console.error("Export summary excel failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportItemizedExcel = () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        ["Timeframe Range", TIMEFRAME_OPTIONS.find((t) => t.id === timeframe)?.label || timeframe],
        ["Search Query", search.trim() || "All"],
        ["Service Status", statusFilter || "All Statuses"],
        ["Payment Status", paymentFilter || "All Payment States"],
        ["Total Exploded Line Items", itemizedRows.length],
      ]

      const itemizedTotals = [
        ["Total Consumed Line Items", itemizedRows.length],
        ["Total Labor Tasks Revenue", kpis.totalLaborRevenue],
        ["Total Replacement Parts Revenue", kpis.totalPartsRevenue],
        ["Total Replacement Parts Cost (Puhunan)", kpis.totalPartsCost],
        ["Total Replacement Parts Gross Profit (Tubo)", kpis.totalPartsMarkup],
        ["Combined Services & Parts Billing", kpis.totalGrossRevenue],
      ]

      const columns = [
        ["JO Reference Code", (row) => row.jobCode],
        ["Date", (row) => row.date ? new Date(row.date).toLocaleString("en-PH") : "—"],
        ["Customer Name", (row) => row.customerName],
        ["Contact", (row) => row.customerContact],
        ["Device / Unit", (row) => row.deviceDescription],
        ["Item Category / Type", (row) => row.itemTypeLabel],
        ["Task Description / Part Name", (row) => row.description],
        ["Catalog Ref / Part Code", (row) => row.catalogCode],
        ["Part Serial Number", (row) => row.serialNumber],
        ["Quantity", (row) => row.quantity],
        ["Unit Cost (Puhunan)", (row) => Number(row.unitCost || 0)],
        ["Unit Selling Price", (row) => Number(row.unitPrice || 0)],
        ["Mark-up (Patong)", (row) => Number(row.markup || 0)],
        ["Line Total (₱)", (row) => Number(row.lineTotal || 0)],
        ["Warranty Terms", (row) => row.warrantyDuration || "None"],
        ["Technician In-Charge", (row) => row.technicianName],
        ["JO Lifecycle Status", (row) => row.status],
        ["Payment Settlement State", (row) => row.paymentState],
        ["POS Cashiering Ref", (row) => row.isBilledInPos ? `Invoice #${row.posInvoiceCode || "—"}` : "—"],
      ]

      exportReportExcel({
        title: `SERVICES & CONSUMED PARTS ITEMIZED AUDIT REPORT (${selectedBranch?.name || "ALL BRANCHES"})`,
        filename: `Services-Itemized-Parts-and-Labor-${timeframe}-${new Date().toISOString().slice(0, 10)}`,
        columns,
        records: itemizedRows,
        branch: selectedBranch,
        generatedBy: user,
        filters: activeFilters,
        totals: itemizedTotals,
      })
    } catch (err) {
      console.error("Export itemized excel failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. EXECUTIVE KPI SUMMARY CARDS (POS Cashiering Standard) */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Card 1: Gross Service Billing */}
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-2xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Gross Service Revenue</span>
            <span className="rounded-lg bg-[var(--color-maroon)]/10 p-1.5 text-[var(--color-maroon)]">
              <DollarSign size={16} />
            </span>
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 dark:text-white font-mono">
            {peso(kpis.totalGrossRevenue)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{kpis.totalJobs} Job Orders</span>
            <span className="font-semibold text-emerald-600">Labor + Parts</span>
          </div>
        </div>

        {/* Card 2: Labor Service Charges */}
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-2xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Labor Service Fees</span>
            <span className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600">
              <Wrench size={16} />
            </span>
          </div>
          <p className="mt-2 text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {peso(kpis.totalLaborRevenue)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Pure Service Value</span>
            <span className="font-semibold text-blue-700">Tech Workmanship</span>
          </div>
        </div>

        {/* Card 3: Workshop Parts & Markup */}
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-2xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Parts Consumed</span>
            <span className="rounded-lg bg-amber-500/10 p-1.5 text-amber-600">
              <Package size={16} />
            </span>
          </div>
          <p className="mt-2 text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {peso(kpis.totalPartsRevenue)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Puhunan: {peso(kpis.totalPartsCost)}</span>
            <span className="font-bold text-emerald-600">+{peso(kpis.totalPartsMarkup)} tubo</span>
          </div>
        </div>

        {/* Card 4: Settlement & POS Link */}
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-2xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Settlement &amp; POS</span>
            <span className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600">
              <Banknote size={16} />
            </span>
          </div>
          <p className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {peso(kpis.totalPaidCollected)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-emerald-700 font-bold">{kpis.posBilledJobsCount} Settle in POS</span>
            {kpis.totalRemainingBalance > 0 ? (
              <span className="text-rose-600 font-mono font-bold">AR: {peso(kpis.totalRemainingBalance)}</span>
            ) : (
              <span className="text-slate-400">Zero AR</span>
            )}
          </div>
        </div>

        {/* Card 5: Throughput & Backjobs */}
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-2xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Released / Backjobs</span>
            <span className="rounded-lg bg-purple-500/10 p-1.5 text-purple-600">
              <ShieldCheck size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono">{kpis.releasedCount}</span>
            <span className="text-xs text-slate-400">released</span>
            {kpis.backjobCount > 0 ? (
              <span className="ml-auto rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700">
                {kpis.backjobCount} BJ ({kpis.backjobRate}%)
              </span>
            ) : (
              <span className="ml-auto rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                0% BJ
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{kpis.ongoingCount} ongoing</span>
            <span>{kpis.quickCount} express</span>
          </div>
        </div>

        {/* Card 6: Top Technician Spotlight */}
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-2xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Top Technician</span>
            <span className="rounded-lg bg-amber-500/10 p-1.5 text-amber-600">
              <Award size={16} />
            </span>
          </div>
          <p className="mt-2 text-base font-black text-slate-900 dark:text-white truncate" title={kpis.topTechnician?.name || "None"}>
            {kpis.topTechnician?.name || "— None yet —"}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{kpis.topTechnician?.completedCount || 0} finished</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {peso(kpis.topTechnician?.laborTotal || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. TIMEFRAME PILLS & CONTROLS HEADER */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Calendar size={13} /> Timeframe:
            </span>
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTimeframe(opt.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  timeframe === opt.id
                    ? "bg-[var(--color-maroon)] text-white shadow-2xs ring-1 ring-[var(--color-maroon)]"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh & Excel Export Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchReportData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Refresh Data
            </button>

            {viewMode === "SUMMARY" ? (
              <ExportExcelButton
                label="Export JO Summary (.xlsx)"
                count={filteredJobs.length}
                isExporting={isExporting}
                onClick={handleExportSummaryExcel}
                size="sm"
              />
            ) : (
              <ExportExcelButton
                label="Export Itemized Tasks & Parts (.xlsx)"
                count={itemizedRows.length}
                isExporting={isExporting}
                onClick={handleExportItemizedExcel}
                size="sm"
              />
            )}
          </div>
        </div>

        {/* Custom Date Pickers (Shown only when CUSTOM selected) */}
        {timeframe === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Date From:</span>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Date To:</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={fetchReportData}
              className="rounded-xl bg-[var(--color-maroon)] px-3 py-1 text-xs font-bold text-white shadow-2xs hover:opacity-90"
            >
              Apply Dates
            </button>
          </div>
        )}
      </div>

      {/* 3. MULTI-FACETED FILTER SUITE & DUAL-VIEW TOGGLE */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View Mode Toggle: SUMMARY vs ITEMIZED */}
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("SUMMARY")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition text-xs cursor-pointer ${
                viewMode === "SUMMARY"
                  ? "bg-white text-slate-900 shadow-2xs font-black dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <FileSpreadsheet size={14} />
              Job Orders Summary ({filteredJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ITEMIZED")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition text-xs cursor-pointer ${
                viewMode === "ITEMIZED"
                  ? "bg-white text-slate-900 shadow-2xs font-black dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Package size={14} />
              Consumed Services &amp; Parts ({itemizedRows.length})
            </button>
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            Showing <strong className="text-slate-800 dark:text-white font-mono">{viewMode === "SUMMARY" ? filteredJobs.length : itemizedRows.length}</strong> records
          </div>
        </div>

        {/* Filter Input Controls */}
        <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 pt-1">
          {/* Search Box */}
          <label className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search JO, Customer, Device, S/N, Problem..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--color-maroon)] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Service Statuses</option>
            <option value="PENDING">Pending (Intake/Diagnostic)</option>
            <option value="IN_PROGRESS">In Progress (Under Repair)</option>
            <option value="READY_FOR_RELEASE">Ready for Release</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled / Pulled Out</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Payment States</option>
            <option value="PAID">Fully Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="UNPAID">Unpaid / Has Balance</option>
            <option value="BILLED_IN_POS">Billed in POS Cashiering</option>
          </select>

          {/* Job Nature Filter */}
          <select
            value={jobNatureFilter}
            onChange={(e) => setJobNatureFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Job Natures</option>
            <option value="STANDARD">Standard Service</option>
            <option value="QUICK">⚡ Quick Service</option>
            <option value="BACKJOB">🔄 Backjob / Warranty Claim</option>
          </select>

          {/* Technician Filter */}
          <select
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                👨‍🔧 {t.fullName || t.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. DATA TABLES */}
      {fetchError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
          ⚠️ {fetchError}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={28} className="animate-spin text-[var(--color-maroon)]" />
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Loading comprehensive services audit records...</p>
          </div>
        </div>
      ) : viewMode === "SUMMARY" ? (
        /* ================= MODE A: JOB ORDERS SUMMARY VIEW ================= */
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
                  <th className="px-3.5 py-3">JO Code &amp; Date</th>
                  <th className="px-3.5 py-3">Customer &amp; Device</th>
                  <th className="px-3.5 py-3">Assigned Tech</th>
                  <th className="px-3.5 py-3 text-center">Status</th>
                  <th className="px-3.5 py-3">Payment &amp; POS</th>
                  <th className="px-3.5 py-3 text-right">Labor</th>
                  <th className="px-3.5 py-3 text-right">Parts</th>
                  <th className="px-3.5 py-3 text-right">Grand Total</th>
                  <th className="px-3.5 py-3 text-right">Balance</th>
                  <th className="px-3.5 py-3">Warranty</th>
                  <th className="px-3.5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <Wrench size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                      <p className="font-bold text-sm text-slate-600 dark:text-slate-400">No service job orders match your filter criteria.</p>
                      <p className="text-xs text-slate-400 mt-0.5">Try broadening the timeframe or clearing search terms.</p>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => {
                    const customerName = job.customerNameSnapshot || job.customer?.fullName || "Walk-in Customer"
                    const contact = job.customerContactSnapshot || job.customer?.mobileNumber || "—"
                    const tech = job.assignedTechnician || job.serviceDoneBy
                    const techName = tech?.fullName || "Unassigned"
                    const isBilledInPos = job.parsedPayment?.isBilledInPos
                    const posInvoice = job.parsedPayment?.posInvoiceCode
                    const paymentState = job.parsedPayment?.paymentState || "UNPAID"
                    const balance = Number(job.parsedPayment?.remainingBalance || 0)
                    const isBackjob = job.parsedBackjob?.isBackjob || job.isBackjob
                    const warranty = job.parsedWarranty

                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40"
                      >
                        {/* JO Code & Date */}
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              {job.jobCode}
                            </span>
                            {job.isQuickService && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-black text-amber-800">
                                ⚡ QUICK
                              </span>
                            )}
                            {isBackjob && (
                              <span
                                className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-black text-rose-800"
                                title={`Original JO: ${job.parsedBackjob?.originalJobCode || "—"}`}
                              >
                                🔄 BACKJOB
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">
                            {job.receivedAt ? new Date(job.receivedAt).toLocaleDateString("en-PH") : "—"}
                          </p>
                        </td>

                        {/* Customer & Device */}
                        <td className="px-3.5 py-3 max-w-[200px]">
                          <p className="font-bold text-slate-900 dark:text-white truncate" title={customerName}>
                            {customerName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{contact}</p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5 font-medium" title={job.deviceDescription || ""}>
                            💻 {job.deviceDescription || "No device details"}
                          </p>
                        </td>

                        {/* Assigned Tech */}
                        <td className="px-3.5 py-3">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {techName}
                          </p>
                          {job.serviceDoneBy && job.serviceDoneBy.fullName !== techName && (
                            <p className="text-[10px] text-blue-600">
                              Done by: {job.serviceDoneBy.fullName}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3.5 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              job.status === "COMPLETED" || job.status === "READY_FOR_RELEASE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : job.status === "IN_PROGRESS"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                : job.status === "CANCELLED"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                          >
                            {job.status === "READY_FOR_RELEASE" ? "READY" : job.status}
                          </span>
                        </td>

                        {/* Payment & POS */}
                        <td className="px-3.5 py-3">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black ${
                              paymentState === "PAID"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : paymentState === "PARTIALLY_PAID"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {paymentState}
                          </span>
                          {isBilledInPos && (
                            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                              <CheckCircle2 size={11} /> POS #{posInvoice || "INV"}
                            </p>
                          )}
                        </td>

                        {/* Labor */}
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {peso(job.laborSum)}
                        </td>

                        {/* Parts */}
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {peso(job.partsSum)}
                        </td>

                        {/* Grand Total */}
                        <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900 dark:text-white">
                          {peso(job.computedTotal)}
                        </td>

                        {/* Balance */}
                        <td className="px-3.5 py-3 text-right font-mono font-bold">
                          {balance > 0 ? (
                            <span className="text-rose-600">{peso(balance)}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">₱0.00</span>
                          )}
                        </td>

                        {/* Warranty */}
                        <td className="px-3.5 py-3">
                          {warranty?.warrantyDays > 0 ? (
                            <div className="text-[11px]">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                🛡️ {formatWarrantyDuration(warranty.warrantyDays)}
                              </span>
                              <p className="text-[10px] text-slate-400">
                                {warranty.isUnderWarranty ? (
                                  <span className="text-emerald-600 font-bold">({warranty.daysRemaining}d left)</span>
                                ) : (
                                  <span className="text-rose-500">Expired</span>
                                )}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">None / As-Is</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3.5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenDetail && onOpenDetail(job)}
                              title="View Full JO Audit & Breakdown"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[var(--color-maroon)] transition cursor-pointer dark:hover:bg-slate-800"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onPrint && onPrint(job)}
                              title="Print Diagnostic / JO Document"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer dark:hover:bg-slate-800"
                            >
                              <Printer size={15} />
                            </button>
                            {!isBilledInPos && (job.status === "READY_FOR_RELEASE" || job.status === "COMPLETED") && (
                              <button
                                type="button"
                                onClick={() => onSendToPos && onSendToPos(job)}
                                title="Settle & Release in POS Cashiering"
                                className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer dark:bg-emerald-950/40 dark:text-emerald-300"
                              >
                                <Banknote size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= MODE B: ITEMIZED CONSUMED SERVICES & PARTS VIEW ================= */
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
                  <th className="px-3.5 py-3">JO Ref &amp; Date</th>
                  <th className="px-3.5 py-3">Customer &amp; Device</th>
                  <th className="px-3.5 py-3">Line Category</th>
                  <th className="px-3.5 py-3">Description / Task / Part Name</th>
                  <th className="px-3.5 py-3 text-center">Qty</th>
                  <th className="px-3.5 py-3 text-right">Unit Cost</th>
                  <th className="px-3.5 py-3 text-right">Unit Price</th>
                  <th className="px-3.5 py-3 text-right">Mark-up</th>
                  <th className="px-3.5 py-3 text-right">Line Total</th>
                  <th className="px-3.5 py-3">Warranty</th>
                  <th className="px-3.5 py-3">Technician</th>
                  <th className="px-3.5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {itemizedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <Package size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                      <p className="font-bold text-sm text-slate-600 dark:text-slate-400">No itemized tasks or parts found.</p>
                      <p className="text-xs text-slate-400 mt-0.5">Tasks and replacement parts formulated on workshop jobs will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  itemizedRows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40"
                    >
                      {/* JO Ref & Date */}
                      <td className="px-3.5 py-3">
                        <span className="font-mono font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {row.jobCode}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {row.date ? new Date(row.date).toLocaleDateString("en-PH") : "—"}
                        </p>
                      </td>

                      {/* Customer & Device */}
                      <td className="px-3.5 py-3 max-w-[180px]">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{row.customerName}</p>
                        <p className="text-[10px] text-slate-500 truncate">💻 {row.deviceDescription}</p>
                      </td>

                      {/* Category */}
                      <td className="px-3.5 py-3">
                        {row.type === "LABOR" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            <Wrench size={11} /> LABOR TASK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Package size={11} /> PART ITEM
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="px-3.5 py-3 max-w-[240px]">
                        <p className="font-bold text-slate-800 dark:text-slate-200">{row.description}</p>
                        {row.serialNumber && row.serialNumber !== "—" && (
                          <p className="text-[10px] font-mono text-slate-400">S/N: {row.serialNumber}</p>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="px-3.5 py-3 text-center font-mono font-bold">
                        {row.quantity}
                      </td>

                      {/* Cost */}
                      <td className="px-3.5 py-3 text-right font-mono text-slate-500">
                        {row.unitCost > 0 ? peso(row.unitCost) : "—"}
                      </td>

                      {/* Price */}
                      <td className="px-3.5 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {peso(row.unitPrice)}
                      </td>

                      {/* Markup */}
                      <td className="px-3.5 py-3 text-right font-mono text-emerald-600 font-bold">
                        {row.markup > 0 ? `+${peso(row.markup)}` : "—"}
                      </td>

                      {/* Line Total */}
                      <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900 dark:text-white">
                        {peso(row.lineTotal)}
                      </td>

                      {/* Warranty */}
                      <td className="px-3.5 py-3">
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          🛡️ {row.warrantyDuration || "None"}
                        </span>
                      </td>

                      {/* Tech */}
                      <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                        {row.technicianName}
                      </td>

                      {/* Action */}
                      <td className="px-3.5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenDetail && onOpenDetail(row.jobRef)}
                          className="rounded-lg p-1 text-slate-400 hover:text-[var(--color-maroon)] hover:bg-slate-100 transition cursor-pointer dark:hover:bg-slate-800"
                          title="View Parent Job Order"
                        >
                          <Eye size={14} />
                        </button>
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
