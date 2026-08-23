import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Eye,
  FilterX,
  History,
  LoaderCircle,
  PackageSearch,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Tag,
  X,
} from "lucide-react"

import { USER_ROLES } from "../../constants/roles"
import { getBranches } from "../../features/branches/branches.api"
import {
  createStockIn,
  getInventoryBatches,
  getInventoryMovements,
  getInventorySerials,
} from "../../features/inventory/inventory.api"
import { getItems } from "../../features/items/items.api"
import apiClient from "../../lib/apiClient"

const SERIAL_MANAGER_ROLES = new Set([
  USER_ROLES.SUPER_OWNER,
  USER_ROLES.BRANCH_OWNER,
  USER_ROLES.ADMIN,
  USER_ROLES.CASHIER,
  USER_ROLES.TECHNICIAN,
])

const SERIAL_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "RETURNED",
  "WARRANTY",
  "DAMAGED",
  "LOST",
]

const STATUS_STYLES = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  RESERVED: "border-blue-200 bg-blue-50 text-blue-700",
  SOLD: "border-violet-200 bg-violet-50 text-violet-700",
  RETURNED: "border-cyan-200 bg-cyan-50 text-cyan-700",
  WARRANTY: "border-amber-200 bg-amber-50 text-amber-800",
  DAMAGED: "border-orange-200 bg-orange-50 text-orange-800",
  LOST: "border-red-200 bg-red-50 text-red-700",
}

const SAFE_MANUAL_TRANSITIONS = {
  AVAILABLE: ["RESERVED", "DAMAGED", "LOST"],
  RESERVED: ["AVAILABLE", "DAMAGED", "LOST"],
  RETURNED: ["AVAILABLE", "DAMAGED", "LOST"],
  DAMAGED: ["AVAILABLE", "LOST"],
  LOST: ["AVAILABLE", "DAMAGED"],
  SOLD: [],
  WARRANTY: [],
}

function formatStatus(value) {
  return String(value || "Unknown")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function getApiErrorMessage(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    fallback
  )
}

function getInventoryResult(response) {
  const result = response?.data || {}

  return {
    rows: Array.isArray(result.data) ? result.data : [],
    pagination: result.pagination || null,
  }
}

function getCatalogRows(response) {
  const result = response?.data || {}
  return Array.isArray(result.items) ? result.items : []
}

async function updateInventorySerialStatus(serialId, payload) {
  const response = await apiClient.patch(`/inventory/serials/${serialId}/status`, payload)
  return response.data
}

