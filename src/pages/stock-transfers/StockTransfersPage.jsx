import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Eye, RefreshCw, Search, X } from "lucide-react"

import {
  getStockTransferById,
  getStockTransfers,
  updateStockTransferPricingById,
  updateStockTransferStatusById,
} from "../../features/stock-transfers/stockTransfers.api"
import { getInventorySerials } from "../../features/inventory/inventory.api"
import { getUser } from "../../lib/sessionStorage"
import SerialScannerModal from "../../components/common/SerialScannerModal"

function formatDate(value) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("en-PH")
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—"
  return Number(value).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  })
}

function extractSerialRows(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data?.data)) return response.data.data
  if (Array.isArray(response?.data?.items)) return response.data.items
  if (Array.isArray(response?.data?.records)) return response.data.records
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.items)) return response.items
  return []
}

function StatusBadge({ status }) {
  const styles = {
    REQUESTED: "bg-amber-50 text-amber-700",
    APPROVED: "bg-blue-50 text-blue-700",
    REJECTED: "bg-rose-50 text-rose-700",
    POSTED: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-gray-100 text-gray-600",
    DRAFT: "bg-slate-100 text-slate-700",
  }

  const formatted = String(status || "Unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles[status] || styles.DRAFT}`}>{formatted}</span>
}

function isV2Transfer(transfer) {
  return transfer?.workflowVersion === 2 || Boolean(transfer?.fulfillmentMethod)
}

function WorkflowBadge({ transfer }) {
  if (isV2Transfer(transfer)) {
    return (
      <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-700">
        V2
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
      Legacy
    </span>
  )
}

function ActionButtons({ transfer, user, busy, onAction, onView }) {
  const isSuperOwner = user?.role === "SUPER_OWNER"
  const isSourceManager = isSuperOwner || transfer.fromBranchId === user?.branchId
  const isLinkedManager = isSourceManager || transfer.toBranchId === user?.branchId
  const isTerminal = ["POSTED", "REJECTED", "CANCELLED"].includes(transfer.status)
  const pricingComplete = (transfer.items || []).every(
    (item) => item.agreedTransferUnitPrice !== null && item.agreedTransferUnitPrice !== undefined
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition" onClick={() => onView(transfer)} type="button">
        <Eye size={13} /> Details
      </button>
      {isSourceManager && transfer.status === "DRAFT" ? (
        <button className="rounded-lg bg-[var(--color-maroon)] px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition" disabled={busy} onClick={() => onAction(transfer, "REQUESTED")} type="button">
          Request
        </button>
      ) : null}
      {isSourceManager && transfer.status === "REQUESTED" ? (
        <>
          <button className="rounded-lg bg-[var(--color-maroon)] px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !pricingComplete} onClick={() => onAction(transfer, "APPROVED")} title={!pricingComplete ? "Set every agreed transfer price before approval" : undefined} type="button">
            Approve
          </button>
          <button className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition" disabled={busy} onClick={() => onAction(transfer, "REJECTED")} type="button">
            Reject
          </button>
        </>
      ) : null}
      {isSourceManager && transfer.status === "APPROVED" ? (
        <button className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition" disabled={busy} onClick={() => onAction(transfer, "POSTED")} type="button">
          Fulfill / Post
        </button>
      ) : null}
      {isLinkedManager && !isTerminal ? (
        <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition" disabled={busy} onClick={() => onAction(transfer, "CANCELLED")} type="button">
          Cancel
        </button>
      ) : null}
    </div>
  )
}

export default function StockTransfersPage({ selectedBranch, user: userProp }) {
  const user = userProp || getUser()
  const branchId = selectedBranch?.id || (user?.role === "SUPER_OWNER" ? "" : user?.branchId || "")
  const [transfers, setTransfers] = useState([])
  const [pagination, setPagination] = useState(null)
  const [statusFilter, setStatusFilter] = useState("")
  const [searchText, setSearchText] = useState("")
  const [page, setPage] = useState(1)
  const [selectedTransfer, setSelectedTransfer] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [actionTransferId, setActionTransferId] = useState("")
  const [pricingDrafts, setPricingDrafts] = useState({})
  const isSelectedSourceManager = Boolean(
    selectedTransfer &&
      (user?.role === "SUPER_OWNER" || selectedTransfer.fromBranchId === user?.branchId)
  )
  const canEditSelectedPricing = Boolean(
    isSelectedSourceManager &&
      selectedTransfer &&
      ["DRAFT", "REQUESTED"].includes(selectedTransfer.status)
  )

  const loadTransfers = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await getStockTransfers({
        branchId: branchId || undefined,
        status: statusFilter || undefined,
        search: searchText.trim() || undefined,
        page,
        limit: 10,
      })
      const result = response?.data || {}
      setTransfers(Array.isArray(result.items) ? result.items : [])
      setPagination(result.pagination || null)
    } catch (error) {
      setTransfers([])
      setPagination(null)
      setErrorMessage(error?.response?.data?.error?.message || "Could not load stock transfers.")
    } finally {
      setIsLoading(false)
    }
  }, [branchId, page, searchText, statusFilter])

  const openTransfer = async (transfer) => {
    setSelectedTransfer(transfer)
    setIsLoadingDetail(true)
    try {
      const response = await getStockTransferById(transfer.id)
      const detail = response?.data || transfer
      setSelectedTransfer(detail)
      setPricingDrafts(
        Object.fromEntries(
          (detail.items || []).map((item) => [
            item.id,
            item.agreedTransferUnitPrice ?? item.proposedTransferUnitPrice ?? "",
          ])
        )
      )
    } catch (error) {
      setErrorMessage(error?.response?.data?.error?.message || "Could not load transfer details.")
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const saveTransferPricing = async () => {
    if (!selectedTransfer) return

    const invalidPricingItem = (selectedTransfer.items || []).find((item) => {
      const rawValue = pricingDrafts[item.id]
      const value = Number(rawValue)

      return (
        rawValue === "" ||
        !Number.isFinite(value) ||
        value < 0 ||
        Math.abs(Math.round(value * 100) - value * 100) > 1e-8
      )
    })

    if (invalidPricingItem) {
      setErrorMessage("Every agreed transfer price must be nonnegative with at most two decimal places.")
      return
    }

    const pricingItems = (selectedTransfer.items || []).map((item) => {
      return {
        stockTransferItemId: item.id,
        agreedTransferUnitPrice: Number(pricingDrafts[item.id]),
      }
    })

    setActionTransferId(selectedTransfer.id)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await updateStockTransferPricingById(selectedTransfer.id, {
        items: pricingItems,
      })
      const updatedTransfer = response?.data || selectedTransfer
      setSelectedTransfer(updatedTransfer)
      setPricingDrafts(
        Object.fromEntries(
          (updatedTransfer.items || []).map((item) => [
            item.id,
            item.agreedTransferUnitPrice ?? "",
          ])
        )
      )
      setSuccessMessage(`${updatedTransfer.transferCode} agreed pricing was saved.`)
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not save agreed transfer pricing."
      )
    } finally {
      setActionTransferId("")
    }
  }

  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false)
  const [serialModalTransfer, setSerialModalTransfer] = useState(null)
  const [serialModalItems, setSerialModalItems] = useState([])
  const [isFulfillingSerials, setIsFulfillingSerials] = useState(false)

  const updateTransferStatus = async (transfer, nextStatus, customPayload = null) => {
    const payload = customPayload || { status: nextStatus }

    if (!customPayload && (nextStatus === "REJECTED" || nextStatus === "CANCELLED")) {
      const label = nextStatus === "REJECTED" ? "rejecting" : "cancelling"
      const reason = window.prompt(`Reason for ${label} this transfer`)
      if (!reason?.trim()) {
        setErrorMessage(`${nextStatus === "REJECTED" ? "Rejection" : "Cancellation"} reason is required.`)
        return
      }
      payload[nextStatus === "REJECTED" ? "rejectionReason" : "cancellationReason"] = reason.trim()
    } else if (!customPayload && !window.confirm(`Confirm ${nextStatus.toLowerCase()} for ${transfer.transferCode}?`)) {
      return
    }

    setActionTransferId(transfer.id)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await updateStockTransferStatusById(transfer.id, payload)
      setSuccessMessage(`${response?.data?.transferCode || transfer.transferCode} is ${nextStatus.toLowerCase()}.`)
      if (selectedTransfer?.id === transfer.id) setSelectedTransfer(response?.data || null)
      await loadTransfers()
    } catch (error) {
      setErrorMessage(error?.response?.data?.error?.message || "Could not update stock transfer.")
    } finally {
      setActionTransferId("")
    }
  }

  const handleAction = async (transfer, nextStatus) => {
    if (nextStatus === "POSTED") {
      setActionTransferId(transfer.id)
      setErrorMessage("")
      setSuccessMessage("")

      try {
        const response = await getStockTransferById(transfer.id)
        const detail = response?.data || transfer
        const serializedLines = (detail.items || []).filter(
          (item) => item.item?.isSerialized || item.isSerialized
        )

        if (serializedLines.length > 0) {
          const fromBranchId = detail.fromBranchId || detail.fromBranch?.id || transfer.fromBranchId || transfer.fromBranch?.id
          const itemsWithSerials = await Promise.all(
            serializedLines.map(async (line) => {
              const itemId = line.itemId || line.item?.id
              const serialRes = await getInventorySerials({
                branchId: fromBranchId,
                itemId,
                status: "AVAILABLE",
                limit: 100,
              })
              let serialRows = extractSerialRows(serialRes)

              // Fallback: if no serials returned by itemId, try fetching by branchId + search itemCode
              if (serialRows.length === 0 && (line.item?.itemCode || line.itemCode)) {
                try {
                  const fallbackRes = await getInventorySerials({
                    branchId: fromBranchId,
                    search: line.item?.itemCode || line.itemCode,
                    status: "AVAILABLE",
                    limit: 100,
                  })
                  const fallbackRows = extractSerialRows(fallbackRes)
                  if (fallbackRows.length > 0) {
                    serialRows = fallbackRows
                  }
                } catch {
                  // ignore fallback error
                }
              }

              return {
                stockTransferItemId: line.id,
                itemId,
                itemName: line.item?.itemName || line.description || "Item",
                itemCode: line.item?.itemCode || "",
                requiredQuantity: Number(line.quantity || 1),
                availableSerials: serialRows,
              }
            })
          )

          setSerialModalTransfer(detail)
          setSerialModalItems(itemsWithSerials)
          setIsSerialModalOpen(true)
          return
        }
      } catch (error) {
        setErrorMessage(
          error?.response?.data?.error?.message ||
            error?.message ||
            "Could not load transfer details for serial verification."
        )
        return
      } finally {
        setActionTransferId("")
      }
    }

    await updateTransferStatus(transfer, nextStatus)
  }

  const handleConfirmSerialFulfillment = async (selectedSerialsMap) => {
    if (!serialModalTransfer) return

    setIsFulfillingSerials(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const itemsPayload = Object.entries(selectedSerialsMap).map(
        ([stockTransferItemId, val]) => {
          if (Array.isArray(val)) {
            return {
              stockTransferItemId,
              serialIds: val,
              newSerialNumbers: [],
            }
          }
          return {
            stockTransferItemId,
            serialIds: val?.serialIds || [],
            newSerialNumbers: val?.newSerialNumbers || [],
          }
        }
      )

      const response = await updateStockTransferStatusById(
        serialModalTransfer.id,
        {
          status: "POSTED",
          items: itemsPayload,
        }
      )

      setSuccessMessage(
        `${response?.data?.transferCode || serialModalTransfer.transferCode} successfully fulfilled and dispatched with assigned serial numbers.`
      )
      setIsSerialModalOpen(false)
      setSerialModalTransfer(null)
      setSerialModalItems([])
      if (selectedTransfer?.id === serialModalTransfer.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not complete serial transfer fulfillment."
      )
    } finally {
      setIsFulfillingSerials(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadTransfers, 250)
    return () => window.clearTimeout(timer)
  }, [loadTransfers])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Supply / Stock</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Stock Transfers</h1>
            <p className="mt-0.5 text-xs text-slate-500">Requests remain auditable. Approval reserves no stock; fulfillment posts both branch movements atomically.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition" onClick={loadTransfers} type="button">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </section>

      {errorMessage ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 flex items-center gap-2"><AlertCircle size={15} />{errorMessage}</div> : null}
      {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{successMessage}</div> : null}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:grid-cols-[1fr_200px]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSearchText(event.target.value); setPage(1) }} placeholder="Search code or notes…" value={searchText} />
        </label>
        <select className="rounded-xl border border-slate-200 bg-white text-slate-800 px-3 py-2 text-xs outline-none focus:border-[var(--color-maroon)] font-semibold" onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} value={statusFilter}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="REQUESTED">Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="POSTED">Posted</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1060px] text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Transfer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? <tr><td className="px-4 py-8 text-center font-bold text-slate-400" colSpan={7}>Loading stock transfers…</td></tr> : null}
              {!isLoading && transfers.length === 0 ? <tr><td className="px-4 py-8 text-center font-bold text-slate-400" colSpan={7}>No stock transfers found.</td></tr> : null}
              {!isLoading ? transfers.map((transfer) => (
                <tr className="hover:bg-slate-50/50 transition" key={transfer.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono font-bold text-slate-900">{transfer.transferCode}</p>
                      <WorkflowBadge transfer={transfer} />
                    </div>
                    <p className="mt-0.5 max-w-52 truncate text-[11px] text-slate-500">{transfer.notes || "No notes"}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={transfer.status} /></td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{transfer.fromBranch?.code || "—"} → {transfer.toBranch?.code || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{transfer.requestedBy?.fullName || transfer.requestedBy?.username || "—"}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">{transfer.items?.length || 0}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(transfer.requestedAt || transfer.transferDate)}</td>
                  <td className="px-4 py-3 text-right"><ActionButtons transfer={transfer} user={user} busy={actionTransferId === transfer.id} onAction={handleAction} onView={openTransfer} /></td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2.5 p-3 xl:hidden">
          {isLoading ? <p className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-400">Loading stock transfers…</p> : null}
          {!isLoading && transfers.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-400">No stock transfers found.</p> : null}
          {!isLoading ? transfers.map((transfer) => (
            <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs text-xs" key={transfer.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono font-bold text-slate-900">{transfer.transferCode}</p>
                    <WorkflowBadge transfer={transfer} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{transfer.fromBranch?.code || "—"} → {transfer.toBranch?.code || "—"}</p>
                </div>
                <StatusBadge status={transfer.status} />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{transfer.items?.length || 0} line(s) · {formatDate(transfer.requestedAt || transfer.transferDate)}</p>
              <div className="mt-3"><ActionButtons transfer={transfer} user={user} busy={actionTransferId === transfer.id} onAction={handleAction} onView={openTransfer} /></div>
            </article>
          )) : null}
        </div>

        {pagination ? (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500">
            <p>Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems} transfer(s)</p>
            <div className="flex gap-1.5">
              <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => Math.max(value - 1, 1))} type="button">Previous</button>
              <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page >= pagination.totalPages || isLoading} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
            </div>
          </div>
        ) : null}
      </section>

      {selectedTransfer ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <section className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-maroon)]">{selectedTransfer.transferCode}</span>
                  <WorkflowBadge transfer={selectedTransfer} />
                  <StatusBadge status={selectedTransfer.status} />
                </div>
                <h2 className="mt-0.5 text-base font-black text-slate-900 leading-tight">Stock Transfer Details</h2>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setSelectedTransfer(null)} type="button" aria-label="Close">
                <X size={16} />
              </button>
            </header>

            {isLoadingDetail ? (
              <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-500">Loading detail…</div>
            ) : (
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">From Branch</p><p className="mt-1 font-bold text-slate-900">{selectedTransfer.fromBranch?.code || "—"}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">To Branch</p><p className="mt-1 font-bold text-slate-900">{selectedTransfer.toBranch?.code || "—"}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Requested</p><p className="mt-1 font-semibold text-slate-700">{formatDate(selectedTransfer.requestedAt || selectedTransfer.transferDate)}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Posted</p><p className="mt-1 font-semibold text-slate-700">{formatDate(selectedTransfer.postedAt)}</p></div>
                  {selectedTransfer.fulfillmentMethod ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Fulfillment</p><p className="mt-1 font-semibold text-slate-700">{selectedTransfer.fulfillmentMethod.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}{selectedTransfer.fulfillmentStatus ? ` (${selectedTransfer.fulfillmentStatus.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())})` : ""}</p></div>
                  ) : null}
                  {selectedTransfer.paymentStatus ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Payment</p><p className="mt-1 font-semibold text-slate-700">{selectedTransfer.paymentStatus.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</p></div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {selectedTransfer.items?.map((item) => (
                    <article className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs" key={item.id}>
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{item.item?.itemCode || "—"} · {item.item?.itemName || item.description || "Item"}</p>
                          <p className="text-[11px] text-slate-500">{item.description || item.item?.itemName || ""}</p>
                        </div>
                        <p className="font-mono font-bold text-slate-900">Qty {formatQuantity(item.quantity)}</p>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">Source batch: {item.fromBatch?.batchCode || "Automatic FIFO / serial allocation"}</p>

                      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400">Proposed / Unit</p><p className="mt-0.5 font-mono font-bold text-slate-800">{formatMoney(item.proposedTransferUnitPrice)}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400">Agreed / Unit</p><p className="mt-0.5 font-mono font-bold text-slate-800">{formatMoney(item.agreedTransferUnitPrice)}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400">Transfer Amount</p><p className="mt-0.5 font-mono font-black text-[var(--color-maroon)]">{formatMoney(item.transferAmount)}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400">Dest. Item</p><p className="mt-0.5 font-bold text-slate-800 truncate">{item.destinationItem?.itemCode || "Locks on approval"}</p></div>
                      </div>

                      {canEditSelectedPricing ? (
                        <label className="mt-2.5 block">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Agreed transfer price / unit</span>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                            min="0"
                            onChange={(event) =>
                              setPricingDrafts((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            step="0.01"
                            type="number"
                            value={pricingDrafts[item.id] ?? ""}
                          />
                        </label>
                      ) : null}

                      {item.allocations?.length ? (
                        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Posted Allocations</p>
                          {item.allocations.map((allocation) => (
                            <div className="rounded-lg bg-slate-50/75 border border-slate-100 p-2 text-[11px]" key={allocation.id}>
                              <div className="grid gap-1.5 sm:grid-cols-3">
                                <p><span className="font-bold text-slate-600">Route:</span> {allocation.sourceBatch?.batchCode} → {allocation.destinationBatch?.batchCode}</p>
                                <p><span className="font-bold text-slate-600">Qty:</span> {formatQuantity(allocation.quantity)}</p>
                                <p><span className="font-bold text-slate-600">Transfer Val:</span> {formatMoney(allocation.transferAmount)}</p>
                              </div>
                              {allocation.serials?.length ? <p className="mt-1 text-[10px] text-slate-500">Serials: {allocation.serials.map((serial) => serial.serialNumberSnapshot).join(", ")}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {item.serials?.length ? <p className="mt-2 text-[11px] text-slate-500">Serials: {item.serials.map((serial) => serial.serialNumberSnapshot).join(", ")}</p> : null}
                    </article>
                  ))}
                </div>

                {canEditSelectedPricing ? (
                  <button className="rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50" disabled={actionTransferId === selectedTransfer.id} onClick={saveTransferPricing} type="button">
                    {actionTransferId === selectedTransfer.id ? "Saving pricing…" : "Save Agreed Pricing"}
                  </button>
                ) : null}

                <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Total Internal Transfer Value</p>
                  <p className="mt-0.5 font-mono font-black text-slate-900 text-sm">{formatMoney((selectedTransfer.items || []).reduce((sum, item) => sum + Number(item.transferAmount || 0), 0))}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Internal transfer accounting, not customer sales revenue.</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                  <div className="text-[11px] text-slate-500">
                    <span>Requested by: <strong className="text-slate-700">{selectedTransfer.requestedBy?.fullName || selectedTransfer.requestedBy?.username || "—"}</strong></span>
                  </div>
                  <ActionButtons transfer={selectedTransfer} user={user} busy={actionTransferId === selectedTransfer.id} onAction={handleAction} onView={() => {}} />
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      <SerialScannerModal
        isOpen={isSerialModalOpen}
        items={serialModalItems}
        isSubmitting={isFulfillingSerials}
        onClose={() => {
          if (!isFulfillingSerials) {
            setIsSerialModalOpen(false)
            setSerialModalTransfer(null)
            setSerialModalItems([])
          }
        }}
        onConfirm={handleConfirmSerialFulfillment}
        subtitle={`Scan barcode or type serial numbers from ${serialModalTransfer?.fromBranch?.name || serialModalTransfer?.fromBranch?.code || "source branch"} to dispatch.`}
        title="Fulfill Stock Transfer"
        transferCode={serialModalTransfer?.transferCode || ""}
      />
    </div>
  )
}

