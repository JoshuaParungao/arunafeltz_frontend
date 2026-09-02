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
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs"
      role="dialog"
    >
      <section className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-maroon)]">Serial Record</span>
            <h2 className="mt-0.5 text-base font-mono font-black text-slate-900 leading-tight" id="serial-detail-title">
              {serial?.serialNumber || "Loading serial…"}
            </h2>
          </div>
          <button aria-label="Close serial details" className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-400">
            <LoaderCircle className="animate-spin" size={16} />
            Loading serial movement history…
          </div>
        ) : errorMessage ? (
          <div className="p-5"><ErrorBanner>{errorMessage}</ErrorBanner></div>
        ) : serial ? (
          <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                <p className="text-[10px] font-bold uppercase text-slate-500">Status</p>
                <div className="mt-1"><StatusBadge status={serial.status} /></div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                <p className="text-[10px] font-bold uppercase text-slate-500">Item</p>
                <p className="mt-1 font-bold text-slate-900">{serial.item?.itemCode || "—"}</p>
                <p className="text-[11px] text-slate-500 truncate">{serial.item?.itemName || "—"}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                <p className="text-[10px] font-bold uppercase text-slate-500">Branch</p>
                <p className="mt-1 font-bold text-slate-900">{serial.branch?.code || "—"}</p>
                <p className="text-[11px] text-slate-500 truncate">{serial.branch?.name || "—"}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                <p className="text-[10px] font-bold uppercase text-slate-500">Batch</p>
                <p className="mt-1 font-bold text-slate-900 truncate">{serial.batch?.batchCode || "No linked batch"}</p>
              </div>
            </div>

            {serial.remarks ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs">
                <p className="text-[10px] font-bold uppercase text-slate-500">Remarks</p>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{serial.remarks}</p>
              </div>
            ) : null}

            <section className="grid gap-2.5 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">Outbound Sale</p>
                  {linkedSales.length && onNavigate ? (
                    <button className="text-[11px] font-bold text-[var(--color-maroon)] hover:underline" onClick={() => onNavigate("pos")} type="button">Open sales</button>
                  ) : null}
                </div>
                {linkedSales.length ? linkedSales.map((sale) => (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 border border-slate-100" key={sale.id}>
                    <p className="font-mono font-bold text-slate-900">{sale.receiptCode}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(sale.saleDate)} · {formatStatus(sale.status)}</p>
                  </div>
                )) : <p className="mt-2 text-slate-400">No linked outbound sale.</p>}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">Warranty</p>
                  {linkedClaims.length && onNavigate ? (
                    <button className="text-[11px] font-bold text-[var(--color-maroon)] hover:underline" onClick={() => onNavigate("warranty")} type="button">Open warranty</button>
                  ) : null}
                </div>
                {linkedClaims.length ? linkedClaims.map((claim) => (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 border border-slate-100" key={claim.id}>
                    <p className="font-mono font-bold text-slate-900">{claim.claimCode}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(claim.receivedAt)} · {formatStatus(claim.status)}</p>
                  </div>
                )) : <p className="mt-2 text-slate-400">No linked warranty claim.</p>}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">Transfers</p>
                  {linkedTransfers.length && onNavigate ? (
                    <button className="text-[11px] font-bold text-[var(--color-maroon)] hover:underline" onClick={() => onNavigate("stock-transfers")} type="button">Open transfers</button>
                  ) : null}
                </div>
                {linkedTransfers.length ? linkedTransfers.map((transfer) => (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 border border-slate-100" key={transfer.id}>
                    <p className="font-mono font-bold text-slate-900">{transfer.transferCode}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{transfer.fromBranch?.code || "—"} → {transfer.toBranch?.code || "—"} · {formatStatus(transfer.status)}</p>
                  </div>
                )) : <p className="mt-2 text-slate-400">No linked transfer record.</p>}
              </div>
            </section>

            {canManage ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-slate-50/75 p-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900">Manual Status Control</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sale and warranty states are read-only here. Their workflows record separate transaction audits.
                  </p>
                </div>
                {transitions.length > 0 ? (
                  <button className="rounded-lg bg-[var(--color-maroon)] px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition shrink-0" onClick={() => onRequestStatus(serial)} type="button">Update Status</button>
                ) : (
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 shrink-0">Workflow controlled</span>
                )}
              </div>
            ) : null}

            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <History className="text-[var(--color-maroon)]" size={15} />
                <h3 className="text-xs font-black text-slate-900">Movement History</h3>
              </div>

              {movements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs font-bold text-slate-400">No inventory movements are linked to this serial.</div>
              ) : (
                <div className="space-y-2">
                  {movements.map((movement) => (
                    <article className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs" key={movement.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={movement.type} />
                            <span className="text-[11px] font-bold text-slate-500">{formatStatus(movement.source)}</span>
                          </div>
                          <p className="mt-1 font-mono font-bold text-slate-900">{movement.movementCode}</p>
                          <p className="text-[11px] text-slate-400">{formatDate(movement.movementDate || movement.createdAt)} · by {movement.createdBy?.fullName || "System"}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Qty</p>
                          <p className="font-mono font-bold text-slate-900">{Number(movement.quantity || 0)}</p>
                        </div>
                      </div>
                      {movement.referenceNo ? <p className="mt-1.5 text-[11px] text-slate-600"><span className="font-bold">Reference:</span> {movement.referenceNo}</p> : null}
                      {movement.remarks ? <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-500">{movement.remarks}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </section>
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
    <div aria-labelledby="serial-status-title" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs" role="dialog">
      <form className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onSubmit={submit}>
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-maroon)]">Manual Status Update</span>
            <h2 className="mt-0.5 text-base font-mono font-black text-slate-900 leading-tight" id="serial-status-title">{serial.serialNumber}</h2>
          </div>
          <button aria-label="Close dialog" className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        <div className="p-5 space-y-3.5">
          <p className="text-xs text-slate-500">Current status: <strong className="text-slate-800">{formatStatus(serial.status)}</strong>. This control cannot mark a serial sold or under warranty.</p>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">New status</span>
            <select autoFocus className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]" disabled={isSaving} onChange={(event) => { setTargetStatus(event.target.value); setMessage("") }} value={targetStatus}>
              {transitions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Reason / Remarks</span>
            <textarea className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)] min-h-20" disabled={isSaving} onChange={(event) => { setRemarks(event.target.value); setMessage("") }} placeholder="Why is this status changing?" value={remarks} />
          </label>

          {message ? <p className="text-xs font-bold text-rose-700">{message}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50" disabled={isSaving} onClick={onClose} type="button">Cancel</button>
          <button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50" disabled={isSaving} type="submit">
            {isSaving ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />}
            {isSaving ? "Saving…" : "Confirm Status"}
          </button>
        </div>
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
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs"
      role="dialog"
    >
      <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Manual Serial Intake
            </span>
            <h2 className="mt-0.5 text-base font-black text-slate-900 leading-tight" id="add-serial-title">
              Add Serial Stock
            </h2>
          </div>
          <button
            aria-label="Close add serial stock dialog"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="max-h-[75vh] overflow-y-auto p-5 space-y-3.5">
            {isSuperOwner ? (
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Target Branch</span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Serialized Item</span>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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

            <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Batch Target</span>
                <div className="flex gap-1.5">
                  <button
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      batchMode === "EXISTING"
                        ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                    disabled={isSaving || batches.length === 0}
                    onClick={() => setBatchMode("EXISTING")}
                    type="button"
                  >
                    Existing Batch ({batches.length})
                  </button>
                  <button
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      batchMode === "NEW"
                        ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                    disabled={isSaving}
                    onClick={() => setBatchMode("NEW")}
                    type="button"
                  >
                    + New Batch
                  </button>
                </div>
              </div>

              {batchMode === "EXISTING" ? (
                <div className="mt-2.5">
                  {batches.length > 0 ? (
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                      disabled={isSaving || isLoadingBatches}
                      onChange={(e) => setSelectedBatchId(e.target.value)}
                      value={selectedBatchId}
                    >
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.batchCode} · {Number(batch.quantityAvailable || 0)} available (Cost: ₱{Number(batch.unitCost || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs font-semibold text-amber-800 mt-1">
                      No active batch exists for this item in this branch. Please create a new batch.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">New Batch Code</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                      disabled={isSaving}
                      onChange={(e) => setNewBatchCode(e.target.value)}
                      placeholder="e.g. BATCH-2026-08-01"
                      value={newBatchCode}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Supplier (Optional)</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                      disabled={isSaving}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Supplier name"
                      value={supplierName}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Unit Cost (Optional)</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Serial Numbers (Barcode / Text)
                </span>
                <span className="text-[11px] font-bold text-[var(--color-maroon)]">
                  {parsedSerials.length} serial(s) {duplicateCount > 0 ? `(${duplicateCount} dupes)` : ""}
                </span>
              </div>
              <textarea
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                disabled={isSaving}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="Paste or scan serial barcodes here (one serial per line, or comma-separated)&#10;SN-001&#10;SN-002"
                value={serialInput}
              />
            </label>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Reference No (Optional)</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                  disabled={isSaving}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. PO-102 or AUDIT-2026"
                  value={referenceNo}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Remarks / Reason</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                  disabled={isSaving}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Unrecorded delivery item"
                  value={remarks}
                />
              </label>
            </div>

            {errorMessage ? <ErrorBanner>{errorMessage}</ErrorBanner> : null}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
              disabled={isSaving || parsedSerials.length === 0}
              type="submit"
            >
              {isSaving ? <LoaderCircle className="animate-spin" size={14} /> : <Plus size={14} />}
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
    <div className="min-w-0 space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Serial Monitoring</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Serialized Inventory Traceability</h1>
            <p className="mt-0.5 max-w-3xl text-xs text-slate-500">Search serials, confirm branch availability, inspect source batches, and review inventory movements.</p>
            {viewingBranch ? <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200"><Building2 size={13} /><span className="truncate">{viewingBranch.code} · {viewingBranch.name}</span></p> : <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200"><Building2 size={13} />All accessible branches</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition"
                onClick={() => setIsAddModalOpen(true)}
                type="button"
              >
                <Plus size={15} /> Add Serial Stock
              </button>
            ) : null}
            <button className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50" disabled={isLoading} onClick={loadSerials} type="button">
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={14} /> Refresh
            </button>
          </div>
        </div>
      </header>

      {noticeMessage ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
          <span>{noticeMessage}</span>
          <button aria-label="Dismiss notice" className="rounded-lg p-1 hover:bg-emerald-100" onClick={() => setNoticeMessage("")} type="button"><X size={14} /></button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtered Total</p>
          <p className="mt-1 font-mono text-xl font-black text-slate-900">{totalItems}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">All matching serials</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Available</p>
          <p className="mt-1 font-mono text-xl font-black text-emerald-600">{currentPageAvailable}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">On this page</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Reserved</p>
          <p className="mt-1 font-mono text-xl font-black text-blue-600">{currentPageReserved}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">On this page</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Other States</p>
          <p className="mt-1 font-mono text-xl font-black text-amber-600">{currentPageUnavailable}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Sold, warranty, returned, damaged</p>
        </div>
      </section>

      <section className="grid gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs md:grid-cols-2 xl:grid-cols-5">
        <label className="relative md:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input aria-label="Search serial records" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSearchText(event.target.value); setPage(1) }} placeholder="Serial, item code, or name…" value={searchText} />
        </label>
        {isSuperOwner ? (
          <select aria-label="Filter serials by branch" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setViewingBranchId(event.target.value); setItemFilter(""); setBatchFilter(""); setPage(1) }} value={viewingBranchId}>
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            <Building2 size={14} />{activeBranch?.code || "Assigned branch"}
          </div>
        )}
        <select aria-label="Filter serials by status" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} value={statusFilter}>
          <option value="">All statuses</option>
          {SERIAL_STATUSES.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
        </select>
        <select aria-label="Filter serials by item" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]" disabled={isLoadingOptions} onChange={(event) => { setItemFilter(event.target.value); setBatchFilter(""); setPage(1) }} value={itemFilter}>
          <option value="">All serialized items</option>
          {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.itemCode} · {item.itemName}</option>)}
        </select>
        <select aria-label="Filter serials by batch" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setBatchFilter(event.target.value); setPage(1) }} value={batchFilter}>
          <option value="">All batches</option>
          {batchOptions.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchCode} · {batch.item?.itemCode || "Item"}</option>)}
        </select>
      </section>

      {errorMessage ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
          <ErrorBanner>{errorMessage}</ErrorBanner>
          <button className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700" onClick={loadSerials} type="button">Try again</button>
        </section>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-slate-400">
            <LoaderCircle className="animate-spin" size={16} />
            Loading serial records…
          </div>
        ) : serials.length === 0 ? (
          <div className="p-8 text-center">
            <PackageSearch className="mx-auto text-slate-300" size={32} />
            <p className="mt-2 text-xs font-bold text-slate-700">{hasFilters ? "No serials match these filters" : "No serialized inventory found"}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{hasFilters ? "Try clearing filters." : "Serialized units will appear after receiving."}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Serial</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Availability</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {serials.map((serial) => {
                    const transitions = SAFE_MANUAL_TRANSITIONS[serial.status] || []
                    return (
                      <tr className="hover:bg-slate-50/50 transition" key={serial.id}>
                        <td className="max-w-64 px-4 py-3 font-mono font-bold text-slate-900 break-all">{serial.serialNumber}</td>
                        <td className="min-w-52 px-4 py-3">
                          <p className="font-bold text-slate-800">{serial.item?.itemName || "—"}</p>
                          <p className="text-[11px] text-slate-400">{serial.item?.itemCode || "—"}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{serial.branch?.code || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700">{serial.batch?.batchCode || "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={serial.status} /></td>
                        <td className="max-w-60 px-4 py-3 text-[11px] text-slate-500 truncate">{serial.remarks || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition" onClick={() => openSerialDetails(serial)} type="button">
                              <Eye size={13} /> History
                            </button>
                            {canManage && transitions.length > 0 ? (
                              <button className="rounded-lg border border-[var(--color-maroon)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--color-maroon)] hover:bg-[var(--color-maroon-soft)] transition" onClick={() => setStatusSerial(serial)} type="button">
                                Status
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2.5 p-3 lg:hidden">
              {serials.map((serial) => {
                const transitions = SAFE_MANUAL_TRANSITIONS[serial.status] || []
                return (
                  <article className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs" key={serial.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-slate-900 break-all">{serial.serialNumber}</p>
                        <p className="mt-0.5 font-bold text-slate-800">{serial.item?.itemName || "—"}</p>
                        <p className="text-[11px] text-slate-400">{serial.item?.itemCode || "—"} · {serial.batch?.batchCode || "No batch"}</p>
                      </div>
                      <StatusBadge status={serial.status} />
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      <button className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition" onClick={() => openSerialDetails(serial)} type="button">
                        <Eye size={13} /> History
                      </button>
                      {canManage && transitions.length > 0 ? (
                        <button className="flex-1 rounded-lg border border-[var(--color-maroon)] bg-white py-1.5 text-xs font-bold text-[var(--color-maroon)] hover:bg-[var(--color-maroon-soft)] transition" onClick={() => setStatusSerial(serial)} type="button">
                          Status
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {!isLoading && serials.length > 0 ? (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500">
            <p>Page {pagination?.page || page} of {totalPages} · {totalItems} serial(s)</p>
            <div className="flex gap-1.5">
              <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">
                <ChevronLeft size={16} />
              </button>
              <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} type="button">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
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
