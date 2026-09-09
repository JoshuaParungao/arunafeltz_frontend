import { useState, useEffect, useCallback } from "react"
import {
  Search,
  Download,
  Percent,
  Sparkles,
  TrendingUp,
  Package,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Layers,
  ArrowUpRight,
} from "lucide-react"

import { getProductProfitabilityReport } from "../../../features/reports/intelligence.api"
import { exportReportExcel } from "../../../utils/businessDocumentExport"
import ExportExcelButton from "../../../components/common/ExportExcelButton"

function peso(val) {
  return `₱${Number(val || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function num(val) {
  return Number(val || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })
}

export default function ProductProfitabilityView({ selectedBranch, user, dateRange }) {
  const branchId = selectedBranch?.id || user?.branchId || ""
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [page, setPage] = useState(1)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getProductProfitabilityReport({
        ...(branchId ? { branchId } : {}),
        ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
        ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(category ? { category } : {}),
        page,
        limit: 100,
      })
      setData(res)
    } catch (err) {
      console.error("Failed to load product profitability", err)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [branchId, dateRange?.dateFrom, dateRange?.dateTo, search, category, page])

  useEffect(() => {
    const t = setTimeout(loadData, 200)
    return () => clearTimeout(t)
  }, [loadData])

  const summary = data?.summary || {}
  const records = data?.records || []

  const handleExportExcel = () => {
    const exportColumns = [
      ["Item Code", (r) => r.itemCode],
      ["Product Name", (r) => r.itemName],
      ["Category", (r) => r.category],
      ["Qty Sold", (r) => Number(r.quantitySold || 0)],
      ["Unit Cost (Puhunan)", (r) => Number(r.unitCost || 0)],
      ["Base SRP", (r) => Number(r.baseSrp || 0)],
      ["Mark-up Unit", (r) => Number(r.actualSellingPrice - r.baseSrp)],
      ["Selling Price", (r) => Number(r.actualSellingPrice || 0)],
      ["Total Puhunan", (r) => Number(r.totalCost || 0)],
      ["Total Base Sales", (r) => Number(r.totalBaseSales || 0)],
      ["Total Actual Sales", (r) => Number(r.totalActualSales || 0)],
      ["Total Mark-up", (r) => Number(r.totalMarkup || 0)],
      ["Pure Tubo (Base - Cost)", (r) => Number(r.totalPureTubo || 0)],
      ["Tubo with Mark-up (Total Kita)", (r) => Number(r.totalTuboWithMarkup || 0)],
      ["Margin %", (r) => Number(r.marginPercent || 0).toFixed(2) + "%"],
    ]

    exportReportExcel({
      label: "Product Profitability & Tubo Report",
      filename: `Product-Profitability-${new Date().toISOString().slice(0, 10)}`,
      columns: exportColumns,
      records,
      branch: selectedBranch || user?.branch,
      generatedBy: user,
      filters: [
        ["Date Range", dateRange?.dateFrom ? `${dateRange.dateFrom} to ${dateRange.dateTo || "Today"}` : "All time"],
        ["Search", search.trim() || "All"],
        ["Category", category || "All categories"],
      ],
      totals: [
        ["Total Products Sold", records.length],
        ["Total Units Sold", summary.totalQuantitySold || 0],
        ["Total Puhunan (Cost)", summary.totalPuhunan || 0],
        ["Total Base Sales", summary.totalBaseSales || 0],
        ["Total Mark-up", summary.totalMarkup || 0],
        ["Total Pure Tubo", summary.totalPureTubo || 0],
        ["Total Kita (Tubo w/ Markup)", summary.totalTuboWithMarkup || 0],
        ["Overall Margin", Number(summary.overallMarginPercent || 0).toFixed(2) + "%"],
      ],
    })
  }

  return (
    <div className="space-y-6">
      {/* Executive Hero KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Card 1: Puhunan */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">1. Total Puhunan (Cost)</p>
            <p className="mt-1 font-mono text-lg font-black text-slate-900 sm:text-xl">{peso(summary.totalPuhunan)}</p>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Total acquisition cost of goods sold</p>
        </div>

        {/* Card 2: Base Sales */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">2. Base Sales (SRP)</p>
            <p className="mt-1 font-mono text-lg font-black text-slate-800 sm:text-xl">{peso(summary.totalBaseSales)}</p>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Sales value before mark-ups</p>
        </div>

        {/* Card 3: Mark-up */}
        <div className="flex flex-col justify-between rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">3. Total Mark-up</p>
              <span className="rounded bg-amber-200/80 px-1 py-0.5 text-[9px] font-black text-amber-900">
                +{Number(summary.overallMarkupPercent || 0).toFixed(1)}%
              </span>
            </div>
            <p className="mt-1 font-mono text-lg font-black text-amber-800 sm:text-xl">{peso(summary.totalMarkup)}</p>
          </div>
          <p className="mt-2 text-[10px] text-amber-700/80">Additional store price markup</p>
        </div>

        {/* Card 4: Pure Tubo */}
        <div className="flex flex-col justify-between rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-800">4. Pure Tubo (Base - Cost)</p>
            <p className="mt-1 font-mono text-lg font-black text-blue-800 sm:text-xl">{peso(summary.totalPureTubo)}</p>
          </div>
          <p className="mt-2 text-[10px] text-blue-700/80">Margin without mark-up</p>
        </div>

        {/* Card 5: Tubo With Mark-up (Hero Kita!) */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 shadow-xs sm:col-span-2 lg:col-span-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-200/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-900">
                <Sparkles size={11} /> Total Kita (Tubo + Mark-up)
              </span>
              <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs font-black text-emerald-800 shadow-2xs">
                {Number(summary.overallMarginPercent || 0).toFixed(1)}% Margin
              </span>
            </div>
            <p className="mt-2 font-mono text-2xl font-black text-emerald-900 sm:text-3xl">{peso(summary.totalTuboWithMarkup)}</p>
          </div>
          <p className="mt-2 text-xs font-bold text-emerald-800">
            Net consolidated profit from product sales across {num(summary.totalQuantitySold)} units sold
          </p>
        </div>
      </div>

      {summary.legacyDataAudit?.legacyLinesCount > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900">
          <AlertCircle className="shrink-0 text-amber-700" size={18} />
          <span>
            {summary.legacyDataAudit.legacyLinesCount} item line(s) ({peso(summary.legacyDataAudit.legacySalesVolume)}) were recorded prior to cost-snapshot logging and have no unit cost snapshot. Their profit is calculated safely without invented cost.
          </span>
        </div>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] focus:bg-white"
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search product name or SKU..."
              type="text"
              value={search}
            />
          </div>

          <input
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] focus:bg-white"
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            placeholder="Filter Category..."
            type="text"
            value={category}
          />
        </div>

        <div className="flex items-center gap-2">
          <ExportExcelButton
            filteredCount={records.length}
            label="Export Profitability (.xlsx)"
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

      {/* Item by Item Profitability Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Product & SKU</th>
                <th className="px-3 py-3.5">Category</th>
                <th className="px-3 py-3.5 text-center">Qty Sold</th>
                <th className="px-3 py-3.5 text-right">Puhunan (Cost)</th>
                <th className="px-3 py-3.5 text-right">Base SRP</th>
                <th className="px-3 py-3.5 text-right">Mark-up</th>
                <th className="px-3 py-3.5 text-right">Selling Price</th>
                <th className="px-3 py-3.5 text-right text-blue-700">Pure Tubo</th>
                <th className="px-4 py-3.5 text-right text-emerald-800">Tubo w/ Mark-up</th>
                <th className="px-3 py-3.5 text-center">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-400 font-bold" colSpan={10}>
                    Loading item profitability analytics...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-400 font-bold" colSpan={10}>
                    No sold items found matching the selected filters.
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => {
                  const markupPerPc = Math.max(0, r.actualSellingPrice - r.baseSrp)
                  const pureTuboPerPc = r.baseSrp - r.unitCost
                  const tuboWithMarkupPerPc = r.actualSellingPrice - r.unitCost
                  const isHighMargin = r.marginPercent >= 20

                  return (
                    <tr className="hover:bg-slate-50/80 transition" key={idx}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{r.itemName}</p>
                        <p className="font-mono text-[11px] text-slate-400">{r.itemCode}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {r.category || "General"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-slate-800">
                        {r.quantitySold} pc(s)
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        {peso(r.unitCost)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-700">
                        {peso(r.baseSrp)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">
                        {markupPerPc > 0 ? (
                          <span className="font-bold text-amber-700">+{peso(markupPerPc)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                        {peso(r.actualSellingPrice)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-blue-700">
                        <p>{peso(r.totalPureTubo)}</p>
                        <p className="text-[10px] text-blue-500 font-medium">({peso(pureTuboPerPc)}/pc)</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                        <p className="text-sm">{peso(r.totalTuboWithMarkup)}</p>
                        <p className="text-[10px] text-emerald-600 font-bold">({peso(tuboWithMarkupPerPc)}/pc)</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-mono text-[11px] font-black ${
                            isHighMargin
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : r.marginPercent >= 10
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {Number(r.marginPercent || 0).toFixed(1)}%
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
    </div>
  )
}
