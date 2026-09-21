import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  History,
  Layers,
  LoaderCircle,
  Package,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  Truck,
  X,
} from "lucide-react"

import { formatSpecs } from "../../utils/attributeFilter"
import { exportReportExcel } from "../../utils/businessDocumentExport"

function peso(val) {
  return `₱${Number(val || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-PH")
}

function dateOnly(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PH")
}

function dateTime(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-PH")
}

function calculateAgingDays(dateValue) {
  if (!dateValue) return 0
  const start = new Date(dateValue).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)))
}

function formatStatus(value) {
  return String(value || "Unknown")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const SERIAL_STATUS_STYLES = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  RESERVED: "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  SOLD: "border-violet-200 bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800",
  RETURNED: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800",
  WARRANTY: "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  DAMAGED: "border-orange-200 bg-orange-50 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",
  LOST: "border-red-200 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
}

const MOVEMENT_TYPE_STYLES = {
  STOCK_IN: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300",
  INITIAL_STOCK: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300",
  SALE: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300",
  SALE_RETURN: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300",
  TRANSFER_IN: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300",
  TRANSFER_OUT: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300",
  ADJUSTMENT_IN: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300",
  ADJUSTMENT_OUT: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300",
  WARRANTY_OUT: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300",
  WARRANTY_RETURN: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300",
}

export default function InventoryReportView({
  branchId,
  selectedBranch,
  user,
  categories = [],
  getInventoryOverviewApi,
  getInventorySerialsApi,
  getInventoryMovementsApi,
  onOpenDetail,
  onOpenAdjustment,
  onAddStock,
}) {
  // 1. View Mode (VALUATION vs SERIALS vs MOVEMENTS)
  const [reportMode, setReportMode] = useState("VALUATION") // "VALUATION" | "SERIALS" | "MOVEMENTS"

  // 2. Filter States
  const [search, setSearch] = useState("")
  const [healthFilter, setHealthFilter] = useState("ALL") // "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"
  const [categoryFilter, setCategoryFilter] = useState("")
  const [brandFilter, setBrandFilter] = useState("")
  const [serializedFilter, setSerializedFilter] = useState("ALL") // "ALL" | "SERIALIZED" | "NON_SERIALIZED"
  const [valueTierFilter, setValueTierFilter] = useState("ALL") // "ALL" | "BUDGET" | "MID" | "HIGH"
  const [serialStatusFilter, setSerialStatusFilter] = useState("") // for Serials view
  const [movementTypeFilter, setMovementTypeFilter] = useState("") // for Movements view

  // 3. Raw Data Collections
  const [rawItems, setRawItems] = useState([])
  const [rawSerials, setRawSerials] = useState([])
  const [rawMovements, setRawMovements] = useState([])

  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [fetchError, setFetchError] = useState("")

  // 4. Fetch All Inventory Data (Looping pages)
  const loadReportData = useCallback(async () => {
    setIsLoading(true)
    setFetchError("")
    try {
      // 4A. Fetch Inventory Overview (Items)
      let allItems = []
      let itemPage = 1
      let itemTotalPages = 1
      do {
        const response = await getInventoryOverviewApi({
          ...(branchId ? { branchId } : {}),
          page: itemPage,
          limit: 100,
        })
        const result = response?.data || {}
        const list = Array.isArray(result.data) ? result.data : []
        allItems = allItems.concat(list)
        itemTotalPages = Math.max(1, Number(result.pagination?.totalPages || 1))
        itemPage += 1
      } while (itemPage <= itemTotalPages && itemPage <= 50)
      setRawItems(allItems)

      // 4B. Fetch Serials
      let allSerials = []
      let serialPage = 1
      let serialTotalPages = 1
      do {
        const response = await getInventorySerialsApi({
          ...(branchId ? { branchId } : {}),
          page: serialPage,
          limit: 100,
        })
        const list = Array.isArray(response?.data) ? response.data : []
        allSerials = allSerials.concat(list)
        serialTotalPages = Math.max(1, Number(response?.pagination?.totalPages || 1))
        serialPage += 1
      } while (serialPage <= serialTotalPages && serialPage <= 50)
      setRawSerials(allSerials)

      // 4C. Fetch Recent Movements
      const movementResponse = await getInventoryMovementsApi({
        ...(branchId ? { branchId } : {}),
        page: 1,
        limit: 100,
      })
      setRawMovements(Array.isArray(movementResponse?.data) ? movementResponse.data : [])
    } catch (err) {
      console.error("Failed to load inventory report data:", err)
      setFetchError(err?.message || "Failed to load inventory reports.")
    } finally {
      setIsLoading(false)
    }
  }, [branchId, getInventoryOverviewApi, getInventorySerialsApi, getInventoryMovementsApi])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  // 5. Unique Brands dynamically aggregated
  const availableBrands = useMemo(() => {
    const set = new Set()
    rawItems.forEach((it) => {
      if (it.brand && it.brand.trim()) {
        set.add(it.brand.trim())
      }
    })
    return Array.from(set).sort()
  }, [rawItems])

  // 6. Augmented Processed Items with Valuation Math
  const processedItems = useMemo(() => {
    return rawItems.map((it) => {
      const avail = Number(it.quantityAvailable || 0)
      const reserved = Number(it.quantityReserved || 0)
      const totalUnits = Number(it.totalQuantity || (avail + reserved))
      const reorder = Number(it.reorderLevel || 0)

      const costPrice = Number(it.costPrice || 0)
      const srp = Number(it.price1 || 0)
      const unitMarkup = Math.max(0, srp - costPrice)
      const markupPercent = costPrice > 0 ? (unitMarkup / costPrice) * 100 : 0

      const totalValuationCost = avail * costPrice
      const totalValuationSrp = avail * srp
      const projectedGrossProfit = totalValuationSrp - totalValuationCost

      let healthStatus = "IN_STOCK"
      let healthLabel = "In Stock"
      if (avail <= 0) {
        healthStatus = "OUT_OF_STOCK"
        healthLabel = "Out of Stock"
      } else if (reorder > 0 && avail <= reorder) {
        healthStatus = "LOW_STOCK"
        healthLabel = "Low Stock"
      }

      return {
        ...it,
        avail,
        reserved,
        totalUnits,
        reorder,
        costPrice,
        srp,
        unitMarkup,
        markupPercent,
        totalValuationCost,
        totalValuationSrp,
        projectedGrossProfit,
        healthStatus,
        healthLabel,
      }
    })
  }, [rawItems])

  // 7. Multi-Faceted Filter Pipeline for Items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()

    return processedItems.filter((it) => {
      if (healthFilter === "IN_STOCK" && it.healthStatus !== "IN_STOCK") return false
      if (healthFilter === "LOW_STOCK" && it.healthStatus !== "LOW_STOCK") return false
      if (healthFilter === "OUT_OF_STOCK" && it.healthStatus !== "OUT_OF_STOCK") return false

      if (categoryFilter) {
        const itemCatId = it.categoryId || it.category?.id
        if (itemCatId !== categoryFilter) return false
      }

      if (brandFilter) {
        if (it.brand?.toLowerCase() !== brandFilter.toLowerCase()) return false
      }

      if (serializedFilter === "SERIALIZED" && !it.isSerialized) return false
      if (serializedFilter === "NON_SERIALIZED" && it.isSerialized) return false

      if (valueTierFilter === "BUDGET" && it.srp >= 1000) return false
      if (valueTierFilter === "MID" && (it.srp < 1000 || it.srp > 10000)) return false
      if (valueTierFilter === "HIGH" && it.srp <= 10000) return false

      if (q) {
        const matches = [
          it.itemCode,
          it.itemName,
          it.brand,
          it.modelName,
          it.category?.name,
          it.categoryName,
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q))

        if (!matches) return false
      }

      return true
    })
  }, [processedItems, search, healthFilter, categoryFilter, brandFilter, serializedFilter, valueTierFilter])

  // 8. Augmented & Filtered Serials
  const filteredSerials = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rawSerials.filter((s) => {
      if (serialStatusFilter && s.status !== serialStatusFilter) return false

      if (q) {
        const matches = [
          s.serialNumber,
          s.item?.itemCode,
          s.item?.itemName,
          s.item?.brand,
          s.batch?.batchCode,
          s.remarks,
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q))

        if (!matches) return false
      }

      return true
    })
  }, [rawSerials, search, serialStatusFilter])

  // 9. Augmented & Filtered Movements
  const filteredMovements = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rawMovements.filter((m) => {
      if (movementTypeFilter && m.type !== movementTypeFilter) return false

      if (q) {
        const matches = [
          m.movementCode,
          m.referenceNo,
          m.item?.itemCode,
          m.item?.itemName,
          m.serial?.serialNumber,
          m.remarks,
          m.createdBy?.fullName,
          m.createdBy?.username,
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q))

        if (!matches) return false
      }

      return true
    })
  }, [rawMovements, search, movementTypeFilter])

  // 10. Executive Financial & Operational KPIs (POS Cashiering Standard)
  const kpis = useMemo(() => {
    let totalCostValuation = 0
    let totalSrpValuation = 0
    let totalUnitsAvailable = 0
    let inStockCount = 0
    let lowStockCount = 0
    let outOfStockCount = 0
    let serializedItemCount = 0

    filteredItems.forEach((it) => {
      totalCostValuation += it.totalValuationCost
      totalSrpValuation += it.totalValuationSrp
      totalUnitsAvailable += it.avail

      if (it.healthStatus === "IN_STOCK") inStockCount += 1
      if (it.healthStatus === "LOW_STOCK") lowStockCount += 1
      if (it.healthStatus === "OUT_OF_STOCK") outOfStockCount += 1
      if (it.isSerialized) serializedItemCount += 1
    })

    const projectedProfit = totalSrpValuation - totalCostValuation
    const profitMargin = totalCostValuation > 0 ? (projectedProfit / totalCostValuation) * 100 : 0

    // Serial units breakdown
    let serialsAvailable = 0
    let serialsSold = 0
    let serialsWarranty = 0
    let serialsDamagedOrLost = 0

    rawSerials.forEach((s) => {
      if (s.status === "AVAILABLE") serialsAvailable += 1
      if (s.status === "SOLD") serialsSold += 1
      if (s.status === "WARRANTY") serialsWarranty += 1
      if (s.status === "DAMAGED" || s.status === "LOST") serialsDamagedOrLost += 1
    })

    return {
      totalSkus: filteredItems.length,
      totalUnitsAvailable,
      totalCostValuation,
      totalSrpValuation,
      projectedProfit,
      profitMargin,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      serializedItemCount,
      totalSerialsCount: rawSerials.length,
      serialsAvailable,
      serialsSold,
      serialsWarranty,
      serialsDamagedOrLost,
    }
  }, [filteredItems, rawSerials])

  // 11. Multi-Level Enterprise Excel Exporters
  const handleExportValuationExcel = () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        ["Search Query", search.trim() || "All Products"],
        ["Stock Health", healthFilter !== "ALL" ? healthFilter : "All Stock States"],
        ["Category", categories.find((c) => c.id === categoryFilter)?.name || "All Categories"],
        ["Brand", brandFilter || "All Brands"],
        ["Serialized", serializedFilter !== "ALL" ? serializedFilter : "All"],
        ["Branch", selectedBranch?.name || "All Branches"],
      ]

      const valuationTotals = [
        ["Total Active SKUs", kpis.totalSkus],
        ["Total Units Available", kpis.totalUnitsAvailable],
        ["Total Asset Valuation at Cost (Puhunan)", kpis.totalCostValuation],
        ["Total Asset Valuation at SRP (Retail)", kpis.totalSrpValuation],
        ["Projected Gross Margin (Tubo)", kpis.projectedProfit],
        ["Projected Profit Margin (%)", `${kpis.profitMargin.toFixed(1)}%`],
        ["Low-Stock Alerts", kpis.lowStockCount],
        ["Out-of-Stock SKUs", kpis.outOfStockCount],
      ]

      const columns = [
        ["Item Code", (row) => row.itemCode || "—"],
        ["Item Name", (row) => row.itemName || "—"],
        ["Brand", (row) => row.brand || "—"],
        ["Model", (row) => row.modelName || "—"],
        ["Category", (row) => row.category?.name || row.categoryName || "—"],
        ["Unit", (row) => row.unit || row.unitName || "PCS"],
        ["Specifications", (row) => formatSpecs(row.attributes)],
        ["Serialized Tracking", (row) => (row.isSerialized ? "YES" : "NO")],
        ["Available On-Hand", (row) => Number(row.avail || 0)],
        ["Reserved Stock", (row) => Number(row.reserved || 0)],
        ["Reorder Threshold", (row) => Number(row.reorder || 0)],
        ["Stock Health Status", (row) => row.healthLabel],
        ["Unit Cost (Puhunan ₱)", (row) => Number(row.costPrice || 0)],
        ["Selling Price / SRP (₱)", (row) => Number(row.srp || 0)],
        ["Unit Profit Markup (₱)", (row) => Number(row.unitMarkup || 0)],
        ["Markup Percentage (%)", (row) => `${row.markupPercent.toFixed(1)}%`],
        ["Total Valuation at Cost (₱)", (row) => Number(row.totalValuationCost || 0)],
        ["Total Valuation at SRP (₱)", (row) => Number(row.totalValuationSrp || 0)],
        ["Projected Gross Profit (₱)", (row) => Number(row.projectedGrossProfit || 0)],
      ]

      exportReportExcel({
        title: `INVENTORY ASSET VALUATION & STOCK LEDGER REPORT (${selectedBranch?.name || "ALL BRANCHES"})`,
        filename: `Inventory-Valuation-${new Date().toISOString().slice(0, 10)}`,
        columns,
        records: filteredItems,
        branch: selectedBranch,
        generatedBy: user,
        filters: activeFilters,
        totals: valuationTotals,
      })
    } catch (err) {
      console.error("Export inventory valuation excel failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportSerialsExcel = () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        ["Search Query", search.trim() || "All Serials"],
        ["Serial Status", serialStatusFilter ? formatStatus(serialStatusFilter) : "All Statuses"],
        ["Total Exploded Serials", filteredSerials.length],
        ["Branch", selectedBranch?.name || "All Branches"],
      ]

      const serialTotals = [
        ["Total Tracked Serials", filteredSerials.length],
        ["Available on Shelf", kpis.serialsAvailable],
        ["Sold in POS", kpis.serialsSold],
        ["Under Warranty / RMA", kpis.serialsWarranty],
        ["Damaged / Lost", kpis.serialsDamagedOrLost],
      ]

      const columns = [
        ["Serial Number", (row) => row.serialNumber || "—"],
        ["Item Code", (row) => row.item?.itemCode || "—"],
        ["Item Name", (row) => row.item?.itemName || "—"],
        ["Brand", (row) => row.item?.brand || "—"],
        ["Model", (row) => row.item?.modelName || "—"],
        ["Batch Number", (row) => row.batch?.batchCode || "—"],
        ["Unit Acquisition Cost (₱)", (row) => Number(row.batch?.costPrice || 0)],
        ["Lifecycle Status", (row) => formatStatus(row.status)],
        ["Branch Location", (row) => row.branch?.name || "—"],
        ["Registered Date", (row) => dateOnly(row.createdAt)],
        ["Days in Inventory", (row) => calculateAgingDays(row.createdAt)],
        ["Remarks / Condition", (row) => row.remarks || "—"],
      ]

      exportReportExcel({
        title: `SERIALIZED HARDWARE LIFECYCLE AUDIT REPORT (${selectedBranch?.name || "ALL BRANCHES"})`,
        filename: `Serialized-Hardware-Audit-${new Date().toISOString().slice(0, 10)}`,
        columns,
        records: filteredSerials,
        branch: selectedBranch,
        generatedBy: user,
        filters: activeFilters,
        totals: serialTotals,
      })
    } catch (err) {
      console.error("Export serials excel failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportMovementsExcel = () => {
    setIsExporting(true)
    try {
      const activeFilters = [
        ["Search Query", search.trim() || "All Movements"],
        ["Movement Type", movementTypeFilter || "All Types"],
        ["Total Audit Records", filteredMovements.length],
        ["Branch", selectedBranch?.name || "All Branches"],
      ]

      const columns = [
        ["Movement Code", (row) => row.movementCode || "—"],
        ["Date & Time", (row) => dateTime(row.movementDate || row.createdAt)],
        ["Movement Type", (row) => row.type || "—"],
        ["Item Code", (row) => row.item?.itemCode || "—"],
        ["Item Name", (row) => row.item?.itemName || "—"],
        ["Serial Number", (row) => row.serial?.serialNumber || "—"],
        ["Quantity Moved", (row) => Number(row.quantity || 0)],
        ["Unit Cost (₱)", (row) => Number(row.unitCost || 0)],
        ["Total Value (₱)", (row) => Number(row.quantity || 0) * Number(row.unitCost || 0)],
        ["Previous Qty", (row) => Number(row.previousQuantity || 0)],
        ["New Qty", (row) => Number(row.newQuantity || 0)],
        ["Reference No.", (row) => row.referenceNo || "—"],
        ["Handled By", (row) => row.createdBy?.fullName || row.createdBy?.username || "—"],
        ["Remarks / Notes", (row) => row.remarks || "—"],
      ]

      exportReportExcel({
        title: `STOCK MOVEMENT & TRANSACTION AUDIT JOURNAL (${selectedBranch?.name || "ALL BRANCHES"})`,
        filename: `Stock-Movements-Journal-${new Date().toISOString().slice(0, 10)}`,
        columns,
        records: filteredMovements,
        branch: selectedBranch,
        generatedBy: user,
        filters: activeFilters,
        totals: [["Total Movement Records Exported", filteredMovements.length]],
      })
    } catch (err) {
      console.error("Export movements excel failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. EXECUTIVE FINANCIAL & OPERATIONAL KPI CARDS (POS Cashiering Standard) */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Card 1: Asset Valuation at Cost (Puhunan) */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Capital Valuation
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-[var(--color-maroon)]/10 text-[var(--color-maroon)]">
              <Boxes size={18} />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-[var(--color-text-strong)]">
            {peso(kpis.totalCostValuation)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)] font-medium">
            Cash capital tied up (Puhunan)
          </p>
        </div>

        {/* Card 2: Asset Valuation at SRP (Retail Potential) */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Retail Valuation
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Tag size={18} />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {peso(kpis.totalSrpValuation)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)] font-medium">
            Total potential revenue at SRP
          </p>
        </div>

        {/* Card 3: Projected Gross Margin / Profit (Tubo) */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Potential Margin
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-sky-600 dark:text-sky-400">
            {peso(kpis.projectedProfit)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-muted)] font-medium">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">+{kpis.profitMargin.toFixed(1)}%</span>
            <span>projected markup</span>
          </div>
        </div>

        {/* Card 4: Physical Unit Volume */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Stock Density
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-300">
              <Package size={18} />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-[var(--color-text-strong)]">
            {formatNumber(kpis.totalUnitsAvailable)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)] font-medium">
            Units across {kpis.totalSkus} active SKUs
          </p>
        </div>

        {/* Card 5: Stock Health Alerts */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Stock Health
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
              {kpis.lowStockCount}
            </p>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">low-stock</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-muted)] font-medium">
            <span className="font-semibold text-rose-600 dark:text-rose-400">{kpis.outOfStockCount} zero stock</span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400">{kpis.inStockCount} okay</span>
          </div>
        </div>

        {/* Card 6: Serialized Hardware Overview */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              Serial Tracking
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <ShieldCheck size={18} />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-violet-600 dark:text-violet-400">
            {formatNumber(kpis.totalSerialsCount)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-muted)] font-medium">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{kpis.serialsAvailable} on shelf</span>
            <span>•</span>
            <span>{kpis.serialsSold} sold</span>
          </div>
        </div>
      </div>

      {/* 2. ADVANCED MULTI-DIMENSIONAL FILTER SUITE */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4.5 shadow-card space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3.5 top-3 text-[var(--color-muted)]" size={16} />
            <input
              type="text"
              placeholder="Search Code, Name, Brand, Model, Serial #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] py-2.5 pl-10 pr-3.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] placeholder:font-normal placeholder:text-[var(--color-muted)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-[var(--color-muted)] hover:text-[var(--color-text-strong)] cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Stock Health Filter */}
          <div>
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 py-2.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="ALL">All Stock States</option>
              <option value="IN_STOCK">✅ In Stock (&gt; Reorder)</option>
              <option value="LOW_STOCK">⚠️ Low Stock (&lt;= Reorder)</option>
              <option value="OUT_OF_STOCK">🚫 Out of Stock (0 Qty)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 py-2.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="">All Categories ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 py-2.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="">All Brands ({availableBrands.length})</option>
              {availableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Serialized Filter */}
          <div>
            <select
              value={serializedFilter}
              onChange={(e) => setSerializedFilter(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 py-2.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="ALL">All Item Types</option>
              <option value="SERIALIZED">Serialized Hardware</option>
              <option value="NON_SERIALIZED">Non-Serialized Consumables</option>
            </select>
          </div>
        </div>

        {/* Secondary Row for Specific Modes (Serials / Movements) */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-t border-[var(--color-border)] pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            {reportMode === "SERIALS" && (
              <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted)]">
                Serial Status:
                <select
                  value={serialStatusFilter}
                  onChange={(e) => setSerialStatusFilter(e.target.value)}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                >
                  <option value="">All Serial Statuses</option>
                  <option value="AVAILABLE">AVAILABLE (On Shelf)</option>
                  <option value="SOLD">SOLD (Via POS)</option>
                  <option value="WARRANTY">WARRANTY (Under RMA)</option>
                  <option value="RESERVED">RESERVED</option>
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="LOST">LOST</option>
                  <option value="RETURNED">RETURNED</option>
                </select>
              </label>
            )}

            {reportMode === "MOVEMENTS" && (
              <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted)]">
                Movement Type:
                <select
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                >
                  <option value="">All Movement Types</option>
                  <option value="STOCK_IN">STOCK IN (Receiving)</option>
                  <option value="SALE">SALE (POS Cashiering)</option>
                  <option value="TRANSFER_IN">TRANSFER IN</option>
                  <option value="TRANSFER_OUT">TRANSFER OUT</option>
                  <option value="ADJUSTMENT_IN">ADJUSTMENT IN (+)</option>
                  <option value="ADJUSTMENT_OUT">ADJUSTMENT OUT (-)</option>
                  <option value="WARRANTY_OUT">WARRANTY OUT (Swap)</option>
                  <option value="WARRANTY_RETURN">WARRANTY RETURN</option>
                </select>
              </label>
            )}

            {reportMode === "VALUATION" && (
              <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted)]">
                Value Tier:
                <select
                  value={valueTierFilter}
                  onChange={(e) => setValueTierFilter(e.target.value)}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                >
                  <option value="ALL">All Valuation Tiers</option>
                  <option value="BUDGET">Budget (&lt; ₱1,000)</option>
                  <option value="MID">Mid-Range (₱1,000 – ₱10,000)</option>
                  <option value="HIGH">High-Value Assets (&gt; ₱10,000)</option>
                </select>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={loadReportData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-text-strong)] shadow-xs transition hover:bg-[var(--color-soft)] cursor-pointer"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={13} />
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>

            {(search || healthFilter !== "ALL" || categoryFilter || brandFilter || serializedFilter !== "ALL" || valueTierFilter !== "ALL" || serialStatusFilter || movementTypeFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  setHealthFilter("ALL")
                  setCategoryFilter("")
                  setBrandFilter("")
                  setSerializedFilter("ALL")
                  setValueTierFilter("ALL")
                  setSerialStatusFilter("")
                  setMovementTypeFilter("")
                }}
                className="text-xs font-bold text-[var(--color-maroon)] hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. TRIPLE TABLE VIEW MODE SWITCHER & EXPORT BUTTON */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)]/50 p-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setReportMode("VALUATION")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition cursor-pointer whitespace-nowrap ${
              reportMode === "VALUATION"
                ? "bg-[var(--color-card)] text-[var(--color-text-strong)] shadow-xs"
                : "text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
            }`}
          >
            <Boxes size={15} />
            Stock Valuation Ledger ({filteredItems.length})
          </button>
          <button
            type="button"
            onClick={() => setReportMode("SERIALS")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition cursor-pointer whitespace-nowrap ${
              reportMode === "SERIALS"
                ? "bg-[var(--color-card)] text-violet-700 dark:text-violet-300 shadow-xs"
                : "text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
            }`}
          >
            <ShieldCheck size={15} />
            Serialized Hardware Audit ({filteredSerials.length})
          </button>
          <button
            type="button"
            onClick={() => setReportMode("MOVEMENTS")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition cursor-pointer whitespace-nowrap ${
              reportMode === "MOVEMENTS"
                ? "bg-[var(--color-card)] text-sky-700 dark:text-sky-300 shadow-xs"
                : "text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
            }`}
          >
            <History size={15} />
            Stock Movements Journal ({filteredMovements.length})
          </button>
        </div>

        {/* Excel Export Button */}
        <div>
          {reportMode === "VALUATION" && (
            <button
              type="button"
              disabled={isExporting || filteredItems.length === 0}
              onClick={handleExportValuationExcel}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-2.5 text-xs font-black text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-600/20 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              {isExporting ? "Exporting Excel..." : "Export Stock Valuation (.xlsx)"}
            </button>
          )}

          {reportMode === "SERIALS" && (
            <button
              type="button"
              disabled={isExporting || filteredSerials.length === 0}
              onClick={handleExportSerialsExcel}
              className="inline-flex items-center gap-2 rounded-2xl border border-violet-600/30 bg-violet-600/10 px-4 py-2.5 text-xs font-black text-violet-700 dark:text-violet-300 transition hover:bg-violet-600/20 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              {isExporting ? "Exporting Excel..." : "Export Serialized Audit (.xlsx)"}
            </button>
          )}

          {reportMode === "MOVEMENTS" && (
            <button
              type="button"
              disabled={isExporting || filteredMovements.length === 0}
              onClick={handleExportMovementsExcel}
              className="inline-flex items-center gap-2 rounded-2xl border border-sky-600/30 bg-sky-600/10 px-4 py-2.5 text-xs font-black text-sky-700 dark:text-sky-300 transition hover:bg-sky-600/20 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              {isExporting ? "Exporting Excel..." : "Export Movement Journal (.xlsx)"}
            </button>
          )}
        </div>
      </div>

      {/* 4. ERROR NOTICE */}
      {fetchError && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <AlertCircle className="mt-0.5 shrink-0" size={15} />
          <span>{fetchError}</span>
        </div>
      )}

      {/* 5. DATA GRIDS */}
      {isLoading ? (
        <div className="grid h-64 place-items-center rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-card">
          <div className="flex flex-col items-center gap-3 text-[var(--color-muted)]">
            <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={32} />
            <p className="text-xs font-bold">Aggregating inventory valuation and serial tracking data...</p>
          </div>
        </div>
      ) : reportMode === "VALUATION" ? (
        /* MODE 1: STOCK VALUATION & SKU LEDGER */
        <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left text-xs text-[var(--color-text)]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-soft)]/50 text-[11px] font-black uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-4 py-3.5">Product &amp; Code</th>
                  <th className="px-4 py-3.5">Category &amp; Specs</th>
                  <th className="px-4 py-3.5">Stock Level</th>
                  <th className="px-4 py-3.5">Stock Health</th>
                  <th className="px-4 py-3.5 text-right">Unit Cost (₱)</th>
                  <th className="px-4 py-3.5 text-right">Retail SRP (₱)</th>
                  <th className="px-4 py-3.5 text-right">Profit Markup (₱)</th>
                  <th className="px-4 py-3.5 text-right">Cost Valuation (₱)</th>
                  <th className="px-4 py-3.5 text-right">SRP Valuation (₱)</th>
                  <th className="px-4 py-3.5 text-right">Projected Profit (₱)</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-xs font-semibold text-[var(--color-muted)]">
                      No inventory items found matching active criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((it) => (
                    <tr key={it.id} className="transition hover:bg-[var(--color-soft)]/30">
                      {/* Product & Code */}
                      <td className="px-4 py-3.5 align-top max-w-[220px]">
                        <span className="font-bold text-[var(--color-text-strong)] line-clamp-2 block leading-snug">
                          {it.itemName}
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-black text-[var(--color-maroon)]">
                            {it.itemCode}
                          </span>
                          {it.isSerialized && (
                            <span className="rounded bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.2 text-[9px] font-black text-violet-800 dark:text-violet-300">
                              SERIALIZED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category & Specs */}
                      <td className="px-4 py-3.5 align-top max-w-[200px]">
                        <span className="font-bold text-[var(--color-text-strong)] block">
                          {it.category?.name || it.categoryName || "Uncategorized"}
                        </span>
                        <p className="text-[10px] text-[var(--color-muted)] line-clamp-2 mt-0.5">
                          {formatSpecs(it.attributes)}
                        </p>
                      </td>

                      {/* Stock Level */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-black text-[var(--color-text-strong)]">
                            {formatNumber(it.avail)} {it.unit || "PCS"}
                          </span>
                          {it.reserved > 0 && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                              {formatNumber(it.reserved)} reserved
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock Health Badge */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        {it.healthStatus === "OUT_OF_STOCK" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
                            Out of Stock
                          </span>
                        )}
                        {it.healthStatus === "LOW_STOCK" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                            Low Stock (&le;{it.reorder})
                          </span>
                        )}
                        {it.healthStatus === "IN_STOCK" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                            Stock OK
                          </span>
                        )}
                      </td>

                      {/* Unit Cost */}
                      <td className="px-4 py-3.5 align-top text-right font-mono font-semibold text-[var(--color-text-strong)] whitespace-nowrap">
                        {peso(it.costPrice)}
                      </td>

                      {/* Retail SRP */}
                      <td className="px-4 py-3.5 align-top text-right font-mono font-bold text-[var(--color-text-strong)] whitespace-nowrap">
                        {peso(it.srp)}
                      </td>

                      {/* Profit Markup */}
                      <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                        <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 block">
                          +{peso(it.unitMarkup)}
                        </span>
                        <span className="text-[10px] text-[var(--color-muted)] font-semibold block">
                          +{it.markupPercent.toFixed(1)}%
                        </span>
                      </td>

                      {/* Total Cost Valuation */}
                      <td className="px-4 py-3.5 align-top text-right font-mono font-bold text-[var(--color-text-strong)] whitespace-nowrap">
                        {peso(it.totalValuationCost)}
                      </td>

                      {/* Total SRP Valuation */}
                      <td className="px-4 py-3.5 align-top text-right font-mono font-black text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                        {peso(it.totalValuationSrp)}
                      </td>

                      {/* Projected Gross Profit */}
                      <td className="px-4 py-3.5 align-top text-right font-mono font-black text-sky-600 dark:text-sky-400 whitespace-nowrap">
                        {peso(it.projectedGrossProfit)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="View Batches & Serials Dossier"
                            onClick={() => onOpenDetail?.(it)}
                            className="inline-flex size-7.5 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] cursor-pointer"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            title="Stock Adjustment"
                            onClick={() => onOpenAdjustment?.(it)}
                            className="inline-flex size-7.5 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 transition hover:bg-amber-500/20 cursor-pointer"
                          >
                            <SlidersHorizontal size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : reportMode === "SERIALS" ? (
        /* MODE 2: SERIALIZED HARDWARE LIFECYCLE AUDIT */
        <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs text-[var(--color-text)]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-violet-500/10 text-[11px] font-black uppercase tracking-wider text-violet-900 dark:text-violet-200">
                  <th className="px-4 py-3.5">Serial Number</th>
                  <th className="px-4 py-3.5">Product &amp; SKU</th>
                  <th className="px-4 py-3.5">Brand &amp; Category</th>
                  <th className="px-4 py-3.5">Batch &amp; Unit Cost</th>
                  <th className="px-4 py-3.5">Current Status</th>
                  <th className="px-4 py-3.5">Associated Document</th>
                  <th className="px-4 py-3.5">Inventory Aging</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredSerials.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs font-semibold text-[var(--color-muted)]">
                      No serialized hardware units found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSerials.map((s) => {
                    const agingDays = calculateAgingDays(s.createdAt)
                    const saleReceipt = s.saleItem?.sale?.receiptCode
                    const warrantyClaim = s.warrantyClaims?.[0]?.claimCode
                    const transferRef = s.stockTransferSerials?.[0]?.stockTransferItem?.stockTransfer?.transferCode

                    return (
                      <tr key={s.id} className="transition hover:bg-[var(--color-soft)]/30">
                        {/* Serial Number */}
                        <td className="px-4 py-3.5 align-top">
                          <span className="font-mono text-xs font-black text-[var(--color-text-strong)] block">
                            {s.serialNumber}
                          </span>
                          <span className="text-[10px] text-[var(--color-muted)] block mt-0.5">
                            Added: {dateOnly(s.createdAt)}
                          </span>
                        </td>

                        {/* Product & SKU */}
                        <td className="px-4 py-3.5 align-top max-w-[220px]">
                          <span className="font-bold text-[var(--color-text-strong)] line-clamp-2 block leading-snug">
                            {s.item?.itemName || "Unlinked Item"}
                          </span>
                          <span className="font-mono text-[10px] font-black text-[var(--color-maroon)] block mt-0.5">
                            {s.item?.itemCode || "—"}
                          </span>
                        </td>

                        {/* Brand & Category */}
                        <td className="px-4 py-3.5 align-top">
                          <span className="font-bold text-[var(--color-text-strong)] block">
                            {s.item?.brand || "—"}
                          </span>
                          <span className="text-[10px] text-[var(--color-muted)] block">
                            {s.item?.modelName || "—"}
                          </span>
                        </td>

                        {/* Batch & Unit Cost */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <span className="font-mono text-[11px] font-bold text-[var(--color-text-strong)] block">
                            {s.batch?.batchCode || "No Batch"}
                          </span>
                          {s.batch?.costPrice && (
                            <span className="font-mono text-[10px] text-[var(--color-muted)] block">
                              Cost: {peso(s.batch.costPrice)}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                              SERIAL_STATUS_STYLES[s.status] || "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {formatStatus(s.status)}
                          </span>
                        </td>

                        {/* Associated Document */}
                        <td className="px-4 py-3.5 align-top max-w-[180px]">
                          {saleReceipt ? (
                            <span className="inline-flex items-center gap-1 rounded bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-800 dark:text-violet-300">
                              Sold: {saleReceipt}
                            </span>
                          ) : warrantyClaim ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800 dark:text-amber-300">
                              RMA: {warrantyClaim}
                            </span>
                          ) : transferRef ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-800 dark:text-blue-300">
                              Transfer: {transferRef}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--color-muted)] italic">—</span>
                          )}
                        </td>

                        {/* Inventory Aging */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <span
                            className={`font-mono text-xs font-black ${
                              agingDays > 60
                                ? "text-rose-600 dark:text-rose-400"
                                : agingDays > 30
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-[var(--color-text-strong)]"
                            }`}
                          >
                            {agingDays} days
                          </span>
                          {agingDays > 60 && (
                            <span className="block text-[9px] font-bold text-rose-600 dark:text-rose-400">
                              SLOW-MOVING
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                          <button
                            type="button"
                            title="View Item Dossier"
                            onClick={() => s.item && onOpenDetail?.(s.item)}
                            className="inline-flex size-7.5 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] cursor-pointer"
                          >
                            <Eye size={13} />
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
      ) : (
        /* MODE 3: STOCK MOVEMENTS JOURNAL */
        <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs text-[var(--color-text)]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-sky-500/10 text-[11px] font-black uppercase tracking-wider text-sky-900 dark:text-sky-200">
                  <th className="px-4 py-3.5">Movement Ref &amp; Date</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Product &amp; Code</th>
                  <th className="px-4 py-3.5">Serial Number</th>
                  <th className="px-4 py-3.5 text-right">Quantity</th>
                  <th className="px-4 py-3.5 text-right">Unit Cost (₱)</th>
                  <th className="px-4 py-3.5 text-right">Movement Value (₱)</th>
                  <th className="px-4 py-3.5">Doc Reference</th>
                  <th className="px-4 py-3.5">Processed By</th>
                  <th className="px-4 py-3.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs font-semibold text-[var(--color-muted)]">
                      No stock movement records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const movementValue = Number(m.quantity || 0) * Number(m.unitCost || 0)

                    return (
                      <tr key={m.id} className="transition hover:bg-[var(--color-soft)]/30">
                        {/* Ref & Date */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <span className="font-mono text-xs font-black text-[var(--color-maroon)] block">
                            {m.movementCode || "—"}
                          </span>
                          <span className="text-[10px] text-[var(--color-muted)] block mt-0.5">
                            {dateTime(m.movementDate || m.createdAt)}
                          </span>
                        </td>

                        {/* Movement Type */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                              MOVEMENT_TYPE_STYLES[m.type] || "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>

                        {/* Product */}
                        <td className="px-4 py-3.5 align-top max-w-[200px]">
                          <span className="font-bold text-[var(--color-text-strong)] line-clamp-2 block leading-snug">
                            {m.item?.itemName || "Unlinked Item"}
                          </span>
                          <span className="font-mono text-[10px] font-black text-[var(--color-muted)] block mt-0.5">
                            {m.item?.itemCode || "—"}
                          </span>
                        </td>

                        {/* Serial */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          {m.serial?.serialNumber ? (
                            <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {m.serial.serialNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--color-muted)] italic">—</span>
                          )}
                        </td>

                        {/* Qty */}
                        <td className="px-4 py-3.5 align-top text-right font-mono font-black text-xs text-[var(--color-text-strong)] whitespace-nowrap">
                          {formatNumber(m.quantity)}
                        </td>

                        {/* Unit Cost */}
                        <td className="px-4 py-3.5 align-top text-right font-mono font-semibold text-[var(--color-text-strong)] whitespace-nowrap">
                          {peso(m.unitCost)}
                        </td>

                        {/* Total Movement Value */}
                        <td className="px-4 py-3.5 align-top text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                          {peso(movementValue)}
                        </td>

                        {/* Doc Ref */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          {m.referenceNo ? (
                            <span className="font-mono text-[11px] font-bold text-[var(--color-text-strong)]">
                              {m.referenceNo}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--color-muted)] italic">—</span>
                          )}
                        </td>

                        {/* Processed By */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <span className="font-semibold text-xs text-[var(--color-text-strong)] block">
                            {m.createdBy?.fullName || m.createdBy?.username || "System"}
                          </span>
                          <span className="text-[10px] text-[var(--color-muted)] block">
                            {m.createdBy?.role || ""}
                          </span>
                        </td>

                        {/* Remarks */}
                        <td className="px-4 py-3.5 align-top max-w-[180px]">
                          <p className="text-[11px] text-[var(--color-muted)] line-clamp-2">
                            {m.remarks || "—"}
                          </p>
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
    </div>
  )
}
