import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Eye, RefreshCw, Search, X } from "lucide-react"

import {
  getStockTransferById,
  getStockTransfers,
  updateStockTransferPricingById,
  updateStockTransferStatusById,
} from "../../features/stock-transfers/stockTransfers.api"
import { getUser } from "../../lib/sessionStorage"

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

function StatusBadge({ status }) {
  const styles = {
    REQUESTED: "bg-amber-50 text-amber-700",
    APPROVED: "bg-blue-50 text-blue-700",
    REJECTED: "bg-rose-50 text-rose-700",
    POSTED: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-gray-100 text-gray-600",
    DRAFT: "bg-slate-100 text-slate-700",
  }

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles[status] || styles.DRAFT}`}>{status || "UNKNOWN"}</span>
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
    <div className="flex flex-wrap gap-2">
      <button className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-black" onClick={() => onView(transfer)} type="button">
        <Eye size={14} /> Details
      </button>
      {isSourceManager && transfer.status === "DRAFT" ? <button className="rounded-xl bg-[#7A1F2B] px-3 py-2 text-xs font-black text-white" disabled={busy} onClick={() => onAction(transfer, "REQUESTED")} type="button">Request</button> : null}
      {isSourceManager && transfer.status === "REQUESTED" ? <>
        <button className="rounded-xl bg-[#7A1F2B] px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !pricingComplete} onClick={() => onAction(transfer, "APPROVED")} title={!pricingComplete ? "Set every agreed transfer price before approval" : undefined} type="button">Approve</button>
        <button className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-black text-rose-700" disabled={busy} onClick={() => onAction(transfer, "REJECTED")} type="button">Reject</button>
      </> : null}
      {isSourceManager && transfer.status === "APPROVED" ? <button className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white" disabled={busy} onClick={() => onAction(transfer, "POSTED")} type="button">Fulfill / post</button> : null}
      {isLinkedManager && !isTerminal ? <button className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-black text-gray-600" disabled={busy} onClick={() => onAction(transfer, "CANCELLED")} type="button">Cancel</button> : null}
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

  const updateTransferStatus = async (transfer, nextStatus) => {
    const payload = { status: nextStatus }

    if (nextStatus === "REJECTED" || nextStatus === "CANCELLED") {
      const label = nextStatus === "REJECTED" ? "rejecting" : "cancelling"
      const reason = window.prompt(`Reason for ${label} this transfer`)
      if (!reason?.trim()) {
        setErrorMessage(`${nextStatus === "REJECTED" ? "Rejection" : "Cancellation"} reason is required.`)
        return
      }
      payload[nextStatus === "REJECTED" ? "rejectionReason" : "cancellationReason"] = reason.trim()
    } else if (!window.confirm(`Confirm ${nextStatus.toLowerCase()} for ${transfer.transferCode}?`)) {
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

  useEffect(() => {
    const timer = window.setTimeout(loadTransfers, 250)
    return () => window.clearTimeout(timer)
  }, [loadTransfers])

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#7A1F2B]">Supply / Stock</p>
            <h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Stock Transfers</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--color-muted)]">Requests remain auditable. Approval reserves no stock; fulfillment posts both branch movements atomically.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-black" onClick={loadTransfers} type="button"><RefreshCw size={16} /> Refresh</button>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={17} />
            <input className="w-full rounded-2xl border border-[var(--color-border)] py-3 pl-11 pr-4 text-sm font-bold" onChange={(event) => { setSearchText(event.target.value); setPage(1) }} placeholder="Search code or notes" value={searchText} />
          </label>
          <select className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold" onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} value={statusFilter}>
            <option value="">All statuses</option><option value="DRAFT">Draft</option><option value="REQUESTED">Requested</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="POSTED">Posted</option><option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {errorMessage ? <div className="mt-4 flex gap-3 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700"><AlertCircle className="shrink-0" size={18} />{errorMessage}</div> : null}
        {successMessage ? <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">{successMessage}</div> : null}

        <div className="mt-5 hidden overflow-x-auto rounded-3xl border border-[var(--color-border)] xl:block">
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]"><tr><th className="px-4 py-3">Transfer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Requested by</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isLoading ? <tr><td className="px-4 py-8 text-center font-bold text-[var(--color-muted)]" colSpan={7}>Loading stock transfers...</td></tr> : null}
              {!isLoading && transfers.length === 0 ? <tr><td className="px-4 py-8 text-center font-bold text-[var(--color-muted)]" colSpan={7}>No stock transfers found.</td></tr> : null}
              {!isLoading ? transfers.map((transfer) => <tr className="align-top" key={transfer.id}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5">
                    <p className="font-black">{transfer.transferCode}</p>
                    <WorkflowBadge transfer={transfer} />
                  </div>
                  <p className="mt-1 max-w-52 truncate text-xs text-[var(--color-muted)]">{transfer.notes || "No notes"}</p>
                </td>
                <td className="px-4 py-4"><StatusBadge status={transfer.status} /></td>
                <td className="px-4 py-4 font-bold">{transfer.fromBranch?.code || "—"} → {transfer.toBranch?.code || "—"}</td>
                <td className="px-4 py-4">{transfer.requestedBy?.fullName || transfer.requestedBy?.username || "—"}</td>
                <td className="px-4 py-4 font-bold">{transfer.items?.length || 0}</td>
                <td className="px-4 py-4 text-[var(--color-muted)]">{formatDate(transfer.requestedAt || transfer.transferDate)}</td>
                <td className="px-4 py-4"><ActionButtons transfer={transfer} user={user} busy={actionTransferId === transfer.id} onAction={updateTransferStatus} onView={openTransfer} /></td>
              </tr>) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-4 xl:hidden">
          {isLoading ? <p className="rounded-2xl bg-[var(--color-soft)] p-4 text-sm font-bold text-[var(--color-muted)]">Loading stock transfers...</p> : null}
          {!isLoading && transfers.length === 0 ? <p className="rounded-2xl bg-[var(--color-soft)] p-4 text-sm font-bold text-[var(--color-muted)]">No stock transfers found.</p> : null}
          {!isLoading ? transfers.map((transfer) => <article className="rounded-3xl border border-[var(--color-border)] p-4" key={transfer.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-black">{transfer.transferCode}</p>
                  <WorkflowBadge transfer={transfer} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{transfer.fromBranch?.code || "—"} → {transfer.toBranch?.code || "—"}</p>
              </div>
              <StatusBadge status={transfer.status} />
            </div>
            <p className="mt-3 text-sm text-[var(--color-muted)]">{transfer.items?.length || 0} line(s) • {formatDate(transfer.requestedAt || transfer.transferDate)}</p>
            <div className="mt-4"><ActionButtons transfer={transfer} user={user} busy={actionTransferId === transfer.id} onAction={updateTransferStatus} onView={openTransfer} /></div>
          </article>) : null}
        </div>

        {pagination ? <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-bold text-[var(--color-muted)]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalItems} transfer(s)</p><div className="flex gap-2"><button className="rounded-xl border px-4 py-2 text-sm font-black disabled:opacity-50" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => Math.max(value - 1, 1))} type="button">Previous</button><button className="rounded-xl border px-4 py-2 text-sm font-black disabled:opacity-50" disabled={page >= pagination.totalPages || isLoading} onClick={() => setPage((value) => value + 1)} type="button">Next</button></div></div> : null}
      </section>

      {selectedTransfer ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
        <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#7A1F2B]">Transfer detail</p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-xl font-black">{selectedTransfer.transferCode}</h2>
                <WorkflowBadge transfer={selectedTransfer} />
              </div>
              <div className="mt-2"><StatusBadge status={selectedTransfer.status} /></div>
            </div>
            <button className="rounded-xl border p-2" onClick={() => setSelectedTransfer(null)} type="button" aria-label="Close"><X size={18} /></button>
          </div>
          {isLoadingDetail ? <p className="mt-5 rounded-2xl bg-[var(--color-soft)] p-4 text-sm font-bold">Loading detail...</p> : <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-black uppercase text-[var(--color-muted)]">From</p><p className="mt-1 font-black">{selectedTransfer.fromBranch?.code || "—"}</p></div>
              <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-black uppercase text-[var(--color-muted)]">To</p><p className="mt-1 font-black">{selectedTransfer.toBranch?.code || "—"}</p></div>
              <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-black uppercase text-[var(--color-muted)]">Requested</p><p className="mt-1 text-sm font-bold">{formatDate(selectedTransfer.requestedAt || selectedTransfer.transferDate)}</p></div>
              <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-black uppercase text-[var(--color-muted)]">Posted</p><p className="mt-1 text-sm font-bold">{formatDate(selectedTransfer.postedAt)}</p></div>
              {selectedTransfer.fulfillmentMethod ? (
                <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-black uppercase text-[var(--color-muted)]">Fulfillment</p><p className="mt-1 text-sm font-bold">{selectedTransfer.fulfillmentMethod}{selectedTransfer.fulfillmentStatus ? ` (${selectedTransfer.fulfillmentStatus})` : ""}</p></div>
              ) : null}
              {selectedTransfer.paymentStatus ? (
                <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-black uppercase text-[var(--color-muted)]">Payment</p><p className="mt-1 text-sm font-bold">{selectedTransfer.paymentStatus}</p></div>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {selectedTransfer.items?.map((item) => (
                <article className="rounded-2xl border border-[var(--color-border)] p-4" key={item.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <div>
                      <p className="font-black">{item.item?.itemCode || "—"} - {item.item?.itemName || item.description || "Item"}</p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{item.description || item.item?.itemName || ""}</p>
                    </div>
                    <p className="font-black">Qty {formatQuantity(item.quantity)}</p>
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">Source batch: {item.fromBatch?.batchCode || "Automatic FIFO / serial allocation"}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-[var(--color-soft)] p-3">
                      <p className="text-xs font-black uppercase text-[var(--color-muted)]">Proposed / unit</p>
                      <p className="mt-1 font-black">{formatMoney(item.proposedTransferUnitPrice)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--color-soft)] p-3">
                      <p className="text-xs font-black uppercase text-[var(--color-muted)]">Agreed / unit</p>
                      <p className="mt-1 font-black">{formatMoney(item.agreedTransferUnitPrice)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--color-soft)] p-3">
                      <p className="text-xs font-black uppercase text-[var(--color-muted)]">Transfer amount</p>
                      <p className="mt-1 font-black">{formatMoney(item.transferAmount)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--color-soft)] p-3">
                      <p className="text-xs font-black uppercase text-[var(--color-muted)]">Destination item</p>
                      <p className="mt-1 font-black">{item.destinationItem?.itemCode || "Locks on approval"}</p>
                    </div>
                  </div>

                  {canEditSelectedPricing ? (
                    <label className="mt-4 block">
                      <span className="text-xs font-black uppercase text-[var(--color-muted)]">Agreed transfer price / unit</span>
                      <input
                        className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-black"
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

                  <div className="mt-3 grid gap-1 text-xs text-[var(--color-muted)]">
                    <p>Proposed by: {item.priceProposedBy?.fullName || item.priceProposedBy?.username || "—"} · {formatDate(item.priceProposedAt)}</p>
                    <p>Agreed by: {item.priceSetBy?.fullName || item.priceSetBy?.username || "—"} · {formatDate(item.priceSetAt)}</p>
                    <p>Price locked: {formatDate(item.priceLockedAt)}</p>
                  </div>

                  {item.allocations?.length ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">Posted allocation and accounting</p>
                      {item.allocations.map((allocation) => (
                        <div className="rounded-xl border border-[var(--color-border)] p-3" key={allocation.id}>
                          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                            <p><span className="font-black">Route:</span> {allocation.sourceBatch?.batchCode} → {allocation.destinationBatch?.batchCode}</p>
                            <p><span className="font-black">Quantity:</span> {formatQuantity(allocation.quantity)}</p>
                            <p><span className="font-black">Transfer value:</span> {formatMoney(allocation.transferAmount)}</p>
                            <p><span className="font-black">Acquisition:</span> {formatMoney(allocation.acquisitionUnitCostSnapshot)}</p>
                            <p><span className="font-black">Source operational:</span> {formatMoney(allocation.sourceOperationalUnitCostSnapshot)}</p>
                            <p><span className="font-black">Destination operational:</span> {formatMoney(allocation.destinationOperationalUnitCostSnapshot)}</p>
                          </div>
                          {allocation.serials?.length ? <p className="mt-2 break-words text-xs text-[var(--color-muted)]">Serial lineage: {allocation.serials.map((serial) => serial.serialNumberSnapshot).join(", ")}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {item.serials?.length ? <p className="mt-3 break-words text-xs text-[var(--color-muted)]">Serials: {item.serials.map((serial) => serial.serialNumberSnapshot).join(", ")}</p> : null}
                </article>
              ))}
            </div>
            {canEditSelectedPricing ? <button className="mt-4 rounded-xl bg-[#7A1F2B] px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={actionTransferId === selectedTransfer.id} onClick={saveTransferPricing} type="button">{actionTransferId === selectedTransfer.id ? "Saving pricing..." : "Save agreed pricing"}</button> : null}
            <div className="mt-4 rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-black uppercase text-[var(--color-muted)]">Total internal transfer value</p><p className="mt-1 text-lg font-black">{formatMoney((selectedTransfer.items || []).reduce((sum, item) => sum + Number(item.transferAmount || 0), 0))}</p><p className="mt-1 text-xs text-[var(--color-muted)]">This is internal transfer accounting, not ordinary customer sales revenue.</p></div>
            <div className="mt-5 grid gap-2 text-sm text-[var(--color-muted)]"><p>Requested by: {selectedTransfer.requestedBy?.fullName || selectedTransfer.requestedBy?.username || "—"}</p><p>Approved by: {selectedTransfer.approvedBy?.fullName || selectedTransfer.approvedBy?.username || "—"}</p><p>Posted by: {selectedTransfer.postedBy?.fullName || selectedTransfer.postedBy?.username || "—"}</p>{selectedTransfer.rejectionReason ? <p>Rejection: {selectedTransfer.rejectionReason}</p> : null}{selectedTransfer.cancellationReason ? <p>Cancellation: {selectedTransfer.cancellationReason}</p> : null}</div>
            <div className="mt-5"><ActionButtons transfer={selectedTransfer} user={user} busy={actionTransferId === selectedTransfer.id} onAction={updateTransferStatus} onView={() => {}} /></div>
          </>}
        </section>
      </div> : null}
    </div>
  )
}
