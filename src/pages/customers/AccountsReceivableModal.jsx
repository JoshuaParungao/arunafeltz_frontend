import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  LoaderCircle,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { getAccountsReceivable } from "../../features/customers/customers.api"
import { exportReportExcel } from "../../utils/businessDocumentExport"
import CustomerStatementOfAccountModal from "./CustomerStatementOfAccountModal"

function formatMoney(value) {
  const n = Number(value || 0)
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatDate(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  })
}

export default function AccountsReceivableModal({
  customers = [],
  initialCustomerId = null,
  onClose,
  selectedBranch,
  user,
}) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [soaCustomer, setSoaCustomer] = useState(null)

  // Filter States
  const [search, setSearch] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || "")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [agingFilter, setAgingFilter] = useState("ALL") // "ALL" | "OVERDUE" | "CURRENT"

  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""

  const loadReceivables = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const params = {
        ...(branchId ? { branchId } : {}),
        ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        limit: 500,
      }
      const res = await getAccountsReceivable(params)
      setData(res?.data || null)
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message || err?.message || "Failed to load Accounts Receivable."
      )
    } finally {
      setIsLoading(false)
    }
  }, [branchId, selectedCustomerId, dateFrom, dateTo])

  useEffect(() => {
    loadReceivables()
  }, [loadReceivables])

  // Client-side filtering by search query & aging
  const filteredItems = useMemo(() => {
    if (!data?.items) return []
    let list = data.items

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (it) =>
          it.transactionNo?.toLowerCase().includes(q) ||
          it.creditCode?.toLowerCase().includes(q) ||
          it.receiptCode?.toLowerCase().includes(q) ||
          it.customerName?.toLowerCase().includes(q) ||
          it.customerCode?.toLowerCase().includes(q) ||
          it.companyName?.toLowerCase().includes(q) ||
          it.customerMobile?.toLowerCase().includes(q)
      )
    }

    if (agingFilter === "OVERDUE") {
      list = list.filter((it) => it.isOverdue)
    } else if (agingFilter === "CURRENT") {
      list = list.filter((it) => !it.isOverdue)
    }

    return list
  }, [data?.items, search, agingFilter])

  // Recalculate totals based on filtered items
  const totals = useMemo(() => {
    let amount = 0
    let balance = 0
    let collected = 0
    let overdueCount = 0
    let overdueAmount = 0
    const customerSet = new Set()

    filteredItems.forEach((it) => {
      amount += Number(it.amount || 0)
      balance += Number(it.balance || 0)
      collected += Number(it.collected || 0)
      if (it.customerId) customerSet.add(it.customerId)
      if (it.isOverdue) {
        overdueCount += 1
        overdueAmount += Number(it.balance || 0)
      }
    })

    return {
      totalAmount: amount,
      totalBalance: balance,
      totalCollected: collected,
      totalCount: filteredItems.length,
      customerCount: customerSet.size,
      overdueCount,
      overdueAmount,
    }
  }, [filteredItems])

  // Print function
  const handlePrint = () => {
    window.print()
  }

  // Export to Excel (supports Summary 5-column or Detailed 17-column, single account or all)
  const handleExportExcel = (type = "summary", singleCustomerId = null, singleCustomerName = null) => {
    const targetCustomerId = singleCustomerId || selectedCustomerId
    const targetCustomer = customers.find((c) => c.id === targetCustomerId)
    const customerName = singleCustomerName || targetCustomer?.fullName

    const targetItems = targetCustomerId
      ? (data?.items || []).filter((it) => it.customerId === targetCustomerId)
      : filteredItems

    const activeFilters = []
    if (targetCustomerId) {
      activeFilters.push({ label: "Customer", value: customerName || targetCustomerId })
    }
    if (dateFrom) activeFilters.push({ label: "Date From", value: dateFrom })
    if (dateTo) activeFilters.push({ label: "Date To", value: dateTo })
    if (agingFilter !== "ALL") activeFilters.push({ label: "Aging Status", value: agingFilter })
    if (search.trim()) activeFilters.push({ label: "Search", value: search.trim() })

    const cleanSub = customerName ? `_${customerName.replace(/[^a-zA-Z0-9]/g, "_")}` : "_all_customers"

    if (type === "summary") {
      const headers = ["Transactionno", "Date", "Customer", "Amount", "Balance"]
      const rows = targetItems.map((it) => [
        it.transactionNo || it.creditCode || "-",
        formatDate(it.date),
        it.customerName || "-",
        Number(it.amount || 0),
        Number(it.balance || 0),
      ])

      exportReportExcel({
        title: customerName
          ? `OUTSTANDING ACCOUNTS RECEIVABLE — ${customerName.toUpperCase()}`
          : "OUTSTANDING ACCOUNTS RECEIVABLE REPORT",
        branchName: selectedBranch?.name || user?.branch?.name || "All Branches",
        generatedBy: user?.fullName || user?.username || "System",
        filenamePrefix: `accounts_receivable_summary${cleanSub}`,
        headers,
        rows,
        activeFilters,
      })
    } else {
      const headers = [
        "Transaction No",
        "Credit Code",
        "Receipt / Invoice No",
        "Date",
        "Customer Name",
        "Customer Code",
        "Company Name",
        "Mobile No",
        "Credit Provider",
        "Installment Term",
        "Total Credit Amount (PHP)",
        "Total Collected (PHP)",
        "Outstanding Balance (PHP)",
        "Due Date",
        "Days Overdue",
        "Aging Status",
        "Branch",
      ]

      const rows = targetItems.map((it) => [
        it.transactionNo || it.creditCode || "-",
        it.creditCode || "-",
        it.receiptCode || "-",
        formatDate(it.date),
        it.customerName || "-",
        it.customerCode || "-",
        it.companyName || "-",
        it.customerMobile || "-",
        it.provider || "-",
        it.term || "Regular",
        Number(it.amount || 0),
        Number(it.collected || 0),
        Number(it.balance || 0),
        formatDate(it.dueDate),
        it.daysOverdue || 0,
        it.isOverdue ? `Overdue (${it.daysOverdue} days)` : "Current",
        it.branch?.name || it.branch?.code || "-",
      ])

      exportReportExcel({
        title: customerName
          ? `OUTSTANDING ACCOUNTS RECEIVABLE (DETAILED) — ${customerName.toUpperCase()}`
          : "OUTSTANDING ACCOUNTS RECEIVABLE (DETAILED AUDIT BREAKDOWN)",
        branchName: selectedBranch?.name || user?.branch?.name || "All Branches",
        generatedBy: user?.fullName || user?.username || "System",
        filenamePrefix: `accounts_receivable_detailed${cleanSub}`,
        headers,
        rows,
        activeFilters,
      })
    }
  }

  const shopName = "ARUNAFELTZ COMPUTER PARTS AND ACCESSORIES SHOP"
  const shopAddress =
    selectedBranch?.address ||
    "KINGSPIRE BUSINESS CENTRE, MAC ARTHUR HIGHWAY, SAN ISIDRO, CITY OF SAN FERNANDO, PAMPANGA / 0961-873-5798"

  return (
    <div className="fixed inset-0 z-60 grid place-items-center overflow-y-auto bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs">
      {/* Print Specific Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #accounts-receivable-printable, #accounts-receivable-printable * {
            visibility: visible;
          }
          #accounts-receivable-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <section
        id="accounts-receivable-printable"
        className="my-auto flex flex-col max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all"
      >
        {/* Top Minimalist Action Bar (hidden in print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={loadReceivables}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition disabled:opacity-50"
              type="button"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin text-[var(--color-maroon)]" : ""} />
              <span>Preview</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isLoading || filteredItems.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition disabled:opacity-50"
              type="button"
            >
              <Printer size={13} className="text-slate-600" />
              <span>Print</span>
            </button>

            {/* Split Export Options: Summary vs Detailed */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                onClick={() => handleExportExcel("summary")}
                disabled={isLoading || filteredItems.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition disabled:opacity-50"
                type="button"
                title={selectedCustomerId ? "Export 5-column summary for selected customer" : "Export 5-column summary for all accounts"}
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                <span>Save As (Summary)</span>
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <button
                onClick={() => handleExportExcel("detailed")}
                disabled={isLoading || filteredItems.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold text-teal-800 hover:bg-teal-50 transition disabled:opacity-50"
                type="button"
                title={selectedCustomerId ? "Export 17-column audit breakdown for selected customer" : "Export 17-column audit breakdown for all accounts"}
              >
                <FileSpreadsheet size={13} className="text-teal-600" />
                <span>Detailed</span>
              </button>
            </div>

            {selectedCustomerId ? (
              <button
                onClick={() => {
                  const targetCustomer = customers.find((c) => c.id === selectedCustomerId)
                  setSoaCustomer({
                    id: selectedCustomerId,
                    name: targetCustomer?.fullName,
                    address: targetCustomer?.address,
                    items: (data?.items || []).filter((it) => it.customerId === selectedCustomerId),
                  })
                }}
                disabled={isLoading || filteredItems.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-900 hover:bg-indigo-100 shadow-2xs transition disabled:opacity-50"
                type="button"
                title="Print customer-facing Statement of Account (SOA)"
              >
                <Printer size={13} className="text-indigo-600" />
                <span>Print Client SOA</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">
              As of: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <button
              onClick={onClose}
              aria-label="Close Accounts Receivable"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Official Letterhead (matching photo & styled cleanly) */}
          <div className="text-center pb-2">
            <h1 className="text-sm sm:text-base font-black tracking-wide text-slate-900 uppercase">
              {shopName}
            </h1>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-600 uppercase tracking-tight max-w-xl mx-auto">
              {shopAddress}
            </p>
            <div className="mt-3 inline-block">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 border-b-2 border-slate-900 pb-0.5 px-2 inline-block">
                Outstanding Accounts Receivable
              </h2>
            </div>
          </div>

          {/* Minimalist Interactive Filters (hidden in print) */}
          <div className="no-print grid gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs sm:grid-cols-4">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)] placeholder:text-slate-400"
                placeholder="Search transaction, customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[var(--color-maroon)]"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">All Customers ({customers.length})</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.customerCode})
                  </option>
                ))}
              </select>
              {selectedCustomerId ? (
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId("")}
                  className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-200 transition shrink-0"
                  title="Reset to All Customers"
                >
                  All
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-1">
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[var(--color-maroon)]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Date From"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[var(--color-maroon)]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Date To"
              />
            </div>

            <select
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[var(--color-maroon)]"
              value={agingFilter}
              onChange={(e) => setAgingFilter(e.target.value)}
            >
              <option value="ALL">All Aging Statuses</option>
              <option value="CURRENT">Current / Due Soon</option>
              <option value="OVERDUE">Overdue Only</option>
            </select>
          </div>

          {/* Minimalist Summary KPI Row (hidden in print) */}
          <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Outstanding
              </p>
              <p className="mt-1 font-mono text-base font-black text-[var(--color-maroon)]">
                {formatMoney(totals.totalBalance)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                {totals.totalCount} active credit accounts
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Debtors
              </p>
              <p className="mt-1 font-mono text-base font-black text-slate-900">
                {totals.customerCount}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                Customers with remaining balance
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Collected
              </p>
              <p className="mt-1 font-mono text-base font-black text-emerald-700">
                {formatMoney(totals.totalCollected)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                Payments collected to date
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Overdue Receivables
              </p>
              <p className="mt-1 font-mono text-base font-black text-amber-900">
                {formatMoney(totals.overdueAmount)}
              </p>
              <p className="text-[10px] text-amber-700/80 font-bold">
                {totals.overdueCount} past due accounts
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {/* Loading Indicator */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs font-bold text-slate-500">
              <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={18} />
              Loading Outstanding Accounts Receivable…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center">
              <ReceiptText className="mx-auto text-slate-300" size={36} />
              <p className="mt-2 text-xs font-bold text-slate-700">
                No Outstanding Accounts Receivable Found
              </p>
              <p className="text-[11px] text-slate-400">
                All customer credit accounts are settled or no records match your selected filters.
              </p>
            </div>
          ) : (
            /* Modern Minimalist Table (matching user screenshot columns with clean styling) */
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-800">
                    <th className="px-3.5 py-2.5 font-bold border-r border-slate-300">
                      Transactionno
                    </th>
                    <th className="px-3.5 py-2.5 font-bold border-r border-slate-300">
                      Date
                    </th>
                    <th className="px-3.5 py-2.5 font-bold border-r border-slate-300">
                      Customer
                    </th>
                    <th className="px-3.5 py-2.5 font-bold text-right border-r border-slate-300">
                      Amount
                    </th>
                    <th className="px-3.5 py-2.5 font-bold text-right border-r border-slate-300">
                      Balance
                    </th>
                    <th className="no-print px-2 py-2.5 font-bold text-center w-28">
                      Account
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredItems.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-3.5 py-2 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {item.transactionNo || item.creditCode}
                      </td>
                      <td className="px-3.5 py-2 font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-3.5 py-2 font-bold text-slate-900 border-r border-slate-200">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerId(item.customerId)}
                            className="text-left hover:underline hover:text-[var(--color-maroon)] transition"
                            title={`Filter transactions for ${item.customerName}`}
                          >
                            <span>{item.customerName}</span>
                            {item.customerMobile ? (
                              <span className="no-print ml-1 text-[10px] text-slate-400 font-normal">
                                ({item.customerMobile})
                              </span>
                            ) : null}
                          </button>
                          {item.term ? (
                            <span className="no-print text-[10px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                              {item.term}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3.5 py-2 font-mono text-right text-slate-800 border-r border-slate-200 whitespace-nowrap">
                        {Number(item.amount || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3.5 py-2 font-mono font-bold text-right text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {Number(item.balance || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="no-print px-2 py-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerId(item.customerId)}
                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition"
                            title={`Filter only ${item.customerName}`}
                          >
                            Filter
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSoaCustomer({
                                id: item.customerId,
                                name: item.customerName,
                                address: item.customerAddress,
                                items: (data?.items || []).filter((it) => it.customerId === item.customerId),
                              })
                            }
                            className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 hover:bg-indigo-100 transition inline-flex items-center gap-0.5"
                            title={`Print Statement of Account (SOA) for ${item.customerName}`}
                          >
                            <Printer size={10} className="text-indigo-600" />
                            SOA
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportExcel("detailed", item.customerId, item.customerName)}
                            className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition inline-flex items-center gap-0.5"
                            title={`Export full audit Excel for ${item.customerName}`}
                          >
                            <FileSpreadsheet size={10} className="text-emerald-600" />
                            Excel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Distinctive Shaded Total Balance Row (matching bottom bar of photo) */}
                  <tr className="border-t-2 border-slate-400 bg-slate-200/90 font-mono text-xs font-black text-slate-900">
                    <td colSpan={3} className="px-3.5 py-2.5 text-right font-bold uppercase tracking-wider text-slate-700 border-r border-slate-300">
                      Total Outstanding Balance:
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold border-r border-slate-300">
                      {Number(totals.totalAmount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-black text-slate-950 text-sm border-r border-slate-300">
                      {Number(totals.totalBalance).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Signatures Section for Print Statements */}
          <div className="hidden print:grid grid-cols-3 gap-6 pt-10 text-xs text-center">
            <div>
              <div className="border-b border-slate-400 h-8 mx-6" />
              <p className="mt-1.5 font-bold text-slate-800">Prepared By</p>
              <p className="text-[10px] text-slate-500">{user?.fullName || user?.username || "Credit Specialist"}</p>
            </div>
            <div>
              <div className="border-b border-slate-400 h-8 mx-6" />
              <p className="mt-1.5 font-bold text-slate-800">Verified By</p>
              <p className="text-[10px] text-slate-500">Credit & Collection Officer</p>
            </div>
            <div>
              <div className="border-b border-slate-400 h-8 mx-6" />
              <p className="mt-1.5 font-bold text-slate-800">Approved By</p>
              <p className="text-[10px] text-slate-500">Management / Owner</p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer (hidden in print) */}
        <footer className="no-print flex items-center justify-between border-t border-slate-200 bg-slate-50/75 px-5 py-3 text-xs">
          <p className="text-slate-500">
            Showing {filteredItems.length} of {data?.items?.length || 0} record(s)
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </footer>
      </section>

      {/* Client-Facing Statement of Account (SOA) Modal */}
      {soaCustomer ? (
        <CustomerStatementOfAccountModal
          customerId={soaCustomer.id}
          initialCustomer={{
            id: soaCustomer.id,
            fullName: soaCustomer.name,
            address: soaCustomer.address,
          }}
          initialItems={soaCustomer.items}
          onClose={() => setSoaCustomer(null)}
          selectedBranch={selectedBranch}
          user={user}
        />
      ) : null}
    </div>
  )
}
