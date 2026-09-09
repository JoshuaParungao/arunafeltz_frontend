import { useState, useEffect, useCallback } from "react"
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Layers,
  ArrowRight,
  RotateCcw,
  Building2,
  DollarSign,
  Percent,
  CheckCircle2,
  Briefcase,
  HandCoins,
} from "lucide-react"

import {
  getSixLayerProfitability,
  getBranchFinancialComparison,
  getServiceProfitabilityReport,
} from "../../../features/reports/intelligence.api"
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

export default function SixLayerExecutiveView({ selectedBranch, user, dateRange }) {
  const branchId = selectedBranch?.id || user?.branchId || ""
  const [data, setData] = useState(null)
  const [branchData, setBranchData] = useState(null)
  const [serviceData, setServiceData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [sixRes, bRes, sRes] = await Promise.all([
        getSixLayerProfitability({
          ...(branchId ? { branchId } : {}),
          ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
          ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
        }),
        getBranchFinancialComparison({
          ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
          ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
        }),
        getServiceProfitabilityReport({
          ...(branchId ? { branchId } : {}),
          ...(dateRange?.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
          ...(dateRange?.dateTo ? { dateTo: dateRange.dateTo } : {}),
        }),
      ])
      setData(sixRes)
      setBranchData(bRes)
      setServiceData(sRes)
    } catch (err) {
      console.error("Failed to load six-layer profitability", err)
    } finally {
      setIsLoading(false)
    }
  }, [branchId, dateRange?.dateFrom, dateRange?.dateTo])

  useEffect(() => {
    loadData()
  }, [loadData])

  const layers = data?.layers || {}
  const lA = layers.layerA || {}
  const lB = layers.layerB || {}
  const lC = layers.layerC || {}
  const lD = layers.layerD || {}
  const lE = layers.layerE || {}
  const lF = layers.layerF || {}

  const handleExportExcel = () => {
    const exportColumns = [
      ["Profit Layer", (r) => r.layer],
      ["Description", (r) => r.desc],
      ["Amount", (r) => Number(r.amount || 0)],
      ["Classification", (r) => r.type],
    ]

    const layerRecords = [
      { layer: "Layer A: Puhunan (Total Cost)", desc: "Product Acquisition Cost + Service Operational Cost", amount: lA.totalPuhunan, type: "Cost / Outflow" },
      { layer: "Layer B: Base Sales", desc: "Outright retail/SRP value before markups and interest", amount: lB.totalBaseSales, type: "Base Inflow" },
      { layer: "Layer B: Pure Base Tubo", desc: "Base Sales minus Puhunan (Pure trading profit)", amount: lB.pureBaseTubo, type: "Pure Base Margin" },
      { layer: "Layer C: Total Mark-up", desc: "Store price additions on products and services", amount: lC.totalMarkup, type: "Additional Margin" },
      { layer: "Layer D: Tubo With Mark-up", desc: "Base Sales + Mark-up minus Puhunan", amount: lD.tuboWithMarkup, type: "Merchandise Profit" },
      { layer: "Layer E: Financing Interest", desc: "Installment interest yield from AR financing contracts", amount: lE.financingInterest, type: "Financing Income" },
      { layer: "Layer F: Overall Total Kita", desc: "Consolidated profit: Base Margin + Mark-up + Financing Interest", amount: lF.overallTotalKita, type: "Total Enterprise Profit" },
    ]

    exportReportExcel({
      label: "Six-Layer Executive Profitability Matrix",
      filename: `Executive-Profit-Matrix-${new Date().toISOString().slice(0, 10)}`,
      columns: exportColumns,
      records: layerRecords,
      branch: selectedBranch || user?.branch,
      generatedBy: user,
      filters: [
        ["Date Range", dateRange?.dateFrom ? `${dateRange.dateFrom} to ${dateRange.dateTo || "Today"}` : "All history"],
        ["Branch Scope", selectedBranch?.name || user?.branch?.name || "All Branches"],
      ],
      totals: [
        ["Total Puhunan", lA.totalPuhunan || 0],
        ["Total Pure Tubo", lB.pureBaseTubo || 0],
        ["Total Mark-up", lC.totalMarkup || 0],
        ["Total Financing Interest", lE.financingInterest || 0],
        ["Consolidated Overall Kita", lF.overallTotalKita || 0],
      ],
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Export */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-maroon)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-maroon)]">
            <ShieldCheck size={13} />
            REPORT 08 — Six-Layer Executive Profitability
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">
            Executive Profit & Earnings Matrix
          </h2>
          <p className="text-xs text-slate-500">
            Cleanly isolates Puhunan, Pure Base Margin, Mark-ups, and Financing Interest for complete financial clarity.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <ExportExcelButton
            filteredCount={6}
            label="Export Matrix (.xlsx)"
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

      {/* Six-Layer Visual Card Deck */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Layer A */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-black text-slate-700">LAYER A</span>
              <span className="text-[10px] font-bold uppercase text-slate-400">Total Outflow</span>
            </div>
            <h3 className="mt-3 text-xs font-black uppercase tracking-wider text-slate-600">Puhunan (Total Cost)</h3>
            <p className="mt-1 font-mono text-2xl font-black text-slate-900">{peso(lA.totalPuhunan)}</p>
          </div>
          <div className="mt-4 border-t border-slate-200/60 pt-3 text-[11px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Product Acquisition COGS:</span>
              <span className="font-mono font-bold text-slate-700">{peso(lA.productCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Service Operational Cost:</span>
              <span className="font-mono font-bold text-slate-700">{peso(lA.serviceCost)}</span>
            </div>
          </div>
        </div>

        {/* Layer B */}
        <div className="flex flex-col justify-between rounded-2xl border border-blue-200 bg-blue-50/30 p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-blue-200 px-2 py-0.5 font-mono text-[10px] font-black text-blue-800">LAYER B</span>
              <span className="text-[10px] font-bold uppercase text-blue-500">Pure Base Margin</span>
            </div>
            <h3 className="mt-3 text-xs font-black uppercase tracking-wider text-blue-900">Pure Base Tubo (Without Markup)</h3>
            <p className="mt-1 font-mono text-2xl font-black text-blue-800">{peso(lB.pureBaseTubo)}</p>
          </div>
          <div className="mt-4 border-t border-blue-200/60 pt-3 text-[11px] text-blue-800/80 space-y-1">
            <div className="flex justify-between">
              <span>Base Sales (SRP):</span>
              <span className="font-mono font-bold">{peso(lB.totalBaseSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>Pure Margin Formula:</span>
              <span className="font-semibold text-blue-600">Base Sales − Puhunan</span>
            </div>
          </div>
        </div>

        {/* Layer C */}
        <div className="flex flex-col justify-between rounded-2xl border border-amber-200 bg-amber-50/30 p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-amber-200 px-2 py-0.5 font-mono text-[10px] font-black text-amber-900">LAYER C</span>
              <span className="text-[10px] font-bold uppercase text-amber-600">Price Additions</span>
            </div>
            <h3 className="mt-3 text-xs font-black uppercase tracking-wider text-amber-900">Total Mark-up Income</h3>
            <p className="mt-1 font-mono text-2xl font-black text-amber-800">{peso(lC.totalMarkup)}</p>
          </div>
          <div className="mt-4 border-t border-amber-200/60 pt-3 text-[11px] text-amber-800/80 space-y-1">
            <p>Added markup on top of base SRP on sold inventory products and custom service lines.</p>
          </div>
        </div>

        {/* Layer D */}
        <div className="flex flex-col justify-between rounded-2xl border border-teal-200 bg-teal-50/30 p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-teal-200 px-2 py-0.5 font-mono text-[10px] font-black text-teal-900">LAYER D</span>
              <span className="text-[10px] font-bold uppercase text-teal-600">Merchandise Profit</span>
            </div>
            <h3 className="mt-3 text-xs font-black uppercase tracking-wider text-teal-900">Tubo With Mark-up</h3>
            <p className="mt-1 font-mono text-2xl font-black text-teal-800">{peso(lD.tuboWithMarkup)}</p>
          </div>
          <div className="mt-4 border-t border-teal-200/60 pt-3 text-[11px] text-teal-800/80 space-y-1">
            <div className="flex justify-between">
              <span>Merchandise Margin:</span>
              <span className="font-mono font-bold">{Number(lD.marginWithMarkupPercent || 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Formula:</span>
              <span className="font-semibold text-teal-600">Base + Mark-up − Puhunan</span>
            </div>
          </div>
        </div>

        {/* Layer E */}
        <div className="flex flex-col justify-between rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-indigo-200 px-2 py-0.5 font-mono text-[10px] font-black text-indigo-900">LAYER E</span>
              <span className="text-[10px] font-bold uppercase text-indigo-600">Financing Yield</span>
            </div>
            <h3 className="mt-3 text-xs font-black uppercase tracking-wider text-indigo-900">Financing Interest Income</h3>
            <p className="mt-1 font-mono text-2xl font-black text-indigo-800">{peso(lE.financingInterest)}</p>
          </div>
          <div className="mt-4 border-t border-indigo-200/60 pt-3 text-[11px] text-indigo-800/80 space-y-1">
            <p>Interest revenue earned from installment term financing (HomeCredit, Salmon, Skyro, In-House).</p>
          </div>
        </div>

        {/* Layer F: HERO CARD */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-[var(--color-maroon)] bg-gradient-to-br from-rose-50 via-white to-rose-50/40 p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-[var(--color-maroon)] px-2.5 py-0.5 font-mono text-[10px] font-black text-white">
                LAYER F · HERO KITA
              </span>
              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-[var(--color-maroon)]">
                +{Number(lF.netReturnOnCostPercent || 0).toFixed(1)}% Return on Cost
              </span>
            </div>
            <h3 className="mt-3 text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">Overall Total Kita</h3>
            <p className="mt-1 font-mono text-3xl font-black text-[var(--color-maroon)]">{peso(lF.overallTotalKita)}</p>
          </div>
          <div className="mt-4 border-t border-rose-200 pt-3 text-[11px] text-slate-600 space-y-1">
            <div className="flex justify-between font-bold text-slate-800">
              <span>Consolidated Inflow:</span>
              <span className="font-mono text-[var(--color-maroon)]">{peso(lF.consolidatedRevenue)}</span>
            </div>
            <p className="text-[10px] text-slate-500">Formula: (Base Sales + Mark-up + Financing Interest) − Puhunan</p>
          </div>
        </div>
      </div>

      {/* Multi-Branch Benchmarking Table (Report 15) */}
      {branchData?.records?.length > 1 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">REPORT 15</p>
              <h3 className="font-black text-slate-900">Branch Financial Comparison</h3>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {branchData.records.length} Branches Benchmarked
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-50 font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-3 py-3 text-right">Gross Sales</th>
                  <th className="px-3 py-3 text-right">Puhunan</th>
                  <th className="px-3 py-3 text-right text-blue-700">Pure Tubo</th>
                  <th className="px-3 py-3 text-right text-amber-700">Mark-up</th>
                  <th className="px-3 py-3 text-right text-indigo-700">Financing Interest</th>
                  <th className="px-4 py-3 text-right text-[var(--color-maroon)]">Overall Kita</th>
                  <th className="px-3 py-3 text-center">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {branchData.records.map((b) => (
                  <tr className="hover:bg-slate-50 transition" key={b.branchId}>
                    <td className="px-4 py-3 font-bold text-slate-900">{b.branchName} ({b.branchCode})</td>
                    <td className="px-3 py-3 text-right font-mono">{peso(b.sales)}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-500">{peso(b.cost)}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-blue-700">{peso(b.pureTubo)}</td>
                    <td className="px-3 py-3 text-right font-mono text-amber-700">+{peso(b.markup)}</td>
                    <td className="px-3 py-3 text-right font-mono text-indigo-700">+{peso(b.interest)}</td>
                    <td className="px-4 py-3 text-right font-mono font-black text-[var(--color-maroon)] text-sm">{peso(b.overallKita)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-800">
                        {Number(b.marginPercent || 0).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