function StatusBadge({ status }) {
  const normalized = String(status || "UNKNOWN").toUpperCase()

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${
        STATUS_STYLES[normalized] || "border-slate-200 bg-slate-100 text-slate-700"
      }`}
    >
      {formatStatus(normalized)}
    </span>
  )
}

function ErrorBanner({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
      <AlertCircle className="mt-0.5 shrink-0" size={18} />
      <span>{children}</span>
    </div>
  )
}

function SerialDetailDialog({
  canManage,
  errorMessage,
  isLoading,
  movements,
  onClose,
  onNavigate,
  onRequestStatus,
  serial,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const transitions = SAFE_MANUAL_TRANSITIONS[serial?.status] || []
  const linkedSales = (serial?.saleItems || []).map((line) => line.sale).filter(Boolean)
  const linkedClaims = serial?.warrantyClaims || []
  const linkedTransfers = (serial?.stockTransferSerials || [])
    .map((entry) => entry.stockTransferItem?.stockTransfer)
    .filter(Boolean)

  return (
    <div
      aria-labelledby="serial-detail-title"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-6"
      role="dialog"
    >
      <div className="mx-auto min-h-full max-w-4xl py-4 sm:py-8">
        <section className="overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-5 sm:p-6">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-maroon)]">Serial record</p>
              <h2 className="mt-1 break-all text-xl font-black text-[var(--color-text-strong)]" id="serial-detail-title">
                {serial?.serialNumber || "Loading serial…"}
              </h2>
            </div>
            <button aria-label="Close serial details" className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-soft)]" onClick={onClose} type="button"><X size={20} /></button>
          </header>

          {isLoading ? (
            <div className="flex items-center gap-3 p-6 text-sm font-semibold text-[var(--color-muted)]"><LoaderCircle className="animate-spin" size={18} />Loading serial movement history…</div>
          ) : errorMessage ? (
            <div className="p-5 sm:p-6"><ErrorBanner>{errorMessage}</ErrorBanner></div>
          ) : serial ? (
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Status</p><div className="mt-2"><StatusBadge status={serial.status} /></div></div>
                <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Item</p><p className="mt-2 font-bold text-[var(--color-text-strong)]">{serial.item?.itemCode || "—"}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{serial.item?.itemName || "—"}</p></div>
                <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Branch</p><p className="mt-2 font-bold text-[var(--color-text-strong)]">{serial.branch?.code || "—"}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{serial.branch?.name || "—"}</p></div>
                <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Batch</p><p className="mt-2 font-bold text-[var(--color-text-strong)]">{serial.batch?.batchCode || "No linked batch"}</p></div>
              </div>

              {serial.remarks ? (
                <div className="rounded-2xl border border-[var(--color-border)] p-4 text-sm"><p className="font-bold text-[var(--color-text-strong)]">Remarks</p><p className="mt-1 whitespace-pre-wrap leading-6 text-[var(--color-muted)]">{serial.remarks}</p></div>
              ) : null}

              <section className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center justify-between gap-3"><p className="font-bold text-[var(--color-text-strong)]">Outbound sale</p>{linkedSales.length && onNavigate ? <button className="text-xs font-black text-[var(--color-maroon)]" onClick={() => onNavigate("pos")} type="button">Open sales</button> : null}</div>
                  {linkedSales.length ? linkedSales.map((sale) => <div className="mt-3 rounded-xl bg-[var(--color-soft)] p-3" key={sale.id}><p className="font-black text-[var(--color-text-strong)]">{sale.receiptCode}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{formatDate(sale.saleDate)} · {formatStatus(sale.status)}</p></div>) : <p className="mt-3 text-sm text-[var(--color-muted)]">No linked outbound sale.</p>}
                </div>
                <div className="rounded-2xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center justify-between gap-3"><p className="font-bold text-[var(--color-text-strong)]">Warranty</p>{linkedClaims.length && onNavigate ? <button className="text-xs font-black text-[var(--color-maroon)]" onClick={() => onNavigate("warranty")} type="button">Open warranty</button> : null}</div>
                  {linkedClaims.length ? linkedClaims.map((claim) => <div className="mt-3 rounded-xl bg-[var(--color-soft)] p-3" key={claim.id}><p className="font-black text-[var(--color-text-strong)]">{claim.claimCode}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{formatDate(claim.receivedAt)} · {formatStatus(claim.status)}</p></div>) : <p className="mt-3 text-sm text-[var(--color-muted)]">No linked warranty claim.</p>}
                </div>
                <div className="rounded-2xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center justify-between gap-3"><p className="font-bold text-[var(--color-text-strong)]">Transfers</p>{linkedTransfers.length && onNavigate ? <button className="text-xs font-black text-[var(--color-maroon)]" onClick={() => onNavigate("stock-transfers")} type="button">Open transfers</button> : null}</div>
                  {linkedTransfers.length ? linkedTransfers.map((transfer) => <div className="mt-3 rounded-xl bg-[var(--color-soft)] p-3" key={transfer.id}><p className="font-black text-[var(--color-text-strong)]">{transfer.transferCode}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{transfer.fromBranch?.code || "-"} → {transfer.toBranch?.code || "-"} · {formatStatus(transfer.status)}</p></div>) : <p className="mt-3 text-sm text-[var(--color-muted)]">No linked transfer record.</p>}
                </div>
              </section>

              {canManage ? (
                <div className="rounded-2xl border border-[var(--color-border)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-[var(--color-text-strong)]">Manual status control</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                        Sale and warranty-owned states are intentionally read-only here. Their workflows must update the serial with their own transaction records.
                      </p>
                    </div>
                    {transitions.length > 0 ? (
                      <button className="shrink-0 rounded-xl border border-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-[var(--color-maroon)] hover:bg-[var(--color-maroon-soft)]" onClick={() => onRequestStatus(serial)} type="button">Update status</button>
                    ) : (
                      <span className="shrink-0 rounded-full bg-[var(--color-soft)] px-3 py-1.5 text-xs font-bold text-[var(--color-muted)]">Workflow controlled</span>
                    )}
                  </div>
                </div>
              ) : null}

              <section>
                <div className="flex items-center gap-2"><History className="text-[var(--color-maroon)]" size={18} /><h3 className="font-black text-[var(--color-text-strong)]">Inbound, outbound, and transfer history</h3></div>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                  Movement references are displayed when available. Open the related workflow to review its full transaction record.
                </p>

                {movements.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">No inventory movements are linked to this serial.</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {movements.map((movement) => (
                      <article className="rounded-2xl border border-[var(--color-border)] p-4" key={movement.id}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={movement.type} /><span className="text-xs font-bold text-[var(--color-muted)]">{formatStatus(movement.source)}</span></div>
                            <p className="mt-2 font-bold text-[var(--color-text-strong)]">{movement.movementCode}</p>
                            <p className="mt-1 text-xs text-[var(--color-muted)]">{formatDate(movement.movementDate || movement.createdAt)} · by {movement.createdBy?.fullName || "System"}</p>
                          </div>
                          <div className="text-left sm:text-right"><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Quantity</p><p className="mt-1 font-black text-[var(--color-text-strong)]">{Number(movement.quantity || 0)}</p></div>
                        </div>
                        {movement.referenceNo ? <p className="mt-3 break-all text-sm"><span className="font-bold text-[var(--color-text-strong)]">Reference:</span> {movement.referenceNo}</p> : null}
                        {movement.remarks ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-muted)]">{movement.remarks}</p> : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function SerialStatusDialog({ isSaving, onClose, onSaved, serial }) {
  const transitions = SAFE_MANUAL_TRANSITIONS[serial.status] || []
  const [targetStatus, setTargetStatus] = useState(transitions[0] || "")
  const [remarks, setRemarks] = useState("")
  const [message, setMessage] = useState("")

  const submit = async (event) => {
    event.preventDefault()
    const normalizedRemarks = remarks.trim()

    if (!targetStatus || !transitions.includes(targetStatus)) {
      setMessage("Choose an allowed manual status transition.")
      return
    }
    if (!normalizedRemarks) {
      setMessage("Enter a reason so this manual status change remains explainable.")
      return
    }

    onSaved({ status: targetStatus, remarks: normalizedRemarks })
  }

  return (
    <div aria-labelledby="serial-status-title" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/70 p-4" role="dialog">
      <form className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6" onSubmit={submit}>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-maroon)]">Manual status update</p>
        <h2 className="mt-1 break-all text-xl font-black text-[var(--color-text-strong)]" id="serial-status-title">{serial.serialNumber}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">Current status: <strong>{formatStatus(serial.status)}</strong>. This control cannot mark a serial sold or under warranty.</p>

        <label className="mt-5 block"><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">New status</span><select autoFocus className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--color-maroon)]" disabled={isSaving} onChange={(event) => { setTargetStatus(event.target.value); setMessage("") }} value={targetStatus}>{transitions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
        <label className="mt-4 block"><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Reason / remarks</span><textarea className="mt-2 min-h-28 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" disabled={isSaving} onChange={(event) => { setRemarks(event.target.value); setMessage("") }} placeholder="Why is this status changing?" value={remarks} /></label>
        {message ? <p className="mt-2 text-sm font-semibold text-red-700">{message}</p> : null}

        <div className="mt-5 grid grid-cols-2 gap-3"><button className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-bold disabled:opacity-50" disabled={isSaving} onClick={onClose} type="button">Cancel</button><button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={isSaving} type="submit">{isSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}{isSaving ? "Saving…" : "Confirm status"}</button></div>
      </form>
    </div>
  )
}

function AddSerialStockDialog({ activeBranch, branches, isSuperOwner, onClose, onSaved, viewingBranchId }) {
  const [selectedBranchId, setSelectedBranchId] = useState(viewingBranchId || activeBranch?.id || branches[0]?.id || "")
  const [items, setItems] = useState([])
  const [selectedItemId, setSelectedItemId] = useState("")
  const [batches, setBatches] = useState([])
  const [batchMode, setBatchMode] = useState("EXISTING")
  const [selectedBatchId, setSelectedBatchId] = useState("")
  const [newBatchCode, setNewBatchCode] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [serialInput, setSerialInput] = useState("")
  const [remarks, setRemarks] = useState("")
  const [referenceNo, setReferenceNo] = useState("")
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [isLoadingBatches, setIsLoadingBatches] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let active = true
    if (!selectedBranchId) return
    setIsLoadingItems(true)
    getItems({ branchId: selectedBranchId, status: "ACTIVE", isSerialized: "true", page: 1, limit: 100 })
      .then((res) => {
        if (!active) return
        const rows = getCatalogRows(res)
        setItems(rows)
        if (rows.length > 0) {
          setSelectedItemId((prev) => (rows.some((r) => r.id === prev) ? prev : rows[0].id))
        } else {
          setSelectedItemId("")
        }
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(getApiErrorMessage(err, "Failed to load serialized items."))
      })
      .finally(() => {
        if (active) setIsLoadingItems(false)
      })
    return () => {
      active = false
    }
  }, [selectedBranchId])

  useEffect(() => {
    let active = true
    if (!selectedBranchId || !selectedItemId) {
      setBatches([])
      setSelectedBatchId("")
      return
    }
    setIsLoadingBatches(true)
    getInventoryBatches({ branchId: selectedBranchId, itemId: selectedItemId, status: "ACTIVE", limit: 50 })
      .then((res) => {
        if (!active) return
        const rows = getInventoryResult(res).rows || []
        setBatches(rows)
        if (rows.length > 0) {
          setSelectedBatchId(rows[0].id)
          setBatchMode("EXISTING")
        } else {
          setSelectedBatchId("")
          setBatchMode("NEW")
        }
      })
      .catch(() => {
        if (!active) return
        setBatches([])
        setBatchMode("NEW")
      })
      .finally(() => {
        if (active) setIsLoadingBatches(false)
      })
    return () => {
      active = false
    }
  }, [selectedBranchId, selectedItemId])

  const parsedSerials = useMemo(() => {
    return serialInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }, [serialInput])

  const duplicateCount = useMemo(() => {
    const seen = new Set()
    let dupes = 0
    for (const s of parsedSerials) {
      const lower = s.toLowerCase()
      if (seen.has(lower)) dupes++
      else seen.add(lower)
    }
    return dupes
  }, [parsedSerials])

  const selectedItem = items.find((i) => i.id === selectedItemId)

  const submit = async (event) => {
    event.preventDefault()
    setErrorMessage("")

    if (!selectedBranchId) {
      setErrorMessage("Please select a branch.")
      return
    }
    if (!selectedItemId) {
      setErrorMessage("Please select a serialized item.")
      return
    }
    if (parsedSerials.length === 0) {
      setErrorMessage("Please enter at least one serial number.")
      return
    }
    if (duplicateCount > 0) {
      setErrorMessage("Please remove duplicate serial numbers from the list.")
      return
    }
    if (batchMode === "EXISTING" && !selectedBatchId) {
      setErrorMessage("Please select an active batch or switch to Create New Batch.")
      return
    }
    if (batchMode === "NEW" && !newBatchCode.trim()) {
      setErrorMessage("Please enter a new batch code.")
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        branchId: selectedBranchId,
        itemId: selectedItemId,
        quantity: parsedSerials.length,
        serialNumbers: parsedSerials,
        remarks: remarks.trim() || "Manual serial stock-in",
        referenceNo: referenceNo.trim() || undefined,
        ...(batchMode === "EXISTING"
          ? { batchId: selectedBatchId }
          : {
              batchCode: newBatchCode.trim(),
              supplierName: supplierName.trim() || undefined,
              unitCost: unitCost !== "" ? Number(unitCost) : undefined,
            }),
      }

      const response = await createStockIn(payload)
      if (!response?.success) throw new Error(response?.message || "Failed to add serial stock")
      onSaved(response.data, parsedSerials.length)
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Unable to add serial stock."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      aria-labelledby="add-serial-title"
      aria-modal="true"
      className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/70 p-4"
      role="dialog"
    >
      <div className="mx-auto my-6 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-maroon)]">
              Manual Serial Intake
            </p>
            <h2 className="mt-1 text-xl font-black text-[var(--color-text-strong)]" id="add-serial-title">
              Add Serial Stock
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Directly intake missed delivery serials or physical count adjustments into branch inventory.
            </p>
          </div>
          <button
            aria-label="Close add serial stock dialog"
            className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-soft)]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          {isSuperOwner ? (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Target branch</span>
              <select
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--color-maroon)]"
                disabled={isSaving}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                value={selectedBranchId}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Serialized item</span>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--color-maroon)]"
              disabled={isSaving || isLoadingItems || items.length === 0}
              onChange={(e) => setSelectedItemId(e.target.value)}
              value={selectedItemId}
            >
              {items.length === 0 ? (
                <option value="">No active serialized items found</option>
              ) : (
                items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemCode} · {item.itemName}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Batch target</span>
              <div className="flex gap-2">
                <button
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                    batchMode === "EXISTING"
                      ? "bg-[var(--color-maroon)] text-white"
                      : "bg-white text-[var(--color-muted)] hover:bg-slate-100"
                  }`}
                  disabled={isSaving || batches.length === 0}
                  onClick={() => setBatchMode("EXISTING")}
                  type="button"
                >
                  Existing batch ({batches.length})
                </button>
                <button
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                    batchMode === "NEW"
                      ? "bg-[var(--color-maroon)] text-white"
                      : "bg-white text-[var(--color-muted)] hover:bg-slate-100"
                  }`}
                  disabled={isSaving}
                  onClick={() => setBatchMode("NEW")}
                  type="button"
                >
                  + New batch
                </button>
              </div>
            </div>

            {batchMode === "EXISTING" ? (
              <div className="mt-3">
                {batches.length > 0 ? (
                  <select
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--color-maroon)]"
                    disabled={isSaving || isLoadingBatches}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    value={selectedBatchId}
                  >
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.batchCode} · {Number(batch.quantityAvailable || 0)} available in stock (Cost: ₱{Number(batch.unitCost || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-amber-800">
                    No active batch exists for this item in this branch. Please create a new batch below.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">New batch code</span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-[var(--color-maroon)]"
                    disabled={isSaving}
                    onChange={(e) => setNewBatchCode(e.target.value)}
                    placeholder="e.g. BATCH-2026-08-01"
                    value={newBatchCode}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Supplier (optional)</span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-maroon)]"
                    disabled={isSaving}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Supplier name"
                    value={supplierName}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Unit cost (optional)</span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-maroon)]"
                    disabled={isSaving}
                    min="0"
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder={selectedItem ? `Default: ₱${Number(selectedItem.costPrice || 0).toLocaleString()}` : "0.00"}
                    step="0.01"
                    type="number"
                    value={unitCost}
                  />
                </label>
              </div>
            )}
          </div>

          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                Serial Numbers barcode / text
              </span>
              <span className="text-xs font-bold text-[var(--color-maroon)]">
                {parsedSerials.length} serial(s) entered {duplicateCount > 0 ? `(${duplicateCount} duplicates)` : ""}
              </span>
            </div>
            <textarea
              className="mt-2 min-h-32 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 font-mono text-sm outline-none focus:border-[var(--color-maroon)]"
              disabled={isSaving}
              onChange={(e) => setSerialInput(e.target.value)}
              placeholder="Paste or scan serial barcodes here (one serial per line, or comma-separated)&#10;TEST-SN-001&#10;TEST-SN-002"
              value={serialInput}
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Each serial will be created as <strong>AVAILABLE</strong> stock and increment branch inventory.
            </p>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Reference no (optional)</span>
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-maroon)]"
                disabled={isSaving}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. PO-102 or AUDIT-2026"
                value={referenceNo}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Remarks / Reason</span>
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-maroon)]"
                disabled={isSaving}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Unrecorded delivery item"
                value={remarks}
              />
            </label>
          </div>

          {errorMessage ? <ErrorBanner>{errorMessage}</ErrorBanner> : null}

          <div className="mt-6 flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <button
              className="rounded-2xl border border-[var(--color-border)] px-5 py-3 text-sm font-bold disabled:opacity-50"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:opacity-50"
              disabled={isSaving || parsedSerials.length === 0}
              type="submit"
            >
              {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
              {isSaving ? "Adding stock…" : `Add ${parsedSerials.length || ""} Serial Stock`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SerialMonitoringPage({ onNavigate, selectedBranch, user }) {
  const activeBranch = selectedBranch || user?.branch || null
  const isSuperOwner = user?.role === USER_ROLES.SUPER_OWNER
  const canManage = SERIAL_MANAGER_ROLES.has(user?.role)
  const [branches, setBranches] = useState(activeBranch ? [activeBranch] : [])
  const [viewingBranchId, setViewingBranchId] = useState(activeBranch?.id || "")
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [optionMessage, setOptionMessage] = useState("")

  const [itemOptions, setItemOptions] = useState([])
  const [batchOptions, setBatchOptions] = useState([])
  const [searchText, setSearchText] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [itemFilter, setItemFilter] = useState("")
  const [batchFilter, setBatchFilter] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [serials, setSerials] = useState([])
  const [pagination, setPagination] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [noticeMessage, setNoticeMessage] = useState("")
  const requestIdRef = useRef(0)

  const [detailSerial, setDetailSerial] = useState(null)
  const [movements, setMovements] = useState([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailMessage, setDetailMessage] = useState("")
  const [statusSerial, setStatusSerial] = useState(null)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const loadBranches = useCallback(async () => {
    if (!isSuperOwner) return

    try {
      const response = await getBranches()
      const rows = Array.isArray(response?.data) ? response.data : []
      setBranches(rows.filter((branch) => branch.status === "ACTIVE"))
    } catch (error) {
      setOptionMessage(getApiErrorMessage(error, "Unable to load branch filter options."))
    }
  }, [isSuperOwner])

  useEffect(() => {
    const timer = window.setTimeout(loadBranches, 0)
    return () => window.clearTimeout(timer)
  }, [loadBranches])

  const loadItemOptions = useCallback(async () => {
    if (!viewingBranchId && !isSuperOwner) return

    setIsLoadingOptions(true)
    setOptionMessage("")
    try {
      const response = await getItems({
        branchId: viewingBranchId || undefined,
        status: "ACTIVE",
        isSerialized: "true",
        page: 1,
        limit: 100,
      })
      setItemOptions(getCatalogRows(response))
    } catch (error) {
      setItemOptions([])
      setOptionMessage(getApiErrorMessage(error, "Unable to load serialized-item filters."))
    } finally {
      setIsLoadingOptions(false)
    }
  }, [isSuperOwner, viewingBranchId])

  useEffect(() => {
    const timer = window.setTimeout(loadItemOptions, 0)
    return () => window.clearTimeout(timer)
  }, [loadItemOptions])

  const loadBatchOptions = useCallback(async () => {
    if (!viewingBranchId && !isSuperOwner) return

    try {
      const response = await getInventoryBatches({
        branchId: viewingBranchId || undefined,
        itemId: itemFilter || undefined,
        page: 1,
        limit: 100,
      })
      setBatchOptions(getInventoryResult(response).rows)
    } catch (error) {
      setBatchOptions([])
      setOptionMessage(getApiErrorMessage(error, "Unable to load batch filter options."))
    }
  }, [isSuperOwner, itemFilter, viewingBranchId])

  useEffect(() => {
    const timer = window.setTimeout(loadBatchOptions, 0)
    return () => window.clearTimeout(timer)
  }, [loadBatchOptions])

  const loadSerials = useCallback(async () => {
    if (!viewingBranchId && !isSuperOwner) {
      setSerials([])
      setPagination(null)
      setErrorMessage("A branch is required to view serial records.")
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await getInventorySerials({
        branchId: viewingBranchId || undefined,
        search: searchText.trim() || undefined,
        status: statusFilter || undefined,
        itemId: itemFilter || undefined,
        batchId: batchFilter || undefined,
        page,
        limit: pageSize,
      })
      if (requestId !== requestIdRef.current) return

      const result = getInventoryResult(response)
      if (result.pagination && page > result.pagination.totalPages && result.pagination.totalPages > 0) {
        setPage(result.pagination.totalPages)
        return
      }

      setSerials(result.rows)
      setPagination(result.pagination)
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setSerials([])
      setPagination(null)
      setErrorMessage(getApiErrorMessage(error, "Unable to load serial records."))
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [batchFilter, isSuperOwner, itemFilter, page, searchText, statusFilter, viewingBranchId])

  useEffect(() => {
    const timer = window.setTimeout(loadSerials, searchText.trim() ? 300 : 0)
    return () => {
      window.clearTimeout(timer)
      requestIdRef.current += 1
    }
  }, [loadSerials, searchText])

  const clearFilters = () => {
    setSearchText("")
    setStatusFilter("")
    setItemFilter("")
    setBatchFilter("")
    setPage(1)
  }

  const openSerialDetails = async (serial) => {
    setDetailSerial(serial)
    setMovements([])
    setIsLoadingDetail(true)
    setDetailMessage("")

    try {
      const response = await getInventoryMovements({
        branchId: serial.branch?.id,
        serialId: serial.id,
        page: 1,
        limit: 100,
      })
      setMovements(getInventoryResult(response).rows)
    } catch (error) {
      setDetailMessage(getApiErrorMessage(error, "Unable to load movement history for this serial."))
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const saveSerialStatus = async (payload) => {
    if (!statusSerial?.id || isSavingStatus) return

    setIsSavingStatus(true)
    try {
      const response = await updateInventorySerialStatus(statusSerial.id, payload)
      const result = response?.data
      const updatedSerial = result?.serial
      if (!response?.success || !updatedSerial) throw new Error("Invalid serial status response")

      setSerials((current) => current.map((serial) => (serial.id === updatedSerial.id ? updatedSerial : serial)))
      setDetailSerial((current) => (current?.id === updatedSerial.id ? updatedSerial : current))
      setNoticeMessage(`${updatedSerial.serialNumber} changed from ${formatStatus(result.previousStatus)} to ${formatStatus(updatedSerial.status)}.`)
      setStatusSerial(null)
      await loadSerials()
    } catch (error) {
      setNoticeMessage(getApiErrorMessage(error, "Unable to update this serial status."))
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleStockInSaved = (_result, count) => {
    setIsAddModalOpen(false)
    setNoticeMessage(`Successfully added ${count || ""} serial unit(s) into inventory.`)
    loadSerials()
  }

  const currentPageAvailable = useMemo(
    () => serials.filter((serial) => serial.status === "AVAILABLE").length,
    [serials],
  )
  const currentPageReserved = useMemo(
    () => serials.filter((serial) => serial.status === "RESERVED").length,
    [serials],
  )
  const currentPageUnavailable = serials.length - currentPageAvailable - currentPageReserved
  const hasFilters = Boolean(searchText.trim() || statusFilter || itemFilter || batchFilter)
  const totalPages = pagination?.totalPages || 1
  const totalItems = pagination?.totalItems ?? serials.length
  const viewingBranch = branches.find((branch) => branch.id === viewingBranchId) || activeBranch

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--color-maroon)]">Serial Monitoring</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-text-strong)]">Serialized inventory traceability</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">Search serials, confirm branch availability, inspect their source batch, and review inventory movements recorded by receiving, transfers, sales, and reversals.</p>
          {viewingBranch ? <p className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--color-soft)] px-3 py-1.5 text-xs font-bold text-[var(--color-muted)]"><Building2 size={14} /><span className="truncate">{viewingBranch.code} · {viewingBranch.name}</span></p> : <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--color-soft)] px-3 py-1.5 text-xs font-bold text-[var(--color-muted)]"><Building2 size={14} />All accessible branches</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]"
              onClick={() => setIsAddModalOpen(true)}
              type="button"
            >
              <Plus size={17} /> Add serial stock
            </button>
          ) : null}
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)] disabled:opacity-50" disabled={isLoading} onClick={loadSerials} type="button"><RefreshCw className={isLoading ? "animate-spin" : ""} size={17} />Refresh serials</button>
        </div>
      </header>

      {noticeMessage ? <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><span>{noticeMessage}</span><button aria-label="Dismiss notice" className="rounded-lg p-1 hover:bg-emerald-100" onClick={() => setNoticeMessage("")} type="button"><X size={16} /></button></div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-soft)] text-[var(--color-text-strong)]"><Boxes size={19} /></span><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Filtered total</span></div><p className="mt-4 text-2xl font-black text-[var(--color-text-strong)]">{totalItems}</p><p className="mt-1 text-xs text-[var(--color-muted)]">All matching serial records</p></div>
        <div className="rounded-3xl border border-emerald-200 bg-white p-4 shadow-card"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><CircleCheckBig size={19} /></span><span className="text-xs font-bold uppercase tracking-wide text-emerald-700">Available</span></div><p className="mt-4 text-2xl font-black text-emerald-700">{currentPageAvailable}</p><p className="mt-1 text-xs text-[var(--color-muted)]">On this page of results</p></div>
        <div className="rounded-3xl border border-blue-200 bg-white p-4 shadow-card"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Tag size={19} /></span><span className="text-xs font-bold uppercase tracking-wide text-blue-700">Reserved</span></div><p className="mt-4 text-2xl font-black text-blue-700">{currentPageReserved}</p><p className="mt-1 text-xs text-[var(--color-muted)]">On this page of results</p></div>
        <div className="rounded-3xl border border-amber-200 bg-white p-4 shadow-card"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-800"><ShieldAlert size={19} /></span><span className="text-xs font-bold uppercase tracking-wide text-amber-800">Other states</span></div><p className="mt-4 text-2xl font-black text-amber-800">{currentPageUnavailable}</p><p className="mt-1 text-xs text-[var(--color-muted)]">Sold, warranty, returned, damaged, or lost</p></div>
      </section>

      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative md:col-span-2 xl:col-span-1"><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={18} /><input aria-label="Search serial records" className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] py-3 pl-11 pr-4 text-sm outline-none focus:border-[var(--color-maroon)] focus:bg-white" onChange={(event) => { setSearchText(event.target.value); setPage(1) }} placeholder="Serial, item code, or name" value={searchText} /></label>
          {isSuperOwner ? <select aria-label="Filter serials by branch" className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-semibold" onChange={(event) => { setViewingBranchId(event.target.value); setItemFilter(""); setBatchFilter(""); setPage(1) }} value={viewingBranchId}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select> : <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-3 text-sm font-semibold"><Building2 size={16} />{activeBranch?.code || "Assigned branch"}</div>}
          <select aria-label="Filter serials by status" className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-semibold" onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} value={statusFilter}><option value="">All statuses</option>{SERIAL_STATUSES.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select>
          <select aria-label="Filter serials by item" className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-semibold" disabled={isLoadingOptions} onChange={(event) => { setItemFilter(event.target.value); setBatchFilter(""); setPage(1) }} value={itemFilter}><option value="">All serialized items</option>{itemOptions.map((item) => <option key={item.id} value={item.id}>{item.itemCode} · {item.itemName}</option>)}</select>
          <select aria-label="Filter serials by batch" className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-semibold" onChange={(event) => { setBatchFilter(event.target.value); setPage(1) }} value={batchFilter}><option value="">All batches</option>{batchOptions.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchCode} · {batch.item?.itemCode || "Item"}</option>)}</select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="text-xs font-semibold text-[var(--color-muted)]">{optionMessage || "Results remain limited to your accessible branches."}</div><button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-bold disabled:opacity-40" disabled={!hasFilters} onClick={clearFilters} type="button"><FilterX size={15} />Clear filters</button></div>
      </section>

      {errorMessage ? <section className="space-y-3 rounded-3xl border border-red-200 bg-red-50 p-5"><ErrorBanner>{errorMessage}</ErrorBanner><button className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700" onClick={loadSerials} type="button">Try again</button></section> : null}

      <section className="min-w-0 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        {isLoading ? (
          <div className="flex items-center gap-3 p-6 text-sm font-semibold text-[var(--color-muted)]"><LoaderCircle className="animate-spin" size={18} />Loading serial records…</div>
        ) : serials.length === 0 ? (
          <div className="grid place-items-center p-10 text-center"><PackageSearch className="text-[var(--color-muted)]" size={42} /><p className="mt-3 font-bold text-[var(--color-text-strong)]">{hasFilters ? "No serials match these filters" : "No serialized inventory found"}</p><p className="mt-1 max-w-md text-sm leading-6 text-[var(--color-muted)]">{hasFilters ? "Try clearing one or more filters." : "Serialized units will appear here after they are received into inventory."}</p></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]"><tr><th className="px-4 py-3">Serial</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Availability</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--color-border)]">{serials.map((serial) => { const transitions = SAFE_MANUAL_TRANSITIONS[serial.status] || []; return <tr className="align-top transition hover:bg-[var(--color-soft)]" key={serial.id}><td className="max-w-64 px-4 py-4"><p className="break-all font-black text-[var(--color-text-strong)]">{serial.serialNumber}</p></td><td className="min-w-52 px-4 py-4"><p className="font-bold text-[var(--color-text-strong)]">{serial.item?.itemName || "—"}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{serial.item?.itemCode || "—"}</p></td><td className="whitespace-nowrap px-4 py-4"><p className="font-bold">{serial.branch?.code || "—"}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{serial.branch?.name || "—"}</p></td><td className="whitespace-nowrap px-4 py-4 font-semibold">{serial.batch?.batchCode || "—"}</td><td className="px-4 py-4"><StatusBadge status={serial.status} /></td><td className="max-w-60 px-4 py-4 text-xs leading-5 text-[var(--color-muted)]"><p className="line-clamp-3">{serial.remarks || "—"}</p></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold" onClick={() => openSerialDetails(serial)} type="button"><Eye size={14} />History</button>{canManage && transitions.length > 0 ? <button className="rounded-xl border border-[var(--color-maroon)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-maroon)]" onClick={() => setStatusSerial(serial)} type="button">Status</button> : null}</div></td></tr> })}</tbody></table>
            </div>
            <div className="grid gap-3 p-4 lg:hidden">{serials.map((serial) => { const transitions = SAFE_MANUAL_TRANSITIONS[serial.status] || []; return <article className="rounded-2xl border border-[var(--color-border)] p-4" key={serial.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all font-black text-[var(--color-text-strong)]">{serial.serialNumber}</p><p className="mt-1 text-sm font-semibold">{serial.item?.itemName || "—"}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{serial.item?.itemCode || "—"} · {serial.batch?.batchCode || "No batch"}</p></div><StatusBadge status={serial.status} /></div><p className="mt-3 text-xs font-semibold text-[var(--color-muted)]">{serial.branch?.code || "—"} · {serial.branch?.name || "—"}</p>{serial.remarks ? <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{serial.remarks}</p> : null}<div className="mt-4 grid grid-cols-2 gap-2"><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm font-bold" onClick={() => openSerialDetails(serial)} type="button"><Eye size={15} />History</button>{canManage && transitions.length > 0 ? <button className="rounded-xl border border-[var(--color-maroon)] px-3 py-2.5 text-sm font-bold text-[var(--color-maroon)]" onClick={() => setStatusSerial(serial)} type="button">Update status</button> : <span className="grid place-items-center rounded-xl bg-[var(--color-soft)] px-3 py-2.5 text-center text-xs font-bold text-[var(--color-muted)]">Read only</span>}</div></article> })}</div>
          </>
        )}

        {!isLoading && serials.length > 0 ? <div className="flex flex-col gap-3 border-t border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-[var(--color-muted)]">Page {pagination?.page || page} of {totalPages} · {totalItems} serial(s)</p><div className="grid grid-cols-2 gap-2 sm:flex"><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button"><ChevronLeft size={16} />Previous</button><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} type="button">Next<ChevronRight size={16} /></button></div></div> : null}
      </section>

      {isAddModalOpen ? (
        <AddSerialStockDialog
          activeBranch={activeBranch}
          branches={branches}
          isSuperOwner={isSuperOwner}
          onClose={() => setIsAddModalOpen(false)}
          onSaved={handleStockInSaved}
          viewingBranchId={viewingBranchId}
        />
      ) : null}
      {detailSerial ? <SerialDetailDialog canManage={canManage} errorMessage={detailMessage} isLoading={isLoadingDetail} movements={movements} onClose={() => { setDetailSerial(null); setMovements([]); setDetailMessage("") }} onNavigate={onNavigate} onRequestStatus={setStatusSerial} serial={detailSerial} /> : null}
      {statusSerial ? <SerialStatusDialog isSaving={isSavingStatus} key={`${statusSerial.id}-${statusSerial.status}`} onClose={() => setStatusSerial(null)} onSaved={saveSerialStatus} serial={statusSerial} /> : null}
    </div>
  )
}

export default SerialMonitoringPage
