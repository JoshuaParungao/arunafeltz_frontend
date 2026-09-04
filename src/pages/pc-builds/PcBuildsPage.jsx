import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Award,
  Box,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cpu,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  HardDrive,
  Layers,
  LoaderCircle,
  Monitor,
  Package,
  Phone,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Tag,
  User,
  UsersRound,
  Wrench,
  X,
  Zap,
} from "lucide-react"

import apiClient from "../../lib/apiClient"
import SaleReceiptModal from "../../components/sales/SaleReceiptModal"

const COMPONENT_CATEGORIES = [
  {
    key: "cpu",
    label: "Processor / CPU",
    icon: Cpu,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    keywords: ["ryzen", "core i3", "core i5", "core i7", "core i9", "processor", "cpu", "intel", "amd ryzen", "athlon"],
  },
  {
    key: "motherboard",
    label: "Motherboard",
    icon: Layers,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    keywords: ["motherboard", "mobo", "b450", "b550", "b650", "a320", "a520", "h510", "h610", "b760", "z790", "x670", "mainboard", "gigabyte", "asrock", "msi", "asus"],
  },
  {
    key: "ram",
    label: "Memory / RAM",
    icon: Zap,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    keywords: ["ram", "memory", "ddr4", "ddr5", "dimm", "8gb", "16gb", "32gb", "fury", "t-force", "team elite", "corsair", "g.skill"],
  },
  {
    key: "gpu",
    label: "Graphics Card / GPU",
    icon: Flame,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    keywords: ["gtx", "rtx", "radeon", "gpu", "graphics", "video card", "rx 580", "rx 6600", "rx 7600", "geforce", "4060", "4070", "3060", "3050", "1650"],
  },
  {
    key: "storage",
    label: "Storage (SSD / NVMe / HDD)",
    icon: HardDrive,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    keywords: ["ssd", "nvme", "m.2", "sata", "hdd", "hard drive", "240gb", "256gb", "500gb", "512gb", "1tb", "2tb", "kingston", "crucial", "western digital", "seagate"],
  },
  {
    key: "psu",
    label: "Power Supply Unit (PSU)",
    icon: Zap,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    keywords: ["psu", "power supply", "500w", "550w", "600w", "650w", "750w", "850w", "bronze", "gold", "80+", "corsair", "seasonic", "silverstone", "darkflash", "inplay"],
  },
  {
    key: "chassis",
    label: "Case / Chassis",
    icon: Server,
    color: "text-slate-700 bg-slate-100 border-slate-300",
    keywords: ["case", "chassis", "casing", "tower", "matx", "atx", "itx", "tempered glass", "darkflash", "montech", "rakk", "inplay", "keytech"],
  },
  {
    key: "cooling",
    label: "Cooling & Fans",
    icon: Box,
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
    keywords: ["cooler", "fan", "aio", "liquid cooling", "rgb fan", "heatsink", "thermal", "deepcool", "id-cooling", "thermalright"],
  },
  {
    key: "peripherals",
    label: "Peripherals & Accessories",
    icon: Monitor,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    keywords: ["monitor", "keyboard", "mouse", "headset", "mousepad", "speaker", "webcam", "avr", "ups"],
  },
]

function categorizeItem(description = "") {
  const desc = String(description).toLowerCase()
  for (const cat of COMPONENT_CATEGORIES) {
    if (cat.keywords.some((kw) => desc.includes(kw))) {
      return cat
    }
  }
  return {
    key: "other",
    label: "Component / Service",
    icon: Package,
    color: "text-slate-600 bg-slate-50 border-slate-200",
  }
}

function formatMoney(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value, includeTime = false) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(date)
}

function isPcBuildSale(sale) {
  const items = Array.isArray(sale.items) ? sale.items : []
  const remarks = String(sale.remarks || "").toLowerCase()
  if (remarks.includes("[pc build]") || remarks.includes("assembled by")) return true
  if (items.length >= 3) return true
  const title = String(sale.quotation?.title || "").toLowerCase()
  if (
    title.includes("build") ||
    title.includes("pc") ||
    title.includes("rig") ||
    title.includes("package") ||
    title.includes("desktop") ||
    title.includes("gaming") ||
    title.includes("system")
  ) {
    return true
  }
  const hasCoreParts = items.some((item) => {
    const desc = String(item.description || "").toLowerCase()
    return (
      desc.includes("ryzen") ||
      desc.includes("intel") ||
      desc.includes("motherboard") ||
      desc.includes("b450") ||
      desc.includes("b550") ||
      desc.includes("gtx") ||
      desc.includes("rtx")
    )
  })
  return hasCoreParts && items.length >= 2
}

