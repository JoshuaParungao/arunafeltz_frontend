import { useState, useEffect, useCallback } from "react"
import {
  CreditCard,
  Banknote,
  RotateCcw,
  Search,
  ChevronRight,
  ShieldAlert,
  Clock,
  HandCoins,
  FileText,
  Calendar,
  Layers,
  ArrowUpRight,
} from "lucide-react"

import {
  getArAgingReport,
  getProviderPerformanceReport,
  getTermAnalysisReport,
  getDownpaymentAnalysisReport,
  getCollectionPerformanceReport,
} from "../../../features/reports/intelligence.api"
import { exportReportExcel } from "../../../utils/businessDocumentExport"
import ExportExcelButton from "../../../components/common/ExportExcelButton"
import CustomerArStatementModal from "../../credits/CustomerArStatementModal"

function peso(val) {
  return `₱${Number(val || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function num(val) {
  return Number(val || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })
}

export default function ArAgingView({ selectedBranch, user, dateRange }) {
  const branchId = selectedBranch?.id || user?.branchId || ""
  const [selectedBucket, setSelectedBucket] = useState("ALL")
  const [selectedSubTab, setSelectedSubTab] = useState("AGING") // AGING | PROVIDERS | TERMS | DOWNPAYMENT | COLLECTIONS
  const [agingData, setAgingData] = useState(null)
  const [providerData, setProviderData] = useState(null)
  const [termData, setTermData] = useState(null)
  const [dpData, setDpData] = useState(null)
  const [colData, setColData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const [statementCustomerId, setStatementCustomerId] = useState(null)
  const [statementCustomerName, setStatementCustomerName] = useState("")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [agRes, provRes, trmRes, dpRes, colRes] = await Promise.all([
        getArAgingReport({
          ...(branchId ? { branchId } : {}),
          bucket: selectedBucket !== "ALL" ? selectedBucket : undefined,
        }),
        getProviderPerformanceReport({
          ...(branchId ? { branchId } : {}),
          ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
          ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
        }),
        getTermAnalysisReport({
          ...(branchId ? { branchId } : {}),
          ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
          ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
        }),
        getDownpaymentAnalysisReport({
          ...(branchId ? { branchId } : {}),
          ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
          ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
        }),
        getCollectionPerformanceReport({
          ...(branchId ? { branchId } : {}),
          ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
          ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
        }),
      ])

      setAgingData(agRes)
      setProviderData(provRes)
      setTermData(trmRes)
      setDpData(dpRes)
      setColData(colRes)
    } catch (err) {
      console.error("Failed to load AR intelligence", err)
    } finally {
      setIsLoading(false)
    }
  }, [branchId, selectedBucket, dateRange?.dateFrom, dateRange?.dateTo])

  useEffect(() => {
    loadData()
  }, [loadData])

  const buckets = agingData?.buckets || {}
  const records = agingData?.records || []
  const summary = agingData?.summary || {}

  const handleExportAgingExcel = () => {
    const exportColumns = [
      ["Credit Code", (r) => r.creditCode],
      ["Customer", (r) => r.customer],
      ["Contact No", (r) => r.contactNo],
      ["Provider", (r) => r.provider],
      ["Term", (r) => r.term || "Straight"],
      ["Reference Code", (r) => r.referenceCode],
      ["Date Opened", (r) => r.dateOpened ? new Date(r.dateOpened).toLocaleDateString("en-PH") : "—"],
      ["Next Due Date", (r) => r.nextDueDate ? new Date(r.nextDueDate).toLocaleDateString("en-PH") : "—"],
      ["Age in Days", (r) => r.ageDays],
      ["Aging Bucket", (r) => r.bucketLabel],
      ["Financed Principal", (r) => Number(r.principal || 0)],
      ["Total Financed Balance", (r) => Number(r.balance || 0)],
      ["Total Collected", (r) => Number(r.collected || 0)],
      ["Remaining Outstanding AR", (r) => Number(r.remaining || 0)],
      ["Status", (r) => r.status],
    ]

    exportReportExcel({
      label: "Accounts Receivable Aging Report",
      filename: `AR-Aging-Report-${new Date().toISOString().slice(0, 10)}`,
      columns: exportColumns,
      records,
      branch: selectedBranch || user?.branch,
      generatedBy: user,
      filters: [
        ["Aging Bucket Filter", selectedBucket],
        ["Branch", selectedBranch?.name || user?.branch?.name || "All Branches"],
      ],
      totals: [
        ["Total Accounts", records.length],
        ["Total Principal Financed", summary.totalPrincipal || 0],
        ["Total Collected to Date", summary.totalCollected || 0],
        ["Total Outstanding AR", summary.totalOutstanding || 0],
      ],
    })
  }

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          ["AGING", "REPORT 02: AR Aging Buckets"],
          ["PROVIDERS", "REPORT 03: Provider Performance"],
          ["TERMS", "REPORT 04: Installment Term Yield"],
          ["DOWNPAYMENT", "REPORT 05: Downpayment Analysis"],
          ["COLLECTIONS", "REPORT 10: Collection Movement"],
        ].map(([key, label]) => (
          <button
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-2xs ${
              selectedSubTab === key
                ? "bg-[var(--color-maroon)] text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
            key={key}
            onClick={() => setSelectedSubTab(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* VIEW 1: AR AGING REPORT (REPORT 02) */}
      {selectedSubTab === "AGING" && (
        <div className="space-y-5">
          {/* Interactive Aging Bucket Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { key: "ALL", label: "All Active AR", count: summary.totalAccounts, amount: summary.totalOutstanding, border: "border-slate-300", bg: "bg-white", text: "text-slate-900" },
              { key: "CURRENT", label: "Current (Healthy)", count: buckets.current?.count, amount: buckets.current?.amount, border: "border-emerald-300", bg: "bg-emerald-50/40", text: "text-emerald-800" },
              { key: "DAYS_1_30", label: "1–30 Days", count: buckets.days1to30?.count, amount: buckets.days1to30?.amount, border: "border-amber-300", bg: "bg-amber-50/40", text: "text-amber-800" },
              { key: "DAYS_31_60", label: "31–60 Days", count: buckets.days31to60?.count, amount: buckets.days31to60?.amount, border: "border-orange-300", bg: "bg-orange-50/40", text: "text-orange-800" },
              { key: "DAYS_61_90", label: "61–90 Days", count: buckets.days61to90?.count, amount: buckets.days61to90?.amount, border: "border-rose-300", bg: "bg-rose-50/40", text: "text-rose-800" },
              { key: "DAYS_120_PLUS", label: "91–120+ Days (Critical)", count: (buckets.days91to120?.count || 0) + (buckets.days120Plus?.count || 0), amount: (buckets.days91to120?.amount || 0) + (buckets.days120Plus?.amount || 0), border: "border-red-500", bg: "bg-red-50/50", text: "text-red-900" },
            ].map((b) => {
              const isSelected = selectedBucket === b.key
              return (
                <button
                  className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition shadow-2xs ${b.border} ${b.bg} ${
                    isSelected ? "ring-2 ring-[var(--color-maroon)] shadow-sm" : "hover:shadow-xs"
                  }`}
                  key={b.key}
                  onClick={() => setSelectedBucket(b.key)}
                  type="button"
                >
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${b.text}`}>{b.label}</p>
                    <p className={`mt-1 font-mono text-base font-black ${b.text}`}>{peso(b.amount)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] text-slate-500 font-bold">
                    <span>{b.count || 0} account(s)</span>
                    {isSelected ? <span className="text-[10px] text-[var(--color-maroon)]">Active Filter</span> : null}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Table Header & Export */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-black text-slate-900">
                Outstanding Accounts Receivable by Age ({records.length} Accounts)
              </h3>
              <p className="text-xs text-slate-500">
                Presents aging timeline from next due date to alert management on high-risk delinquency.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ExportExcelButton
                filteredCount={records.length}
                label="Export Aging (.xlsx)"
                onExport={handleExportAgingExcel}
              />
              <button
                className="grid size-9 place-items-center rounded-xl border border-slate-200 hover:bg-slate-50"
                onClick={loadData}
                title="Refresh"
                type="button"
              >
                <RotateCcw className={isLoading ? "animate-spin text-slate-400" : "text-slate-600"} size={14} />
              </button>
            </div>
          </div>

          {/* Detailed Aging Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="bg-slate-50 font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">Account & Customer</th>
                    <th className="px-3 py-3.5">Provider & Term</th>
                    <th className="px-3 py-3.5 text-right">Principal</th>
                    <th className="px-3 py-3.5 text-right">Financed Balance</th>
                    <th className="px-3 py-3.5 text-right text-emerald-700">Collected</th>
                    <th className="px-3 py-3.5 text-right font-black text-slate-900">Remaining AR</th>
                    <th className="px-3 py-3.5 text-center">Due / Age</th>
                    <th className="px-3 py-3.5 text-center">Aging Bucket</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-12 text-center text-slate-400 font-bold" colSpan={9}>
                        Loading accounts receivable aging data...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td className="px-4 py-12 text-center text-slate-400 font-bold" colSpan={9}>
                        No credit accounts found in this aging bucket.
                      </td>
                    </tr>
                  ) : (
                    records.map((acc) => {
                      const isCritical = acc.bucket === "DAYS_91_120" || acc.bucket === "DAYS_120_PLUS"
                      const isWarning = acc.bucket === "DAYS_31_60" || acc.bucket === "DAYS_61_90"

                      return (
                        <tr className="hover:bg-slate-50 transition" key={acc.id}>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{acc.customer}</p>
                            <p className="font-mono text-[11px] text-slate-400">{acc.creditCode} · {acc.contactNo}</p>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-bold text-slate-800">{acc.provider}</span>
                            <p className="text-[10px] text-slate-400">{acc.term || "Straight"}</p>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-600">
                            {peso(acc.principal)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-700">
                            {peso(acc.balance)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">
                            {peso(acc.collected)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-black text-slate-900 text-sm">
                            {peso(acc.remaining)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <p className="font-mono font-bold text-slate-800">{acc.ageDays} day(s)</p>
                            <p className="text-[10px] text-slate-400">
                              {acc.nextDueDate ? new Date(acc.nextDueDate).toLocaleDateString("en-PH") : "—"}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${
                                isCritical
                                  ? "bg-red-100 text-red-800 border border-red-300"
                                  : isWarning
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              }`}
                            >
                              {acc.bucketLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:text-[var(--color-maroon)] transition shadow-2xs"
                              onClick={() => {
                                setStatementCustomerId(acc.id)
                                setStatementCustomerName(acc.customer)
                              }}
                              type="button"
                            >
                              Statement (SOA)
                            </button>
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

      {/* VIEW 2: PROVIDER PERFORMANCE (REPORT 03) */}
      {selectedSubTab === "PROVIDERS" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-black text-slate-900 text-base">Financing Provider Performance Matrix</h3>
            <p className="text-xs text-slate-500">
              Evaluates sales volume, financing interest yield, and recovery rate across financing partners.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-50 font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-3 py-3 text-center">Accounts</th>
                    <th className="px-3 py-3 text-right">Gross Sales</th>
                    <th className="px-3 py-3 text-right">Principal</th>
                    <th className="px-3 py-3 text-right text-indigo-700">Interest</th>
                    <th className="px-3 py-3 text-right">Downpayment</th>
                    <th className="px-3 py-3 text-right text-emerald-700">Collected</th>
                    <th className="px-4 py-3 text-right font-black text-slate-900">Outstanding AR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(providerData?.records || []).map((r) => (
                    <tr className="hover:bg-slate-50 transition" key={r.provider}>
                      <td className="px-4 py-3 font-bold text-slate-900">{r.provider}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold">{r.accountCount}</td>
                      <td className="px-3 py-3 text-right font-mono">{peso(r.grossSales)}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">{peso(r.principal)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-indigo-700">+{peso(r.interest)}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">{peso(r.downpayment)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">{peso(r.collected)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900 text-sm">{peso(r.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: TERM ANALYSIS (REPORT 04) */}
      {selectedSubTab === "TERMS" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-black text-slate-900 text-base">Installment Term Yield & Term Performance</h3>
            <p className="text-xs text-slate-500">
              Analyzes yield differences between Straight, 3m, 6m, 9m, 12m, 18m, 24m, and Cash Promo terms.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-50 font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Installment Term</th>
                    <th className="px-3 py-3 text-center">Accounts</th>
                    <th className="px-3 py-3 text-right">Sales Volume</th>
                    <th className="px-3 py-3 text-right">Principal</th>
                    <th className="px-3 py-3 text-right text-indigo-700">Interest</th>
                    <th className="px-3 py-3 text-center">Yield Rate %</th>
                    <th className="px-3 py-3 text-right">Downpayment</th>
                    <th className="px-4 py-3 text-right font-black text-slate-900">Outstanding AR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(termData?.records || []).map((r) => (
                    <tr className="hover:bg-slate-50 transition" key={r.term}>
                      <td className="px-4 py-3 font-bold text-slate-900">{r.term}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold">{r.accountCount}</td>
                      <td className="px-3 py-3 text-right font-mono">{peso(r.sales)}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">{peso(r.principal)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-indigo-700">+{peso(r.interest)}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-indigo-900">
                        {Number(r.effectiveYieldPercent || 0).toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{peso(r.downpayments)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900 text-sm">{peso(r.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: DOWNPAYMENT ANALYSIS (REPORT 05) */}
      {selectedSubTab === "DOWNPAYMENT" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-black text-slate-900 text-base">Upfront Downpayment Liquidity Analysis</h3>
            <p className="text-xs text-slate-500">
              Evaluates upfront cash collection received during contract creation (Cash DP, GCash DP, Bank Transfer DP, Zero DP).
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(dpData?.records || []).map((r) => (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4" key={r.method}>
                  <p className="text-xs font-black uppercase text-slate-600">{r.method}</p>
                  <p className="mt-2 font-mono text-2xl font-black text-slate-900">{peso(r.downpayment)}</p>
                  <div className="mt-3 border-t border-slate-200 pt-2 text-[11px] text-slate-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Accounts:</span>
                      <span className="font-bold text-slate-800">{r.accounts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gross Sales:</span>
                      <span className="font-mono font-bold text-slate-800">{peso(r.grossSales)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: COLLECTION MOVEMENT (REPORT 10) */}
      {selectedSubTab === "COLLECTIONS" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="font-black text-slate-900 text-lg">Collection Performance & AR Movement</h3>
            <p className="text-xs text-slate-500">
              Audit formula: Opening AR + New AR Originated − Collections Received = Closing AR.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase text-slate-500">1. Opening AR</p>
                <p className="mt-1 font-mono text-2xl font-black text-slate-800">{peso(colData?.summary?.openingAR)}</p>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                <p className="text-[11px] font-black uppercase text-blue-800">+ 2. New AR Originated</p>
                <p className="mt-1 font-mono text-2xl font-black text-blue-900">{peso(colData?.summary?.newAR)}</p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                <p className="text-[11px] font-black uppercase text-emerald-800">− 3. Collections Received</p>
                <p className="mt-1 font-mono text-2xl font-black text-emerald-900">{peso(colData?.summary?.collections)}</p>
              </div>

              <div className="rounded-2xl border-2 border-slate-900 bg-white p-4">
                <p className="text-[11px] font-black uppercase text-slate-700">= 4. Closing AR Balance</p>
                <p className="mt-1 font-mono text-2xl font-black text-slate-900">{peso(colData?.summary?.closingAR)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Statement Modal (Report 20) */}
      {statementCustomerId ? (
        <CustomerArStatementModal
          customerId={statementCustomerId}
          customerName={statementCustomerName}
          onClose={() => setStatementCustomerId(null)}
          selectedBranch={selectedBranch}
          user={user}
        />
      ) : null}
    </div>
  )
}
