import { useState, useEffect, useCallback } from "react"
import {
  RotateCcw,
  Search,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Banknote,
  Percent,
} from "lucide-react"

import {
  getSalesSettlementReport,
  getPaymentMethodReport,
} from "../../../features/reports/intelligence.api"
import { exportReportExcel } from "../../../utils/businessDocumentExport"
import ExportExcelButton from "../../../components/common/ExportExcelButton"

function peso(val) {
  return `₱${Number(val || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function SettlementCashflowView({ selectedBranch, user, dateRange }) {
  const branchId = selectedBranch?.id || user?.branchId || ""
  const [data, setData] = useState(null)
  const [pmData, setPmData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [settlementFilter, setSettlementFilter] = useState("ALL")
  const [page, setPage] = useState(1)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [settleRes, pmRes] = await Promise.all([
        getSalesSettlementReport({
          ...(branchId ? { branchId } : {}),
          ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
          ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
          settlementType: settlementFilter !== "ALL" ? settlementFilter : undefined,
          page,
          limit: 100,
        }),
        getPaymentMethodReport({
          ...(branchId ? { branchId } : {}),
          ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
          ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
        }),
      ])
      setData(settleRes)
      setPmData(pmRes)
    } catch (err) {
      console.error("Failed to load settlement report", err)
    } finally {
      setIsLoading(false)
    }
  }, [branchId, dateRange?.dateFrom, dateRange?.dateTo, settlementFilter, page])

  useEffect(() => {
    loadData()
  }, [loadData])

  const summary = data?.summary || {}
  const comp = summary.comparison || {}
  const records = data?.records || []

  const handleExportExcel = () => {
    const exportColumns = [
      ["Receipt Code", (r) => r.receiptCode],
      ["Date", (r) => r.date ? new Date(r.date).toLocaleString("en-PH") : "—"],
      ["Customer", (r) => r.customer],
      ["Cashier", (r) => r.cashier],
      ["Settlement Type", (r) => r.settlementType === "GOOD_AS_CASH" ? "Good-as-Cash" : "AR / Financing"],
      ["Payment Method", (r) => r.primaryPaymentMethod],
      ["Provider", (r) => r.provider || "—"],
      ["Term", (r) => r.term || "—"],
      ["Gross Sales", (r) => Number(r.grossSales || 0)],
      ["Base Sales (SRP)", (r) => Number(r.baseSales || 0)],
      ["Mark-up", (r) => Number(r.markup || 0)],
      ["Downpayment", (r) => Number(r.downpayment || 0)],
      ["Financed Principal", (r) => Number(r.financedPrincipal || 0)],
      ["Financing Interest", (r) => Number(r.interest || 0)],
      ["Collected Amount", (r) => Number(r.collected || 0)],
      ["Outstanding AR", (r) => Number(r.outstanding || 0)],
    ]

    exportReportExcel({
      label: "Sales Settlement & Cash vs AR Report",
      filename: `Sales-Settlement-${new Date().toISOString().slice(0, 10)}`,
      columns: exportColumns,
      records,
      branch: selectedBranch || user?.branch,
      generatedBy: user,
      filters: [
        ["Date Range", dateRange?.dateFrom ? `${dateRange.dateFrom} to ${dateRange.dateTo || "Today"}` : "All history"],
        ["Settlement Filter", settlementFilter],
      ],
      totals: [
        ["Total Transactions", records.length],
        ["Total Gross Sales", summary.grossSales || 0],
        ["Total Base Sales", summary.baseSales || 0],
        ["Total Mark-up", summary.totalMarkup || 0],
        ["Total Downpayment", summary.totalDownpayment || 0],
        ["Total Financed Principal", summary.totalPrincipal || 0],
        ["Total Financing Interest", summary.totalInterest || 0],
        ["Total Collected", summary.totalCollected || 0],
        ["Total Outstanding AR", summary.totalOutstandingAR || 0],
      ],
    })
  }

  return (
    <div className="space-y-6">
      {/* REPORT 16: Cash vs AR Comparison Cards */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">REPORT 16</p>
            <h3 className="text-base font-black text-slate-900">Good-as-Cash vs. AR Financing Head-to-Head</h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Total Sales: <span className="font-mono font-black text-slate-900">{peso(summary.grossSales)}</span>
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Cash Card */}
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/30 p-5">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                GOOD-AS-CASH (CASH / GCASH / BANK)
              </span>
              <span className="font-mono text-sm font-black text-emerald-800">
                {Number(comp.goodAsCash?.sharePercent || 0).toFixed(1)}% Share
              </span>
            </div>
            <p className="mt-3 font-mono text-3xl font-black text-emerald-900">{peso(comp.goodAsCash?.volume)}</p>
            <p className="mt-1 text-xs text-emerald-700 font-bold">
              {comp.goodAsCash?.count || 0} transaction(s) fully settled immediately
            </p>
          </div>

          {/* AR Card */}
          <div className="rounded-2xl border-2 border-blue-500/40 bg-blue-50/30 p-5">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-800">
                ACCOUNTS RECEIVABLE / FINANCING
              </span>
              <span className="font-mono text-sm font-black text-blue-800">
                {Number(comp.arFinancing?.sharePercent || 0).toFixed(1)}% Share
              </span>
            </div>
            <p className="mt-3 font-mono text-3xl font-black text-blue-900">{peso(comp.arFinancing?.volume)}</p>
            <p className="mt-1 text-xs text-blue-700 font-bold">
              {comp.arFinancing?.count || 0} contract(s) generating installment interest & receivables
            </p>
          </div>
        </div>
      </div>

      {/* REPORT 11: Payment Method Breakdown Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-black text-slate-900">REPORT 11 — Payment Method & Tender Breakdown</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(pmData?.records || []).map((pm) => (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5" key={pm.method}>
              <p className="text-[11px] font-bold text-slate-600">{pm.method}</p>
              <p className="mt-1 font-mono text-lg font-black text-slate-900">{peso(pm.grossAmount)}</p>
              <div className="mt-2 border-t border-slate-200 pt-1.5 text-[10px] text-slate-500 flex justify-between">
                <span>{pm.txCount} tx(s)</span>
                {pm.outstanding > 0 ? <span className="text-[var(--color-maroon)] font-bold">AR: {peso(pm.outstanding)}</span> : <span className="text-emerald-700 font-bold">Settled</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Export Bar for Settlements */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Filter Settlement:</span>
          {[
            ["ALL", "All Settlements"],
            ["GOOD_AS_CASH", "Good-as-Cash Only"],
            ["AR_FINANCING", "AR / Financing Only"],
          ].map(([k, lbl]) => (
            <button
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                settlementFilter === k
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              key={k}
              onClick={() => {
                setSettlementFilter(k)
                setPage(1)
              }}
              type="button"
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ExportExcelButton
            filteredCount={records.length}
            label="Export Settlements (.xlsx)"
            onExport={handleExportExcel}
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

      {/* REPORT 01: Settlements Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-slate-50 font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Receipt & Date</th>
                <th className="px-3 py-3.5">Customer</th>
                <th className="px-3 py-3.5">Settlement Class</th>
                <th className="px-3 py-3.5 text-right">Gross Sales</th>
                <th className="px-3 py-3.5 text-right">Base Sales</th>
                <th className="px-3 py-3.5 text-right text-amber-700">Mark-up</th>
                <th className="px-3 py-3.5 text-right">Downpayment</th>
                <th className="px-3 py-3.5 text-right text-indigo-700">Interest</th>
                <th className="px-3 py-3.5 text-right text-emerald-700">Collected</th>
                <th className="px-4 py-3.5 text-right font-black text-slate-900">Outstanding AR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-400 font-bold" colSpan={10}>
                    Loading settlement data...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-400 font-bold" colSpan={10}>
                    No sales transactions found for the selected filter.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr className="hover:bg-slate-50 transition" key={r.saleId}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{r.receiptCode}</p>
                      <p className="text-[10px] text-slate-400">{new Date(r.date).toLocaleString("en-PH")}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-slate-800">{r.customer}</p>
                      <p className="text-[10px] text-slate-400">Cashier: {r.cashier}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${
                          r.settlementType === "GOOD_AS_CASH"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-blue-100 text-blue-800 border border-blue-300"
                        }`}
                      >
                        {r.settlementType === "GOOD_AS_CASH" ? "Good-as-Cash" : `${r.provider || "AR"} · ${r.term || "Term"}`}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                      {peso(r.grossSales)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-700">
                      {peso(r.baseSales)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-amber-700 font-bold">
                      {r.markup > 0 ? `+${peso(r.markup)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      {r.downpayment > 0 ? peso(r.downpayment) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-indigo-700 font-bold">
                      {r.interest > 0 ? `+${peso(r.interest)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">
                      {peso(r.collected)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                      {r.outstanding > 0 ? peso(r.outstanding) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
