import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  Lightbulb,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Truck,
  UserCheck,
  Utensils,
  Wrench,
  X,
  XCircle,
} from "lucide-react"

import {
  cancelCashHandover,
  cancelCashTransaction,
  createCashHandover,
  createCashTransaction,
  getCashBoxes,
  getCashHandovers,
  getCashTransactions,
  receiveCashHandover,
} from "../../features/cash-boxes/cashBoxes.api"
import { getSales } from "../../features/sales/sales.api"
import { getServiceJobs } from "../../features/service-jobs/serviceJobs.api"
import { getUsers } from "../../features/users/users.api"
import { getRoleLabel } from "../../constants/roles"
import { exportReportExcel } from "../../utils/businessDocumentExport"
import ExportExcelButton from "../../components/common/ExportExcelButton"
import CashBoxesReportView from "./CashBoxesReportView"

const OWNER_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN"])
const CASH_IN_TYPES = new Set(["CASH_IN", "ADJUSTMENT_IN", "SALE_PAYMENT", "CREDIT_COLLECTION", "SERVICE_PAYMENT"])

const EXPENSE_CATEGORIES = [
  { id: "SUPPLIER_PAYMENT", label: "Supplier Payment / Delivery", icon: Building2, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400" },
  { id: "MEALS_SNACKS", label: "Meals & Staff Snacks", icon: Utensils, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400" },
  { id: "LOGISTICS_COURIER", label: "Logistics & Delivery", icon: Truck, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400" },
  { id: "STORE_SUPPLIES", label: "Store Supplies & Cleaning", icon: Sparkles, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400" },
  { id: "UTILITIES_BILLS", label: "Utilities & Store Bills", icon: Lightbulb, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-400" },
  { id: "SHOP_TOOLS_MAINTENANCE", label: "Shop Tools & Repairs", icon: Wrench, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400" },
  { id: "SALARY_VALE", label: "Salary Advance / Vale", icon: UserCheck, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" },
  { id: "PERMITS_TAXES", label: "Permits & Taxes", icon: Landmark, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400" },
  { id: "OTHER_EXPENSE", label: "Other Store Expense", icon: Receipt, color: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300" },
]

const POPULAR_BANKS = ["BDO", "BPI", "Metrobank", "UnionBank", "RCBC", "Security Bank", "GCash Enterprise", "Maya Business", "Other Bank"]

function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function dateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH")
}

function dateOnly(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

function apiError(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error?.message || fallback
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

function tone(status) {
  if (["ACTIVE", "POSTED", "RECEIVED", "COMPLETED"].includes(status)) return "bg-emerald-50 text-emerald-800 border border-emerald-200"
  if (["CANCELLED", "INACTIVE", "REJECTED"].includes(status)) return "bg-rose-50 text-rose-800 border border-rose-200"
  return "bg-amber-50 text-amber-800 border border-amber-200"
}

function Status({ value }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${tone(value)}`}>{formatStatus(value)}</span>
}

export default function CashBoxesPage({
  hasCashBoxAccess = false,
  selectedBranch,
  user,
}) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const branchName = selectedBranch?.name || user?.branch?.name || "Active Branch"
  const canManage = OWNER_ROLES.has(user?.role)
  const canReceive = Boolean(hasCashBoxAccess)

  const [boxes, setBoxes] = useState([])
  const [selectedBoxId, setSelectedBoxId] = useState("")
  const [transactions, setTransactions] = useState([])
  const [transactionMeta, setTransactionMeta] = useState({})
  const [handovers, setHandovers] = useState([])
  const [handoverMeta, setHandoverMeta] = useState({})
  const [staff, setStaff] = useState([])
  const [salesRecords, setSalesRecords] = useState([])
  const [serviceRecords, setServiceRecords] = useState([])

  const [pageMode, setPageMode] = useState("operations") // "operations" | "reports"
  const [tab, setTab] = useState("all") // "all" | "expenses" | "cashless" | "handovers"
  const [transactionPage, setTransactionPage] = useState(1)
  const [handoverPage, setHandoverPage] = useState(1)
  const [transactionSearch, setTransactionSearch] = useState("")
  const [transactionType, setTransactionType] = useState("")
  const [handoverStatus, setHandoverStatus] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [notice, setNotice] = useState("")

  // Modals state
  const [modalType, setModalType] = useState(null) // "EXPENSE" | "BANK_DEPOSIT" | "CASH_IN" | "HANDOVER" | null

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    category: "MEALS_SNACKS",
    amount: "",
    description: "",
    referenceNo: "",
    transactionDate: new Date().toISOString().slice(0, 10),
  })

  const [bankDepositForm, setBankDepositForm] = useState({
    bankName: "BDO",
    customBankName: "",
    amount: "",
    depositSlipRef: "",
    accountNo: "",
    notes: "",
    transactionDate: new Date().toISOString().slice(0, 10),
  })

  const [cashInForm, setCashInForm] = useState({
    amount: "",
    reason: "Opening Change Fund (Petty Cash Float)",
    referenceNo: "",
    transactionDate: new Date().toISOString().slice(0, 10),
  })

  const [handoverForm, setHandoverForm] = useState({
    amount: "",
    toUserId: "",
    remarks: "",
  })

  const selectedBox = useMemo(
    () => boxes.find((box) => box.id === selectedBoxId) || boxes[0] || null,
    [boxes, selectedBoxId],
  )

  const loadBoxes = useCallback(async () => {
    const response = await getCashBoxes({ ...(branchId ? { branchId } : {}), status: "ACTIVE", limit: 50 })
    const result = response?.data || {}
    const nextBoxes = Array.isArray(result) ? result : result.data || []
    setBoxes(nextBoxes)
    setSelectedBoxId((current) => (nextBoxes.some((box) => box.id === current) ? current : nextBoxes[0]?.id || ""))
  }, [branchId])

  const loadTransactions = useCallback(async () => {
    if (!selectedBoxId) {
      setTransactions([])
      setTransactionMeta({})
      return
    }
    const response = await getCashTransactions(selectedBoxId, {
      ...(transactionSearch.trim() ? { search: transactionSearch.trim() } : {}),
      ...(transactionType ? { type: transactionType } : {}),
      page: transactionPage,
      limit: 30,
    })
    const result = response?.data || {}
    setTransactions(result.data || [])
    setTransactionMeta(result.meta || {})
  }, [selectedBoxId, transactionPage, transactionSearch, transactionType])

  const loadHandovers = useCallback(async () => {
    const response = await getCashHandovers({
      ...(branchId ? { branchId } : {}),
      ...(selectedBoxId ? { cashBoxId: selectedBoxId } : {}),
      ...(handoverStatus ? { status: handoverStatus } : {}),
      page: handoverPage,
      limit: 20,
    })
    setHandovers(Array.isArray(response?.data) ? response.data : [])
    setHandoverMeta(response?.meta || {})
  }, [branchId, handoverPage, handoverStatus, selectedBoxId])

  const loadStaff = useCallback(async () => {
    if (!canManage) return
    const response = await getUsers({ ...(branchId ? { branchId } : {}), status: "ACTIVE", limit: 100 })
    const result = response?.data || {}
    setStaff((Array.isArray(result) ? result : result.data || []).filter((member) => member.role !== "SUPER_OWNER"))
  }, [branchId, canManage])

  const loadDigitalChannels = useCallback(async () => {
    if (!branchId) return
    try {
      const [salesRes, serviceRes] = await Promise.all([
        getSales({ branchId, limit: 100 }),
        getServiceJobs({ branchId, limit: 100 }),
      ])
      const salesList = salesRes?.data?.sales || salesRes?.data || []
      const serviceList = serviceRes?.data || []
      setSalesRecords(Array.isArray(salesList) ? salesList : [])
      setServiceRecords(Array.isArray(serviceList) ? serviceList : [])
    } catch {
      // ignore
    }
  }, [branchId])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setMessage("")
    try {
      await Promise.all([loadBoxes(), loadStaff(), loadDigitalChannels()])
    } catch (error) {
      setMessage(apiError(error, "Could not load cash register data."))
    } finally {
      setIsLoading(false)
    }
  }, [loadBoxes, loadStaff, loadDigitalChannels])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        if (tab === "all" || tab === "expenses") await loadTransactions()
        if (tab === "handovers") await loadHandovers()
      } catch (error) {
        setMessage(apiError(error, "Could not load cash history."))
      }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [loadHandovers, loadTransactions, tab])

  const [isExporting, setIsExporting] = useState(false)

  const handleExportCashExcel = async () => {
    setIsExporting(true)
    try {
      if (tab === "handovers") {
        let allHandovers = []
        let currPage = 1
        let totalPages = 1
        do {
          const response = await getCashHandovers({
            ...(branchId ? { branchId } : {}),
            ...(selectedBoxId ? { cashBoxId: selectedBoxId } : {}),
            ...(handoverStatus ? { status: handoverStatus } : {}),
            page: currPage,
            limit: 100,
          })
          const items = Array.isArray(response?.data) ? response.data : []
          allHandovers = allHandovers.concat(items)
          totalPages = Number(response?.meta?.totalPages || 1)
          currPage += 1
        } while (currPage <= totalPages && currPage <= 50)

        const activeFilters = [
          { label: "Active View", value: "Cash Handovers / Custody" },
          { label: "Cash Box", value: selectedBox?.name || selectedBoxId || "All" },
        ]
        if (handoverStatus) activeFilters.push({ label: "Status", value: formatStatus(handoverStatus) })

        const headers = [
          "Handover Code",
          "Date / Time",
          "Cash Box",
          "Transferor (From)",
          "Recipient (To)",
          "Amount (₱)",
          "Status",
          "Received Date",
          "Remarks",
        ]

        const rows = allHandovers.map((h) => [
          h.handoverCode || "-",
          dateTime(h.createdAt),
          h.cashBox?.name || selectedBox?.name || "-",
          h.fromUser?.fullName || h.fromUser?.username || "-",
          h.toUser?.fullName || h.toUser?.username || "Open to authorized staff",
          Number(h.amount || 0),
          formatStatus(h.status),
          h.receivedAt ? dateTime(h.receivedAt) : "-",
          h.remarks || "-",
        ])

        exportReportExcel({
          title: "CASH HANDOVERS & SHIFT TURNOVER REPORT",
          branchName: branchName || "All Branches",
          generatedBy: user?.fullName || user?.username || "System",
          filenamePrefix: "cash_handovers",
          headers,
          rows,
          activeFilters,
        })
      } else {
        let allTxns = []
        let currPage = 1
        let totalPages = 1
        const effectiveType = tab === "expenses" ? "EXPENSE" : transactionType

        do {
          const response = await getCashTransactions(selectedBoxId, {
            ...(transactionSearch.trim() ? { search: transactionSearch.trim() } : {}),
            ...(effectiveType ? { type: effectiveType } : {}),
            page: currPage,
            limit: 100,
          })
          const result = response?.data || {}
          const items = result.data || []
          allTxns = allTxns.concat(items)
          totalPages = Number(result.meta?.totalPages || 1)
          currPage += 1
        } while (currPage <= totalPages && currPage <= 50)

        const activeFilters = [
          { label: "Cash Box", value: selectedBox?.name || selectedBoxId || "All" },
        ]
        if (tab === "expenses") activeFilters.push({ label: "View Mode", value: "Store Expenses" })
        if (transactionSearch.trim()) activeFilters.push({ label: "Search Keyword", value: transactionSearch.trim() })
        if (effectiveType) activeFilters.push({ label: "Transaction Type", value: formatStatus(effectiveType) })

        const headers = [
          "Transaction Code",
          "Date / Time",
          "Type",
          "Description / Category",
          "Reference No",
          "Inflow / Outflow",
          "Amount (₱)",
          "Balance After (₱)",
          "Encoder / Staff",
          "Status",
        ]

        const rows = allTxns.map((t) => {
          const isCashIn = CASH_IN_TYPES.has(t.type)
          return [
            t.transactionCode || "-",
            dateTime(t.createdAt),
            formatStatus(t.type),
            t.description || "-",
            t.referenceNo || "-",
            isCashIn ? "INFLOW (+)" : "OUTFLOW (-)",
            Number(t.amount || 0),
            Number(t.balanceAfter || 0),
            t.performedBy?.fullName || t.performedBy?.username || "-",
            formatStatus(t.status),
          ]
        })

        exportReportExcel({
          title: tab === "expenses" ? "STORE CASH EXPENSES REPORT" : "CASH REGISTER TRANSACTIONS REPORT",
          branchName: branchName || "All Branches",
          generatedBy: user?.fullName || user?.username || "System",
          filenamePrefix: tab === "expenses" ? "cash_expenses" : "cash_transactions",
          headers,
          rows,
          activeFilters,
        })
      }
    } catch (error) {
      console.error(error)
      setMessage("Failed to export cash data: " + (error.message || "Unknown error"))
    } finally {
      setIsExporting(false)
    }
  }

  const reloadActive = async () => {
    await Promise.all([loadBoxes(), loadDigitalChannels()])
    if (tab === "all" || tab === "expenses") await loadTransactions()
    if (tab === "handovers") await loadHandovers()
  }

  // Calculate Cash Flow Pillars
  const cashPillar = useMemo(() => {
    const currentBalance = Number(selectedBox?.currentBalance || 0)
    let totalInflow = 0
    let totalOutflow = 0
    let totalExpenses = 0
    let totalDepositedBank = 0

    transactions.forEach((tx) => {
      if (tx.status === "POSTED") {
        const amt = Number(tx.amount || 0)
        if (CASH_IN_TYPES.has(tx.type)) {
          totalInflow += amt
        } else {
          totalOutflow += amt
          if (tx.description?.startsWith("[EXPENSE:")) {
            totalExpenses += amt
          } else if (tx.description?.startsWith("[BANK DEPOSIT")) {
            totalDepositedBank += amt
          }
        }
      }
    })

    return {
      currentBalance,
      totalInflow,
      totalOutflow,
      totalExpenses,
      totalDepositedBank,
    }
  }, [selectedBox, transactions])

  const cashlessPillar = useMemo(() => {
    let gcashTotal = 0
    let bankTransferTotal = 0
    let cardArTotal = 0
    const digitalTransactions = []

    // Sales payments
    salesRecords.forEach((sale) => {
      if (sale.status === "COMPLETED") {
        (sale.payments || []).forEach((p) => {
          const amt = Number(p.amount || 0)
          const method = p.paymentMethod?.toUpperCase()
          if (method === "GCASH" || method === "MAYA") {
            gcashTotal += amt
            digitalTransactions.push({
              id: `sale-p-${p.id || sale.id}`,
              channel: "E-Wallet (GCash/Maya)",
              sourceCode: sale.receiptCode,
              sourceType: "POS Sale",
              customerName: sale.customer?.fullName || "Walk-in",
              amount: amt,
              refNo: p.referenceNo || p.remarks || "—",
              date: p.paidAt || sale.saleDate,
            })
          } else if (method === "BANK_TRANSFER") {
            bankTransferTotal += amt
            digitalTransactions.push({
              id: `sale-p-${p.id || sale.id}`,
              channel: "Direct Bank Transfer",
              sourceCode: sale.receiptCode,
              sourceType: "POS Sale",
              customerName: sale.customer?.fullName || "Walk-in",
              amount: amt,
              refNo: p.referenceNo || p.remarks || "—",
              date: p.paidAt || sale.saleDate,
            })
          } else if (method && method !== "CASH") {
            cardArTotal += amt
            digitalTransactions.push({
              id: `sale-p-${p.id || sale.id}`,
              channel: `Card / Financing (${formatStatus(method)})`,
              sourceCode: sale.receiptCode,
              sourceType: "POS Sale",
              customerName: sale.customer?.fullName || "Walk-in",
              amount: amt,
              refNo: p.referenceNo || p.remarks || "—",
              date: p.paidAt || sale.saleDate,
            })
          }
        })
      }
    })

    // Service payments
    serviceRecords.forEach((job) => {
      (job.payments || []).forEach((p) => {
        const amt = Number(p.amount || 0)
        const method = p.paymentMethod?.toUpperCase()
        if (method === "GCASH" || method === "MAYA") {
          gcashTotal += amt
          digitalTransactions.push({
            id: `service-p-${p.id || job.id}`,
            channel: "E-Wallet (GCash/Maya)",
            sourceCode: job.jobCode,
            sourceType: "Service Job",
            customerName: job.customer?.fullName || job.customerNameSnapshot || "Walk-in",
            amount: amt,
            refNo: p.referenceNo || p.remarks || "—",
            date: p.createdAt || job.receivedAt,
          })
        } else if (method === "BANK_TRANSFER") {
          bankTransferTotal += amt
          digitalTransactions.push({
            id: `service-p-${p.id || job.id}`,
            channel: "Direct Bank Transfer",
            sourceCode: job.jobCode,
            sourceType: "Service Job",
            customerName: job.customer?.fullName || job.customerNameSnapshot || "Walk-in",
            amount: amt,
            refNo: p.referenceNo || p.remarks || "—",
            date: p.createdAt || job.receivedAt,
          })
        } else if (method && method !== "CASH") {
          cardArTotal += amt
          digitalTransactions.push({
            id: `service-p-${p.id || job.id}`,
            channel: `Card / Financing (${formatStatus(method)})`,
            sourceCode: job.jobCode,
            sourceType: "Service Job",
            customerName: job.customer?.fullName || job.customerNameSnapshot || "Walk-in",
            amount: amt,
            refNo: p.referenceNo || p.remarks || "—",
            date: p.createdAt || job.receivedAt,
          })
        }
      })
    })

    const totalCashless = gcashTotal + bankTransferTotal + cardArTotal

    return {
      gcashTotal,
      bankTransferTotal,
      cardArTotal,
      totalCashless,
      digitalTransactions,
    }
  }, [salesRecords, serviceRecords])

  const totalBothInflow = cashPillar.currentBalance + cashlessPillar.totalCashless

  // Filtered Expense Transactions
  const expenseTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => tx.type === "CASH_OUT" || tx.description?.startsWith("[EXPENSE:"),
    )
  }, [transactions])

  // Category breakdown for expenses
  const expenseCategoryBreakdown = useMemo(() => {
    const map = {}
    EXPENSE_CATEGORIES.forEach((cat) => {
      map[cat.id] = { ...cat, total: 0, count: 0 }
    })
    map["OTHER_EXPENSE"] = map["OTHER_EXPENSE"] || { id: "OTHER_EXPENSE", label: "Other Expenses", total: 0, count: 0 }

    expenseTransactions.forEach((tx) => {
      if (tx.status === "POSTED") {
        const amt = Number(tx.amount || 0)
        let foundCat = "OTHER_EXPENSE"
        EXPENSE_CATEGORIES.forEach((cat) => {
          if (tx.description?.includes(`[EXPENSE: ${cat.label}]`) || tx.description?.includes(cat.label)) {
            foundCat = cat.id
          }
        })
        if (foundCat === "OTHER_EXPENSE") {
          const lowerDesc = tx.description?.toLowerCase() || ""
          if (lowerDesc.includes("permit") || lowerDesc.includes("tax") || lowerDesc.includes("bir") || lowerDesc.includes("mayor")) {
            foundCat = "PERMITS_TAXES"
          }
        }
        if (!map[foundCat]) map[foundCat] = { id: foundCat, label: "Other", total: 0, count: 0 }
        map[foundCat].total += amt
        map[foundCat].count += 1
      }
    })

    return Object.values(map).filter((c) => c.total > 0 || c.id === "MEALS_SNACKS" || c.id === "LOGISTICS_COURIER" || c.id === "PERMITS_TAXES")
  }, [expenseTransactions])

  // Handlers
  const handleRecordExpense = async (e) => {
    e.preventDefault()
    if (!selectedBox || isSaving) return
    const amt = Number(expenseForm.amount)
    if (!amt || amt <= 0) {
      setMessage("Please enter a valid expense amount.")
      return
    }

    const catObj = EXPENSE_CATEGORIES.find((c) => c.id === expenseForm.category)
    const catLabel = catObj?.label || "Store Expense"
    const description = `[EXPENSE: ${catLabel}] ${expenseForm.description.trim()}`

    setIsSaving(true)
    setMessage("")
    try {
      await createCashTransaction(selectedBox.id, {
        type: "CASH_OUT",
        amount: amt,
        description,
        referenceNo: expenseForm.referenceNo.trim() || undefined,
        transactionDate: expenseForm.transactionDate || undefined,
      })
      setNotice(`Store expense of ${money(amt)} recorded successfully.`)
      setExpenseForm({
        category: "MEALS_SNACKS",
        amount: "",
        description: "",
        referenceNo: "",
        transactionDate: new Date().toISOString().slice(0, 10),
      })
      setModalType(null)
      await reloadActive()
    } catch (err) {
      setMessage(apiError(err, "Could not record expense."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleBankDeposit = async (e) => {
    e.preventDefault()
    if (!selectedBox || isSaving) return
    const amt = Number(bankDepositForm.amount)
    if (!amt || amt <= 0) {
      setMessage("Please enter a valid deposit amount.")
      return
    }

    const effectiveBank = bankDepositForm.bankName === "Other Bank" ? bankDepositForm.customBankName.trim() : bankDepositForm.bankName
    const description = `[BANK DEPOSIT - ${effectiveBank || "Bank"}] ${bankDepositForm.notes.trim() || `Cash deposited to ${effectiveBank} account ${bankDepositForm.accountNo || ""}`}`

    setIsSaving(true)
    setMessage("")
    try {
      await createCashTransaction(selectedBox.id, {
        type: "CASH_OUT",
        amount: amt,
        description,
        referenceNo: bankDepositForm.depositSlipRef.trim() || undefined,
        transactionDate: bankDepositForm.transactionDate || undefined,
      })
      setNotice(`Bank deposit of ${money(amt)} to ${effectiveBank} recorded.`)
      setBankDepositForm({
        bankName: "BDO",
        customBankName: "",
        amount: "",
        depositSlipRef: "",
        accountNo: "",
        notes: "",
        transactionDate: new Date().toISOString().slice(0, 10),
      })
      setModalType(null)
      await reloadActive()
    } catch (err) {
      setMessage(apiError(err, "Could not record bank deposit."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCashIn = async (e) => {
    e.preventDefault()
    if (!selectedBox || isSaving) return
    const amt = Number(cashInForm.amount)
    if (!amt || amt <= 0) {
      setMessage("Please enter a valid cash amount.")
      return
    }

    setIsSaving(true)
    setMessage("")
    try {
      await createCashTransaction(selectedBox.id, {
        type: "CASH_IN",
        amount: amt,
        description: `[CASH IN] ${cashInForm.reason.trim()}`,
        referenceNo: cashInForm.referenceNo.trim() || undefined,
        transactionDate: cashInForm.transactionDate || undefined,
      })
      setNotice(`Cash float of ${money(amt)} added to drawer.`)
      setCashInForm({
        amount: "",
        reason: "Opening Change Fund (Petty Cash Float)",
        referenceNo: "",
        transactionDate: new Date().toISOString().slice(0, 10),
      })
      setModalType(null)
      await reloadActive()
    } catch (err) {
      setMessage(apiError(err, "Could not add cash."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateHandover = async (e) => {
    e.preventDefault()
    if (!selectedBox || isSaving) return
    const amt = Number(handoverForm.amount)
    if (!amt || amt <= 0) {
      setMessage("Please enter a valid handover amount.")
      return
    }

    setIsSaving(true)
    setMessage("")
    try {
      await createCashHandover(selectedBox.id, {
        amount: amt,
        toUserId: handoverForm.toUserId || undefined,
        remarks: handoverForm.remarks.trim() || undefined,
      })
      setNotice(`Cash handover request of ${money(amt)} submitted.`)
      setHandoverForm({ amount: "", toUserId: "", remarks: "" })
      setModalType(null)
      setTab("handovers")
      await reloadActive()
    } catch (err) {
      setMessage(apiError(err, "Could not create cash handover."))
    } finally {
      setIsSaving(false)
    }
  }

  const reverseTransaction = async (transaction) => {
    const reason = window.prompt(`Reason for voiding / reversing transaction ${transaction.transactionCode}?`)
    if (!reason?.trim()) return
    setIsSaving(true)
    try {
      await cancelCashTransaction(transaction.id, { cancellationReason: reason.trim() })
      setNotice(`${transaction.transactionCode} reversed with audit entry.`)
      await reloadActive()
    } catch (err) {
      setMessage(apiError(err, "Could not reverse transaction."))
    } finally {
      setIsSaving(false)
    }
  }

  const actOnHandover = async (handover, action) => {
    if (isSaving) return
    const isReceive = action === "receive"
    const reason = isReceive ? window.prompt("Optional receiving remarks:", "") : window.prompt("Cancellation reason:")
    if (!isReceive && !reason?.trim()) return
    setIsSaving(true)
    setMessage("")
    try {
      if (isReceive) await receiveCashHandover(handover.id, { remarks: reason?.trim() || undefined })
      else await cancelCashHandover(handover.id, { cancellationReason: reason.trim() })
      setNotice(`${handover.handoverCode} ${isReceive ? "received and confirmed" : "cancelled"}.`)
      await reloadActive()
    } catch (err) {
      setMessage(apiError(err, `Could not ${action} cash handover.`))
    } finally {
      setIsSaving(false)
    }
  }

  const transactionPages = Math.max(1, transactionMeta.totalPages || 1)
  const handoverPages = Math.max(1, handoverMeta.totalPages || 1)

  return (
    <div className="space-y-5">
      {/* Top Header Banner */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
                Finance & Cash Flow
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] font-semibold text-slate-500">
                {branchName}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
              Cash Register & Vault Center
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Multi-channel monitoring for physical cash in drawer, cashless e-wallets, bank deposits, store expenses, and shift handovers.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              disabled={isLoading}
              onClick={refresh}
              type="button"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={14} />
              Refresh
            </button>

            {pageMode === "operations" && (
              <ExportExcelButton
                count={tab === "handovers" ? (handoverMeta?.total || handovers.length) : (transactionMeta?.total || transactions.length)}
                isExporting={isExporting}
                onClick={handleExportCashExcel}
              />
            )}

            {canManage && (
              <>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition shadow-2xs"
                  onClick={() => setModalType("EXPENSE")}
                  type="button"
                >
                  <Receipt size={14} className="text-rose-600" />
                  Record Expense
                </button>

                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 transition shadow-2xs"
                  onClick={() => setModalType("BANK_DEPOSIT")}
                  type="button"
                >
                  <Building2 size={14} className="text-sky-600" />
                  Deposit to Bank
                </button>

                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-2xs"
                  onClick={() => setModalType("CASH_IN")}
                  type="button"
                >
                  <Plus size={14} />
                  Add Cash Float
                </button>

                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-2xs"
                  onClick={() => setModalType("HANDOVER")}
                  type="button"
                >
                  <HandCoins size={14} className="text-amber-700" />
                  Shift Handover
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mt-5 flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setPageMode("operations")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              pageMode === "operations"
                ? "border-[var(--color-maroon)] text-[var(--color-maroon)] font-black"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Banknote size={14} />
            <span>Cashier Operations & Drawer</span>
          </button>
          <button
            type="button"
            onClick={() => setPageMode("reports")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              pageMode === "reports"
                ? "border-[var(--color-maroon)] text-[var(--color-maroon)] font-black"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>Executive Reports & Shift Audit</span>
          </button>
        </div>
      </section>

      {/* Alerts */}
      {message && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button"><X size={16} /></button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} type="button"><X size={16} /></button>
        </div>
      )}

      {pageMode === "reports" ? (
        <CashBoxesReportView
          branchId={branchId}
          selectedBranch={selectedBranch}
          user={user}
          boxes={boxes}
          staff={staff}
          onRefresh={refresh}
        />
      ) : (
        <>
          {/* THE 3 CLEAN PILLARS OF CASH FLOW */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* PILLAR 1: TOTAL PHYSICAL CASH IN DRAWER */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700">
                    <Banknote size={16} />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Physical Cash
                    </p>
                    <p className="text-[10px] font-medium text-slate-400">
                      Drawer & Vault Holding
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Drawer Active
                </span>
              </div>

              <div className="mt-4">
                <p className="font-mono text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {money(cashPillar.currentBalance)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Physical currency available in cashier drawer
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Inflow Collections</p>
                  <p className="mt-0.5 font-mono font-bold text-emerald-700">
                    +{money(cashPillar.totalInflow)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Expenses & Outflow</p>
                  <p className="mt-0.5 font-mono font-bold text-rose-700">
                    -{money(cashPillar.totalOutflow)}
                  </p>
                </div>
              </div>
            </div>

            {/* PILLAR 2: TOTAL CASHLESS & DIGITAL WALLETS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-sky-50 border border-sky-100 text-sky-700">
                    <Smartphone size={16} />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Cashless & Digital
                    </p>
                    <p className="text-[10px] font-medium text-slate-400">
                      GCash, Bank, Cards
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-sky-50 border border-sky-200/60 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                  Verified AR
                </span>
              </div>

              <div className="mt-4">
                <p className="font-mono text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {money(cashlessPillar.totalCashless)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Digital receipts from sales & service jobs
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-1.5 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase truncate">GCash/Maya</p>
                  <p className="mt-0.5 font-mono font-bold text-slate-800 truncate">
                    {money(cashlessPillar.gcashTotal)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-1.5 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase truncate">Bank Trans</p>
                  <p className="mt-0.5 font-mono font-bold text-slate-800 truncate">
                    {money(cashlessPillar.bankTransferTotal)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-1.5 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase truncate">Cards & AR</p>
                  <p className="mt-0.5 font-mono font-bold text-slate-800 truncate">
                    {money(cashlessPillar.cardArTotal)}
                  </p>
                </div>
              </div>
            </div>

            {/* PILLAR 3: TOTAL COMBINED CASH FLOW */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-purple-50 border border-purple-100 text-purple-700">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Total Gross Inflow
                    </p>
                    <p className="text-[10px] font-medium text-slate-400">
                      Combined Business Revenue
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-purple-50 border border-purple-200/60 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                  Cash + Digital
                </span>
              </div>

              <div className="mt-4">
                <p className="font-mono text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {money(totalBothInflow)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Combined drawer cash + verified digital receipts
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Store Expenses</p>
                  <p className="mt-0.5 font-mono font-bold text-rose-700">
                    {money(cashPillar.totalExpenses)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bank Deposits</p>
                  <p className="mt-0.5 font-mono font-bold text-sky-700">
                    {money(cashPillar.totalDepositedBank)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* TABS & LEDGER CONTAINER */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            {/* Tab Headers */}
            <div className="flex items-center border-b border-slate-200 px-4 pt-1 gap-2 sm:gap-6 overflow-x-auto bg-white">
              <button
                className={`flex items-center gap-1.5 pb-3 pt-2 text-xs transition border-b-2 whitespace-nowrap ${
                  tab === "all"
                    ? "border-[var(--color-maroon)] text-[var(--color-maroon)] font-black"
                    : "border-transparent text-slate-500 hover:text-slate-800 font-bold"
                }`}
                onClick={() => setTab("all")}
                type="button"
              >
                <Banknote size={14} />
                <span>All Movements & Ledger</span>
              </button>

              <button
                className={`flex items-center gap-1.5 pb-3 pt-2 text-xs transition border-b-2 whitespace-nowrap ${
                  tab === "expenses"
                    ? "border-[var(--color-maroon)] text-[var(--color-maroon)] font-black"
                    : "border-transparent text-slate-500 hover:text-slate-800 font-bold"
                }`}
                onClick={() => setTab("expenses")}
                type="button"
              >
                <Receipt size={14} />
                <span>Store Expenses Tracker</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                  {expenseTransactions.length}
                </span>
              </button>

              <button
                className={`flex items-center gap-1.5 pb-3 pt-2 text-xs transition border-b-2 whitespace-nowrap ${
                  tab === "cashless"
                    ? "border-[var(--color-maroon)] text-[var(--color-maroon)] font-black"
                    : "border-transparent text-slate-500 hover:text-slate-800 font-bold"
                }`}
                onClick={() => setTab("cashless")}
                type="button"
              >
                <Smartphone size={14} />
                <span>Cashless & Bank Log</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                  {cashlessPillar.digitalTransactions.length}
                </span>
              </button>

              <button
                className={`flex items-center gap-1.5 pb-3 pt-2 text-xs transition border-b-2 whitespace-nowrap ${
                  tab === "handovers"
                    ? "border-[var(--color-maroon)] text-[var(--color-maroon)] font-black"
                    : "border-transparent text-slate-500 hover:text-slate-800 font-bold"
                }`}
                onClick={() => setTab("handovers")}
                type="button"
              >
                <HandCoins size={14} />
                <span>Shift Handovers</span>
              </button>
            </div>

            {/* TAB 1: ALL CASH MOVEMENTS & LEDGER */}
            {tab === "all" && (
              <div>
                <div className="grid gap-3 border-b border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-[1fr_220px]">
                  <label className="relative block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                      onChange={(event) => {
                        setTransactionSearch(event.target.value)
                        setTransactionPage(1)
                      }}
                      placeholder="Search transaction code, reference, description..."
                      value={transactionSearch}
                    />
                  </label>

                  <select
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[var(--color-maroon)]"
                    onChange={(event) => {
                      setTransactionType(event.target.value)
                      setTransactionPage(1)
                    }}
                    value={transactionType}
                  >
                    <option value="">All transaction types</option>
                    {["CASH_IN", "CASH_OUT", "SALE_PAYMENT", "CREDIT_COLLECTION", "SERVICE_PAYMENT", "HANDOVER_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"].map((value) => (
                      <option key={value} value={value}>{formatStatus(value)}</option>
                    ))}
                  </select>
                </div>

                <div className="divide-y divide-slate-100">
                  {transactions.map((entry) => {
                    const isIn = CASH_IN_TYPES.has(entry.type)
                    const isExpense = entry.description?.startsWith("[EXPENSE:")
                    const isBankDeposit = entry.description?.startsWith("[BANK DEPOSIT")

                    return (
                      <article className="grid gap-3 p-3.5 sm:px-4 sm:py-3 md:grid-cols-[1fr_auto_auto] md:items-center hover:bg-slate-50/70 transition" key={entry.id}>
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${
                            isExpense
                              ? "bg-rose-50 text-rose-700 border-rose-100"
                              : isBankDeposit
                                ? "bg-sky-50 text-sky-700 border-sky-100"
                                : isIn
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                  : "bg-amber-50 text-amber-700 border-amber-100"
                          }`}>
                            {isExpense ? <Receipt size={15} /> : isBankDeposit ? <Building2 size={15} /> : isIn ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-mono font-bold text-xs text-slate-900">
                                {entry.transactionCode}
                              </p>
                              {entry.referenceNo ? (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                                  Ref: {entry.referenceNo}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs font-semibold text-slate-800 line-clamp-1">
                              {entry.description}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {dateTime(entry.transactionDate)} · {formatStatus(entry.type)} · Encoder: {entry.createdBy?.fullName || "System"}
                            </p>
                          </div>
                        </div>

                        <div className="text-left md:text-right">
                          <p className={`font-mono text-sm font-bold ${isIn ? "text-emerald-700" : "text-rose-700"}`}>
                            {isIn ? "+" : "−"}{money(entry.amount)}
                          </p>
                          <div className="mt-0.5">
                            <Status value={entry.status} />
                          </div>
                        </div>

                        {canManage && entry.status === "POSTED" && entry.source === "MANUAL" ? (
                          <button
                            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition shadow-2xs"
                            disabled={isSaving}
                            onClick={() => reverseTransaction(entry)}
                            type="button"
                          >
                            Void / Reverse
                          </button>
                        ) : (
                          <span className="w-16" />
                        )}
                      </article>
                    )
                  })}

                  {!isLoading && transactions.length === 0 && (
                    <div className="p-12 text-center">
                      <div className="size-11 rounded-2xl bg-slate-100 text-slate-400 grid place-items-center mx-auto mb-2.5">
                        <Banknote size={20} />
                      </div>
                      <p className="text-xs font-bold text-slate-700">No cash transactions found</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">Adjust filters or post a new cash movement.</p>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-500">
                  <p className="text-xs font-medium text-slate-500">
                    Page {transactionMeta.page || transactionPage} of {transactionPages}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition"
                      disabled={transactionPage <= 1}
                      onClick={() => setTransactionPage((p) => Math.max(1, p - 1))}
                      type="button"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition"
                      disabled={transactionPage >= transactionPages}
                      onClick={() => setTransactionPage((p) => p + 1)}
                      type="button"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}

        {/* TAB 2: STORE EXPENSES TRACKER */}
        {tab === "expenses" && (
          <div className="p-5 space-y-6">
            {/* Category Breakdown Cards */}
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Expense Categories Summary
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {expenseCategoryBreakdown.map((cat) => {
                  const IconComponent = cat.icon || Receipt
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-slate-300" key={cat.id}>
                      <div className="flex items-center gap-2.5">
                        <span className={`grid size-8 place-items-center rounded-lg ${cat.color || "bg-slate-100 text-slate-700"}`}>
                          <IconComponent size={15} />
                        </span>
                        <p className="text-xs font-semibold text-slate-800 line-clamp-1">{cat.label}</p>
                      </div>
                      <div className="mt-2.5 flex items-baseline justify-between border-t border-slate-100 pt-2">
                        <p className="font-mono text-base font-bold text-rose-700">
                          {money(cat.total)}
                        </p>
                        <span className="text-[11px] font-medium text-slate-400">
                          {cat.count} entry{cat.count === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Expenses List Table - Desktop */}
            <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3">Code / Voucher</th>
                    <th className="p-3">Category & Description</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Encoder</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseTransactions.map((tx) => (
                    <tr className="hover:bg-slate-50/60 transition-colors" key={tx.id}>
                      <td className="p-3 font-mono font-semibold text-xs text-slate-800">
                        {tx.transactionCode}
                        {tx.referenceNo ? <p className="text-[11px] font-normal text-slate-400">Ref: {tx.referenceNo}</p> : null}
                      </td>
                      <td className="p-3">
                        <p className="text-xs font-medium text-slate-800">{tx.description}</p>
                      </td>
                      <td className="p-3 text-xs text-slate-500">{dateOnly(tx.transactionDate)}</td>
                      <td className="p-3 text-xs text-slate-500">{tx.createdBy?.fullName || "—"}</td>
                      <td className="p-3 text-right font-mono font-bold text-xs text-rose-700">
                        -{money(tx.amount)}
                      </td>
                      <td className="p-3 text-right">
                        {canManage && tx.status === "POSTED" && tx.source === "MANUAL" ? (
                          <button
                            className="rounded-lg border border-rose-200 bg-rose-50/50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100/60 transition"
                            disabled={isSaving}
                            onClick={() => reverseTransaction(tx)}
                            type="button"
                          >
                            Void
                          </button>
                        ) : (
                          <Status value={tx.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                  {expenseTransactions.length === 0 && (
                    <tr>
                      <td className="p-8 text-center text-xs text-slate-400" colSpan={6}>
                        No store expenses recorded yet. Click <strong className="text-slate-600">"Record Expense"</strong> above to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Expenses List Cards - Mobile */}
            <div className="grid gap-2.5 lg:hidden">
              {expenseTransactions.map((tx) => (
                <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2" key={tx.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-bold text-xs text-slate-900">{tx.transactionCode}</p>
                      {tx.referenceNo ? <p className="text-[11px] text-slate-400 font-mono">Ref: {tx.referenceNo}</p> : null}
                    </div>
                    <p className="font-mono font-bold text-sm text-rose-700">
                      -{money(tx.amount)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-800 leading-snug">{tx.description}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <div>
                      <span>{dateOnly(tx.transactionDate)}</span>
                      <span className="mx-1.5">·</span>
                      <span>{tx.createdBy?.fullName || "—"}</span>
                    </div>
                    <div>
                      {canManage && tx.status === "POSTED" && tx.source === "MANUAL" ? (
                        <button
                          className="rounded-lg border border-rose-200 bg-rose-50/50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100/60 transition"
                          disabled={isSaving}
                          onClick={() => reverseTransaction(tx)}
                          type="button"
                        >
                          Void
                        </button>
                      ) : (
                        <Status value={tx.status} />
                      )}
                    </div>
                  </div>
                </article>
              ))}
              {expenseTransactions.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  No store expenses recorded yet. Click <strong className="text-slate-600">"Record Expense"</strong> above to add one.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CASHLESS & BANK COLLECTIONS */}
        {tab === "cashless" && (
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Digital Collections Breakdown
                </h2>
                <p className="text-xs text-slate-400">
                  Real-time verified cashless receipts from POS Cashiering and Service Job Orders.
                </p>
              </div>
              <div>
                <span className="rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-1.5 text-xs font-mono font-bold text-sky-800">
                  Total: {money(cashlessPillar.totalCashless)}
                </span>
              </div>
            </div>

            {/* Cashless Table - Desktop */}
            <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3">Receipt / Job Code</th>
                    <th className="p-3">Payment Channel</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Reference / Notes</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashlessPillar.digitalTransactions.map((item) => (
                    <tr className="hover:bg-slate-50/60 transition-colors" key={item.id}>
                      <td className="p-3 font-mono font-semibold text-xs text-slate-800">
                        {item.sourceCode}
                        <p className="text-[11px] font-normal text-slate-400">{item.sourceType}</p>
                      </td>
                      <td className="p-3 font-semibold text-xs text-sky-700">
                        {item.channel}
                      </td>
                      <td className="p-3 text-xs font-medium text-slate-700">
                        {item.customerName}
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-500">
                        {item.refNo}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {dateTime(item.date)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-xs text-emerald-700">
                        +{money(item.amount)}
                      </td>
                    </tr>
                  ))}
                  {cashlessPillar.digitalTransactions.length === 0 && (
                    <tr>
                      <td className="p-8 text-center text-xs text-slate-400" colSpan={6}>
                        No cashless digital transactions recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cashless Cards - Mobile */}
            <div className="grid gap-2.5 lg:hidden">
              {cashlessPillar.digitalTransactions.map((item) => (
                <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2" key={item.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-bold text-xs text-slate-900">{item.sourceCode}</p>
                      <p className="text-[11px] text-slate-400">{item.sourceType}</p>
                    </div>
                    <p className="font-mono font-bold text-sm text-emerald-700">
                      +{money(item.amount)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-sky-700">{item.channel}</span>
                    <span className="font-medium text-slate-700">{item.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span className="font-mono text-[11px]">{item.refNo || "No ref"}</span>
                    <span>{dateTime(item.date)}</span>
                  </div>
                </article>
              ))}
              {cashlessPillar.digitalTransactions.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  No cashless digital transactions recorded for this period.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SHIFT HANDOVERS */}
        {tab === "handovers" && (
          <div>
            <div className="border-b border-slate-200/80 p-3.5 bg-slate-50/50">
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 md:max-w-xs outline-none focus:border-slate-400 shadow-2xs"
                onChange={(event) => {
                  setHandoverStatus(event.target.value)
                  setHandoverPage(1)
                }}
                value={handoverStatus}
              >
                <option value="">All handover statuses</option>
                <option value="PENDING">Pending Acceptance</option>
                <option value="RECEIVED">Received & Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="divide-y divide-slate-100">
              {handovers.map((handover) => (
                <article className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center hover:bg-slate-50/60 transition-colors" key={handover.id}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-amber-200/70 bg-amber-50 text-amber-800">
                      <HandCoins size={16} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-xs text-slate-900">{handover.handoverCode}</p>
                        <Status value={handover.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        From <strong className="text-slate-800">{handover.fromUser?.fullName || "Staff"}</strong> to <strong className="text-slate-800">{handover.toUser?.fullName || "Branch Custodian / Next Shift"}</strong>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {dateTime(handover.createdAt)} · {handover.remarks || "No additional remarks"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="font-mono text-base font-bold text-slate-900">
                      {money(handover.amount)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {canReceive && handover.status === "PENDING" ? (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition"
                        disabled={isSaving}
                        onClick={() => actOnHandover(handover, "receive")}
                        type="button"
                      >
                        <CheckCircle2 size={14} />
                        Receive Cash
                      </button>
                    ) : null}
                    {canManage && handover.status === "PENDING" ? (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/60 transition"
                        disabled={isSaving}
                        onClick={() => actOnHandover(handover, "cancel")}
                        type="button"
                      >
                        <XCircle size={14} />
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}

              {!isLoading && handovers.length === 0 && (
                <div className="p-10 text-center">
                  <HandCoins className="mx-auto text-slate-300" size={30} />
                  <p className="mt-2 text-xs font-semibold text-slate-700">No cash handovers recorded</p>
                  <p className="text-[11px] text-slate-400">Shift handovers and vault remittances will appear here.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-100 p-3.5">
              <p className="text-xs font-medium text-slate-500">
                Page {handoverMeta.page || handoverPage} of {handoverPages}
              </p>
              <div className="flex gap-1.5">
                <button
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition"
                  disabled={handoverPage <= 1}
                  onClick={() => setHandoverPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition"
                  disabled={handoverPage >= handoverPages}
                  onClick={() => setHandoverPage((p) => p + 1)}
                  type="button"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. RECORD STORE EXPENSE MODAL */}
      {modalType === "EXPENSE" && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-rose-50 text-rose-700">
                  <Receipt size={15} />
                </span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Cash Register</span>
                  <h3 className="text-base font-black text-slate-900 leading-tight">Record Store Expense</h3>
                </div>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setModalType(null)} type="button">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordExpense}>
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Select Category</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-0.5">
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const IconComponent = cat.icon
                      const isSelected = expenseForm.category === cat.id
                      return (
                        <button
                          className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-semibold transition ${
                            isSelected
                              ? "border-[var(--color-maroon)] bg-rose-50 text-[var(--color-maroon)] font-bold shadow-2xs"
                              : "border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                          key={cat.id}
                          onClick={() => setExpenseForm((f) => ({ ...f, category: cat.id }))}
                          type="button"
                        >
                          <span className={`grid size-6 shrink-0 place-items-center rounded-md ${cat.color}`}>
                            <IconComponent size={13} />
                          </span>
                          <span className="truncate">{cat.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Amount (₱) <span className="text-red-600">*</span></label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                      min="0.01"
                      onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={expenseForm.amount}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Date</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                      onChange={(e) => setExpenseForm((f) => ({ ...f, transactionDate: e.target.value }))}
                      type="date"
                      value={expenseForm.transactionDate}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Description / Purpose <span className="text-red-600">*</span></label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400 placeholder:font-normal"
                    minLength={3}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Lunch for staff / Courier delivery / Mayor's permit / BIR tax"
                    required
                    value={expenseForm.description}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Receipt / Voucher Ref (Optional)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400 placeholder:font-normal"
                    onChange={(e) => setExpenseForm((f) => ({ ...f, referenceNo: e.target.value }))}
                    placeholder="e.g. OR #12345 / Grab Booking #456"
                    value={expenseForm.referenceNo}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  onClick={() => setModalType(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Recording…" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. DEPOSIT CASH TO BANK MODAL */}
      {modalType === "BANK_DEPOSIT" && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-sky-50 text-sky-700">
                  <Building2 size={15} />
                </span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Remittance</span>
                  <h3 className="text-base font-black text-slate-900 leading-tight">Deposit Cash to Bank</h3>
                </div>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setModalType(null)} type="button">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleBankDeposit}>
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Select Bank Account</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {POPULAR_BANKS.map((b) => (
                      <button
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          bankDepositForm.bankName === b
                            ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        key={b}
                        onClick={() => setBankDepositForm((f) => ({ ...f, bankName: b }))}
                        type="button"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {bankDepositForm.bankName === "Other Bank" && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Specify Bank Name <span className="text-red-600">*</span></label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                      onChange={(e) => setBankDepositForm((f) => ({ ...f, customBankName: e.target.value }))}
                      placeholder="Enter bank name"
                      required
                      value={bankDepositForm.customBankName}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Deposit Amount (₱) <span className="text-red-600">*</span></label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                      min="0.01"
                      onChange={(e) => setBankDepositForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={bankDepositForm.amount}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Deposit Date</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                      onChange={(e) => setBankDepositForm((f) => ({ ...f, transactionDate: e.target.value }))}
                      type="date"
                      value={bankDepositForm.transactionDate}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Deposit Slip Ref / Transaction No.</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400 placeholder:font-normal"
                    onChange={(e) => setBankDepositForm((f) => ({ ...f, depositSlipRef: e.target.value }))}
                    placeholder="e.g. Dep Slip #891023 / BDO Ref #4567"
                    value={bankDepositForm.depositSlipRef}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Deposit Notes / Remittance Remarks</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400 placeholder:font-normal"
                    onChange={(e) => setBankDepositForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Remitted weekly cash sales to main company vault"
                    value={bankDepositForm.notes}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  onClick={() => setModalType(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Saving…" : "Confirm Bank Deposit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD CASH IN / FLOAT MODAL */}
      {modalType === "CASH_IN" && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Plus size={15} />
                </span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Cash Float</span>
                  <h3 className="text-base font-black text-slate-900 leading-tight">Add Cash In / Opening Float</h3>
                </div>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setModalType(null)} type="button">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCashIn}>
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Cash Amount (₱) <span className="text-red-600">*</span></label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                      min="0.01"
                      onChange={(e) => setCashInForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={cashInForm.amount}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Date</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                      onChange={(e) => setCashInForm((f) => ({ ...f, transactionDate: e.target.value }))}
                      type="date"
                      value={cashInForm.transactionDate}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Reason / Purpose <span className="text-red-600">*</span></label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400 placeholder:font-normal"
                    minLength={3}
                    onChange={(e) => setCashInForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="e.g. Opening Change Fund / Owner Capital Injection"
                    required
                    value={cashInForm.reason}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Reference (Optional)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400 placeholder:font-normal"
                    onChange={(e) => setCashInForm((f) => ({ ...f, referenceNo: e.target.value }))}
                    placeholder="e.g. Slip # / Voucher Ref"
                    value={cashInForm.referenceNo}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  onClick={() => setModalType(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Adding…" : "Add to Drawer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. SHIFT HANDOVER MODAL */}
      {modalType === "HANDOVER" && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-amber-50 text-amber-800">
                  <HandCoins size={15} />
                </span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Turnover</span>
                  <h3 className="text-base font-black text-slate-900 leading-tight">New Shift Handover</h3>
                </div>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setModalType(null)} type="button">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateHandover}>
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Handover Amount (₱) <span className="text-red-600">*</span></label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                    min="0.01"
                    onChange={(e) => setHandoverForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                    step="0.01"
                    type="number"
                    value={handoverForm.amount}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Turnover To Staff / Incoming Cashier</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                    onChange={(e) => setHandoverForm((f) => ({ ...f, toUserId: e.target.value }))}
                    value={handoverForm.toUserId}
                  >
                    <option value="">Open Branch Handover (Any Custodian)</option>
                    {staff.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Remarks (Optional)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400 placeholder:font-normal"
                    onChange={(e) => setHandoverForm((f) => ({ ...f, remarks: e.target.value }))}
                    placeholder="e.g. End of shift drawer turnover"
                    value={handoverForm.remarks}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  onClick={() => setModalType(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Submitting…" : "Submit Handover"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
