import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  LoaderCircle,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  PackagePlus,
  Percent,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Truck,
  X,
} from "lucide-react"

import { getPurchaseOrders } from "../../features/purchase-orders/purchaseOrders.api"
import { getPurchaseReceivings } from "../../features/purchase-receivings/purchaseReceivings.api"
import { getSuppliers } from "../../features/suppliers/suppliers.api"
import { exportReportExcel } from "../../utils/businessDocumentExport"

function money(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatNumber(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toLocaleString("en-PH") : "0"
}

function dateOnly(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-PH")
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

export default function PurchasesReportView({
  branchId,
  selectedBranch,
  user,
  initialTab = "PO_FULFILLMENT",
  onOpenPoDetail,
  onOpenReceivingDetail,
  onReceivePo,
}) {
  const [activeTab, setActiveTab] = useState(initialTab) // "PO_FULFILLMENT" | "RECEIVINGS_LOG" | "COST_VARIANCE" | "SUPPLIER_SCORECARD"
  const [timeframe, setTimeframe] = useState("THIS_MONTH")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("")
  const [poStatusFilter, setPoStatusFilter] = useState("")
  const [receivingStatusFilter, setReceivingStatusFilter] = useState("")
  const [fulfillmentFilter, setFulfillmentFilter] = useState("ALL")
  const [varianceFilter, setVarianceFilter] = useState("ALL")

  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [purchaseReceivings, setPurchaseReceivings] = useState([])
  const [suppliers, setSuppliers] = useState([])

  // Compute date range based on timeframe preset
  const effectiveDates = useMemo(() => {
    if (timeframe === "CUSTOM") {
      return { from: dateFrom, to: dateTo }
    }
    if (timeframe === "ALL_TIME") {
      return { from: "", to: "" }
    }

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    if (timeframe === "TODAY") {
      return { from: todayStr, to: todayStr }
    }

    if (timeframe === "YESTERDAY") {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const yStr = y.toISOString().slice(0, 10)
      return { from: yStr, to: yStr }
    }

    if (timeframe === "THIS_WEEK") {
      const d = new Date(now)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
      const monday = new Date(d.setDate(diff))
      return { from: monday.toISOString().slice(0, 10), to: todayStr }
    }

    if (timeframe === "THIS_MONTH") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: firstDay.toISOString().slice(0, 10), to: todayStr }
    }

    if (timeframe === "THIS_YEAR") {
      const firstDay = new Date(now.getFullYear(), 0, 1)
      return { from: firstDay.toISOString().slice(0, 10), to: todayStr }
    }

    return { from: "", to: "" }
  }, [timeframe, dateFrom, dateTo])

  // Load suppliers for dropdown
  useEffect(() => {
    let isMounted = true
    async function fetchSuppliers() {
      try {
        const res = await getSuppliers({
          ...(branchId ? { branchId } : {}),
          status: "ACTIVE",
          limit: 100,
        })
        if (isMounted) {
          setSuppliers(res?.data?.items || [])
        }
      } catch (err) {
        console.error("Failed to load suppliers:", err)
      }
    }
    fetchSuppliers()
    return () => {
      isMounted = false
    }
  }, [branchId])

  // Fetch all purchase orders and receivings in batch
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const poParams = {
        limit: 100,
        ...(branchId ? { branchId } : {}),
      }
      if (effectiveDates.from) poParams.dateFrom = effectiveDates.from
      if (effectiveDates.to) poParams.dateTo = effectiveDates.to

      const allOrders = []
      let poPage = 1
      let poTotalPages = 1

      do {
        const poRes = await getPurchaseOrders({ ...poParams, page: poPage })
        const items = poRes?.data?.items || []
        allOrders.push(...items)
        poTotalPages = Math.max(1, Number(poRes?.data?.pagination?.totalPages || 1))
        poPage += 1
      } while (poPage <= Math.min(poTotalPages, 10))

      const recParams = {
        limit: 100,
        ...(branchId ? { branchId } : {}),
      }
      if (effectiveDates.from) recParams.dateFrom = effectiveDates.from
      if (effectiveDates.to) recParams.dateTo = effectiveDates.to

      const allReceivings = []
      let recPage = 1
      let recTotalPages = 1

      do {
        const recRes = await getPurchaseReceivings({ ...recParams, page: recPage })
        const items = recRes?.data?.items || []
        allReceivings.push(...items)
        recTotalPages = Math.max(1, Number(recRes?.data?.pagination?.totalPages || 1))
        recPage += 1
      } while (recPage <= Math.min(recTotalPages, 10))

      setPurchaseOrders(allOrders)
      setPurchaseReceivings(allReceivings)
    } catch (err) {
      console.error("Failed to load purchase reports data:", err)
      setErrorMessage(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "Could not load procurement data. Please try again."
      )
    } finally {
      setIsLoading(false)
    }
  }, [branchId, effectiveDates.from, effectiveDates.to])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Processed PO fulfillment list with detailed line computations
  const processedOrders = useMemo(() => {
    return purchaseOrders.map((order) => {
      const items = Array.isArray(order.items) ? order.items : []
      const totalOrderedQty = items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      )
      const totalReceivedQty = items.reduce(
        (sum, item) => sum + Number(item.quantityReceived || 0),
        0
      )
      const fulfillmentRate =
        totalOrderedQty > 0
          ? Math.min(100, Math.round((totalReceivedQty / totalOrderedQty) * 100))
          : 0

      const poAmount = Number(order.grandTotal || order.totalAmount || 0)
      const receivedAmount = items.reduce((sum, item) => {
        const qtyReceived = Number(item.quantityReceived || 0)
        const unitCost = Number(item.unitCost || 0)
        const disc =
          Number(item.quantity || 1) > 0
            ? Number(item.discountAmount || 0) / Number(item.quantity || 1)
            : 0
        return sum + qtyReceived * Math.max(0, unitCost - disc)
      }, 0)
      const pendingAmount = Math.max(0, poAmount - receivedAmount)

      const isOverdue =
        ["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status) &&
        order.expectedDate &&
        new Date(order.expectedDate) < new Date()

      return {
        ...order,
        totalOrderedQty,
        totalReceivedQty,
        fulfillmentRate,
        poAmount,
        receivedAmount,
        pendingAmount,
        isOverdue,
        itemsCount: items.length,
      }
    })
  }, [purchaseOrders])

  // Processed Cost Variance items list
  const costVarianceItems = useMemo(() => {
    const list = []

    purchaseReceivings.forEach((receiving) => {
      if (receiving.status === "CANCELLED") return

      const items = Array.isArray(receiving.items) ? receiving.items : []
      items.forEach((item) => {
        const poItem = item.purchaseOrderItem
        const quantityReceived = Number(item.quantityReceived || 0)
        const invoicedUnitCost = Number(item.unitCost || 0)
        const agreedPoUnitCost = poItem ? Number(poItem.unitCost || 0) : null

        if (agreedPoUnitCost !== null && agreedPoUnitCost !== undefined) {
          const unitDiff = invoicedUnitCost - agreedPoUnitCost
          const totalDiff = unitDiff * quantityReceived
          const variancePct =
            agreedPoUnitCost > 0
              ? Math.round((unitDiff / agreedPoUnitCost) * 1000) / 10
              : 0

          let varianceType = "EXACT_MATCH"
          if (unitDiff > 0.01) varianceType = "PRICE_INCREASE"
          else if (unitDiff < -0.01) varianceType = "PRICE_DECREASE"

          list.push({
            id: `${receiving.id}-${item.id}`,
            receivingCode: receiving.receivingCode,
            receivingDate: receiving.receivingDate || receiving.createdAt,
            receivingStatus: receiving.status,
            supplierId: receiving.supplierId,
            supplierName:
              receiving.supplierNameSnapshot ||
              receiving.supplier?.name ||
              "Unknown Supplier",
            poCode: receiving.purchaseOrder?.poCode || "Direct Receiving",
            poId: receiving.purchaseOrderId,
            itemCode: item.item?.itemCode || "—",
            itemName: item.item?.itemName || item.description || "—",
            batchCode: item.batchCode || "—",
            quantityReceived,
            agreedPoUnitCost,
            invoicedUnitCost,
            unitDiff,
            totalDiff,
            variancePct,
            varianceType,
            invoiceNo: receiving.invoiceNo || receiving.deliveryReceiptNo || "—",
            serialsCount: Array.isArray(item.serials) ? item.serials.length : 0,
          })
        }
      })
    })

    return list
  }, [purchaseReceivings])

  // Processed Supplier Scorecard
  const supplierScorecards = useMemo(() => {
    const map = new Map()

    processedOrders.forEach((order) => {
      const name =
        order.supplierNameSnapshot || order.supplier?.name || "Direct / Other"
      const supplierId = order.supplierId || name

      if (!map.has(supplierId)) {
        map.set(supplierId, {
          supplierId,
          supplierName: name,
          supplierCode: order.supplier?.supplierCode || "—",
          totalPos: 0,
          completedPos: 0,
          partialPos: 0,
          pendingPos: 0,
          cancelledPos: 0,
          totalOrderedQty: 0,
          totalReceivedQty: 0,
          committedSpend: 0,
          receivedSpend: 0,
          netCostVariance: 0,
          receivingCount: 0,
          serialsCount: 0,
        })
      }

      const rec = map.get(supplierId)
      rec.totalPos += 1
      if (order.status === "RECEIVED") rec.completedPos += 1
      else if (order.status === "PARTIALLY_RECEIVED") rec.partialPos += 1
      else if (order.status === "ORDERED") rec.pendingPos += 1
      else if (order.status === "CANCELLED") rec.cancelledPos += 1

      rec.totalOrderedQty += order.totalOrderedQty
      rec.totalReceivedQty += order.totalReceivedQty
      rec.committedSpend += order.poAmount
      rec.receivedSpend += order.receivedAmount
    })

    // Also account for receivings and cost variances
    costVarianceItems.forEach((v) => {
      const key = v.supplierId || v.supplierName
      if (map.has(key)) {
        const rec = map.get(key)
        rec.netCostVariance += v.totalDiff
      }
    })

    purchaseReceivings.forEach((rec) => {
      if (rec.status === "CANCELLED") return
      const key = rec.supplierId || rec.supplierNameSnapshot || rec.supplier?.name
      if (key && map.has(key)) {
        const data = map.get(key)
        data.receivingCount += 1
        const items = Array.isArray(rec.items) ? rec.items : []
        items.forEach((item) => {
          if (Array.isArray(item.serials)) {
            data.serialsCount += item.serials.length
          }
        })
      }
    })

    return Array.from(map.values()).map((s) => {
      const fulfillmentRate =
        s.totalOrderedQty > 0
          ? Math.min(100, Math.round((s.totalReceivedQty / s.totalOrderedQty) * 100))
          : s.completedPos > 0
          ? 100
          : 0
      return {
        ...s,
        fulfillmentRate,
      }
    })
  }, [processedOrders, costVarianceItems, purchaseReceivings])

  // Filtered Purchase Orders
  const filteredOrders = useMemo(() => {
    return processedOrders.filter((order) => {
      const q = search.trim().toLowerCase()
      if (q) {
        const code = String(order.poCode || "").toLowerCase()
        const supplier = String(
          order.supplierNameSnapshot || order.supplier?.name || ""
        ).toLowerCase()
        const notes = String(order.notes || "").toLowerCase()
        const itemsMatch = (order.items || []).some((it) =>
          String(it.description || it.item?.itemName || "")
            .toLowerCase()
            .includes(q)
        )
        if (
          !code.includes(q) &&
          !supplier.includes(q) &&
          !notes.includes(q) &&
          !itemsMatch
        ) {
          return false
        }
      }

      if (supplierFilter && order.supplierId !== supplierFilter) {
        return false
      }

      if (poStatusFilter && order.status !== poStatusFilter) {
        return false
      }

      if (fulfillmentFilter === "FULLY_FULFILLED" && order.fulfillmentRate < 100) {
        return false
      }
      if (
        fulfillmentFilter === "PARTIAL_BACKLOG" &&
        (order.fulfillmentRate === 0 || order.fulfillmentRate >= 100)
      ) {
        return false
      }
      if (fulfillmentFilter === "ZERO_DELIVERIES" && order.fulfillmentRate > 0) {
        return false
      }
      if (fulfillmentFilter === "OVERDUE" && !order.isOverdue) {
        return false
      }

      return true
    })
  }, [processedOrders, search, supplierFilter, poStatusFilter, fulfillmentFilter])

  // Filtered Receivings
  const filteredReceivings = useMemo(() => {
    return purchaseReceivings.filter((rec) => {
      const q = search.trim().toLowerCase()
      if (q) {
        const code = String(rec.receivingCode || "").toLowerCase()
        const poCode = String(rec.purchaseOrder?.poCode || "").toLowerCase()
        const supplier = String(
          rec.supplierNameSnapshot || rec.supplier?.name || ""
        ).toLowerCase()
        const inv = String(
          rec.invoiceNo || rec.deliveryReceiptNo || ""
        ).toLowerCase()
        const serialsMatch = (rec.items || []).some((it) =>
          (it.serials || []).some((s) =>
            String(s.serialNumber || "")
              .toLowerCase()
              .includes(q)
          )
        )
        const itemsMatch = (rec.items || []).some((it) =>
          String(it.description || it.item?.itemName || "")
            .toLowerCase()
            .includes(q)
        )
        if (
          !code.includes(q) &&
          !poCode.includes(q) &&
          !supplier.includes(q) &&
          !inv.includes(q) &&
          !serialsMatch &&
          !itemsMatch
        ) {
          return false
        }
      }

      if (supplierFilter && rec.supplierId !== supplierFilter) {
        return false
      }

      if (receivingStatusFilter && rec.status !== receivingStatusFilter) {
        return false
      }

      return true
    })
  }, [purchaseReceivings, search, supplierFilter, receivingStatusFilter])

  // Filtered Cost Variances
  const filteredCostVariances = useMemo(() => {
    return costVarianceItems.filter((item) => {
      const q = search.trim().toLowerCase()
      if (q) {
        const rec = String(item.receivingCode || "").toLowerCase()
        const po = String(item.poCode || "").toLowerCase()
        const supp = String(item.supplierName || "").toLowerCase()
        const itName = String(item.itemName || "").toLowerCase()
        const itCode = String(item.itemCode || "").toLowerCase()
        if (
          !rec.includes(q) &&
          !po.includes(q) &&
          !supp.includes(q) &&
          !itName.includes(q) &&
          !itCode.includes(q)
        ) {
          return false
        }
      }

      if (supplierFilter && item.supplierId !== supplierFilter) {
        return false
      }

      if (varianceFilter === "PRICE_INCREASE" && item.varianceType !== "PRICE_INCREASE") {
        return false
      }
      if (varianceFilter === "PRICE_DECREASE" && item.varianceType !== "PRICE_DECREASE") {
        return false
      }
      if (varianceFilter === "EXACT_MATCH" && item.varianceType !== "EXACT_MATCH") {
        return false
      }

      return true
    })
  }, [costVarianceItems, search, supplierFilter, varianceFilter])

  // Filtered Supplier Scorecard
  const filteredScorecards = useMemo(() => {
    return supplierScorecards.filter((s) => {
      const q = search.trim().toLowerCase()
      if (q) {
        const name = String(s.supplierName || "").toLowerCase()
        const code = String(s.supplierCode || "").toLowerCase()
        if (!name.includes(q) && !code.includes(q)) return false
      }
      if (supplierFilter && s.supplierId !== supplierFilter) return false
      return true
    })
  }, [supplierScorecards, search, supplierFilter])

  // Executive KPI summary calculations
  const summaryKpis = useMemo(() => {
    const totalCommittedSpend = processedOrders.reduce(
      (sum, po) => sum + (po.status !== "CANCELLED" ? po.poAmount : 0),
      0
    )
    const totalReceivedSpend = purchaseReceivings.reduce(
      (sum, rec) =>
        sum + (rec.status === "POSTED" ? Number(rec.grandTotal || 0) : 0),
      0
    )
    const pendingBacklogSpend = processedOrders.reduce(
      (sum, po) =>
        sum +
        (["ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)
          ? po.pendingAmount
          : 0),
      0
    )
    const pendingPoCount = processedOrders.filter((po) =>
      ["ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)
    ).length

    const totalOrderedUnits = processedOrders.reduce(
      (sum, po) => (po.status !== "CANCELLED" ? sum + po.totalOrderedQty : 0),
      0
    )
    const totalReceivedUnits = processedOrders.reduce(
      (sum, po) => (po.status !== "CANCELLED" ? sum + po.totalReceivedQty : 0),
      0
    )
    const overallFulfillmentRate =
      totalOrderedUnits > 0
        ? Math.min(100, Math.round((totalReceivedUnits / totalOrderedUnits) * 100))
        : 0

    const netCostVariance = costVarianceItems.reduce(
      (sum, item) => sum + item.totalDiff,
      0
    )
    const totalOvercharge = costVarianceItems
      .filter((i) => i.totalDiff > 0)
      .reduce((sum, i) => sum + i.totalDiff, 0)
    const totalSavings = costVarianceItems
      .filter((i) => i.totalDiff < 0)
      .reduce((sum, i) => sum + Math.abs(i.totalDiff), 0)

    let totalSerialsReceived = 0
    purchaseReceivings.forEach((rec) => {
      if (rec.status === "CANCELLED") return
      const items = Array.isArray(rec.items) ? rec.items : []
      items.forEach((item) => {
        if (Array.isArray(item.serials)) {
          totalSerialsReceived += item.serials.length
        }
      })
    })

    const overdueCount = processedOrders.filter((po) => po.isOverdue).length

    return {
      totalCommittedSpend,
      totalReceivedSpend,
      pendingBacklogSpend,
      pendingPoCount,
      overallFulfillmentRate,
      netCostVariance,
      totalOvercharge,
      totalSavings,
      totalSerialsReceived,
      overdueCount,
      activeSuppliersCount: supplierScorecards.length,
    }
  }, [processedOrders, purchaseReceivings, costVarianceItems, supplierScorecards])

  // Handle Export to Excel
  const handleExportCurrentView = async () => {
    setIsExporting(true)
    try {
      const branchLabel = selectedBranch?.name || selectedBranch?.code || "Branch"
      const dateStr = new Date().toISOString().slice(0, 10)

      if (activeTab === "PO_FULFILLMENT") {
        const columns = [
          ["PO Code", (r) => r.poCode || "—"],
          ["Date Ordered", (r) => dateOnly(r.orderDate || r.createdAt)],
          ["Supplier", (r) => r.supplierNameSnapshot || r.supplier?.name || "—"],
          ["Status", (r) => formatStatus(r.status)],
          ["Expected Date", (r) => dateOnly(r.expectedDate)],
          ["Ordered Qty", (r) => r.totalOrderedQty],
          ["Received Qty", (r) => r.totalReceivedQty],
          ["Fulfillment %", (r) => `${r.fulfillmentRate}%`],
          ["Committed Amount (₱)", (r) => r.poAmount],
          ["Received Amount (₱)", (r) => r.receivedAmount],
          ["Pending Amount (₱)", (r) => r.pendingAmount],
          ["Overdue Status", (r) => (r.isOverdue ? "OVERDUE" : "On Track")],
          ["Notes", (r) => r.notes || "—"],
        ]

        exportReportExcel({
          label: "Purchase Orders & Fulfillment Report",
          filename: `PO-Fulfillment-Report-${branchLabel}-${dateStr}`,
          columns,
          records: filteredOrders,
          branch: selectedBranch,
          generatedBy: user,
          filters: [
            ["Timeframe", timeframe],
            ["Date Range", `${effectiveDates.from || "Start"} to ${effectiveDates.to || "Now"}`],
            ["Search", search || "All"],
            ["Supplier", supplierFilter ? suppliers.find((s) => s.id === supplierFilter)?.name : "All"],
            ["PO Status", poStatusFilter || "All"],
            ["Fulfillment Status", fulfillmentFilter],
          ],
          totals: [
            ["Total POs", filteredOrders.length],
            ["Total Committed Spend", filteredOrders.reduce((s, r) => s + r.poAmount, 0)],
            ["Total Received Landed Value", filteredOrders.reduce((s, r) => s + r.receivedAmount, 0)],
            ["Outstanding Backlog", filteredOrders.reduce((s, r) => s + r.pendingAmount, 0)],
          ],
        })
      } else if (activeTab === "RECEIVINGS_LOG") {
        const columns = [
          ["Receiving Code", (r) => r.receivingCode || "—"],
          ["Date Received", (r) => dateOnly(r.receivingDate || r.createdAt)],
          ["Supplier", (r) => r.supplierNameSnapshot || r.supplier?.name || "—"],
          ["PO Reference", (r) => r.purchaseOrder?.poCode || "Direct Receiving"],
          ["Invoice / DR #", (r) => r.invoiceNo || r.deliveryReceiptNo || "—"],
          ["Status", (r) => formatStatus(r.status)],
          ["Items Count", (r) => (r.items || []).length],
          ["Total Units Received", (r) => (r.items || []).reduce((s, i) => s + Number(i.quantityReceived || 0), 0)],
          ["Total Landed Value (₱)", (r) => Number(r.grandTotal || 0)],
          ["Total Serials Captured", (r) => (r.items || []).reduce((s, i) => s + (Array.isArray(i.serials) ? i.serials.length : 0), 0)],
          ["Received By", (r) => r.createdBy?.fullName || r.createdBy?.username || "—"],
          ["Delivery Notes", (r) => r.notes || "—"],
        ]

        exportReportExcel({
          label: "Inbound Goods Receivings Report",
          filename: `Inbound-Receivings-Report-${branchLabel}-${dateStr}`,
          columns,
          records: filteredReceivings,
          branch: selectedBranch,
          generatedBy: user,
          filters: [
            ["Timeframe", timeframe],
            ["Date Range", `${effectiveDates.from || "Start"} to ${effectiveDates.to || "Now"}`],
            ["Search", search || "All"],
            ["Supplier", supplierFilter ? suppliers.find((s) => s.id === supplierFilter)?.name : "All"],
            ["Status", receivingStatusFilter || "All"],
          ],
          totals: [
            ["Total Inbound Deliveries", filteredReceivings.length],
            ["Total Landed Goods Cost", filteredReceivings.reduce((s, r) => s + Number(r.grandTotal || 0), 0)],
          ],
        })
      } else if (activeTab === "COST_VARIANCE") {
        const columns = [
          ["Receiving Code", (r) => r.receivingCode],
          ["Date", (r) => dateOnly(r.receivingDate)],
          ["Supplier", (r) => r.supplierName],
          ["PO Reference", (r) => r.poCode],
          ["Item Code", (r) => r.itemCode],
          ["Item Description", (r) => r.itemName],
          ["Qty Received", (r) => r.quantityReceived],
          ["Agreed PO Cost (₱)", (r) => r.agreedPoUnitCost],
          ["Invoiced Cost (₱)", (r) => r.invoicedUnitCost],
          ["Unit Variance (₱)", (r) => r.unitDiff],
          ["Variance %", (r) => `${r.variancePct}%`],
          ["Total Variance (₱)", (r) => r.totalDiff],
          ["Discrepancy Type", (r) => r.varianceType],
          ["Invoice / DR #", (r) => r.invoiceNo],
        ]

        exportReportExcel({
          label: "Supplier Cost Variance & Discrepancy Audit",
          filename: `Supplier-Cost-Variance-${branchLabel}-${dateStr}`,
          columns,
          records: filteredCostVariances,
          branch: selectedBranch,
          generatedBy: user,
          filters: [
            ["Timeframe", timeframe],
            ["Search", search || "All"],
            ["Supplier", supplierFilter ? suppliers.find((s) => s.id === supplierFilter)?.name : "All"],
            ["Variance Filter", varianceFilter],
          ],
          totals: [
            ["Total Line Items Analyzed", filteredCostVariances.length],
            ["Net Cost Variance", filteredCostVariances.reduce((s, r) => s + r.totalDiff, 0)],
          ],
        })
      } else if (activeTab === "SUPPLIER_SCORECARD") {
        const columns = [
          ["Supplier Name", (r) => r.supplierName],
          ["Supplier Code", (r) => r.supplierCode],
          ["Total POs Issued", (r) => r.totalPos],
          ["Completed POs", (r) => r.completedPos],
          ["Pending Backlog POs", (r) => r.pendingPos + r.partialPos],
          ["Cancelled POs", (r) => r.cancelledPos],
          ["Committed Spend (₱)", (r) => r.committedSpend],
          ["Actual Delivered Spend (₱)", (r) => r.receivedSpend],
          ["Overall Fulfillment Rate %", (r) => `${r.fulfillmentRate}%`],
          ["Deliveries Processed", (r) => r.receivingCount],
          ["Serials Checked In", (r) => r.serialsCount],
          ["Net Cost Variance (₱)", (r) => r.netCostVariance],
        ]

        exportReportExcel({
          label: "Supplier Delivery Performance Scorecard",
          filename: `Supplier-Performance-Scorecard-${branchLabel}-${dateStr}`,
          columns,
          records: filteredScorecards,
          branch: selectedBranch,
          generatedBy: user,
          filters: [
            ["Timeframe", timeframe],
            ["Search", search || "All"],
            ["Supplier", supplierFilter ? suppliers.find((s) => s.id === supplierFilter)?.name : "All"],
          ],
          totals: [
            ["Suppliers Evaluated", filteredScorecards.length],
            ["Combined Committed Spend", filteredScorecards.reduce((s, r) => s + r.committedSpend, 0)],
            ["Combined Delivered Value", filteredScorecards.reduce((s, r) => s + r.receivedSpend, 0)],
            ["Total Cost Discrepancy Net", filteredScorecards.reduce((s, r) => s + r.netCostVariance, 0)],
          ],
        })
      }
    } catch (err) {
      console.error("Export failed:", err)
      setErrorMessage("Could not export report to Excel. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Controls: Timeframe, Search, Mode Switcher, and Export */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-strong)] flex items-center gap-2">
              <Truck className="text-[var(--color-maroon)]" size={22} />
              Purchases & Supply Chain Audit
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-muted)] font-medium">
              PO fulfillment rates, inbound deliveries, serial verification, and supplier cost variance tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe Presets */}
            <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold text-slate-600">
              {[
                { id: "TODAY", label: "Today" },
                { id: "THIS_WEEK", label: "This Week" },
                { id: "THIS_MONTH", label: "This Month" },
                { id: "THIS_YEAR", label: "This Year" },
                { id: "ALL_TIME", label: "All Time" },
                { id: "CUSTOM", label: "Custom" },
              ].map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id)}
                  type="button"
                  className={`rounded-xl px-3 py-1.5 transition ${
                    timeframe === tf.id
                      ? "bg-white text-slate-900 shadow-xs"
                      : "hover:text-slate-900"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCurrentView}
              disabled={isExporting || isLoading}
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-800 transition disabled:opacity-50"
            >
              <FileSpreadsheet size={15} />
              {isExporting ? "Exporting…" : "Export Excel (.xlsx)"}
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Custom date range inputs */}
        {timeframe === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <Calendar size={16} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-700">Custom Date Range:</span>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              From:
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs outline-none focus:border-[var(--color-maroon)]"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              To:
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs outline-none focus:border-[var(--color-maroon)]"
              />
            </label>
          </div>
        )}

        {/* Audit Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Audit Mode:
          </span>
          <button
            type="button"
            onClick={() => setActiveTab("PO_FULFILLMENT")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "PO_FULFILLMENT"
                ? "bg-[var(--color-maroon)] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <PackageCheck size={14} />
            PO Fulfillment & Supply Chain Tracker
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("RECEIVINGS_LOG")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "RECEIVINGS_LOG"
                ? "bg-[var(--color-maroon)] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <PackagePlus size={14} />
            Goods Receivings & Landed Cost Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("COST_VARIANCE")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "COST_VARIANCE"
                ? "bg-[var(--color-maroon)] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <TrendingUp size={14} />
            PO vs Receiving Cost Variance Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SUPPLIER_SCORECARD")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "SUPPLIER_SCORECARD"
                ? "bg-[var(--color-maroon)] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Layers size={14} />
            Supplier Delivery Performance Scorecard
          </button>
        </div>
      </section>

      {/* Executive Financial & Supply Chain KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Committed Spend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Total Committed Spend
            </span>
            <DollarSign size={16} className="text-slate-400" />
          </div>
          <p className="mt-2 text-xl font-black font-mono text-slate-900">
            {money(summaryKpis.totalCommittedSpend)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{processedOrders.length} Total Purchase Orders</span>
            <span className="font-semibold text-emerald-700">
              {processedOrders.filter((p) => p.status === "RECEIVED").length} Delivered
            </span>
          </div>
        </div>

        {/* KPI 2: Actual Landed Goods Received */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Landed Goods Received
            </span>
            <Truck size={16} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-xl font-black font-mono text-emerald-700">
            {money(summaryKpis.totalReceivedSpend)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{purchaseReceivings.filter((r) => r.status === "POSTED").length} Posted Deliveries</span>
            <span className="font-bold text-slate-700">
              {summaryKpis.totalSerialsReceived} Serials Logged
            </span>
          </div>
        </div>

        {/* KPI 3: In-Transit Backlog & Fulfillment Rate */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Fulfillment Rate & Backlog
            </span>
            <Percent size={16} className="text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-xl font-black text-indigo-700">
              {summaryKpis.overallFulfillmentRate}%
            </p>
            <span className="text-xs font-bold text-slate-500">
              ({money(summaryKpis.pendingBacklogSpend)} pending)
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-amber-700 font-bold">
              {summaryKpis.pendingPoCount} POs in Transit
            </span>
            {summaryKpis.overdueCount > 0 ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800">
                {summaryKpis.overdueCount} Overdue
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold">Deliveries on schedule</span>
            )}
          </div>
        </div>

        {/* KPI 4: Net Cost Variance / Supplier Price Shifts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Supplier Cost Variance
            </span>
            {summaryKpis.netCostVariance > 0 ? (
              <ArrowUpRight size={16} className="text-rose-600" />
            ) : summaryKpis.netCostVariance < 0 ? (
              <ArrowDownRight size={16} className="text-emerald-600" />
            ) : (
              <CheckCircle2 size={16} className="text-slate-400" />
            )}
          </div>
          <p
            className={`mt-2 text-xl font-black font-mono ${
              summaryKpis.netCostVariance > 0
                ? "text-rose-700"
                : summaryKpis.netCostVariance < 0
                ? "text-emerald-700"
                : "text-slate-900"
            }`}
          >
            {summaryKpis.netCostVariance > 0 ? "+" : ""}
            {money(summaryKpis.netCostVariance)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-rose-700 font-semibold">
              +{money(summaryKpis.totalOvercharge)} Hikes
            </span>
            <span className="text-emerald-700 font-semibold">
              -{money(summaryKpis.totalSavings)} Savings
            </span>
          </div>
        </div>
      </section>

      {/* Multi-Dimensional Search & Secondary Filter Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Live Search */}
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO, receiving, supplier, item, serial…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:bg-white"
            />
          </div>

          {/* Supplier Dropdown */}
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
          >
            <option value="">All Suppliers ({suppliers.length})</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.supplierCode})
              </option>
            ))}
          </select>

          {/* Contextual Filters depending on Tab */}
          {activeTab === "PO_FULFILLMENT" && (
            <>
              <select
                value={poStatusFilter}
                onChange={(e) => setPoStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
              >
                <option value="">All PO Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ORDERED">Ordered</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="RECEIVED">Fully Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
              >
                <option value="ALL">All Delivery Progress</option>
                <option value="FULLY_FULFILLED">Fully Fulfilled (100%)</option>
                <option value="PARTIAL_BACKLOG">Partial Deliveries / Backlog</option>
                <option value="ZERO_DELIVERIES">Zero Deliveries (0%)</option>
                <option value="OVERDUE">Overdue Orders Alert</option>
              </select>
            </>
          )}

          {activeTab === "RECEIVINGS_LOG" && (
            <select
              value={receivingStatusFilter}
              onChange={(e) => setReceivingStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="">All Receiving Statuses</option>
              <option value="POSTED">Posted to Stock</option>
              <option value="DRAFT">Draft Verification</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          )}

          {activeTab === "COST_VARIANCE" && (
            <select
              value={varianceFilter}
              onChange={(e) => setVarianceFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
            >
              <option value="ALL">All Price Variances</option>
              <option value="PRICE_INCREASE">Price Increases / Overcharges (Supplier Cost &gt; PO Cost)</option>
              <option value="PRICE_DECREASE">Price Drops / Discounts (Supplier Cost &lt; PO Cost)</option>
              <option value="EXACT_MATCH">Exact Price Match</option>
            </select>
          )}
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Audit Tables */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-xs font-bold text-slate-500">
            <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={18} />
            Loading procurement and supply chain records…
          </div>
        ) : (
          <>
            {/* Mode 1: PO Fulfillment & Supply Chain Tracker */}
            {activeTab === "PO_FULFILLMENT" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3">PO Code & Date</th>
                      <th className="px-4 py-3">Supplier Name</th>
                      <th className="px-4 py-3">Expected Date</th>
                      <th className="px-4 py-3">Delivery Progress</th>
                      <th className="px-4 py-3 text-right">Committed Spend</th>
                      <th className="px-4 py-3 text-right">Delivered Landed</th>
                      <th className="px-4 py-3 text-right">Backlog</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                          No purchase orders match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3">
                            <p className="font-mono font-bold text-slate-900">{order.poCode}</p>
                            <p className="text-[10px] text-slate-400">
                              {dateOnly(order.orderDate || order.createdAt)}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {order.supplierNameSnapshot || order.supplier?.name || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <span>{dateOnly(order.expectedDate)}</span>
                              {order.isOverdue && (
                                <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-800">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-36">
                              <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                                <span>{order.totalReceivedQty} / {order.totalOrderedQty} units</span>
                                <span>{order.fulfillmentRate}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    order.fulfillmentRate === 100
                                      ? "bg-emerald-600"
                                      : order.fulfillmentRate > 0
                                      ? "bg-amber-500"
                                      : "bg-slate-300"
                                  }`}
                                  style={{ width: `${order.fulfillmentRate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {money(order.poAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                            {money(order.receivedAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700">
                            {order.pendingAmount > 0 ? money(order.pendingAmount) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                                order.status === "RECEIVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : order.status === "CANCELLED"
                                  ? "bg-rose-100 text-rose-800"
                                  : order.status === "DRAFT"
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {formatStatus(order.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {onOpenPoDetail && (
                                <button
                                  type="button"
                                  onClick={() => onOpenPoDetail(order)}
                                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                                  title="View Full PO Details"
                                >
                                  <Eye size={13} />
                                </button>
                              )}
                              {onReceivePo && ["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status) && (
                                <button
                                  type="button"
                                  onClick={() => onReceivePo(order)}
                                  className="rounded-lg bg-[var(--color-maroon)] px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)]"
                                >
                                  Receive
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mode 2: Goods Receivings & Landed Cost Log */}
            {activeTab === "RECEIVINGS_LOG" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Receiving Code & Date</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Linked PO</th>
                      <th className="px-4 py-3">Invoice / DR #</th>
                      <th className="px-4 py-3">Units & Serials</th>
                      <th className="px-4 py-3 text-right">Landed Cost (₱)</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReceivings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                          No purchase receivings match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredReceivings.map((rec) => {
                        const totalUnits = (rec.items || []).reduce(
                          (sum, it) => sum + Number(it.quantityReceived || 0),
                          0
                        )
                        const totalSerials = (rec.items || []).reduce(
                          (sum, it) =>
                            sum + (Array.isArray(it.serials) ? it.serials.length : 0),
                          0
                        )

                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3">
                              <p className="font-mono font-bold text-slate-900">{rec.receivingCode}</p>
                              <p className="text-[10px] text-slate-400">
                                {dateOnly(rec.receivingDate || rec.createdAt)}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {rec.supplierNameSnapshot || rec.supplier?.name || "—"}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-slate-600">
                              {rec.purchaseOrder?.poCode || "Direct Receiving"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {rec.invoiceNo || rec.deliveryReceiptNo || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-slate-800">
                                <span className="font-bold">{totalUnits} units</span>
                                {totalSerials > 0 && (
                                  <span className="ml-2 rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-indigo-700">
                                    {totalSerials} serials
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                              {money(rec.grandTotal)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                                  rec.status === "POSTED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : rec.status === "CANCELLED"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {formatStatus(rec.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {onOpenReceivingDetail && (
                                <button
                                  type="button"
                                  onClick={() => onOpenReceivingDetail(rec)}
                                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                                  title="View Receiving Details"
                                >
                                  <Eye size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mode 3: PO vs Receiving Cost Variance Ledger */}
            {activeTab === "COST_VARIANCE" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Item Description</th>
                      <th className="px-4 py-3">Supplier & Reference</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3 text-right">Agreed PO Cost</th>
                      <th className="px-4 py-3 text-right">Invoiced Cost</th>
                      <th className="px-4 py-3 text-right">Unit Shift</th>
                      <th className="px-4 py-3 text-right">Total Net Variance</th>
                      <th className="px-4 py-3">Audit Alert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCostVariances.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                          No cost variance records found. All invoiced deliveries match agreed PO costs.
                        </td>
                      </tr>
                    ) : (
                      filteredCostVariances.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{item.itemName}</p>
                            <p className="font-mono text-[10px] text-slate-400">{item.itemCode}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{item.supplierName}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              PO: {item.poCode} • REC: {item.receivingCode}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {item.quantityReceived} units
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-slate-600">
                            {money(item.agreedPoUnitCost)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {money(item.invoicedUnitCost)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-bold ${
                              item.unitDiff > 0
                                ? "text-rose-600"
                                : item.unitDiff < 0
                                ? "text-emerald-600"
                                : "text-slate-400"
                            }`}
                          >
                            {item.unitDiff > 0 ? "+" : ""}
                            {money(item.unitDiff)} ({item.variancePct > 0 ? "+" : ""}
                            {item.variancePct}%)
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-black ${
                              item.totalDiff > 0
                                ? "text-rose-700"
                                : item.totalDiff < 0
                                ? "text-emerald-700"
                                : "text-slate-500"
                            }`}
                          >
                            {item.totalDiff > 0 ? "+" : ""}
                            {money(item.totalDiff)}
                          </td>
                          <td className="px-4 py-3">
                            {item.varianceType === "PRICE_INCREASE" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-800">
                                <ArrowUpRight size={11} /> Overcharge (+{item.variancePct}%)
                              </span>
                            ) : item.varianceType === "PRICE_DECREASE" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                <ArrowDownRight size={11} /> Savings ({item.variancePct}%)
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                Exact Match
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mode 4: Supplier Delivery Performance Scorecard */}
            {activeTab === "SUPPLIER_SCORECARD" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Supplier Name & Code</th>
                      <th className="px-4 py-3">PO Activity</th>
                      <th className="px-4 py-3">Deliveries Processed</th>
                      <th className="px-4 py-3">Fulfillment Rate</th>
                      <th className="px-4 py-3 text-right">Committed Spend</th>
                      <th className="px-4 py-3 text-right">Delivered Landed</th>
                      <th className="px-4 py-3 text-right">Net Price Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredScorecards.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold">
                          No supplier scorecard data found.
                        </td>
                      </tr>
                    ) : (
                      filteredScorecards.map((s) => (
                        <tr key={s.supplierId} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{s.supplierName}</p>
                            <p className="font-mono text-[10px] text-slate-400">{s.supplierCode}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5 text-[11px]">
                              <p className="font-bold text-slate-800">{s.totalPos} POs Total</p>
                              <p className="text-slate-500">
                                {s.completedPos} Completed • {s.pendingPos + s.partialPos} Pending
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-800">
                              <span className="font-bold">{s.receivingCount} Deliveries</span>
                              {s.serialsCount > 0 && (
                                <p className="text-[10px] text-indigo-700 font-medium">
                                  {s.serialsCount} Serials Checked In
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-32">
                              <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
                                <span>Rate</span>
                                <span>{s.fulfillmentRate}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    s.fulfillmentRate >= 90
                                      ? "bg-emerald-600"
                                      : s.fulfillmentRate >= 50
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                  }`}
                                  style={{ width: `${s.fulfillmentRate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {money(s.committedSpend)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                            {money(s.receivedSpend)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-black ${
                              s.netCostVariance > 0
                                ? "text-rose-700"
                                : s.netCostVariance < 0
                                ? "text-emerald-700"
                                : "text-slate-500"
                            }`}
                          >
                            {s.netCostVariance > 0 ? "+" : ""}
                            {money(s.netCostVariance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
