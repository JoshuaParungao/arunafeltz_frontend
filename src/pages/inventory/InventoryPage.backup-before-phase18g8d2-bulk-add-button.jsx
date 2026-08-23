import { useEffect, useState } from "react"
import { AlertCircle, PackageSearch, RefreshCw, Search } from "lucide-react"

import { getBranches } from "../../features/branches/branches.api"
import {
  createStockTransferRequest,
  getInventoryOverview,
} from "../../features/inventory/inventory.api"

function formatNumber(value) {
  const number = Number(value || 0)
  return number.toLocaleString("en-PH")
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

function InventoryMobileCard({ item }) {
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
    </article>
  )
}

export default function InventoryPage({ selectedBranch }) {
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
  const pageSize = 10
  const viewingBranch = branchOptions.find((branch) => branch.id === viewingBranchId)
  const isViewingOwnBranch = selectedBranch?.id && viewingBranchId === selectedBranch.id
  const canRequestFromViewedBranch = Boolean(viewingBranchId && !isViewingOwnBranch)
  const filteredBulkItems = items.filter((item) => {
    const keyword = bulkSearchText.trim().toLowerCase()

    if (!keyword) return true

    return [
      item.itemCode,
      item.itemName,
      item.brand,
      item.modelName,
      item.category?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(keyword)
  })

  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [requestItem, setRequestItem] = useState(null)
  const [requestQuantity, setRequestQuantity] = useState("1")
  const [requestNotes, setRequestNotes] = useState("")
  const [requestMessage, setRequestMessage] = useState("")
  const [isRequesting, setIsRequesting] = useState(false)

  const loadBranches = async () => {
    try {
      const response = await getBranches()
      const branches = response?.data

      setBranchOptions(Array.isArray(branches) ? branches : [])

      if (!viewingBranchId && selectedBranch?.id) {
        setViewingBranchId(selectedBranch.id)
      }
    } catch {
      setBranchOptions([])
    }
  }

  const loadInventory = async () => {
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
  }

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
  const openRequestModal = (item) => {
    setRequestMessage("")
    setRequestItem(item)
    setRequestQuantity("1")
    setRequestNotes("")
  }

  const closeRequestModal = () => {
    if (isRequesting) return

    setRequestItem(null)
    setRequestQuantity("1")
    setRequestNotes("")
  }

  const submitStockRequest = async (event) => {
    event.preventDefault()

    if (!requestItem || !viewingBranchId) {
      setRequestMessage("Choose an item first.")
      return
    }

    const quantity = Number(requestQuantity)
    const availableQuantity = Number(requestItem.quantityAvailable || 0)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setRequestMessage("Enter a valid quantity.")
      return
    }

    if (quantity > availableQuantity) {
      setRequestMessage("Requested quantity is higher than available stock.")
      return
    }

    setIsRequesting(true)
    setRequestMessage("")

    try {
      await createStockTransferRequest({
        fromBranchId: viewingBranchId,
        toBranchId: selectedBranch?.id,
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
    loadBranches()
  }, [])

  useEffect(() => {
    if (selectedBranch?.id && !viewingBranchId) {
      setViewingBranchId(selectedBranch.id)
    }
  }, [selectedBranch?.id, viewingBranchId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadInventory()
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchText, viewingBranchId, statusFilter, lowStockOnly, page])

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

        <button
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
          onClick={loadInventory}
          type="button"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
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
            {canRequestFromViewedBranch ? (
              <button
                className="mt-3 w-full rounded-2xl border border-[#7A1F2B] bg-white px-4 py-3 text-sm font-black text-[#7A1F2B] transition hover:bg-[#F4F1EC]"
                onClick={() => {
                  setBulkSearchText("")
                  setBulkRequestItems([])
                  setRequestMessage("")
                  setIsBulkRequestOpen(true)
                }}
                type="button"
              >
                Bulk request
              </button>
            ) : null}
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

      {errorMessage ? (
        <section className="flex items-start gap-3 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <span>{errorMessage}</span>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
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
                      <td className="whitespace-nowrap px-4 py-4">
                        {canRequestFromViewedBranch ? (
                          <button
                            className="inline-flex items-center justify-center rounded-2xl border border-[#7A1F2B] bg-white px-4 py-2 text-xs font-black text-[#7A1F2B] transition hover:bg-[#F4F1EC] disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:opacity-60"
                            disabled={Number(item.quantityAvailable || 0) <= 0}
                            onClick={() => openRequestModal(item)}
                            type="button"
                          >
                            Add to request
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-[var(--color-muted)]">
                            Own branch
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 xl:hidden">
              {items.map((item) => (
                <InventoryMobileCard item={item} key={item.id} />
              ))}
            </div>
          </>
        )}
      </section>

      {isBulkRequestOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Stock request
                </p>
                <h3 className="mt-1 text-xl font-black text-[var(--color-text-strong)]">
                  Bulk stock request
                </h3>
                <p className="mt-1 text-sm font-semibold text-[var(--color-muted)]">
                  Choose multiple products from the viewed branch and send one request.
                </p>
              </div>

              <button
                className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                onClick={() => {
                  setIsBulkRequestOpen(false)
                  setBulkSearchText("")
                  setBulkRequestItems([])
                  setRequestMessage("")
                }}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid min-h-0 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="min-h-0 rounded-3xl border border-[var(--color-border)] p-4">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                    size={18}
                  />
                  <input
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] py-3 pl-11 pr-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                    onChange={(event) => setBulkSearchText(event.target.value)}
                    placeholder="Search item code, item name, brand, or model"
                    value={bulkSearchText}
                  />
                </div>

                <div className="mt-4 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                  {filteredBulkItems.length > 0 ? (
                    filteredBulkItems.map((item) => (
                      <article
                        className="rounded-2xl border border-[var(--color-border)] bg-white p-4"
                        key={item.id}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-black text-[var(--color-text-strong)]">
                              {item.itemName}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[var(--color-muted)]">
                              {item.itemCode}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-muted)]">
                              {[item.brand, item.modelName].filter(Boolean).join(" • ") || "No brand/model"}
                            </p>
                          </div>

                          <div className="text-sm font-bold text-[var(--color-text-strong)]">
                            Available: {formatNumber(item.quantityAvailable)}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-[var(--color-soft)] p-5 text-sm font-bold text-[var(--color-muted)]">
                      No products found.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-[var(--color-border)] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Request list
                </p>
                <h4 className="mt-1 text-lg font-black text-[var(--color-text-strong)]">
                  Selected products
                </h4>

                <div className="mt-4 rounded-2xl bg-[var(--color-soft)] p-4 text-sm font-bold text-[var(--color-muted)]">
                  {bulkRequestItems.length} product(s) selected
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] p-5 text-sm font-semibold text-[var(--color-muted)]">
                  Selected items will appear here in the next step.
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <button
                    className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white opacity-60"
                    disabled
                    type="button"
                  >
                    Send bulk request
                  </button>
                  <p className="text-xs font-semibold text-[var(--color-muted)]">
                    Sending will be enabled after item selection is added.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
      {requestItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Product request
                </p>
                <h3 className="mt-1 text-xl font-black text-[var(--color-text-strong)]">
                  Request product
                </h3>
                <p className="mt-1 text-sm font-semibold text-[var(--color-muted)]">
                  This will send a request only. Stock will not move yet.
                </p>
              </div>

              <button
                className="rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                disabled={isRequesting}
                onClick={closeRequestModal}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-[var(--color-soft)] p-4">
              <p className="text-sm font-black text-[var(--color-text-strong)]">
                {requestItem.itemName}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                {requestItem.itemCode}
              </p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                    From
                  </p>
                  <p className="mt-1 font-black text-[var(--color-text-strong)]">
                    {viewingBranch?.code || requestItem.branch?.code || "Viewed branch"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                    To
                  </p>
                  <p className="mt-1 font-black text-[var(--color-text-strong)]">
                    {selectedBranch?.code || "Your branch"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                    Available
                  </p>
                  <p className="mt-1 font-black text-[var(--color-text-strong)]">
                    {formatNumber(requestItem.quantityAvailable)}
                  </p>
                </div>
              </div>
            </div>

            <form className="mt-5 space-y-4" onSubmit={submitStockRequest}>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Quantity
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                  disabled={isRequesting}
                  min="1"
                  onChange={(event) => setRequestQuantity(event.target.value)}
                  type="number"
                  value={requestQuantity}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Notes
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                  disabled={isRequesting}
                  onChange={(event) => setRequestNotes(event.target.value)}
                  placeholder="Optional note for the approving branch"
                  value={requestNotes}
                />
              </label>

              {requestMessage ? (
                <p className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)]">
                  {requestMessage}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  className="rounded-2xl border border-[var(--color-border)] px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isRequesting}
                  onClick={closeRequestModal}
                  type="button"
                >
                  Cancel
                </button>

                <button
                  className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isRequesting}
                  type="submit"
                >
                  {isRequesting ? "Sending..." : "Send request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {pagination ? (
        <section className="flex flex-col gap-3 rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-[var(--color-muted)]">
            Page {pagination.page} of {pagination.totalPages} • {pagination.totalItems} item(s)
          </div>

          <div className="flex gap-3">
            <button
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
              type="button"
            >
              Previous
            </button>

            <button
              className="rounded-2xl border border-[#7A1F2B] bg-white px-4 py-3 text-sm font-bold text-[#7A1F2B] transition hover:bg-[#F4F1EC] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page >= pagination.totalPages || isLoading}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}


















