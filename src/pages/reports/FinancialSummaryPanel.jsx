import {
  Calendar,
  HandCoins,
  PackageCheck,
  Percent,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from "lucide-react"

const BUSINESS_TIME_ZONE = "Asia/Manila"

const PROVIDER_LABELS = Object.freeze({
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  HOMECREDIT: "HomeCredit",
  SALMON: "Salmon",
  SKYRO: "Skyro",
  KYRO: "Kyro",
  OTHER_FINANCING: "Other Financing",
  IN_HOUSE_INSTALLMENT: "In-House Installment",
})

function peso(value) {
  return `\u20B1${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function number(value) {
  return Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })
}

function manilaDate(value) {
  if (!value) return "No lower bound"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date)
}

function Metric({ label, value, money = true, tone = "default" }) {
  const toneClass = tone === "warning"
    ? "text-amber-700"
    : tone === "positive"
      ? "text-emerald-700"
      : "text-[var(--color-text-strong)]"

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--color-muted)]">{label}</p>
      <p className={`mt-2 text-xl font-black ${toneClass}`}>{money ? peso(value) : number(value)}</p>
    </div>
  )
}

function MetricRow({ label, value, muted = false }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] py-2 last:border-b-0">
      <span className={`text-sm ${muted ? "text-[var(--color-muted)]" : "font-semibold text-[var(--color-text-strong)]"}`}>{label}</span>
      <span className="text-sm font-black text-[var(--color-text-strong)]">{peso(value)}</span>
    </div>
  )
}

function RepairAllocation({ label, allocation = {} }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-black text-[var(--color-text-strong)]">{label}</h4>
        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-maroon)]">Nested allocation</span>
      </div>
      <div className="mt-3">
        <MetricRow label="JO base sales" value={allocation.serviceBaseSales} />
        <MetricRow label="Repair cost pool" value={allocation.repairCostPool} />
        <MetricRow label="Company share" value={allocation.companyShare} />
        <MetricRow label="Technician repair fees" value={allocation.technicianRepairFees} muted />
        <MetricRow label="Repair incentives" value={allocation.repairIncentives} muted />
        <MetricRow label="Remaining/unallocated Repair Cost Pool" value={allocation.remainingUnallocatedRepairCostPool} muted />
      </div>
      {Number(allocation.baseAllocationReconciliationDifference || 0) !== 0 || Number(allocation.poolDetailReconciliationDifference || 0) !== 0 ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
          Snapshot reconciliation: base {peso(allocation.baseAllocationReconciliationDifference)}; pool detail {peso(allocation.poolDetailReconciliationDifference)}.
        </p>
      ) : null}
    </div>
  )
}

export default function FinancialSummaryPanel({ report }) {
  const sections = report?.sections
  if (!sections) return null

  const item = sections.itemSales || {}
  const service = sections.serviceSales || {}
  const markup = sections.markupSales || {}
  const ar = sections.accountsReceivable || {}
  const settlements = sections.settlements || {}
  const cash = settlements.actualCash || {}
  const gross = sections.gross || {}
  const coverage = sections.coverage || {}
  const providers = Array.isArray(ar.byProvider) ? ar.byProvider : []
  const legacyCount = Number(coverage.legacySaleLinesWithoutBaseSnapshot || 0)
    + Number(coverage.legacyJobOrdersWithoutFinancialSnapshot || 0)

  const itemProfitBase = Number(item.itemProfitBeforeUnresolvedDiscountAndReturnAllocation || 0)
  const totalMarkup = Number(markup.totalMarkupSales || 0)
  const baseSalesTotal = Number(item.baseSales || 0) + Number(service.totalServiceBaseSales || 0)
  const arOriginatedTotal = Number(ar.originatedInPeriod?.receivable || 0)
  const totalGrossWithMarkupAndAR = Number(gross.classifiedGross || 0)
  const totalTuboConsolidated = itemProfitBase + totalMarkup + Number(service.totalServiceBaseSales || 0)

  return (
    <section className="space-y-4">
      {/* Executive Sales & Profit Breakdown Matrix (Owner Summary) */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 dark:border-slate-800/80 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-maroon)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-maroon)] dark:bg-[var(--color-maroon)]/25 dark:text-rose-300">
              <ShieldCheck className="shrink-0" size={13} />
              Executive Profit & Sales Matrix (Owner Summary)
            </div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Consolidated Sales, Mark-Up, AR & Profit Matrix
            </h2>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 self-start md:self-auto">
            <Calendar className="text-slate-400 shrink-0" size={13} />
            <span>
              {report.period?.dateFrom ? manilaDate(report.period.startInclusive) : "All history"} through {manilaDate(new Date(new Date(report.period?.endExclusive).getTime() - 1))} · Asia/Manila
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Total Sales (with Mark-Up & AR) */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:border-slate-700">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-rose-50 text-[var(--color-maroon)] dark:bg-rose-950/50 dark:text-rose-400">
                  <TrendingUp size={17} />
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs dark:bg-slate-800 dark:text-slate-400">
                  01
                </span>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Total Sales (with Mark-Up & AR)
              </p>
              <p className="mt-1 font-mono text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {peso(totalGrossWithMarkupAndAR)}
              </p>
            </div>
            <p className="mt-3 border-t border-slate-200/60 pt-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:border-slate-800/60 dark:text-slate-400">
              Gross classified sales including store markup and AR contract values
            </p>
          </div>

          {/* Card 2: Base Sales (without Mark-Up & AR) */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:border-slate-700">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <ShoppingBag size={17} />
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs dark:bg-slate-800 dark:text-slate-400">
                  02
                </span>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Base Sales (without Mark-Up & AR)
              </p>
              <p className="mt-1 font-mono text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                {peso(baseSalesTotal)}
              </p>
            </div>
            <p className="mt-3 border-t border-slate-200/60 pt-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:border-slate-800/60 dark:text-slate-400">
              Base sales at outright cash / SRP tier before markup and financing
            </p>
          </div>

          {/* Card 3: Total Gross Profit (with Mark-Up & AR) - Hero Card */}
          <div className="group relative flex flex-col justify-between rounded-2xl border-2 border-emerald-500/50 bg-emerald-50/50 p-5 shadow-xs transition hover:border-emerald-500/70 hover:bg-emerald-50/70 dark:border-emerald-600/50 dark:bg-emerald-950/25 dark:hover:border-emerald-500/60">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <Sparkles size={17} />
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200">
                  03 · Hero Margin
                </span>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                3. Total Gross Profit (with Mark-Up & AR)
              </p>
              <p className="mt-1 font-mono text-2xl font-black tracking-tight text-emerald-700 dark:text-emerald-400 sm:text-3xl">
                {peso(totalTuboConsolidated)}
              </p>
            </div>
            <p className="mt-3 border-t border-emerald-200/70 pt-2 text-[11px] font-semibold leading-relaxed text-emerald-700/90 dark:border-emerald-800/60 dark:text-emerald-300/90">
              Consolidated profit from Base Margin + Mark-up + Services
            </p>
          </div>

          {/* Card 4: Mark-Up Profit (Product & Service) */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition hover:border-amber-200 hover:bg-amber-50/20 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:border-amber-900/50">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-amber-100/80 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                  <Percent size={17} />
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs dark:bg-slate-800 dark:text-slate-400">
                  04
                </span>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                4. Mark-Up Profit (Product & Service)
              </p>
              <p className="mt-1 font-mono text-2xl font-black tracking-tight text-amber-700 dark:text-amber-400 sm:text-3xl">
                {peso(totalMarkup)}
              </p>
            </div>
            <p className="mt-3 border-t border-slate-200/60 pt-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:border-slate-800/60 dark:text-slate-400">
              Profit generated exclusively from price markups on products and labor
            </p>
          </div>

          {/* Card 5: AR Contracts Originated in Period */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition hover:border-sky-200 hover:bg-sky-50/20 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:border-sky-900/50">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-sky-100/80 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                  <HandCoins size={17} />
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs dark:bg-slate-800 dark:text-slate-400">
                  05
                </span>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-400">
                5. AR Contracts Originated in Period
              </p>
              <p className="mt-1 font-mono text-2xl font-black tracking-tight text-sky-700 dark:text-sky-400 sm:text-3xl">
                {peso(arOriginatedTotal)}
              </p>
            </div>
            <p className="mt-3 border-t border-slate-200/60 pt-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:border-slate-800/60 dark:text-slate-400">
              Total new installment and accounts receivable contracts issued
            </p>
          </div>

          {/* Card 6: Base Profit (without Mark-Up & AR) */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition hover:border-indigo-200 hover:bg-indigo-50/20 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:border-indigo-900/50">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <PackageCheck size={17} />
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs dark:bg-slate-800 dark:text-slate-400">
                  06
                </span>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                6. Base Profit (without Mark-Up & AR)
              </p>
              <p className="mt-1 font-mono text-2xl font-black tracking-tight text-indigo-950 dark:text-indigo-200 sm:text-3xl">
                {peso(itemProfitBase)}
              </p>
            </div>
            <p className="mt-3 border-t border-slate-200/60 pt-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:border-slate-800/60 dark:text-slate-400">
              Base profit margin of item sales (Base Price minus Operational COGS)
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-maroon)]">Snapshot accounting</p>
            <h2 className="mt-1 text-xl font-black text-[var(--color-text-strong)]">Unified Financial Details & Breakdown</h2>
          </div>
          <p className="text-xs font-bold text-[var(--color-muted)]">
            {report.period?.dateFrom ? manilaDate(report.period.startInclusive) : "All history"} through {manilaDate(new Date(new Date(report.period?.endExclusive).getTime() - 1))} · Asia/Manila
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Classified gross" value={gross.classifiedGross} />
          <Metric label="Net revenue effect" value={gross.netRevenueEffect} tone="positive" />
          <Metric label="Outstanding AR as of period end" value={ar.totals?.outstandingAsOf} />
          <Metric label="Actual cash received (net)" value={cash.actualCashReceivedNet} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <h3 className="font-black text-[var(--color-text-strong)]">Item sales</h3>
          <div className="mt-3">
            <MetricRow label="Base / cash item sales" value={item.baseSales} />
            <MetricRow label="Net operational COGS" value={item.netCogs} />
            <MetricRow label="Item profit before unresolved allocation" value={item.itemProfitBeforeUnresolvedDiscountAndReturnAllocation} />
            <MetricRow label="Company-view acquisition COGS" value={item.acquisitionCogsForCompanyView} muted />
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <h3 className="font-black text-[var(--color-text-strong)]">Service sales</h3>
          <div className="mt-3">
            <MetricRow label="POS / quotation custom service base" value={service.posCustomServiceBaseSales} />
            <MetricRow label="Standard service base" value={service.ordinaryRepairBaseSales} />
            <MetricRow label="Specialized repair base" value={service.boardLevelRepairBaseSales} />
            <MetricRow label="Total service base" value={service.totalServiceBaseSales} />
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <h3 className="font-black text-[var(--color-text-strong)]">Mark up sales</h3>
          <div className="mt-3">
            <MetricRow label="Product mark up" value={markup.productMarkupSales} />
            <MetricRow label="Custom service mark up" value={markup.customServiceMarkupSales} />
            <MetricRow label="JO service mark up" value={markup.jobOrderServiceMarkupSales} />
            <MetricRow label="Total mark up" value={markup.totalMarkupSales} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RepairAllocation label="Standard service allocation" allocation={service.repairAllocation?.ordinary} />
        <RepairAllocation label="Specialized repair allocation" allocation={service.repairAllocation?.boardLevel} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <h3 className="font-black text-[var(--color-text-strong)]">Cash and settlements</h3>
          <div className="mt-3">
            <MetricRow label="Direct settlements (net)" value={settlements.directSettlementsNet} />
            <MetricRow label="AR collections (net)" value={settlements.arCollectionsNet} />
            <MetricRow label="Partial settlements" value={settlements.partialSettlementAmount} />
            <MetricRow label="AR originated in period (non-additive)" value={ar.originatedInPeriod?.receivable} muted />
            <MetricRow label="Cash from direct payments" value={cash.directCashTenderReceived} muted />
            <MetricRow label="Cash AR collections" value={cash.arCashCollectionsReceived} muted />
            <MetricRow label="Actual cash received (net)" value={cash.actualCashReceivedNet} />
          </div>
          <p className="mt-3 rounded-xl bg-sky-50 p-3 text-xs font-bold text-sky-800">Cash AR collections already form part of actual cash received. The two figures are not additive.</p>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <h3 className="font-black text-[var(--color-text-strong)]">Gross reconciliation</h3>
          <div className="mt-3">
            <MetricRow label="Item base" value={gross.itemBaseSales} />
            <MetricRow label="Service base" value={gross.serviceBaseSales} />
            <MetricRow label="Mark up" value={gross.markupSales} />
            <MetricRow label="Legacy unclassified" value={gross.legacyUnclassifiedGross} muted />
            <MetricRow label="Exact discount contra — unallocated" value={gross.exactDiscountContraUnallocated} muted />
            <MetricRow label="Return contra — unallocated" value={gross.returnRefundContraUnallocated} muted />
            <MetricRow label="Net revenue effect" value={gross.netRevenueEffect} />
          </div>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Item sale discount allocation remains unresolved. Discounts and return refunds stay as separate contra amounts and are not assigned to item base or mark up.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        <div className="border-b border-[var(--color-border)] p-5">
          <h3 className="font-black text-[var(--color-text-strong)]">Accounts receivable by provider</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">As of the exclusive period boundary {manilaDate(ar.asOfExclusive)}. Financing contract differences are not revenue.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-[0.1em] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Accounts</th>
                <th className="px-4 py-3">Unpaid</th>
                <th className="px-4 py-3">Partial</th>
                <th className="px-4 py-3">Settled</th>
                <th className="px-4 py-3">Opening AR</th>
                <th className="px-4 py-3">Originated in period</th>
                <th className="px-4 py-3">Collected</th>
                <th className="px-4 py-3">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr className="border-t border-[var(--color-border)]" key={provider.provider}>
                  <td className="px-4 py-3 font-black text-[var(--color-text-strong)]">{PROVIDER_LABELS[provider.provider] || provider.provider}</td>
                  <td className="px-4 py-3">{number(provider.accountCount)}</td>
                  <td className="px-4 py-3">{number(provider.unpaidAccounts)}</td>
                  <td className="px-4 py-3">{number(provider.partiallySettledAccounts)}</td>
                  <td className="px-4 py-3">{number(provider.settledAccounts)}</td>
                  <td className="px-4 py-3 font-semibold">{peso(provider.openingReceivable)}</td>
                  <td className="px-4 py-3 font-semibold">{peso(provider.originatedReceivableInPeriod)}</td>
                  <td className="px-4 py-3 font-semibold">{peso(provider.collectedAsOf)}</td>
                  <td className="px-4 py-3 font-black">{peso(provider.outstandingAsOf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {legacyCount > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">Historical snapshot coverage</p>
          <p className="mt-1">{number(legacyCount)} historical sale line(s) or JO(s) have no required transaction-time snapshot. Their stored final revenue remains visible as legacy/unclassified; current Settings were not used to back-calculate it.</p>
        </div>
      ) : null}
    </section>
  )
}