export function getBuilderName(sale) {
  if (sale?.quotation?.serviceDoneBy?.fullName) {
    return sale.quotation.serviceDoneBy.fullName
  }
  const remarks = String(sale?.remarks || "")
  const match = remarks.match(/Assembled by:\s*([^|\]\n]+)/i) || remarks.match(/Done by:\s*([^|\]\n]+)/i)
  if (match && match[1]) {
    return match[1].trim()
  }
  return null
}

export default function PcBuildsPage({ selectedBranch, user }) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const [sales, setSales] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [search, setSearch] = useState("")
  const [filterMode, setFilterMode] = useState("all_builds") // 'all_builds' | 'all_sales'
  const [selectedBuilderFilter, setSelectedBuilderFilter] = useState("ALL")
  const [selectedReceiptSale, setSelectedReceiptSale] = useState(null)
  const [expandedBuildIds, setExpandedBuildIds] = useState(new Set())

  const loadSales = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await apiClient.get("/sales", {
        params: {
          ...(branchId ? { branchId } : {}),
          limit: 100,
        },
      })
      const items = response?.data?.data || []
      setSales(items)
      // Automatically expand the first 5 builds for convenience
      const buildIds = items
        .filter((s) => isPcBuildSale(s))
        .slice(0, 5)
        .map((s) => s.id)
      setExpandedBuildIds(new Set(buildIds))
    } catch (error) {
      setSales([])
      setErrorMessage(
        error?.response?.data?.message || "Unable to load sales records.",
      )
    } finally {
      setIsLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  const toggleExpand = (saleId) => {
    setExpandedBuildIds((prev) => {
      const next = new Set(prev)
      if (next.has(saleId)) {
        next.delete(saleId)
      } else {
        next.add(saleId)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedBuildIds(new Set(filteredBuilds.map((s) => s.id)))
  }

  const collapseAll = () => {
    setExpandedBuildIds(new Set())
  }

  // Extract distinct builders for filter dropdown
  const uniqueBuilders = useMemo(() => {
    const set = new Set()
    for (const sale of sales) {
      const builder = getBuilderName(sale)
      if (builder) set.add(builder)
    }
    return Array.from(set).sort()
  }, [sales])

  const filteredBuilds = useMemo(() => {
    return sales.filter((sale) => {
      if (filterMode === "all_builds" && !isPcBuildSale(sale)) {
        return false
      }
      if (selectedBuilderFilter !== "ALL") {
        const builder = getBuilderName(sale)
        if (builder !== selectedBuilderFilter) return false
      }
      if (!search.trim()) return true
      const q = search.toLowerCase().trim()
      const matchesReceipt = sale.receiptCode?.toLowerCase().includes(q)
      const matchesCustomer =
        sale.customer?.fullName?.toLowerCase().includes(q) ||
        sale.customer?.companyName?.toLowerCase().includes(q)
      const matchesQuotation = sale.quotation?.quotationCode?.toLowerCase().includes(q)
      const matchesBuilder = getBuilderName(sale)?.toLowerCase().includes(q)
      const matchesItems = sale.items?.some(
        (it) =>
          it.description?.toLowerCase().includes(q) ||
          it.serial?.serialNumber?.toLowerCase().includes(q) ||
          it.warrantyDuration?.toLowerCase().includes(q),
      )
      return matchesReceipt || matchesCustomer || matchesQuotation || matchesBuilder || matchesItems
    })
  }, [sales, filterMode, selectedBuilderFilter, search])

  // Top summary KPIs
  const metrics = useMemo(() => {
    const pcSales = sales.filter((s) => isPcBuildSale(s))
    const totalBuilds = pcSales.length
    const totalBuildsRevenue = pcSales.reduce(
      (sum, s) => sum + Number(s.grandTotal || 0),
      0,
    )
    const totalPartsCount = pcSales.reduce(
      (sum, s) => sum + (Array.isArray(s.items) ? s.items.length : 0),
      0,
    )
    const totalSerializedParts = pcSales.reduce(
      (sum, s) =>
        sum +
        (Array.isArray(s.items)
          ? s.items.filter((it) => Boolean(it.serial?.serialNumber)).length
          : 0),
      0,
    )

    return {
      totalBuilds,
      totalBuildsRevenue,
      totalPartsCount,
      totalSerializedParts,
    }
  }, [sales])

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
                Operations & Assemblies
              </span>
              <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                Live Sales Feed
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Monitor size={24} className="text-[var(--color-maroon)]" />
              PC Builds & Sold Systems
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">
              Directory of all sold PC builds and desktop packages. Inspect individual component specs, review existing per-part hardware warranties & serials, and access official sales receipts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
              onClick={loadSales}
              type="button"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Total PC Builds Sold
            </span>
            <Monitor size={17} className="text-blue-600" />
          </div>
          <p className="mt-1 font-mono text-2xl font-black text-slate-900">
            {metrics.totalBuilds}
          </p>
          <p className="text-[11px] font-medium text-blue-700/80">
            Sold & assembled rigs
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              PC Builds Revenue
            </span>
            <Receipt size={17} className="text-emerald-600" />
          </div>
          <p className="mt-1 font-mono text-2xl font-black text-slate-900">
            {formatMoney(metrics.totalBuildsRevenue)}
          </p>
          <p className="text-[11px] font-medium text-emerald-700/80">
            Total sales volume
          </p>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
              Components Installed
            </span>
            <Cpu size={17} className="text-purple-600" />
          </div>
          <p className="mt-1 font-mono text-2xl font-black text-slate-900">
            {metrics.totalPartsCount}
          </p>
          <p className="text-[11px] font-medium text-purple-700/80">
            Individual hardware lines
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Serialized Hardware
            </span>
            <ShieldCheck size={17} className="text-amber-600" />
          </div>
          <p className="mt-1 font-mono text-2xl font-black text-slate-900">
            {metrics.totalSerializedParts}
          </p>
          <p className="text-[11px] font-medium text-amber-700/80">
            Tracked with S/N & warranty
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {/* Search & Filter Bar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative min-w-[240px] flex-1 sm:max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)] placeholder:text-slate-400 font-medium"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt code, customer, CPU, GPU, RAM, SSD, or serial number…"
            value={search}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
            onChange={(e) => setFilterMode(e.target.value)}
            value={filterMode}
          >
            <option value="all_builds">🖥️ PC Builds Only ({metrics.totalBuilds})</option>
            <option value="all_sales">🧾 All Sales & Orders ({sales.length})</option>
          </select>

          {uniqueBuilders.length > 0 ? (
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
              onChange={(e) => setSelectedBuilderFilter(e.target.value)}
              value={selectedBuilderFilter}
            >
              <option value="ALL">🛠️ All Assemblers ({uniqueBuilders.length})</option>
              {uniqueBuilders.map((builderName) => (
                <option key={builderName} value={builderName}>
                  🛠️ {builderName}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              onClick={expandAll}
              title="Expand All Builds"
              type="button"
            >
              Expand All
            </button>
            <button
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              onClick={collapseAll}
              title="Collapse All"
              type="button"
            >
              Collapse
            </button>
          </div>
        </div>
      </section>

      {/* Main PC Builds Feed */}
      <section className="space-y-3.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-slate-400 shadow-xs">
            <LoaderCircle size={32} className="animate-spin text-[var(--color-maroon)]" />
            <p className="mt-3 text-xs font-bold text-slate-600">
              Loading PC builds and sales feed…
            </p>
          </div>
        ) : filteredBuilds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
            <Monitor className="mx-auto text-slate-300" size={42} />
            <p className="mt-2.5 text-sm font-bold text-slate-800">
              No matching PC builds found
            </p>
            <p className="text-xs text-slate-500">
              Try adjusting your search query or check back when new system builds are sold at the POS.
            </p>
          </div>
        ) : (
          filteredBuilds.map((sale) => {
            const isExpanded = expandedBuildIds.has(sale.id)
            const items = Array.isArray(sale.items) ? sale.items : []
            const partsWithWarranty = items.filter((it) => Boolean(it.warrantyDuration))
            const builderName = getBuilderName(sale)

            return (
              <article
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition"
                key={sale.id}
              >
                {/* Build Card Header */}
                <div
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/75 px-5 py-3.5 cursor-pointer select-none"
                  onClick={() => toggleExpand(sale.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white font-black text-sm shadow-xs">
                      <Monitor size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-[var(--color-maroon)]">
                          {sale.receiptCode}
                        </span>
                        {sale.quotation?.quotationCode ? (
                          <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.2 font-mono text-[10px] font-bold text-indigo-700">
                            QT: {sale.quotation.quotationCode}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.2 text-[10px] font-bold text-emerald-700">
                          {sale.paymentStatus || "PAID"}
                        </span>
                        {builderName ? (
                          <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 flex items-center gap-1">
                            <Wrench size={10} />
                            Assembled: {builderName}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-sm font-black text-slate-900 leading-tight mt-0.5">
                        {sale.customer?.fullName || "Walk-in Customer"}
                        {sale.customer?.companyName ? (
                          <span className="text-xs font-normal text-slate-500 ml-1.5">
                            ({sale.customer.companyName})
                          </span>
                        ) : null}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Build Total
                      </span>
                      <p className="font-mono text-base font-black text-slate-900">
                        {formatMoney(sale.grandTotal)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatDate(sale.saleDate, true)}
                      </p>
                    </div>

                    <div
                      className="flex items-center gap-1.5 border-l border-slate-200 pl-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] text-white px-3 py-1.5 text-xs font-bold hover:bg-[var(--color-maroon-hover)] shadow-xs transition"
                        onClick={() => setSelectedReceiptSale(sale)}
                        title="View Official Receipt"
                        type="button"
                      >
                        <Receipt size={13} /> View Receipt
                      </button>

                      <button
                        className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition shadow-2xs"
                        onClick={() => toggleExpand(sale.id)}
                        type="button"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Build Specifications & Parts Breakdown */}
                {isExpanded ? (
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                          <Cpu size={14} className="text-[var(--color-maroon)]" />
                          Component Specifications ({items.length} Parts)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          · Cashier: {sale.cashier?.fullName || "Counter"}
                        </span>
                        {builderName ? (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Wrench size={11} />
                            Assembled by: {builderName}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <ShieldCheck size={13} />
                        <span>Existing Per-Part Hardware Warranty Tracked</span>
                      </div>
                    </div>

                    {/* Parts Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          <tr>
                            <th className="px-4 py-2.5">Category</th>
                            <th className="px-4 py-2.5">Part Model & Description</th>
                            <th className="px-4 py-2.5">Serial Number (S/N)</th>
                            <th className="px-4 py-2.5">Warranty Term (By Part)</th>
                            <th className="px-4 py-2.5 text-center">Qty</th>
                            <th className="px-4 py-2.5 text-right">Price</th>
                            <th className="px-4 py-2.5 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((line, idx) => {
                            const cat = categorizeItem(line.description)
                            const IconComponent = cat.icon

                            return (
                              <tr
                                className="hover:bg-slate-50/60 transition"
                                key={line.id || idx}
                              >
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${cat.color}`}
                                  >
                                    <IconComponent size={11} />
                                    <span>{cat.label.split(" ")[0]}</span>
                                  </span>
                                </td>

                                <td className="px-4 py-2.5">
                                  <p className="font-bold text-slate-900">
                                    {line.description}
                                  </p>
                                  {line.item?.itemCode ? (
                                    <p className="font-mono text-[10px] text-slate-400">
                                      Code: {line.item.itemCode}
                                    </p>
                                  ) : null}
                                </td>

                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  {line.serial?.serialNumber ? (
                                    <span className="inline-block rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-700">
                                      S/N: {line.serial.serialNumber}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] italic">
                                      Non-serialized
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  {line.warrantyDuration ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                      <Shield size={11} className="text-amber-600" />
                                      <span>{line.warrantyDuration}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">—</span>
                                  )}
                                </td>

                                <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-800">
                                  {Number(line.quantity || 1)}
                                </td>

                                <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                                  {formatMoney(line.unitPrice)}
                                </td>

                                <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                                  {formatMoney(line.lineTotal)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="border-t border-slate-200 bg-slate-50/80 font-bold text-xs">
                          <tr>
                            <td colSpan={6} className="px-4 py-2.5 text-right text-slate-600">
                              Build Grand Total:
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-sm font-black text-slate-900">
                              {formatMoney(sale.grandTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {sale.remarks ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-600">
                        <strong className="font-semibold text-slate-800">Build Notes: </strong>
                        {sale.remarks}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })
        )}
      </section>

      {/* POS Sale Receipt Modal */}
      {selectedReceiptSale ? (
        <SaleReceiptModal
          onClose={() => setSelectedReceiptSale(null)}
          sale={selectedReceiptSale}
          saleId={selectedReceiptSale.id}
        />
      ) : null}
    </div>
  )
}
