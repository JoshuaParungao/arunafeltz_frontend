import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  HandCoins,
  Landmark,
  Layers,
  Lightbulb,
  LoaderCircle,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  UserCheck,
  Users,
  Utensils,
  Wrench,
  X,
} from "lucide-react"

import {
  getCashBoxes,
  getCashHandovers,
  getCashTransactions,
} from "../../features/cash-boxes/cashBoxes.api"
import { exportReportExcel } from "../../utils/businessDocumentExport"
import ExportExcelButton from "../../components/common/ExportExcelButton"

const CASH_IN_TYPES = new Set([
  "CASH_IN",
  "ADJUSTMENT_IN",
  "SALE_PAYMENT",
  "CREDIT_COLLECTION",
  "SERVICE_PAYMENT",
])

const EXPENSE_CATEGORIES = [
  { id: "MEALS_SNACKS", label: "Meals & Staff Snacks", icon: Utensils, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { id: "SUPPLIER_PAYMENT", label: "Supplier Payment / Delivery", icon: Building2, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { id: "LOGISTICS_COURIER", label: "Logistics & Delivery", icon: Truck, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { id: "STORE_SUPPLIES", label: "Store Supplies & Cleaning", icon: Sparkles, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { id: "UTILITIES_BILLS", label: "Utilities & Store Bills", icon: Lightbulb, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  { id: "SHOP_TOOLS_MAINTENANCE", label: "Shop Tools & Maintenance", icon: Wrench, color: "text-orange-600 bg-orange-50 border-orange-200" },
  { id: "SALARY_VALE", label: "Salary Advance / Vale", icon: UserCheck, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { id: "PERMITS_TAXES", label: "Permits & Taxes", icon: Landmark, color: "text-rose-600 bg-rose-50 border-rose-200" },
  { id: "OTHER_EXPENSE", label: "Other Store Expense", icon: Receipt, color: "text-slate-600 bg-slate-100 border-slate-200" },
]

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

function dateOnly(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
}

function formatStatus(value) {
  if (!value) return "—"
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export default function CashBoxesReportView({
  branchId,
  selectedBranch,
  user,
  boxes = [],
  staff = [],
  onRefresh,
}) {
  const branchName = selectedBranch?.name || user?.branch?.name || "All Branches"

  // Active Audit Mode
  const [activeTab, setActiveTab] = useState("SHIFTS") // "SHIFTS" | "EXPENSES" | "CASHBOOK" | "HANDOVERS"

  // Date Filtering
  const [timeframe, setTimeframe] = useState("THIS_MONTH") // "ALL" | "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_30_DAYS" | "CUSTOM"
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Filter Selectors
  const [selectedBoxFilter, setSelectedBoxFilter] = useState("ALL")
  const [selectedStaffFilter, setSelectedStaffFilter] = useState("ALL")
  const [selectedExpenseCatFilter, setSelectedExpenseCatFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  // Data state
  const [allTransactions, setAllTransactions] = useState([])
  const [allHandovers, setAllHandovers] = useState([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 25

  // Load Transactions & Handovers for reports
  const loadReportData = useCallback(async () => {
    if (!branchId) return
    setIsLoadingData(true)
    try {
      let currentBoxes = boxes
      if (!currentBoxes || currentBoxes.length === 0) {
        const boxesRes = await getCashBoxes({ branchId, status: "ACTIVE", limit: 50 })
        currentBoxes = Array.isArray(boxesRes?.data) ? boxesRes.data : boxesRes?.data?.data || []
      }

      // Fetch transactions for selected box or across all boxes in branch
      let fetchedTxns = []
      if (selectedBoxFilter !== "ALL") {
        const res = await getCashTransactions(selectedBoxFilter, { limit: 500 })
        const list = res?.data?.data || res?.data || []
        const foundBox = currentBoxes.find((b) => b.id === selectedBoxFilter)
        fetchedTxns = (Array.isArray(list) ? list : []).map((t) => ({
          ...t,
          cashBox: t.cashBox || foundBox,
        }))
      } else if (currentBoxes.length > 0) {
        const results = await Promise.all(
          currentBoxes.map(async (b) => {
            try {
              const res = await getCashTransactions(b.id, { limit: 200 })
              const list = res?.data?.data || res?.data || []
              return Array.isArray(list) ? list.map((t) => ({ ...t, cashBox: t.cashBox || b })) : []
            } catch {
              return []
            }
          })
        )
        fetchedTxns = results.flat()
      }

      // Fetch handovers
      const hoRes = await getCashHandovers({
        branchId,
        ...(selectedBoxFilter !== "ALL" ? { cashBoxId: selectedBoxFilter } : {}),
        limit: 300,
      })
      const hoList = Array.isArray(hoRes?.data) ? hoRes.data : hoRes?.data?.data || []

      setAllTransactions(fetchedTxns)
      setAllHandovers(hoList)
    } catch (err) {
      console.error("Failed to load cash report data:", err)
    } finally {
      setIsLoadingData(false)
    }
  }, [branchId, boxes, selectedBoxFilter])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  // Date Range Bounds calculation
  const dateRangeBounds = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    if (timeframe === "TODAY") {
      return { start: `${todayStr}T00:00:00.000Z`, end: `${todayStr}T23:59:59.999Z` }
    }
    if (timeframe === "YESTERDAY") {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const yStr = y.toISOString().slice(0, 10)
      return { start: `${yStr}T00:00:00.000Z`, end: `${yStr}T23:59:59.999Z` }
    }
    if (timeframe === "THIS_WEEK") {
      const d = new Date(now)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      const monStr = monday.toISOString().slice(0, 10)
      return { start: `${monStr}T00:00:00.000Z`, end: `${todayStr}T23:59:59.999Z` }
    }
    if (timeframe === "THIS_MONTH") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const firstStr = firstDay.toISOString().slice(0, 10)
      return { start: `${firstStr}T00:00:00.000Z`, end: `${todayStr}T23:59:59.999Z` }
    }
    if (timeframe === "LAST_30_DAYS") {
      const past = new Date(now)
      past.setDate(past.getDate() - 30)
      const pastStr = past.toISOString().slice(0, 10)
      return { start: `${pastStr}T00:00:00.000Z`, end: `${todayStr}T23:59:59.999Z` }
    }
    if (timeframe === "CUSTOM" && dateFrom) {
      const start = `${dateFrom}T00:00:00.000Z`
      const end = dateTo ? `${dateTo}T23:59:59.999Z` : `${todayStr}T23:59:59.999Z`
      return { start, end }
    }
    return null
  }, [timeframe, dateFrom, dateTo])

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      // Date bounds
      if (dateRangeBounds) {
        const tTime = new Date(tx.transactionDate || tx.createdAt).getTime()
        const sTime = new Date(dateRangeBounds.start).getTime()
        const eTime = new Date(dateRangeBounds.end).getTime()
        if (tTime < sTime || tTime > eTime) return false
      }

      // Cash box filter
      if (selectedBoxFilter !== "ALL") {
        if (tx.cashBoxId !== selectedBoxFilter && tx.cashBox?.id !== selectedBoxFilter) return false
      }

      // Staff filter
      if (selectedStaffFilter !== "ALL") {
        const staffId = tx.performedBy?.id || tx.createdBy?.id || tx.createdById
        if (staffId !== selectedStaffFilter) return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const code = (tx.transactionCode || "").toLowerCase()
        const desc = (tx.description || "").toLowerCase()
        const ref = (tx.referenceNo || "").toLowerCase()
        const staffName = (tx.performedBy?.fullName || tx.createdBy?.fullName || "").toLowerCase()
        const boxName = (tx.cashBox?.name || "").toLowerCase()
        if (!code.includes(q) && !desc.includes(q) && !ref.includes(q) && !staffName.includes(q) && !boxName.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [allTransactions, dateRangeBounds, selectedBoxFilter, selectedStaffFilter, searchQuery])

  // Filtered Handovers
  const filteredHandovers = useMemo(() => {
    return allHandovers.filter((h) => {
      if (dateRangeBounds) {
        const hTime = new Date(h.createdAt).getTime()
        const sTime = new Date(dateRangeBounds.start).getTime()
        const eTime = new Date(dateRangeBounds.end).getTime()
        if (hTime < sTime || hTime > eTime) return false
      }

      if (selectedBoxFilter !== "ALL") {
        if (h.cashBoxId !== selectedBoxFilter && h.cashBox?.id !== selectedBoxFilter) return false
      }

      if (selectedStaffFilter !== "ALL") {
        const fromId = h.fromUser?.id || h.fromUserId
        const toId = h.toUser?.id || h.toUserId
        if (fromId !== selectedStaffFilter && toId !== selectedStaffFilter) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const code = (h.handoverCode || "").toLowerCase()
        const from = (h.fromUser?.fullName || "").toLowerCase()
        const to = (h.toUser?.fullName || "").toLowerCase()
        const rem = (h.remarks || "").toLowerCase()
        if (!code.includes(q) && !from.includes(q) && !to.includes(q) && !rem.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [allHandovers, dateRangeBounds, selectedBoxFilter, selectedStaffFilter, searchQuery])

  // Executive KPI Computations
  const kpis = useMemo(() => {
    let totalInflow = 0
    let totalSalesCash = 0
    let totalServicesCash = 0
    let totalCreditCash = 0
    let totalFloatIn = 0

    let totalExpenses = 0
    let totalBankDeposits = 0
    let totalHandoverOut = 0

    filteredTransactions.forEach((tx) => {
      if (tx.status !== "POSTED") return
      const amt = Number(tx.amount || 0)

      if (CASH_IN_TYPES.has(tx.type)) {
        totalInflow += amt
        if (tx.type === "SALE_PAYMENT") totalSalesCash += amt
        else if (tx.type === "SERVICE_PAYMENT") totalServicesCash += amt
        else if (tx.type === "CREDIT_COLLECTION") totalCreditCash += amt
        else if (tx.type === "CASH_IN" || tx.type === "ADJUSTMENT_IN") totalFloatIn += amt
      } else if (tx.type === "HANDOVER_OUT") {
        totalHandoverOut += amt
      } else if (tx.type === "CASH_OUT" || tx.type === "ADJUSTMENT_OUT") {
        if (tx.description?.includes("[BANK DEPOSIT")) {
          totalBankDeposits += amt
        } else {
          totalExpenses += amt
        }
      }
    })

    const netCashFlow = totalInflow - (totalExpenses + totalBankDeposits + totalHandoverOut)

    // Current Drawer Physical Balances
    const currentDrawersTotal = boxes.reduce(
      (sum, b) => sum + Number(b.currentBalance || 0),
      0
    )

    // Handover stats
    const handoversAcceptedTotal = filteredHandovers
      .filter((h) => h.status === "RECEIVED")
      .reduce((sum, h) => sum + Number(h.amount || 0), 0)

    const handoversPendingTotal = filteredHandovers
      .filter((h) => h.status === "PENDING")
      .reduce((sum, h) => sum + Number(h.amount || 0), 0)

    return {
      totalInflow,
      totalSalesCash,
      totalServicesCash,
      totalCreditCash,
      totalFloatIn,
      totalExpenses,
      totalBankDeposits,
      totalHandoverOut,
      netCashFlow,
      currentDrawersTotal,
      handoversAcceptedTotal,
      handoversPendingTotal,
    }
  }, [filteredTransactions, filteredHandovers, boxes])

  // Mode 1: Shift & Daily Drawer Groups
  const shiftGroups = useMemo(() => {
    const map = {}

    // Sort transactions chronologically ascending first to establish starting and ending balances
    const sortedTxns = [...filteredTransactions].sort(
      (a, b) => new Date(a.transactionDate || a.createdAt) - new Date(b.transactionDate || b.createdAt)
    )

    sortedTxns.forEach((tx) => {
      if (tx.status !== "POSTED") return
      const dateKey = tx.transactionDate
        ? String(tx.transactionDate).slice(0, 10)
        : String(tx.createdAt).slice(0, 10)

      const boxId = tx.cashBoxId || tx.cashBox?.id || "drawer"
      const staffId = tx.performedBy?.id || tx.createdBy?.id || tx.createdById || "staff"
      const groupKey = `${dateKey}__${boxId}__${staffId}`

      if (!map[groupKey]) {
        map[groupKey] = {
          key: groupKey,
          dateKey,
          dateFormatted: dateOnly(dateKey),
          cashBoxName: tx.cashBox?.name || "Cash Drawer",
          cashBoxCode: tx.cashBox?.boxCode || "BOX",
          staffName: tx.performedBy?.fullName || tx.createdBy?.fullName || "Staff",
          cashierRole: tx.performedBy?.role || tx.createdBy?.role || "CASHIER",
          startingBalance: Number(tx.balanceBefore || 0),
          cashSales: 0,
          servicesCash: 0,
          creditCash: 0,
          cashInFloat: 0,
          storeExpenses: 0,
          bankDeposits: 0,
          handoverOut: 0,
          endingBalance: Number(tx.balanceAfter || 0),
          txCount: 0,
          firstTxTime: tx.transactionDate || tx.createdAt,
          lastTxTime: tx.transactionDate || tx.createdAt,
        }
      }

      const g = map[groupKey]
      g.txCount += 1
      g.lastTxTime = tx.transactionDate || tx.createdAt
      g.endingBalance = Number(tx.balanceAfter || 0)

      const amt = Number(tx.amount || 0)
      if (tx.type === "SALE_PAYMENT") g.cashSales += amt
      else if (tx.type === "SERVICE_PAYMENT") g.servicesCash += amt
      else if (tx.type === "CREDIT_COLLECTION") g.creditCash += amt
      else if (tx.type === "CASH_IN" || tx.type === "ADJUSTMENT_IN") g.cashInFloat += amt
      else if (tx.type === "HANDOVER_OUT") g.handoverOut += amt
      else if (tx.type === "CASH_OUT" || tx.type === "ADJUSTMENT_OUT") {
        if (tx.description?.includes("[BANK DEPOSIT")) {
          g.bankDeposits += amt
        } else {
          g.storeExpenses += amt
        }
      }
    })

    // Sort shift groups by date descending
    return Object.values(map).sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }, [filteredTransactions])

  // Mode 2: Expenses Breakdown by Category
  const expenseCategoryBreakdown = useMemo(() => {
    const map = {}
    EXPENSE_CATEGORIES.forEach((cat) => {
      map[cat.id] = { ...cat, total: 0, count: 0, vouchers: [] }
    })
    map["OTHER_EXPENSE"] = {
      id: "OTHER_EXPENSE",
      label: "Other Store Expense",
      icon: Receipt,
      color: "text-slate-600 bg-slate-100 border-slate-200",
      total: 0,
      count: 0,
      vouchers: [],
    }

    let totalAllExpenses = 0

    filteredTransactions.forEach((tx) => {
      if (tx.status !== "POSTED") return
      const isExpense =
        (tx.type === "CASH_OUT" || tx.description?.startsWith("[EXPENSE:")) &&
        !tx.description?.includes("[BANK DEPOSIT")
      if (!isExpense) return

      const amt = Number(tx.amount || 0)
      totalAllExpenses += amt

      let matchedCat = "OTHER_EXPENSE"
      for (const cat of EXPENSE_CATEGORIES) {
        if (tx.description?.includes(`[EXPENSE: ${cat.label}]`) || tx.description?.includes(cat.label)) {
          matchedCat = cat.id
          break
        }
      }

      if (matchedCat === "OTHER_EXPENSE") {
        const lowerDesc = (tx.description || "").toLowerCase()
        if (lowerDesc.includes("permit") || lowerDesc.includes("tax") || lowerDesc.includes("bir")) {
          matchedCat = "PERMITS_TAXES"
        } else if (lowerDesc.includes("meal") || lowerDesc.includes("lunch") || lowerDesc.includes("snack") || lowerDesc.includes("food")) {
          matchedCat = "MEALS_SNACKS"
        } else if (lowerDesc.includes("courier") || lowerDesc.includes("lalamove") || lowerDesc.includes("delivery") || lowerDesc.includes("fare")) {
          matchedCat = "LOGISTICS_COURIER"
        } else if (lowerDesc.includes("supply") || lowerDesc.includes("paper") || lowerDesc.includes("cleaning")) {
          matchedCat = "STORE_SUPPLIES"
        } else if (lowerDesc.includes("electric") || lowerDesc.includes("water") || lowerDesc.includes("internet") || lowerDesc.includes("bill")) {
          matchedCat = "UTILITIES_BILLS"
        } else if (lowerDesc.includes("vale") || lowerDesc.includes("salary") || lowerDesc.includes("advance")) {
          matchedCat = "SALARY_VALE"
        } else if (lowerDesc.includes("repair") || lowerDesc.includes("tool") || lowerDesc.includes("maintenance")) {
          matchedCat = "SHOP_TOOLS_MAINTENANCE"
        }
      }

      map[matchedCat].total += amt
      map[matchedCat].count += 1
      map[matchedCat].vouchers.push(tx)
    })

    const categoriesWithStats = Object.values(map).map((cat) => ({
      ...cat,
      percent: totalAllExpenses > 0 ? (cat.total / totalAllExpenses) * 100 : 0,
      avgAmount: cat.count > 0 ? cat.total / cat.count : 0,
    }))

    // Filtered vouchers table
    let visibleVouchers = []
    if (selectedExpenseCatFilter === "ALL") {
      visibleVouchers = categoriesWithStats.flatMap((c) => c.vouchers)
    } else {
      visibleVouchers = map[selectedExpenseCatFilter]?.vouchers || []
    }

    // Sort vouchers date descending
    visibleVouchers.sort(
      (a, b) => new Date(b.transactionDate || b.createdAt) - new Date(a.transactionDate || a.createdAt)
    )

    return {
      categories: categoriesWithStats,
      totalAllExpenses,
      visibleVouchers,
    }
  }, [filteredTransactions, selectedExpenseCatFilter])

  // Mode 3: Master Cashbook chronologically sorted
  const sortedCashbookTransactions = useMemo(() => {
    return [...filteredTransactions].sort(
      (a, b) => new Date(b.transactionDate || b.createdAt) - new Date(a.transactionDate || a.createdAt)
    )
  }, [filteredTransactions])

  // Mode 4: Handovers chronologically sorted
  const sortedHandovers = useMemo(() => {
    return [...filteredHandovers].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )
  }, [filteredHandovers])

  // Reset page when switching tabs or filters
  useEffect(() => {
    setPage(1)
  }, [activeTab, timeframe, selectedBoxFilter, selectedStaffFilter, selectedExpenseCatFilter, searchQuery])

  // Paginated Slices
  const paginatedShifts = useMemo(() => {
    const start = (page - 1) * pageSize
    return shiftGroups.slice(start, start + pageSize)
  }, [shiftGroups, page])

  const paginatedVouchers = useMemo(() => {
    const start = (page - 1) * pageSize
    return expenseCategoryBreakdown.visibleVouchers.slice(start, start + pageSize)
  }, [expenseCategoryBreakdown.visibleVouchers, page])

  const paginatedCashbook = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedCashbookTransactions.slice(start, start + pageSize)
  }, [sortedCashbookTransactions, page])

  const paginatedHandovers = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedHandovers.slice(start, start + pageSize)
  }, [sortedHandovers, page])

  // Total pages
  const totalPages = useMemo(() => {
    let totalItems = 0
    if (activeTab === "SHIFTS") totalItems = shiftGroups.length
    else if (activeTab === "EXPENSES") totalItems = expenseCategoryBreakdown.visibleVouchers.length
    else if (activeTab === "CASHBOOK") totalItems = sortedCashbookTransactions.length
    else if (activeTab === "HANDOVERS") totalItems = sortedHandovers.length
    return Math.max(1, Math.ceil(totalItems / pageSize))
  }, [activeTab, shiftGroups, expenseCategoryBreakdown.visibleVouchers, sortedCashbookTransactions, sortedHandovers])

  // Comprehensive Excel Export
  const handleExportReportExcel = async () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        { label: "Report Period", value: timeframe.replace(/_/g, " ") },
        { label: "Cash Box / Drawer", value: selectedBoxFilter === "ALL" ? "All Cash Drawers" : boxes.find(b => b.id === selectedBoxFilter)?.name || selectedBoxFilter },
      ]
      if (selectedStaffFilter !== "ALL") {
        const staffObj = staff.find((s) => s.id === selectedStaffFilter)
        activeFilters.push({ label: "Staff / Cashier", value: staffObj?.fullName || selectedStaffFilter })
      }
      if (searchQuery.trim()) {
        activeFilters.push({ label: "Search Keyword", value: searchQuery.trim() })
      }

      if (activeTab === "SHIFTS") {
        const headers = [
          "Shift Date",
          "Cash Box Code",
          "Cash Box Name",
          "Cashier / Staff",
          "Staff Role",
          "Starting Float (₱)",
          "Cash Sales (₱)",
          "Services Cash (₱)",
          "Credit Collected (₱)",
          "Cash-In / Float Added (₱)",
          "Store Expenses (₱)",
          "Bank Deposits (₱)",
          "Handover Out (₱)",
          "Net Flow (₱)",
          "Ending Drawer Balance (₱)",
          "Transactions Count",
        ]

        const rows = shiftGroups.map((g) => {
          const totalIn = g.cashSales + g.servicesCash + g.creditCash + g.cashInFloat
          const totalOut = g.storeExpenses + g.bankDeposits + g.handoverOut
          const net = totalIn - totalOut

          return [
            g.dateFormatted,
            g.cashBoxCode,
            g.cashBoxName,
            g.staffName,
            g.cashierRole,
            g.startingBalance,
            g.cashSales,
            g.servicesCash,
            g.creditCash,
            g.cashInFloat,
            g.storeExpenses,
            g.bankDeposits,
            g.handoverOut,
            net,
            g.endingBalance,
            g.txCount,
          ]
        })

        // Add Totals Summary Row
        const sumSales = shiftGroups.reduce((s, g) => s + g.cashSales, 0)
        const sumServices = shiftGroups.reduce((s, g) => s + g.servicesCash, 0)
        const sumCredit = shiftGroups.reduce((s, g) => s + g.creditCash, 0)
        const sumFloatIn = shiftGroups.reduce((s, g) => s + g.cashInFloat, 0)
        const sumExpenses = shiftGroups.reduce((s, g) => s + g.storeExpenses, 0)
        const sumBank = shiftGroups.reduce((s, g) => s + g.bankDeposits, 0)
        const sumHandover = shiftGroups.reduce((s, g) => s + g.handoverOut, 0)
        const sumNet = (sumSales + sumServices + sumCredit + sumFloatIn) - (sumExpenses + sumBank + sumHandover)
        const sumCount = shiftGroups.reduce((s, g) => s + g.txCount, 0)

        rows.push([
          "TOTALS",
          "—",
          "—",
          "—",
          "—",
          "—",
          sumSales,
          sumServices,
          sumCredit,
          sumFloatIn,
          sumExpenses,
          sumBank,
          sumHandover,
          sumNet,
          "—",
          sumCount,
        ])

        exportReportExcel({
          title: "DAILY CASHIER SHIFT & DRAWER RECONCILIATION REPORT",
          branchName,
          generatedBy: user?.fullName || user?.username || "System",
          filenamePrefix: "cashier_shift_reconciliation",
          headers,
          rows,
          activeFilters,
        })
      } else if (activeTab === "EXPENSES") {
        const headers = [
          "Date / Time",
          "Voucher Code",
          "Cash Box / Drawer",
          "Expense Category",
          "Description",
          "Receipt / Voucher Ref No",
          "Encoder / Staff",
          "Amount (₱)",
          "Balance After (₱)",
        ]

        const rows = expenseCategoryBreakdown.visibleVouchers.map((v) => {
          let catLabel = "Other Store Expense"
          for (const cat of EXPENSE_CATEGORIES) {
            if (v.description?.includes(cat.label)) {
              catLabel = cat.label
              break
            }
          }

          return [
            dateTime(v.transactionDate || v.createdAt),
            v.transactionCode || "—",
            v.cashBox?.name || "Cash Drawer",
            catLabel,
            v.description || "—",
            v.referenceNo || "—",
            v.performedBy?.fullName || v.createdBy?.fullName || "Staff",
            Number(v.amount || 0),
            Number(v.balanceAfter || 0),
          ]
        })

        // Add summary totals
        const sumExp = expenseCategoryBreakdown.visibleVouchers.reduce((s, v) => s + Number(v.amount || 0), 0)
        rows.push(["TOTALS", "—", "—", "—", "—", "—", "—", sumExp, "—"])

        exportReportExcel({
          title: "STORE OPERATING EXPENSES & PETTY CASH REPORT",
          branchName,
          generatedBy: user?.fullName || user?.username || "System",
          filenamePrefix: "store_expenses_audit",
          headers,
          rows,
          activeFilters: [
            ...activeFilters,
            { label: "Category Filter", value: selectedExpenseCatFilter === "ALL" ? "All Categories" : selectedExpenseCatFilter },
          ],
        })
      } else if (activeTab === "CASHBOOK") {
        const headers = [
          "Date / Time",
          "Transaction Code",
          "Cash Box / Drawer",
          "Type",
          "Direction",
          "Description / Reason",
          "Reference No",
          "Handled By (Staff)",
          "Inflow Amount (₱)",
          "Outflow Amount (₱)",
          "Balance After (₱)",
          "Status",
        ]

        const rows = sortedCashbookTransactions.map((tx) => {
          const isInflow = CASH_IN_TYPES.has(tx.type)
          const amt = Number(tx.amount || 0)

          return [
            dateTime(tx.transactionDate || tx.createdAt),
            tx.transactionCode || "—",
            tx.cashBox?.name || "Cash Drawer",
            formatStatus(tx.type),
            isInflow ? "INFLOW (+)" : "OUTFLOW (-)",
            tx.description || "—",
            tx.referenceNo || "—",
            tx.performedBy?.fullName || tx.createdBy?.fullName || "Staff",
            isInflow ? amt : 0,
            !isInflow ? amt : 0,
            Number(tx.balanceAfter || 0),
            formatStatus(tx.status),
          ]
        })

        // Totals
        const totalIn = sortedCashbookTransactions.filter(t => CASH_IN_TYPES.has(t.type) && t.status === "POSTED").reduce((s, t) => s + Number(t.amount || 0), 0)
        const totalOut = sortedCashbookTransactions.filter(t => !CASH_IN_TYPES.has(t.type) && t.status === "POSTED").reduce((s, t) => s + Number(t.amount || 0), 0)
        rows.push(["TOTALS", "—", "—", "—", "—", "—", "—", "—", totalIn, totalOut, "—", "—"])

        exportReportExcel({
          title: "MASTER CASH BOOK & INFLOW/OUTFLOW STREAM",
          branchName,
          generatedBy: user?.fullName || user?.username || "System",
          filenamePrefix: "master_cashbook_stream",
          headers,
          rows,
          activeFilters,
        })
      } else if (activeTab === "HANDOVERS") {
        const headers = [
          "Handover Code",
          "Date / Time Initiated",
          "Cash Box / Drawer",
          "Turned Over By (From)",
          "Assigned Recipient (To)",
          "Amount (₱)",
          "Status",
          "Accepted / Received Date",
          "Remarks",
        ]

        const rows = sortedHandovers.map((h) => [
          h.handoverCode || "—",
          dateTime(h.createdAt),
          h.cashBox?.name || "Cash Drawer",
          h.fromUser?.fullName || h.fromUser?.username || "Staff",
          h.toUser?.fullName || h.toUser?.username || "Open to authorized staff",
          Number(h.amount || 0),
          formatStatus(h.status),
          h.receivedAt ? dateTime(h.receivedAt) : "Pending",
          h.remarks || "—",
        ])

        const sumHandover = sortedHandovers.reduce((s, h) => s + Number(h.amount || 0), 0)
        rows.push(["TOTALS", "—", "—", "—", "—", sumHandover, "—", "—", "—"])

        exportReportExcel({
          title: "SHIFT TURNOVER & CASH CUSTODY TRANSFER AUDIT",
          branchName,
          generatedBy: user?.fullName || user?.username || "System",
          filenamePrefix: "shift_custody_handovers",
          headers,
          rows,
          activeFilters,
        })
      }
    } catch (err) {
      console.error("Export error:", err)
      alert("Failed to export report: " + (err.message || "Unknown error"))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. Date & Scope Controls */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar size={13} /> Period:
            </span>
            {[
              { id: "TODAY", label: "Today" },
              { id: "YESTERDAY", label: "Yesterday" },
              { id: "THIS_WEEK", label: "This Week" },
              { id: "THIS_MONTH", label: "This Month" },
              { id: "LAST_30_DAYS", label: "Last 30 Days" },
              { id: "ALL", label: "All Time" },
              { id: "CUSTOM", label: "Custom Range" },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setTimeframe(preset.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  timeframe === preset.id
                    ? "bg-[var(--color-maroon)] text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Export & Refresh */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadReportData}
              disabled={isLoadingData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <RefreshCw size={14} className={isLoadingData ? "animate-spin text-[var(--color-maroon)]" : ""} />
              Refresh
            </button>

            <ExportExcelButton
              count={
                activeTab === "SHIFTS"
                  ? shiftGroups.length
                  : activeTab === "EXPENSES"
                    ? expenseCategoryBreakdown.visibleVouchers.length
                    : activeTab === "CASHBOOK"
                      ? sortedCashbookTransactions.length
                      : sortedHandovers.length
              }
              isExporting={isExporting}
              onClick={handleExportReportExcel}
            />
          </div>
        </div>

        {/* Custom Date Inputs & Filters */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-slate-100">
          {timeframe === "CUSTOM" && (
            <>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">From Date</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">To Date</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                />
              </label>
            </>
          )}

          {/* Cash Box Filter */}
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash Register / Drawer</span>
            <select
              value={selectedBoxFilter}
              onChange={(e) => setSelectedBoxFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="ALL">All Cash Drawers & Registers</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.boxCode}) — Bal: {money(b.currentBalance)}
                </option>
              ))}
            </select>
          </label>

          {/* Cashier / Staff Filter */}
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Staff / Cashier</span>
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="ALL">All Staff & Cashiers</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.role})
                </option>
              ))}
            </select>
          </label>

          {/* Search Query */}
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Search Keyword</span>
            <div className="relative mt-1">
              <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code, desc, ref..."
                className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
              />
            </div>
          </label>
        </div>
      </section>

      {/* 2. Executive KPI Summary Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total Inflows */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Cash Inflow</span>
            <ArrowDownLeft size={16} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 font-mono">{money(kpis.totalInflow)}</p>
          <p className="mt-1 text-[10px] text-slate-500 font-medium">
            Sales: {money(kpis.totalSalesCash)} • Float In: {money(kpis.totalFloatIn)}
          </p>
        </div>

        {/* Total Operating Expenses */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Store Expenses</span>
            <ArrowUpRight size={16} className="text-rose-600" />
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 font-mono">{money(kpis.totalExpenses)}</p>
          <p className="mt-1 text-[10px] text-slate-500 font-medium">
            Meals, courier, store supplies, bills
          </p>
        </div>

        {/* Bank Deposits */}
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-sky-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Bank Remittances</span>
            <Landmark size={16} className="text-sky-600" />
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 font-mono">{money(kpis.totalBankDeposits)}</p>
          <p className="mt-1 text-[10px] text-slate-500 font-medium">Deposited to bank accounts</p>
        </div>

        {/* Shift Handovers */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Shift Custody Turnover</span>
            <HandCoins size={16} className="text-amber-600" />
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 font-mono">
            {money(kpis.handoversAcceptedTotal + kpis.handoversPendingTotal)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 font-medium">
            Accepted: {money(kpis.handoversAcceptedTotal)}{" "}
            {kpis.handoversPendingTotal > 0 ? `• Pending: ${money(kpis.handoversPendingTotal)}` : ""}
          </p>
        </div>

        {/* Net Drawer Balance / Active Drawers */}
        <div className="rounded-2xl border border-slate-300 bg-slate-50/80 p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-[10px] font-black uppercase tracking-wider">Active Drawer Holdings</span>
            <Banknote size={16} className="text-slate-600" />
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 font-mono">{money(kpis.currentDrawersTotal)}</p>
          <p className="mt-1 text-[10px] text-slate-500 font-medium">
            Net Flow (Period):{" "}
            <strong className={kpis.netCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}>
              {kpis.netCashFlow >= 0 ? "+" : ""}
              {money(kpis.netCashFlow)}
            </strong>
          </p>
        </div>
      </section>

      {/* 3. Audit Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "SHIFTS", label: "Daily Cashier Shift & Drawer Balancing", count: shiftGroups.length, icon: Calendar },
          { id: "EXPENSES", label: "Store Expenses by Category", count: expenseCategoryBreakdown.visibleVouchers.length, icon: Receipt },
          { id: "CASHBOOK", label: "Master Cash Book & Inflow/Outflow", count: sortedCashbookTransactions.length, icon: Layers },
          { id: "HANDOVERS", label: "Shift Turnover & Custody Transfer", count: sortedHandovers.length, icon: HandCoins },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                isActive
                  ? "bg-[var(--color-maroon)] text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 4. Tab Content Panels */}
      {/* MODE 1: DAILY CASHIER SHIFTS */}
      {activeTab === "SHIFTS" && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Calendar size={16} className="text-[var(--color-maroon)]" />
                Daily Cashier Shifts & Drawer Reconciliation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit starting float, cash sales, expenses, bank remittances, and ending balances per shift.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{shiftGroups.length} shift record(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-black uppercase text-slate-600">
                  <th className="p-3">Shift Date</th>
                  <th className="p-3">Drawer / Register</th>
                  <th className="p-3">Cashier / Staff</th>
                  <th className="p-3 text-right">Starting Float</th>
                  <th className="p-3 text-right text-emerald-800">Cash Sales</th>
                  <th className="p-3 text-right text-emerald-800">Services Cash</th>
                  <th className="p-3 text-right text-emerald-800">Float Added</th>
                  <th className="p-3 text-right text-rose-800">Expenses</th>
                  <th className="p-3 text-right text-sky-800">Bank Deposit</th>
                  <th className="p-3 text-right text-amber-800">Handover</th>
                  <th className="p-3 text-right font-black">Net Change</th>
                  <th className="p-3 text-right font-black">Ending Bal</th>
                  <th className="p-3 text-center">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedShifts.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400 font-semibold">
                      No shift records found for the selected period and drawer filters.
                    </td>
                  </tr>
                ) : (
                  paginatedShifts.map((shift) => {
                    const totalIn = shift.cashSales + shift.servicesCash + shift.creditCash + shift.cashInFloat
                    const totalOut = shift.storeExpenses + shift.bankDeposits + shift.handoverOut
                    const netChange = totalIn - totalOut

                    return (
                      <tr key={shift.key} className="hover:bg-slate-50/60 transition">
                        <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">{shift.dateFormatted}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-bold text-slate-800">{shift.cashBoxName}</span>
                          <span className="block text-[10px] font-mono text-slate-400">{shift.cashBoxCode}</span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-bold text-slate-800">{shift.staffName}</span>
                          <span className="block text-[10px] text-slate-400">{shift.cashierRole}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600">{money(shift.startingBalance)}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {shift.cashSales > 0 ? money(shift.cashSales) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {shift.servicesCash > 0 ? money(shift.servicesCash) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-700">
                          {shift.cashInFloat > 0 ? money(shift.cashInFloat) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700">
                          {shift.storeExpenses > 0 ? money(shift.storeExpenses) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-sky-700">
                          {shift.bankDeposits > 0 ? money(shift.bankDeposits) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-amber-700">
                          {shift.handoverOut > 0 ? money(shift.handoverOut) : "—"}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-black ${
                            netChange >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {netChange >= 0 ? `+${money(netChange)}` : money(netChange)}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                          {money(shift.endingBalance)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {shift.txCount}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {shiftGroups.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-black text-slate-900">
                    <td colSpan={4} className="p-3">TOTALS ({shiftGroups.length} shifts)</td>
                    <td className="p-3 text-right font-mono text-emerald-800">
                      {money(shiftGroups.reduce((s, g) => s + g.cashSales, 0))}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-800">
                      {money(shiftGroups.reduce((s, g) => s + g.servicesCash, 0))}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-800">
                      {money(shiftGroups.reduce((s, g) => s + g.cashInFloat, 0))}
                    </td>
                    <td className="p-3 text-right font-mono text-rose-800">
                      {money(shiftGroups.reduce((s, g) => s + g.storeExpenses, 0))}
                    </td>
                    <td className="p-3 text-right font-mono text-sky-800">
                      {money(shiftGroups.reduce((s, g) => s + g.bankDeposits, 0))}
                    </td>
                    <td className="p-3 text-right font-mono text-amber-800">
                      {money(shiftGroups.reduce((s, g) => s + g.handoverOut, 0))}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {money(
                        shiftGroups.reduce(
                          (s, g) =>
                            s +
                            (g.cashSales + g.servicesCash + g.creditCash + g.cashInFloat) -
                            (g.storeExpenses + g.bankDeposits + g.handoverOut),
                          0
                        )
                      )}
                    </td>
                    <td colSpan={2} className="p-3 text-center text-slate-500 font-normal">
                      {shiftGroups.reduce((s, g) => s + g.txCount, 0)} transactions
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* MODE 2: STORE EXPENSES BY CATEGORY */}
      {activeTab === "EXPENSES" && (
        <div className="space-y-4">
          {/* Category Cards Distribution */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {expenseCategoryBreakdown.categories.map((cat) => {
              const Icon = cat.icon || Receipt
              const isSelected = selectedExpenseCatFilter === cat.id

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    setSelectedExpenseCatFilter((current) => (current === cat.id ? "ALL" : cat.id))
                  }
                  className={`rounded-2xl border p-3.5 text-left transition shadow-2xs ${
                    isSelected
                      ? "border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon)]/20 bg-rose-50/50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`grid size-7 place-items-center rounded-lg border text-xs ${cat.color}`}>
                      <Icon size={14} />
                    </span>
                    <span className="text-[10px] font-black text-slate-400">
                      {cat.percent.toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-slate-700 truncate">{cat.label}</p>
                  <p className="mt-0.5 text-base font-black text-slate-900 font-mono">{money(cat.total)}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {cat.count} voucher(s) • Avg {money(cat.avgAmount)}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Detailed Expense Vouchers Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Receipt size={16} className="text-rose-600" />
                  Store Expense Vouchers & Receipts
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {selectedExpenseCatFilter === "ALL" ? "All Categories" : selectedExpenseCatFilter} • Total Spent:{" "}
                  <strong className="text-rose-800 font-mono">{money(expenseCategoryBreakdown.totalAllExpenses)}</strong>
                </p>
              </div>
              {selectedExpenseCatFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setSelectedExpenseCatFilter("ALL")}
                  className="inline-flex items-center gap-1 rounded-xl bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-300 transition"
                >
                  <X size={12} /> Clear Category Filter
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-black uppercase text-slate-600">
                    <th className="p-3">Date / Time</th>
                    <th className="p-3">Voucher Code</th>
                    <th className="p-3">Drawer</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Ref / Receipt #</th>
                    <th className="p-3">Encoder / Staff</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                        No store expense vouchers found for this selection.
                      </td>
                    </tr>
                  ) : (
                    paginatedVouchers.map((v) => {
                      let catBadge = "Other Store Expense"
                      for (const cat of EXPENSE_CATEGORIES) {
                        if (v.description?.includes(cat.label)) {
                          catBadge = cat.label
                          break
                        }
                      }

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">
                            {dateTime(v.transactionDate || v.createdAt)}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {v.transactionCode || "—"}
                          </td>
                          <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                            {v.cashBox?.name || "Cash Drawer"}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-800">
                              {catBadge}
                            </span>
                          </td>
                          <td className="p-3 text-slate-800 max-w-xs truncate" title={v.description}>
                            {v.description || "—"}
                          </td>
                          <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{v.referenceNo || "—"}</td>
                          <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                            {v.performedBy?.fullName || v.createdBy?.fullName || "Staff"}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-rose-700 whitespace-nowrap">
                            {money(v.amount)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: MASTER CASH BOOK STREAM */}
      {activeTab === "CASHBOOK" && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers size={16} className="text-[var(--color-maroon)]" />
                Master Cash Book & Flow Journal
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete chronological log of every cash movement with running drawer balance.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {sortedCashbookTransactions.length} cash movement(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-black uppercase text-slate-600">
                  <th className="p-3">Date / Time</th>
                  <th className="p-3">Transaction Code</th>
                  <th className="p-3">Drawer</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Description / Reason</th>
                  <th className="p-3">Reference #</th>
                  <th className="p-3">Handled By</th>
                  <th className="p-3 text-right text-emerald-800">Inflow (+)</th>
                  <th className="p-3 text-right text-rose-800">Outflow (-)</th>
                  <th className="p-3 text-right font-black">Balance After</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCashbook.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 font-semibold">
                      No cash transactions found for the selected period.
                    </td>
                  </tr>
                ) : (
                  paginatedCashbook.map((tx) => {
                    const isInflow = CASH_IN_TYPES.has(tx.type)
                    const amt = Number(tx.amount || 0)

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">
                          {dateTime(tx.transactionDate || tx.createdAt)}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {tx.transactionCode || "—"}
                        </td>
                        <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                          {tx.cashBox?.name || "Cash Drawer"}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                              isInflow
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-rose-100 text-rose-800 border border-rose-300"
                            }`}
                          >
                            {formatStatus(tx.type)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-800 max-w-xs truncate" title={tx.description}>
                          {tx.description || "—"}
                        </td>
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{tx.referenceNo || "—"}</td>
                        <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                          {tx.performedBy?.fullName || tx.createdBy?.fullName || "Staff"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {isInflow ? `+${money(amt)}` : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                          {!isInflow ? `-${money(amt)}` : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-900 bg-slate-50/40 whitespace-nowrap">
                          {money(tx.balanceAfter)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              tx.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE 4: SHIFT TURNOVER & CUSTODY AUDIT */}
      {activeTab === "HANDOVERS" && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <HandCoins size={16} className="text-amber-600" />
                Shift Turnover & Cash Custody Audit
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit cash transitions between cashiers and managers, acceptance status, and custody chain.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{sortedHandovers.length} handover(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-black uppercase text-slate-600">
                  <th className="p-3">Handover Code</th>
                  <th className="p-3">Date / Time Initiated</th>
                  <th className="p-3">Drawer</th>
                  <th className="p-3">Turned Over By (From)</th>
                  <th className="p-3">Assigned Recipient (To)</th>
                  <th className="p-3 text-right font-black">Amount</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Accepted Date / Time</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedHandovers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                      No shift handovers found for the selected period.
                    </td>
                  </tr>
                ) : (
                  paginatedHandovers.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {h.handoverCode || "—"}
                      </td>
                      <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">{dateTime(h.createdAt)}</td>
                      <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                        {h.cashBox?.name || "Cash Drawer"}
                      </td>
                      <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                        {h.fromUser?.fullName || h.fromUser?.username || "Staff"}
                      </td>
                      <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                        {h.toUser?.fullName || h.toUser?.username || "Open to authorized staff"}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                        {money(h.amount)}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            h.status === "RECEIVED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : h.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                                : "bg-rose-100 text-rose-800 border border-rose-300"
                          }`}
                        >
                          {h.status === "RECEIVED" ? "✓ RECEIVED" : h.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {h.receivedAt ? dateTime(h.receivedAt) : <span className="italic text-amber-600 font-semibold">Awaiting Acceptance</span>}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate" title={h.remarks}>
                        {h.remarks || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
