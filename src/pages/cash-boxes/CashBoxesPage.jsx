import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HandCoins,
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

const OWNER_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN"])
const CASH_IN_TYPES = new Set(["CASH_IN", "ADJUSTMENT_IN", "SALE_PAYMENT", "CREDIT_COLLECTION", "SERVICE_PAYMENT"])

const EXPENSE_CATEGORIES = [
  { id: "MEALS_SNACKS", label: "Meals & Staff Snacks", icon: Utensils, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400" },
  { id: "LOGISTICS_COURIER", label: "Logistics & Delivery", icon: Truck, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400" },
  { id: "STORE_SUPPLIES", label: "Store Supplies & Cleaning", icon: Sparkles, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400" },
  { id: "UTILITIES_BILLS", label: "Utilities & Store Bills", icon: Lightbulb, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-400" },
  { id: "SHOP_TOOLS_MAINTENANCE", label: "Shop Tools & Repairs", icon: Wrench, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400" },
  { id: "SALARY_VALE", label: "Salary Advance / Vale", icon: UserCheck, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" },
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
  if (["ACTIVE", "POSTED", "RECEIVED", "COMPLETED"].includes(status)) return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
  if (["CANCELLED", "INACTIVE", "REJECTED"].includes(status)) return "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
  return "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
}

function Status({ value }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${tone(value)}`}>{formatStatus(value)}</span>
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
        if (!map[foundCat]) map[foundCat] = { id: foundCat, label: "Other", total: 0, count: 0 }
        map[foundCat].total += amt
        map[foundCat].count += 1
      }
    })

    return Object.values(map).filter((c) => c.total > 0 || c.id === "MEALS_SNACKS" || c.id === "LOGISTICS_COURIER")
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
    <div className="space-y-6">
      {/* Top Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-soft)]/50 to-[var(--color-card)] p-6 shadow-card">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-[var(--color-maroon)]/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
                Finance & Cash Flow
              </span>
              <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-[var(--color-text-strong)]">
                {branchName}
              </span>
            </div>
            <h1 className="mt-2.5 text-3xl font-black tracking-tight text-[var(--color-text-strong)]">
              Cash Register & Vault Center
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
              Complete multi-channel monitoring for physical cash in drawer, cashless e-wallets, bank deposits, store expenses, and shift handovers.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] shadow-sm"
              disabled={isLoading}
              onClick={refresh}
              type="button"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
              Refresh
            </button>

            {canManage && (
              <>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-rose-700"
                  onClick={() => setModalType("EXPENSE")}
                  type="button"
                >
                  <Receipt size={16} />
                  Record Expense
                </button>

                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-sky-700"
                  onClick={() => setModalType("BANK_DEPOSIT")}
                  type="button"
                >
                  <Building2 size={16} />
                  Deposit to Bank
                </button>

                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-800"
                  onClick={() => setModalType("CASH_IN")}
                  type="button"
                >
                  <Plus size={16} />
                  Add Cash Float
                </button>

                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-gold)] px-4 py-3 text-sm font-black text-slate-900 shadow-md transition hover:opacity-90"
                  onClick={() => setModalType("HANDOVER")}
                  type="button"
                >
                  <HandCoins size={16} />
                  Shift Handover
                </button>
              </>
            )}
          </div>
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

      {/* THE 3 BIG PILLARS OF CASH FLOW */}
      <section className="grid gap-5 lg:grid-cols-3">
        {/* PILLAR 1: TOTAL CASH IN DRAWER */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[var(--color-card)] to-[var(--color-card)] p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md">
                <Banknote size={22} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Total Physical Cash
                </p>
                <p className="text-xs font-semibold text-[var(--color-muted)]">
                  Drawer & Vault Holding
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-black text-emerald-800 dark:text-emerald-300">
              Drawer Active
            </span>
          </div>

          <div className="mt-5">
            <p className="font-mono text-3xl font-black text-[var(--color-text-strong)]">
              {money(cashPillar.currentBalance)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Real-time physical currency ready in cashier drawer
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-4 text-xs">
            <div className="rounded-xl bg-[var(--color-soft)] p-2.5">
              <p className="font-bold text-[var(--color-muted)]">Inflow Collections</p>
              <p className="mt-1 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                +{money(cashPillar.totalInflow)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--color-soft)] p-2.5">
              <p className="font-bold text-[var(--color-muted)]">Expenses & Outflow</p>
              <p className="mt-1 font-mono font-bold text-rose-600 dark:text-rose-400">
                -{money(cashPillar.totalOutflow)}
              </p>
            </div>
          </div>
        </div>

        {/* PILLAR 2: TOTAL CASHLESS & DIGITAL WALLETS */}
        <div className="relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-[var(--color-card)] to-[var(--color-card)] p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-11 place-items-center rounded-2xl bg-sky-600 text-white shadow-md">
                <Smartphone size={22} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  Total Cashless & Digital
                </p>
                <p className="text-xs font-semibold text-[var(--color-muted)]">
                  GCash, Bank & Financing
                </p>
              </div>
            </div>
            <span className="rounded-full bg-sky-100 dark:bg-sky-950/60 px-3 py-1 text-xs font-black text-sky-800 dark:text-sky-300">
              Online/AR
            </span>
          </div>

          <div className="mt-5">
            <p className="font-mono text-3xl font-black text-[var(--color-text-strong)]">
              {money(cashlessPillar.totalCashless)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Total digital collections from sales and service jobs
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-4 text-xs">
            <div className="rounded-xl bg-[var(--color-soft)] p-2 text-center">
              <p className="font-bold text-[var(--color-muted)]">📱 GCash/Maya</p>
              <p className="mt-1 font-mono font-bold text-sky-600 dark:text-sky-400 truncate">
                {money(cashlessPillar.gcashTotal)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--color-soft)] p-2 text-center">
              <p className="font-bold text-[var(--color-muted)]">🏦 Bank Trans</p>
              <p className="mt-1 font-mono font-bold text-sky-600 dark:text-sky-400 truncate">
                {money(cashlessPillar.bankTransferTotal)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--color-soft)] p-2 text-center">
              <p className="font-bold text-[var(--color-muted)]">💳 Cards & AR</p>
              <p className="mt-1 font-mono font-bold text-sky-600 dark:text-sky-400 truncate">
                {money(cashlessPillar.cardArTotal)}
              </p>
            </div>
          </div>
        </div>

        {/* PILLAR 3: TOTAL OF BOTH (COMBINED CASH FLOW) */}
        <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-[var(--color-card)] to-[var(--color-card)] p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-11 place-items-center rounded-2xl bg-purple-600 text-white shadow-md">
                <Sparkles size={22} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                  Total of Both (Combined)
                </p>
                <p className="text-xs font-semibold text-[var(--color-muted)]">
                  Gross Business Cash Flow
                </p>
              </div>
            </div>
            <span className="rounded-full bg-purple-100 dark:bg-purple-950/60 px-3 py-1 text-xs font-black text-purple-800 dark:text-purple-300">
              Cash + Cashless
            </span>
          </div>

          <div className="mt-5">
            <p className="font-mono text-3xl font-black text-purple-900 dark:text-purple-200">
              {money(totalBothInflow)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Combined cash in drawer + all verified digital receipts
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-4 text-xs">
            <div className="rounded-xl bg-[var(--color-soft)] p-2.5">
              <p className="font-bold text-[var(--color-muted)]">Store Expenses Total</p>
              <p className="mt-1 font-mono font-bold text-rose-600 dark:text-rose-400">
                {money(cashPillar.totalExpenses)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--color-soft)] p-2.5">
              <p className="font-bold text-[var(--color-muted)]">Bank Deposits</p>
              <p className="mt-1 font-mono font-bold text-sky-600 dark:text-sky-400">
                {money(cashPillar.totalDepositedBank)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TABS & LEDGER CONTAINER */}
      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
        {/* Tab Headers */}
        <div className="flex flex-wrap border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 p-2 gap-1">
          <button
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
              tab === "all"
                ? "bg-[var(--color-maroon)] text-white shadow-sm"
                : "text-[var(--color-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-text-strong)]"
            }`}
            onClick={() => setTab("all")}
            type="button"
          >
            <Banknote size={16} />
            All Movements & Ledger
          </button>

          <button
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
              tab === "expenses"
                ? "bg-[var(--color-maroon)] text-white shadow-sm"
                : "text-[var(--color-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-text-strong)]"
            }`}
            onClick={() => setTab("expenses")}
            type="button"
          >
            <Receipt size={16} />
            Store Expenses Tracker ({expenseTransactions.length})
          </button>

          <button
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
              tab === "cashless"
                ? "bg-[var(--color-maroon)] text-white shadow-sm"
                : "text-[var(--color-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-text-strong)]"
            }`}
            onClick={() => setTab("cashless")}
            type="button"
          >
            <Smartphone size={16} />
            Cashless & Bank Log ({cashlessPillar.digitalTransactions.length})
          </button>

          <button
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
              tab === "handovers"
                ? "bg-[var(--color-maroon)] text-white shadow-sm"
                : "text-[var(--color-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-text-strong)]"
            }`}
            onClick={() => setTab("handovers")}
            type="button"
          >
            <HandCoins size={16} />
            Shift Handovers
          </button>
        </div>

        {/* TAB 1: ALL CASH MOVEMENTS & LEDGER */}
        {tab === "all" && (
          <div>
            <div className="grid gap-3 border-b border-[var(--color-border)] p-4 md:grid-cols-2">
              <label className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} />
                <input
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-3 pl-10 pr-4 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                  onChange={(event) => {
                    setTransactionSearch(event.target.value)
                    setTransactionPage(1)
                  }}
                  placeholder="Search transaction code, reference, description..."
                  value={transactionSearch}
                />
              </label>

              <select
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
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

            <div className="divide-y divide-[var(--color-border)]">
              {transactions.map((entry) => {
                const isIn = CASH_IN_TYPES.has(entry.type)
                const isExpense = entry.description?.startsWith("[EXPENSE:")
                const isBankDeposit = entry.description?.startsWith("[BANK DEPOSIT")

                return (
                  <article className="grid gap-4 p-4.5 md:grid-cols-[1fr_auto_auto] md:items-center hover:bg-[var(--color-soft)]/40 transition" key={entry.id}>
                    <div className="flex min-w-0 items-start gap-3.5">
                      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl shadow-sm ${
                        isExpense
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          : isBankDeposit
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                            : isIn
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}>
                        {isExpense ? <Receipt size={18} /> : isBankDeposit ? <Building2 size={18} /> : isIn ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-black text-sm text-[var(--color-text-strong)]">
                            {entry.transactionCode}
                          </p>
                          {entry.referenceNo ? (
                            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-[var(--color-muted)]">
                              Ref: {entry.referenceNo}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[var(--color-text-strong)] line-clamp-1">
                          {entry.description}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {dateTime(entry.transactionDate)} · {formatStatus(entry.type)} · Encoder: {entry.createdBy?.fullName || "System"}
                        </p>
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <p className={`font-mono text-base font-black ${isIn ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {isIn ? "+" : "−"}{money(entry.amount)}
                      </p>
                      <div className="mt-1">
                        <Status value={entry.status} />
                      </div>
                    </div>

                    {canManage && entry.status === "POSTED" && entry.source === "MANUAL" ? (
                      <button
                        className="rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
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
                  <Banknote className="mx-auto text-[var(--color-muted)]" size={36} />
                  <p className="mt-2 font-bold text-[var(--color-text-strong)]">No cash transactions found</p>
                  <p className="text-xs text-[var(--color-muted)]">Adjust filters or post a new cash movement.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] p-4">
              <p className="text-xs font-bold text-[var(--color-muted)]">
                Page {transactionMeta.page || transactionPage} of {transactionPages}
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-[var(--color-border)] p-2 disabled:opacity-30 hover:bg-[var(--color-soft)]"
                  disabled={transactionPage <= 1}
                  onClick={() => setTransactionPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="rounded-xl border border-[var(--color-border)] p-2 disabled:opacity-30 hover:bg-[var(--color-soft)]"
                  disabled={transactionPage >= transactionPages}
                  onClick={() => setTransactionPage((p) => p + 1)}
                  type="button"
                >
                  <ChevronRight size={16} />
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
              <h2 className="text-sm font-black uppercase tracking-wider text-[var(--color-muted)]">
                Expense Categories Summary
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {expenseCategoryBreakdown.map((cat) => {
                  const IconComponent = cat.icon || Receipt
                  return (
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 shadow-sm" key={cat.id}>
                      <div className="flex items-center gap-2.5">
                        <span className={`grid size-9 place-items-center rounded-xl ${cat.color || "bg-slate-200"}`}>
                          <IconComponent size={18} />
                        </span>
                        <p className="text-xs font-bold text-[var(--color-text-strong)] line-clamp-1">{cat.label}</p>
                      </div>
                      <div className="mt-3 flex items-baseline justify-between">
                        <p className="font-mono text-lg font-black text-rose-600 dark:text-rose-400">
                          {money(cat.total)}
                        </p>
                        <span className="text-[11px] font-bold text-[var(--color-muted)]">
                          {cat.count} entry{cat.count === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Expenses List Table */}
            <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-soft)] text-xs font-black uppercase text-[var(--color-muted)]">
                  <tr>
                    <th className="p-3.5">Code / Voucher</th>
                    <th className="p-3.5">Category & Description</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Encoder</th>
                    <th className="p-3.5 text-right">Amount</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {expenseTransactions.map((tx) => (
                    <tr className="hover:bg-[var(--color-soft)]/50 transition" key={tx.id}>
                      <td className="p-3.5 font-mono font-bold text-xs text-[var(--color-text-strong)]">
                        {tx.transactionCode}
                        {tx.referenceNo ? <p className="text-[11px] text-[var(--color-muted)]">Ref: {tx.referenceNo}</p> : null}
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-sm text-[var(--color-text-strong)]">{tx.description}</p>
                      </td>
                      <td className="p-3.5 text-xs text-[var(--color-muted)]">{dateOnly(tx.transactionDate)}</td>
                      <td className="p-3.5 text-xs font-medium text-[var(--color-muted)]">{tx.createdBy?.fullName || "—"}</td>
                      <td className="p-3.5 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                        -{money(tx.amount)}
                      </td>
                      <td className="p-3.5 text-right">
                        {canManage && tx.status === "POSTED" && tx.source === "MANUAL" ? (
                          <button
                            className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50"
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
                      <td className="p-8 text-center text-sm text-[var(--color-muted)]" colSpan={6}>
                        No store expenses recorded yet. Click <strong>"Record Expense"</strong> above to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CASHLESS & BANK COLLECTIONS */}
        {tab === "cashless" && (
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-[var(--color-text-strong)]">
                  Digital Collections Breakdown
                </h2>
                <p className="text-xs text-[var(--color-muted)]">
                  Real-time verified cashless receipts from POS Cashiering and Service Job Orders.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="rounded-xl bg-sky-100 dark:bg-sky-950/60 px-3 py-1.5 text-xs font-mono font-black text-sky-800 dark:text-sky-300">
                  Total: {money(cashlessPillar.totalCashless)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-soft)] text-xs font-black uppercase text-[var(--color-muted)]">
                  <tr>
                    <th className="p-3.5">Receipt / Job Code</th>
                    <th className="p-3.5">Payment Channel</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Reference / Notes</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {cashlessPillar.digitalTransactions.map((item) => (
                    <tr className="hover:bg-[var(--color-soft)]/50 transition" key={item.id}>
                      <td className="p-3.5 font-mono font-bold text-xs text-[var(--color-text-strong)]">
                        {item.sourceCode}
                        <p className="text-[11px] text-[var(--color-muted)]">{item.sourceType}</p>
                      </td>
                      <td className="p-3.5 font-bold text-xs text-sky-700 dark:text-sky-400">
                        {item.channel}
                      </td>
                      <td className="p-3.5 text-xs font-medium text-[var(--color-text-strong)]">
                        {item.customerName}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-[var(--color-muted)]">
                        {item.refNo}
                      </td>
                      <td className="p-3.5 text-xs text-[var(--color-muted)]">
                        {dateTime(item.date)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        +{money(item.amount)}
                      </td>
                    </tr>
                  ))}
                  {cashlessPillar.digitalTransactions.length === 0 && (
                    <tr>
                      <td className="p-8 text-center text-sm text-[var(--color-muted)]" colSpan={6}>
                        No cashless digital transactions recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: SHIFT HANDOVERS */}
        {tab === "handovers" && (
          <div>
            <div className="border-b border-[var(--color-border)] p-4">
              <select
                className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] md:max-w-xs outline-none focus:border-[var(--color-maroon)]"
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

            <div className="divide-y divide-[var(--color-border)]">
              {handovers.map((handover) => (
                <article className="grid gap-4 p-4.5 lg:grid-cols-[1fr_auto_auto] lg:items-center hover:bg-[var(--color-soft)]/40 transition" key={handover.id}>
                  <div className="flex items-start gap-3.5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shadow-sm">
                      <HandCoins size={20} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-black text-sm text-[var(--color-text-strong)]">{handover.handoverCode}</p>
                        <Status value={handover.status} />
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        From <strong>{handover.fromUser?.fullName || "Staff"}</strong> to <strong>{handover.toUser?.fullName || "Branch Custodian / Next Shift"}</strong>
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {dateTime(handover.createdAt)} · {handover.remarks || "No additional remarks"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="font-mono text-lg font-black text-[var(--color-text-strong)]">
                      {money(handover.amount)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {canReceive && handover.status === "PENDING" ? (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 transition"
                        disabled={isSaving}
                        onClick={() => actOnHandover(handover, "receive")}
                        type="button"
                      >
                        <CheckCircle2 size={15} />
                        Receive Cash
                      </button>
                    ) : null}
                    {canManage && handover.status === "PENDING" ? (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                        disabled={isSaving}
                        onClick={() => actOnHandover(handover, "cancel")}
                        type="button"
                      >
                        <XCircle size={15} />
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}

              {!isLoading && handovers.length === 0 && (
                <div className="p-12 text-center">
                  <HandCoins className="mx-auto text-[var(--color-muted)]" size={36} />
                  <p className="mt-2 font-bold text-[var(--color-text-strong)]">No cash handovers recorded</p>
                  <p className="text-xs text-[var(--color-muted)]">Shift handovers and vault remittances will appear here.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] p-4">
              <p className="text-xs font-bold text-[var(--color-muted)]">
                Page {handoverMeta.page || handoverPage} of {handoverPages}
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-[var(--color-border)] p-2 disabled:opacity-30 hover:bg-[var(--color-soft)]"
                  disabled={handoverPage <= 1}
                  onClick={() => setHandoverPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="rounded-xl border border-[var(--color-border)] p-2 disabled:opacity-30 hover:bg-[var(--color-soft)]"
                  disabled={handoverPage >= handoverPages}
                  onClick={() => setHandoverPage((p) => p + 1)}
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

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
                    placeholder="e.g. Lunch for staff / Courier delivery to client"
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
