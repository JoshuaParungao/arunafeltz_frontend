import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, PackagePlus, PackageSearch, Plus, RefreshCw, Search, X } from "lucide-react"
import { useCallback } from "react"

import { getBranches } from "../../features/branches/branches.api"
import StockAdjustmentPanel from "./StockAdjustmentPanel"
import StockMovementHistoryPanel from "./StockMovementHistoryPanel"
import AddStockModal from "./AddStockModal"
import {
  createStockAdjustment,
  createStockTransferRequest,
  getInventoryOverview,
  getInventoryBatches,
  getInventoryMovements,
  getInventorySerials,
  getRequestableStock,
} from "../../features/inventory/inventory.api"

import { exportInventoryPdf } from "../../utils/businessDocumentExport"
function formatNumber(value) {
  const number = Number(value || 0)
  return number.toLocaleString("en-PH")
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  })
}

function StockBadge({ item }) {
  const availableQuantity = Number(item.quantityAvailable || 0)
  const reorderLevel = Number(item.reorderLevel || 0)

  if (availableQuantity <= 0) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
        Out of stock
      </span>
    )
  }

  if (reorderLevel > 0 && availableQuantity <= reorderLevel) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
        Low stock
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
      Stock is okay
    </span>
  )
}

function InventoryMobileCard({ item, canAdjust, onView, onAdjust }) {
  return (
    <article className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[var(--color-text-strong)]">
            {item.itemName}
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--color-muted)]">
            {item.itemCode}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {[item.brand, item.modelName].filter(Boolean).join(" • ") || "No brand/model"}
          </p>
        </div>

        <StockBadge item={item} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-[var(--color-soft)] p-3">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Available</p>
          <p className="mt-1 font-bold text-[var(--color-text-strong)]">
            {formatNumber(item.quantityAvailable)}
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] p-3">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Total In</p>
          <p className="mt-1 font-bold text-[var(--color-text-strong)]">
            {formatNumber(item.quantityIn)}
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] p-3">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Batches</p>
          <p className="mt-1 font-bold text-[var(--color-text-strong)]">
            {formatNumber(item.batchCount)}
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] p-3">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Serials</p>
          <p className="mt-1 font-bold text-[var(--color-text-strong)]">
            {formatNumber(item.serialCount)}
          </p>
        </div>
      </div>

      <div className="mt-4 text-xs font-semibold leading-6 text-[var(--color-muted)]">
        <p>Branch: {item.branch?.code || item.branch?.name || "No branch"}</p>
        <p>Category: {item.category?.name || "No category"}</p>
        <p>Unit: {item.unit?.name || "No unit"}</p>
        <p>Tracking: {item.isSerialized ? "Serialized" : "Non-serialized"}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-xs font-black text-[var(--color-text-strong)]"
          onClick={() => onView(item)}
          type="button"
        >
          View details
        </button>
        {canAdjust ? (
          <button
            className="rounded-2xl border border-[#7A1F2B] px-4 py-2 text-xs font-black text-[#7A1F2B]"
            onClick={() => onAdjust(item)}
            type="button"
          >
            Adjust stock
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function InventoryPage({ selectedBranch, user }) {
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState(null)
  const [searchText, setSearchText] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [lowStockOnly, setLowStockOnly] = useState("")
  const [branchOptions, setBranchOptions] = useState([])
  const [viewingBranchId, setViewingBranchId] = useState(selectedBranch?.id || "")
  const [page, setPage] = useState(1)
  const [isBulkRequestOpen, setIsBulkRequestOpen] = useState(false)
  const [bulkSearchText, setBulkSearchText] = useState("")
  const [bulkRequestItems, setBulkRequestItems] = useState([])
  const [requestSourceBranchId, setRequestSourceBranchId] = useState("")
  const [requestCatalogItems, setRequestCatalogItems] = useState([])
  const [adjustItem, setAdjustItem] = useState(null)
  const [adjustMode, setAdjustMode] = useState("ADJUST")
  const [adjustBatches, setAdjustBatches] = useState([])
  const [adjustBatchId, setAdjustBatchId] = useState("")
  const [adjustType, setAdjustType] = useState("INCREASE")
  const [adjustQuantity, setAdjustQuantity] = useState("1")
  const [adjustReferenceNo, setAdjustReferenceNo] = useState("")
  const [adjustRemarks, setAdjustRemarks] = useState("")
  const [adjustSerialNumbersText, setAdjustSerialNumbersText] = useState("")
  const [adjustAvailableSerials, setAdjustAvailableSerials] = useState([])
  const [adjustMessage, setAdjustMessage] = useState("")
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [isAddStockOpen, setIsAddStockOpen] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState("")
  const [stockMovements, setStockMovements] = useState([])
  const [isLoadingMovements, setIsLoadingMovements] = useState(false)
  const [movementMessage, setMovementMessage] = useState("")
  const pageSize = 10
  const viewingBranch = branchOptions.find((branch) => branch.id === viewingBranchId)
  const requestSourceOptions = branchOptions.filter(
    (branch) => branch.status === "ACTIVE" && branch.id !== selectedBranch?.id
  )
  const canOpenStockRequest = Boolean(selectedBranch?.id && requestSourceOptions.length > 0)
  const canAdjustStock = ["SUPER_OWNER", "BRANCH_OWNER", "ADMIN", "CASHIER", "TECHNICIAN"].includes(user?.role)
  const canViewInventoryCosts = ["SUPER_OWNER", "BRANCH_OWNER", "ADMIN"].includes(user?.role)
  const filteredBulkItems = requestCatalogItems

  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [requestItem, setRequestItem] = useState(null)
  const [requestQuantity, setRequestQuantity] = useState("1")
  const [requestFulfillmentMethod, setRequestFulfillmentMethod] = useState("PICKUP")
  const [requestDeliveryCharge, setRequestDeliveryCharge] = useState("0")
  const [requestNotes, setRequestNotes] = useState("")
  const [requestMessage, setRequestMessage] = useState("")
  const [isRequesting, setIsRequesting] = useState(false)

  const loadBranches = useCallback(async () => {
    try {
      const response = await getBranches()
      const branches = response?.data

      setBranchOptions(Array.isArray(branches) ? branches : [])

    } catch {
      setBranchOptions([])
    }
  }, [])

  const loadInventory = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const params = {
        page,
        limit: pageSize,
      }

      if (viewingBranchId) {
        params.branchId = viewingBranchId
      }

      if (searchText.trim()) {
        params.search = searchText.trim()
      }

      if (statusFilter) {
        params.status = statusFilter
      }

      if (lowStockOnly) {
        params.lowStockOnly = lowStockOnly
      }

      const response = await getInventoryOverview(params)
      const result = response?.data || {}

      setItems(Array.isArray(result.data) ? result.data : [])
      setPagination(result.pagination || null)
    } catch {
      setErrorMessage("Unable to load inventory right now. Please refresh and try again.")
      setItems([])
      setPagination(null)
    } finally {
      setIsLoading(false)
    }
  }, [lowStockOnly, page, pageSize, searchText, statusFilter, viewingBranchId])

  const loadRequestCatalog = useCallback(async () => {
    if (!isBulkRequestOpen || !requestSourceBranchId) {
      setRequestCatalogItems([])
      return
    }

    setIsLoadingRequestCatalog(true)

    try {
      const response = await getRequestableStock({
        fromBranchId: requestSourceBranchId,
        search: bulkSearchText.trim() || undefined,
        limit: 100,
      })
      const result = response?.data || {}
      setRequestCatalogItems(Array.isArray(result.data) ? result.data : [])
    } catch (error) {
      setRequestCatalogItems([])
      setRequestMessage(
        error?.response?.data?.error?.message || "Could not load requestable stock."
      )
    } finally {
      setIsLoadingRequestCatalog(false)
    }
  }, [bulkSearchText, isBulkRequestOpen, requestSourceBranchId, setRequestMessage])

  const clearFilters = () => {
    setSearchText("")
    setStatusFilter("")
    setLowStockOnly("")
    setPage(1)
  }

  const addBulkRequestItem = (item) => {
    const availableQuantity = Number(item.quantityAvailable || 0)

    if (availableQuantity <= 0) {
      setRequestMessage("This product has no available stock.")
      return
    }

    setRequestMessage("")

    setBulkRequestItems((currentItems) => {
      const existingItem = currentItems.find((requestItem) => requestItem.id === item.id)

      if (existingItem) {
        return currentItems
      }

      return [
        ...currentItems,
        {
          id: item.id,
          itemCode: item.itemCode,
          itemName: item.itemName,
          brand: item.brand,
          modelName: item.modelName,
          availableQuantity,
          quantity: "1",
        },
      ]
    })
  }

  const updateBulkRequestQuantity = (itemId, quantity) => {
    setBulkRequestItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
            ...item,
            quantity,
          }
          : item
      )
    )
  }

  const removeBulkRequestItem = (itemId) => {
    setBulkRequestItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId)
    )
  }
  const closeRequestModal = () => {
    if (isRequesting) return

    setRequestItem(null)
    setRequestQuantity("1")
    setRequestFulfillmentMethod("PICKUP")
    setRequestDeliveryCharge("0")
    setRequestNotes("")
  }

  const loadStockMovements = async (item) => {
    if (!item) {
      setStockMovements([])
      return
    }

    setIsLoadingMovements(true)
    setMovementMessage("")

    try {
      const response = await getInventoryMovements({
        branchId: item.branch?.id || viewingBranchId,
        itemId: item.id,
        limit: 10,
      })

      const result = response?.data || {}
      const movements = result.data || result.items || []

      setStockMovements(Array.isArray(movements) ? movements : [])
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ||
        "Could not load movement history."

      setStockMovements([])
      setMovementMessage(message)
    } finally {
      setIsLoadingMovements(false)
    }
  }
  const openAdjustModal = async (item, mode = "ADJUST") => {
    setAdjustMessage("")
    setAdjustItem(item)
    setAdjustMode(mode)
    setAdjustBatchId("")
    setAdjustType("INCREASE")
    setAdjustQuantity("1")
    setAdjustReferenceNo("")
    setAdjustRemarks("")
    setAdjustBatches([])
    setAdjustSerialNumbersText("")
    setAdjustAvailableSerials([])

    try {
      const branchId = item.branch?.id || viewingBranchId
      const [batchRes, serialRes] = await Promise.all([
        getInventoryBatches({
          branchId,
          itemId: item.id,
          limit: 50,
        }),
        item.isSerialized
          ? getInventorySerials({
              branchId,
              itemId: item.id,
              status: "AVAILABLE",
              limit: 100,
            })
          : Promise.resolve(null),
      ])

      const batches = batchRes?.data?.data || batchRes?.data?.items || []
      setAdjustBatches(batches)

      const firstActiveBatch = batches.find((batch) => Number(batch.quantityAvailable || 0) > 0) || batches[0]
      setAdjustBatchId(firstActiveBatch?.id || "")

      if (serialRes) {
        const serials = serialRes?.data?.data || serialRes?.data?.items || []
        setAdjustAvailableSerials(serials)
      }

      await loadStockMovements(item)
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ||
        "Could not load stock batches. Please try again."

      setAdjustMessage(message)
    }
  }

  const closeAdjustModal = () => {
    if (isAdjusting) return

    setAdjustItem(null)
    setAdjustBatches([])
    setAdjustBatchId("")
    setAdjustType("INCREASE")
    setAdjustQuantity("1")
    setAdjustReferenceNo("")
    setAdjustRemarks("")
    setAdjustSerialNumbersText("")
    setAdjustAvailableSerials([])
    setAdjustMessage("")
    setStockMovements([])
    setMovementMessage("")
  }
  const submitStockAdjustment = async () => {
    if (!adjustItem) {
      setAdjustMessage("Choose an item first.")
      return
    }

    const quantity = Number(adjustQuantity)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAdjustMessage("Enter a valid quantity.")
      return
    }

    if (!adjustRemarks.trim()) {
      setAdjustMessage("Reason is required.")
      return
    }

    const selectedBatch = adjustBatches.find((batch) => batch.id === adjustBatchId)
    const availableQuantity = Number(selectedBatch?.quantityAvailable || adjustItem.quantityAvailable || 0)

    if (adjustType === "DECREASE" && quantity > availableQuantity) {
      setAdjustMessage("Deduct quantity cannot be higher than available stock.")
      return
    }

    let parsedSerials = []
    if (adjustItem.isSerialized) {
      parsedSerials = adjustSerialNumbersText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)

      if (parsedSerials.length !== quantity) {
        setAdjustMessage(`Please enter exactly ${quantity} serial number(s). Currently entered: ${parsedSerials.length}.`)
        return
      }

      if (new Set(parsedSerials).size !== parsedSerials.length) {
        setAdjustMessage("Duplicate serial numbers found in the input list.")
        return
      }
    }

    const confirmed = window.confirm(
      `Confirm stock adjustment for ${adjustItem.itemName || adjustItem.itemCode}?`
    )

    if (!confirmed) return

    setIsAdjusting(true)
    setAdjustMessage("")

    try {
      await createStockAdjustment({
        branchId: adjustItem.branch?.id || viewingBranchId,
        batchId: adjustBatchId || undefined,
        itemId: adjustItem.id,
        type: adjustType,
        quantity,
        referenceNo: adjustReferenceNo.trim() || undefined,
        remarks: adjustRemarks.trim(),
        serialNumbers: adjustItem.isSerialized ? parsedSerials : undefined,
      })

      setNoticeMessage(`Stock adjustment recorded successfully for ${adjustItem.itemName}!`)
      await loadInventory()
      closeAdjustModal()
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not save stock adjustment. Please try again."

      setAdjustMessage(message)
    } finally {
      setIsAdjusting(false)
    }
  }
  const handleExportInventoryPdf = async () => {
    setErrorMessage("")

    try {
      const params = {
        limit: 100,
      }

      if (viewingBranchId) {
        params.branchId = viewingBranchId
      }

      if (searchText.trim()) {
        params.search = searchText.trim()
      }

      if (statusFilter) {
        params.status = statusFilter
      }

      if (lowStockOnly) {
        params.lowStockOnly = lowStockOnly
      }

      const exportItems = []
      let exportPage = 1
      let totalPages = 1

      do {
        const response = await getInventoryOverview({
          ...params,
          page: exportPage,
        })

        const result = response?.data || {}
        const pageItems = Array.isArray(result.data)
          ? result.data
          : []

        exportItems.push(...pageItems)

        totalPages = Math.max(
          1,
          Number(result.pagination?.totalPages || 1),
        )

        exportPage += 1
      } while (exportPage <= totalPages)

      exportInventoryPdf(exportItems, {
        branch: viewingBranch || selectedBranch,
        generatedBy: user,
        filters: [
          [
            "Search",
            searchText.trim() || "All inventory items",
          ],
          [
            "Status",
            statusFilter || "All statuses",
          ],
          [
            "Low stock only",
            lowStockOnly === "true" ? "Yes" : "No",
          ],
        ],
      })
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        "Could not export inventory PDF.",
      )
    }
  }

  const submitBulkStockRequest = async () => {
    if (!requestSourceBranchId || !selectedBranch?.id) {
      setRequestMessage("Choose source and destination branches first.")
      return
    }

    if (bulkRequestItems.length === 0) {
      setRequestMessage("Add at least one product.")
      return
    }

    const invalidItem = bulkRequestItems.find((item) => {
      const quantity = Number(item.quantity)
      const availableQuantity = Number(item.availableQuantity || 0)

      return (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > availableQuantity
      )
    })

    if (invalidItem) {
      setRequestMessage("Check quantities. Each quantity must be valid and within available stock.")
      return
    }

    const deliveryCharge = Number(requestDeliveryCharge || 0)

    if (
      requestFulfillmentMethod === "DELIVERY" &&
      (
        !Number.isFinite(deliveryCharge) ||
        deliveryCharge < 0 ||
        Math.abs(Math.round(deliveryCharge * 100) - deliveryCharge * 100) > 1e-8
      )
    ) {
      setRequestMessage("Delivery charge must be nonnegative with at most two decimal places.")
      return
    }

    setIsRequesting(true)
    setRequestMessage("")

    try {
      await createStockTransferRequest({
        fromBranchId: requestSourceBranchId,
        toBranchId: selectedBranch?.id,
        fulfillmentMethod: requestFulfillmentMethod,
        ...(requestFulfillmentMethod === "DELIVERY"
          ? { deliveryCharge }
          : {}),
        notes: "Bulk request from inventory page",
        items: bulkRequestItems.map((item) => ({
          itemId: item.id,
          quantity: Number(item.quantity),
          description: item.itemName || item.itemCode || "Requested item",
        })),
      })

      setRequestMessage("Bulk stock request sent successfully. Waiting for approval.")
      setBulkRequestItems([])
      setBulkSearchText("")
      setRequestFulfillmentMethod("PICKUP")
      setRequestDeliveryCharge("0")
      await loadInventory()
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ||
        "Could not send bulk stock request. Please try again."

      setRequestMessage(message)
    } finally {
      setIsRequesting(false)
    }
  }
  const submitStockRequest = async (event) => {
    event.preventDefault()

    if (!requestItem || !viewingBranchId) {
      setRequestMessage("Choose an item first.")
      return
    }

    const quantity = Number(requestQuantity)
    const availableQuantity = Number(requestItem.quantityAvailable || 0)
    const deliveryCharge = Number(requestDeliveryCharge || 0)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setRequestMessage("Enter a valid quantity.")
      return
    }

    if (quantity > availableQuantity) {
      setRequestMessage("Requested quantity is higher than available stock.")
      return
    }

    if (
      requestFulfillmentMethod === "DELIVERY" &&
      (
        !Number.isFinite(deliveryCharge) ||
        deliveryCharge < 0 ||
        Math.abs(Math.round(deliveryCharge * 100) - deliveryCharge * 100) > 1e-8
      )
    ) {
      setRequestMessage("Delivery charge must be nonnegative with at most two decimal places.")
      return
    }

    setIsRequesting(true)
    setRequestMessage("")

    try {
      await createStockTransferRequest({
        fromBranchId: requestSourceBranchId || viewingBranchId,
        toBranchId: selectedBranch?.id,
        fulfillmentMethod: requestFulfillmentMethod,
        ...(requestFulfillmentMethod === "DELIVERY"
          ? { deliveryCharge }
          : {}),
        notes: requestNotes.trim() || undefined,
        items: [
          {
            itemId: requestItem.id,
            quantity,
            description: requestItem.itemName || requestItem.itemCode || "Requested item",
          },
        ],
      })

      setRequestMessage("Stock request sent successfully.")
      setRequestItem(null)
      setRequestQuantity("1")
      setRequestFulfillmentMethod("PICKUP")
      setRequestDeliveryCharge("0")
      setRequestNotes("")
      await loadInventory()
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ||
        "Could not send stock request. Please try again."

      setRequestMessage(message)
    } finally {
      setIsRequesting(false)
    }
  }


  useEffect(() => {
    // Load branch options when the inventory view mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBranches()
  }, [loadBranches])

  useEffect(() => {
    if (selectedBranch?.id && !viewingBranchId) {
      // Adopt the authenticated branch once when no local selection exists.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewingBranchId(selectedBranch.id)
    }
  }, [selectedBranch?.id, viewingBranchId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadInventory()
    }, 300)

    return () => window.clearTimeout(timer)
  }, [loadInventory])

  useEffect(() => {
    const timer = window.setTimeout(loadRequestCatalog, 250)
    return () => window.clearTimeout(timer)
  }, [loadRequestCatalog])

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--color-accent)]">Inventory</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--color-text-strong)]">
            Branch Stock Overview
          </h1>
          <p className="mt-2 text-sm font-semibold text-[var(--color-muted)]">
            Monitor available stock, batches, serial count, and low-stock items.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {canAdjustStock ? (
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-black text-white transition hover:bg-[var(--color-maroon-hover)] shadow-xs"
              onClick={() => setIsAddStockOpen(true)}
              type="button"
            >
              <Plus size={16} />
              Add Stock
            </button>
          ) : null}
          {canOpenStockRequest ? (
            <button
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition"
              onClick={() => {
                setRequestSourceBranchId(requestSourceOptions[0]?.id || "")
                setBulkSearchText("")
                setBulkRequestItems([])
                setRequestMessage("")
                setRequestFulfillmentMethod("PICKUP")
                setRequestDeliveryCharge("0")
                setIsBulkRequestOpen(true)
              }}
              type="button"
            >
              Request stock
            </button>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              onClick={handleExportInventoryPdf}
              type="button"
            >
              Export PDF
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
              onClick={loadInventory}
              type="button"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
              size={18}
            />
            <input
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] py-3 pl-11 pr-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setSearchText(event.target.value)
                setPage(1)
              }}
              placeholder="Search item code, item name, brand, or model"
              value={searchText}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
              {pagination?.totalItems ?? items.length} item(s)
            </div>

            <button
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Viewing branch
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setViewingBranchId(event.target.value)
                setPage(1)
              }}
              value={viewingBranchId}
            >
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs font-semibold text-[var(--color-muted)]">
              Viewing only. This does not switch your whole app branch.
            </p>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Status
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              value={statusFilter}
            >
              <option value="">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Stock level
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setLowStockOnly(event.target.value)
                setPage(1)
              }}
              value={lowStockOnly}
            >
              <option value="">All stock levels</option>
              <option value="true">Low stock only</option>
            </select>
          </label>
        </div>
      </section>

      {noticeMessage ? (
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="shrink-0 text-emerald-600" size={16} />
            <span>{noticeMessage}</span>
          </div>
          <button onClick={() => setNoticeMessage("")} type="button" className="text-emerald-600 hover:text-emerald-900">
            <X size={14} />
          </button>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="flex items-start gap-3 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <span>{errorMessage}</span>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        {adjustItem && adjustMode === "ADJUST" && canAdjustStock && (user?.role === "SUPER_OWNER" || adjustItem.branch?.id === selectedBranch?.id) ? (
          <StockAdjustmentPanel
            item={adjustItem}
            batches={adjustBatches}
            batchId={adjustBatchId}
            type={adjustType}
            quantity={adjustQuantity}
            referenceNo={adjustReferenceNo}
            remarks={adjustRemarks}
            serialNumbersText={adjustSerialNumbersText}
            availableSerials={adjustAvailableSerials}
            onBatchChange={setAdjustBatchId}
            onTypeChange={setAdjustType}
            onQuantityChange={setAdjustQuantity}
            onReferenceNoChange={setAdjustReferenceNo}
            onRemarksChange={setAdjustRemarks}
            onSerialNumbersChange={setAdjustSerialNumbersText}
            message={adjustMessage}
            isSaving={isAdjusting}
            onSave={submitStockAdjustment}
            onClose={closeAdjustModal}
          />
        ) : null}
        {adjustItem && adjustMode === "BATCHES" ? (
          <section className="m-5 rounded-3xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#7A1F2B]">Batch details</p>
                <h3 className="mt-1 text-lg font-black text-[var(--color-text-strong)]">{adjustItem.itemName}</h3>
              </div>
              <button className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-black" onClick={closeAdjustModal} type="button">Close</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {adjustBatches.length > 0 ? adjustBatches.map((batch) => (
                <article className="rounded-2xl bg-white p-4" key={batch.id}>
                  <p className="font-black text-[var(--color-text-strong)]">{batch.batchCode}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">Available: {formatNumber(batch.quantityAvailable)}</p>
                  {canViewInventoryCosts ? <p className="mt-1 text-xs text-[var(--color-muted)]">Acquisition cost: {formatMoney(batch.unitCost)}</p> : null}
                  {canViewInventoryCosts ? <p className="mt-1 text-xs text-[var(--color-muted)]">Operational cost: {formatMoney(batch.operationalUnitCost ?? batch.unitCost)}</p> : null}
                  {batch.originBatch ? <p className="mt-1 text-xs text-[var(--color-muted)]">Origin batch: {batch.originBatch.batchCode}</p> : null}
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Status: {batch.status}</p>
                </article>
              )) : <p className="text-sm font-bold text-[var(--color-muted)]">No batches found.</p>}
            </div>
          </section>
        ) : null}
        {adjustItem && adjustMode === "BATCHES" ? (
          <StockMovementHistoryPanel movements={stockMovements} isLoading={isLoadingMovements} message={movementMessage} />
        ) : null}
        {isLoading ? (
          <div className="p-6 text-sm font-semibold text-[var(--color-muted)]">
            Loading inventory... Please wait.
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center p-8 text-center">
            <PackageSearch className="text-[var(--color-muted)]" size={38} />
            <p className="mt-3 font-bold text-[var(--color-text-strong)]">
              No matching inventory found
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Try clearing the filters or changing your search.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1240px] border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <tr>
                    <th className="min-w-[260px] px-4 py-3">Item</th>
                    <th className="whitespace-nowrap px-4 py-3">Available</th>
                    <th className="whitespace-nowrap px-4 py-3">Total In</th>
                    <th className="whitespace-nowrap px-4 py-3">Batches</th>
                    <th className="whitespace-nowrap px-4 py-3">Serials</th>
                    <th className="whitespace-nowrap px-4 py-3">Reorder</th>
                    <th className="whitespace-nowrap px-4 py-3">Tracking</th>
                    <th className="whitespace-nowrap px-4 py-3">Stock Level</th>
                    <th className="whitespace-nowrap px-4 py-3">Branch</th>
                    <th className="min-w-[170px] px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-border)]">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top transition hover:bg-[var(--color-soft)]">
                      <td className="min-w-[260px] px-4 py-4">
                        <p className="font-bold text-[var(--color-text-strong)]">
                          {item.itemName}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                          {item.itemCode}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {[item.brand, item.modelName].filter(Boolean).join(" • ") || "No brand/model"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {item.category?.name || "No category"} • {item.unit?.name || "No unit"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 font-bold text-[var(--color-text-strong)]">
                        {formatNumber(item.quantityAvailable)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--color-muted)]">
                        {formatNumber(item.quantityIn)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--color-muted)]">
                        {formatNumber(item.batchCount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--color-muted)]">
                        {formatNumber(item.serialCount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--color-muted)]">
                        {formatNumber(item.reorderLevel)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--color-muted)]">
                        {item.isSerialized ? "Serialized" : "Non-serialized"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <StockBadge item={item} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--color-muted)]">
                        {item.branch?.code || item.branch?.name || "No branch"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-xs font-black" onClick={() => openAdjustModal(item, "VIEW")} type="button">View details</button>
                          {canAdjustStock && (user?.role === "SUPER_OWNER" || item.branch?.id === selectedBranch?.id) ? (
                            <button className="rounded-2xl border border-[#7A1F2B] px-4 py-2 text-xs font-black text-[#7A1F2B]" onClick={() => openAdjustModal(item, "ADJUST")} type="button">Adjust stock</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 xl:hidden">
              {items.map((item) => (
                <InventoryMobileCard
                  item={item}
                  key={item.id}
                  canAdjust={canAdjustStock && (user?.role === "SUPER_OWNER" || item.branch?.id === selectedBranch?.id)}
                  onView={(i) => openAdjustModal(i, "VIEW")}
                  onAdjust={(i) => openAdjustModal(i, "ADJUST")}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {isBulkRequestOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
                  Stock Request
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Bulk Stock Request
                </h3>
              </div>

              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                onClick={() => {
                  setIsBulkRequestOpen(false)
                  setRequestSourceBranchId("")
                  setRequestCatalogItems([])
                  setBulkSearchText("")
                  setBulkRequestItems([])
                  setRequestMessage("")
                  setRequestFulfillmentMethod("PICKUP")
                  setRequestDeliveryCharge("0")
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Source Branch</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                    onChange={(event) => {
                      setRequestSourceBranchId(event.target.value)
                      setBulkRequestItems([])
                      setRequestMessage("")
                    }}
                    value={requestSourceBranchId}
                  >
                    {requestSourceOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.code} - {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Destination</span>
                    <span className="font-bold text-slate-900">
                      {selectedBranch?.code || selectedBranch?.name || "Your branch"}
                    </span>
                  </div>
                  <span className="rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold px-2 py-0.5">Target</span>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Fulfillment Method
                  </span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                    disabled={isRequesting}
                    onChange={(event) => {
                      const method = event.target.value
                      setRequestFulfillmentMethod(method)
                      if (method === "PICKUP") {
                        setRequestDeliveryCharge("0")
                      }
                      setRequestMessage("")
                    }}
                    value={requestFulfillmentMethod}
                  >
                    <option value="PICKUP">Pickup</option>
                    <option value="DELIVERY">Delivery</option>
                  </select>
                </label>

                {requestFulfillmentMethod === "DELIVERY" ? (
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Delivery Charge (₱)
                    </span>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                      disabled={isRequesting}
                      min="0"
                      onChange={(event) => setRequestDeliveryCharge(event.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={requestDeliveryCharge}
                    />
                  </label>
                ) : (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs font-medium text-slate-500 flex items-center">
                    Pickup — no delivery charge.
                  </div>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr] items-start pt-1">
                {/* Available Stock List */}
                <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Available Branch Stock
                    </p>
                    <span className="text-[11px] font-bold text-slate-500">
                      {filteredBulkItems.length} found
                    </span>
                  </div>

                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={15}
                    />
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                      onChange={(event) => setBulkSearchText(event.target.value)}
                      placeholder="Search code, name, brand…"
                      value={bulkSearchText}
                    />
                  </div>

                  <div className="max-h-[220px] sm:max-h-[260px] lg:max-h-[300px] space-y-2 overflow-y-auto pr-1 text-xs">
                    {isLoadingRequestCatalog ? (
                      <div className="rounded-xl bg-white p-4 text-center text-xs font-bold text-slate-400 border border-slate-200">
                        Loading requestable stock…
                      </div>
                    ) : filteredBulkItems.length > 0 ? (
                      filteredBulkItems.map((item) => (
                        <article
                          className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs transition hover:border-[var(--color-maroon)]"
                          key={item.id}
                        >
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 leading-snug truncate">
                                {item.itemName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[10px] font-bold text-slate-500">
                                  {item.itemCode}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {[item.brand, item.modelName].filter(Boolean).join(" • ")}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                Avail: {formatNumber(item.quantityAvailable)}
                              </span>
                              <button
                                className="rounded-lg bg-[var(--color-maroon)] px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                                disabled={Number(item.quantityAvailable || 0) <= 0}
                                onClick={() => addBulkRequestItem(item)}
                                type="button"
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-xl bg-white p-4 text-center text-xs font-bold text-slate-400 border border-slate-200">
                        No products found.
                      </div>
                    )}
                  </div>
                </section>

                {/* Selected Products Cart */}
                <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Request List
                      </p>
                      <h4 className="text-xs font-black text-slate-900">
                        Selected Products
                      </h4>
                    </div>
                    <span className="rounded-full bg-rose-50 border border-rose-200 text-[var(--color-maroon)] px-2 py-0.5 text-[10px] font-bold">
                      {bulkRequestItems.length} selected
                    </span>
                  </div>

                  {requestMessage ? (
                    <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-xs font-bold text-emerald-800">
                      {requestMessage}
                    </p>
                  ) : null}

                  <div className="max-h-[180px] sm:max-h-[220px] lg:max-h-[260px] space-y-2 overflow-y-auto pr-1 text-xs">
                    {bulkRequestItems.length > 0 ? (
                      bulkRequestItems.map((item) => (
                        <article
                          className="rounded-xl border border-slate-200 bg-slate-50/75 p-2.5"
                          key={item.id}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 truncate">
                                {item.itemName}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {item.itemCode} • Avail: {formatNumber(item.availableQuantity)}
                              </p>
                            </div>

                            <button
                              className="shrink-0 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50"
                              onClick={() => removeBulkRequestItem(item.id)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase text-slate-500">
                              Quantity:
                            </span>
                            <input
                              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 text-center outline-none focus:border-[var(--color-maroon)]"
                              max={item.availableQuantity}
                              min="1"
                              onChange={(event) =>
                                updateBulkRequestQuantity(item.id, event.target.value)
                              }
                              type="number"
                              value={item.quantity}
                            />
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs font-medium text-slate-400">
                        Selected items appear here. Click "+ Add" from list.
                      </div>
                    )}
                  </div>

                  <button
                    className="w-full rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    disabled={isRequesting || bulkRequestItems.length === 0}
                    onClick={submitBulkStockRequest}
                    type="button"
                  >
                    {isRequesting ? "Sending…" : `Send Request (${bulkRequestItems.length})`}
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {requestItem ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
                  Product Request
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Request Product
                </h3>
              </div>

              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                disabled={isRequesting}
                onClick={closeRequestModal}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={submitStockRequest}>
              <div className="p-5 space-y-3.5">
                <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                  <p className="font-bold text-slate-900">
                    {requestItem.itemName}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">
                    {requestItem.itemCode}
                  </p>
                  <div className="mt-2.5 grid gap-2 grid-cols-3 pt-2 border-t border-slate-200/60">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        From
                      </p>
                      <p className="font-bold text-slate-800">
                        {viewingBranch?.code || requestItem.branch?.code || "Viewed"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        To
                      </p>
                      <p className="font-bold text-slate-800">
                        {selectedBranch?.code || "Your branch"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Available
                      </p>
                      <p className="font-mono font-bold text-slate-900">
                        {formatNumber(requestItem.quantityAvailable)}
                      </p>
                    </div>
                  </div>
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Quantity
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isRequesting}
                    min="1"
                    onChange={(event) => setRequestQuantity(event.target.value)}
                    type="number"
                    value={requestQuantity}
                  />
                </label>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Fulfillment Method
                    </span>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                      disabled={isRequesting}
                      onChange={(event) => {
                        const method = event.target.value
                        setRequestFulfillmentMethod(method)
                        if (method === "PICKUP") {
                          setRequestDeliveryCharge("0")
                        }
                        setRequestMessage("")
                      }}
                      value={requestFulfillmentMethod}
                    >
                      <option value="PICKUP">Pickup</option>
                      <option value="DELIVERY">Delivery</option>
                    </select>
                  </label>

                  {requestFulfillmentMethod === "DELIVERY" ? (
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                        Delivery Charge
                      </span>
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                        disabled={isRequesting}
                        min="0"
                        onChange={(event) => setRequestDeliveryCharge(event.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={requestDeliveryCharge}
                      />
                    </label>
                  ) : (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs font-medium text-slate-500 flex items-center">
                      Pickup — no delivery charge.
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Notes
                  </span>
                  <textarea
                    className="mt-1 min-h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isRequesting}
                    onChange={(event) => setRequestNotes(event.target.value)}
                    placeholder="Optional note for the approving branch"
                    value={requestNotes}
                  />
                </label>

                {requestMessage ? (
                  <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-xs font-bold text-emerald-800">
                    {requestMessage}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  disabled={isRequesting}
                  onClick={closeRequestModal}
                  type="button"
                >
                  Cancel
                </button>

                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
                  disabled={isRequesting}
                  type="submit"
                >
                  {isRequesting ? "Sending…" : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {pagination ? (
        <section className="flex flex-col gap-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-[var(--color-muted)]">
            Page {pagination.page} of {pagination.totalPages} • {pagination.totalItems} item(s)
          </div>

          <div className="flex gap-3">
            <button
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
              type="button"
            >
              Previous
            </button>

            <button
              className="rounded-2xl border border-[var(--color-maroon)] bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-400 disabled:border-transparent"
              disabled={page >= pagination.totalPages || isLoading}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </section>
      ) : null}

      {/* Add Stock Modal */}
      <AddStockModal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        onSuccess={(msg) => setNoticeMessage(msg)}
        branchId={viewingBranchId}
        branchName={viewingBranch?.name || viewingBranch?.code}
      />
    </div>
  )
}
  