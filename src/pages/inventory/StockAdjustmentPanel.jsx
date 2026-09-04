import { useMemo } from "react"
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Hash,
  Layers,
  Package,
  Sliders,
  X,
} from "lucide-react"

function formatNumber(value) {
  const number = Number(value || 0)
  return number.toLocaleString("en-PH")
}

export default function StockAdjustmentPanel({
  item,
  batches = [],
  batchId,
  type,
  quantity,
  referenceNo,
  remarks,
  serialNumbersText = "",
  availableSerials = [],
  message,
  isSaving,
  onBatchChange,
  onTypeChange,
  onQuantityChange,
  onReferenceNoChange,
  onRemarksChange,
  onSerialNumbersChange,
  onSave,
  onClose,
}) {
  if (!item) return null

  const isSerialized = Boolean(item.isSerialized)
  const numQuantity = Number(quantity || 0)

  // Parse entered serial numbers
  const enteredSerials = useMemo(() => {
    if (!isSerialized || !serialNumbersText) return []
    return serialNumbersText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }, [isSerialized, serialNumbersText])

  const hasDuplicateSerials = useMemo(() => {
    return new Set(enteredSerials).size !== enteredSerials.length
  }, [enteredSerials])

  const isSerialCountValid =
    !isSerialized ||
    (enteredSerials.length === numQuantity && !hasDuplicateSerials && numQuantity > 0)

  const selectedBatch = batches.find((b) => b.id === batchId)
  const isIncrease = type === "INCREASE"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5 shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-[var(--color-maroon)] border border-rose-100/80 shadow-2xs">
              <Sliders size={20} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  Adjust Stock: {item.itemName}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                    isSerialized
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {isSerialized ? "Serialized Product" : "Standard Product"}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Code: <strong className="font-mono text-slate-700">{item.itemCode}</strong></span>
                {item.brand ? <span>• Brand: <strong className="text-slate-700">{item.brand}</strong></span> : null}
                <span>• Branch: <strong className="text-[var(--color-maroon)]">{item.branch?.name || item.branch?.code || "Branch"}</strong></span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50/80 border border-slate-200/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Available
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {formatNumber(item.quantityAvailable)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50/80 border border-slate-200/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Batches
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {formatNumber(batches.length)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50/80 border border-slate-200/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Selected Batch
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {selectedBatch ? formatNumber(selectedBatch.quantityAvailable) : "Auto"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50/80 border border-slate-200/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Adjustment
              </p>
              <div className="mt-1 flex items-center gap-1 font-black text-sm">
                {isIncrease ? (
                  <span className="text-emerald-700 flex items-center gap-0.5">
                    <ArrowUpRight size={15} strokeWidth={3} />
                    +{quantity || 0}
                  </span>
                ) : (
                  <span className="text-rose-700 flex items-center gap-0.5">
                    <ArrowDownRight size={15} strokeWidth={3} />
                    -{quantity || 0}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Adjustment Mode Selector (Segmented Cards) */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Adjustment Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => onTypeChange("INCREASE")}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-all text-left ${
                  isIncrease
                    ? "border-emerald-600 bg-emerald-50/60 text-emerald-950 shadow-xs ring-1 ring-emerald-500/30"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-xl font-black ${
                    isIncrease ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <ArrowUpRight size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-xs font-black">Add Stock (Increase)</p>
                  <p className="text-[10px] text-slate-500 font-medium">Magdagdag ng inventory</p>
                </div>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => onTypeChange("DECREASE")}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-all text-left ${
                  !isIncrease
                    ? "border-rose-600 bg-rose-50/60 text-rose-950 shadow-xs ring-1 ring-rose-500/30"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-xl font-black ${
                    !isIncrease ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <ArrowDownRight size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-xs font-black">Deduct Stock (Decrease)</p>
                  <p className="text-[10px] text-slate-500 font-medium">Magbawas ng inventory</p>
                </div>
              </button>
            </div>
          </div>

          {/* Quantity and Batch Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Quantity to Adjust *
              </label>
              <input
                type="number"
                min="1"
                disabled={isSaving}
                value={quantity}
                onChange={(e) => onQuantityChange(e.target.value)}
                placeholder="1"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-black text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Batch Assignment
              </label>
              <select
                disabled={isSaving}
                value={batchId || ""}
                onChange={(e) => onBatchChange(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50"
              >
                {batches.length === 0 ? (
                  <option value="">Auto-create fresh batch ({new Date().toISOString().slice(0, 10).replace(/-/g, "")})</option>
                ) : (
                  <>
                    <option value="">Latest / Auto-resolve Batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.batchCode} (Available: {formatNumber(batch.quantityAvailable)})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Reference & Remarks Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reference No. <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                disabled={isSaving}
                value={referenceNo}
                onChange={(e) => onReferenceNoChange(e.target.value)}
                placeholder="Hal. ADJ-001, Inv, Count"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reason / Remarks *
              </label>
              <input
                type="text"
                disabled={isSaving}
                value={remarks}
                onChange={(e) => onRemarksChange(e.target.value)}
                placeholder="Hal. Physical count adjustment, damaged item"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50"
              />
            </div>
          </div>

          {/* Serial Numbers (If Serialized) */}
          {isSerialized ? (
            <div className="rounded-2xl border border-purple-200/80 bg-purple-50/30 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Hash size={15} className="text-purple-700" />
                  <label className="text-xs font-black text-purple-900">
                    {isIncrease ? "Serial Numbers to Add *" : "Serial Numbers to Deduct / Remove *"}
                  </label>
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-black border ${
                    enteredSerials.length === numQuantity && !hasDuplicateSerials && numQuantity > 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                  }`}
                >
                  {enteredSerials.length} of {numQuantity} entered
                </span>
              </div>

              <p className="text-[11px] text-purple-700/80 font-medium">
                {isIncrease
                  ? "I-type o i-scan ang mga bagong serial numbers (bawat linya o pinaghihiwalay ng kuwit/comma)."
                  : "I-type o i-scan ang serial number(s) ng item na aalisin (bawat linya o pinaghihiwalay ng kuwit/comma)."}
              </p>

              <textarea
                rows={3}
                disabled={isSaving}
                value={serialNumbersText}
                onChange={(e) => onSerialNumbersChange(e.target.value)}
                placeholder="SN-100293&#10;SN-100294"
                className="w-full rounded-xl border border-purple-200 bg-white p-3 font-mono text-xs text-slate-900 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
              />

              {hasDuplicateSerials ? (
                <p className="text-xs font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle size={13} /> May duplicate serial number sa listahan.
                </p>
              ) : null}

              {/* Clickable serial pill suggestions when deducting */}
              {!isIncrease && availableSerials.length > 0 ? (
                <div className="mt-3 pt-3 border-t border-purple-200/60">
                  <p className="text-[11px] font-black text-purple-900 mb-1.5">
                    Available Serials sa Branch (Pindutin para mabilis maidagdag):
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                    {availableSerials.map((s) => {
                      const isPicked = enteredSerials.includes(s.serialNumber)
                      return (
                        <button
                          key={s.id || s.serialNumber}
                          type="button"
                          onClick={() => {
                            if (isPicked) {
                              const updated = enteredSerials.filter((x) => x !== s.serialNumber)
                              onSerialNumbersChange(updated.join("\n"))
                            } else {
                              const updated = [...enteredSerials, s.serialNumber]
                              onSerialNumbersChange(updated.join("\n"))
                            }
                          }}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold transition ${
                            isPicked
                              ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                              : "bg-white border border-purple-200 text-purple-800 hover:bg-purple-100"
                          }`}
                        >
                          {s.serialNumber} {isPicked ? "✓" : ""}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Error Message */}
          {message ? (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
              <AlertCircle size={16} className="shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/60 px-6 py-4 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSaving || (isSerialized && !isSerialCountValid)}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-black text-white shadow-xs transition hover:bg-[var(--color-maroon-hover)] disabled:opacity-50"
          >
            <CheckCircle2 size={15} />
            {isSaving ? "Saving Adjustment..." : "Save Adjustment"}
          </button>
        </div>
      </div>
    </div>
  )
}
