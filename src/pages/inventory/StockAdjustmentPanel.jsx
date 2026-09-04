import { useMemo } from "react"
import { AlertCircle, CheckCircle2, Hash, Layers } from "lucide-react"

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

  const isSerialCountValid = !isSerialized || (enteredSerials.length === numQuantity && !hasDuplicateSerials)

  const selectedBatch = batches.find((b) => b.id === batchId)

  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Inventory Action
            </span>
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
          <h3 className="mt-1 text-xl font-black text-slate-900">
            Adjust Stock: {item.itemName}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Code: {item.itemCode} {item.brand ? `• Brand: ${item.brand}` : ""}
          </p>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={onClose}
          className="self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Close
        </button>
      </div>

      {/* Quick Summary Info */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Available</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(item.quantityAvailable)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Batches</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(batches.length)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Batch Stock</p>
          <p className="mt-1 text-lg font-black text-slate-900">
            {selectedBatch ? formatNumber(selectedBatch.quantityAvailable) : "Auto-batch"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Branch</p>
          <p className="mt-1 text-sm font-bold text-slate-800 truncate">{item.branch?.name || item.branch?.code || "Branch"}</p>
        </div>
      </div>

      {/* Adjustment Form Fields */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Adjustment Type */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Adjustment Type *</label>
          <select
            value={type}
            disabled={isSaving}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
          >
            <option value="INCREASE">➕ Add Stock (Increase)</option>
            <option value="DECREASE">➖ Deduct Stock (Decrease)</option>
          </select>
        </div>

        {/* Batch Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Batch Assignment</label>
          <select
            value={batchId || ""}
            disabled={isSaving}
            onChange={(e) => onBatchChange(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
          >
            {batches.length === 0 ? (
              <option value="">Auto-create fresh batch ({new Date().toISOString().slice(0, 10).replace(/-/g, "")})</option>
            ) : (
              <>
                <option value="">Latest / Auto-resolve Batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchCode} (Avail: {formatNumber(batch.quantityAvailable)})
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Quantity to Adjust *</label>
          <input
            type="number"
            min="1"
            value={quantity}
            disabled={isSaving}
            onChange={(e) => onQuantityChange(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-black text-slate-900 outline-none focus:border-[var(--color-maroon)]"
            placeholder="1"
          />
        </div>

        {/* Reference Number */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Reference No. (Optional)</label>
          <input
            type="text"
            value={referenceNo}
            disabled={isSaving}
            onChange={(e) => onReferenceNoChange(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)]"
            placeholder="Hal. ADJ-001, Inv, etc."
          />
        </div>
      </div>

      {/* Serial Numbers (If Serialized Item) */}
      {isSerialized ? (
        <div className="mt-4 rounded-2xl border border-purple-200/80 bg-purple-50/40 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Hash size={15} className="text-purple-700" />
              <label className="text-xs font-black text-purple-900">
                {type === "INCREASE" ? "Serial Numbers to Add *" : "Serial Numbers to Deduct / Remove *"}
              </label>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                enteredSerials.length === numQuantity && !hasDuplicateSerials
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-amber-100 text-amber-800 border border-amber-300"
              }`}
            >
              {enteredSerials.length} of {numQuantity} serials entered
            </span>
          </div>

          <p className="text-[11px] text-purple-700/80 mb-2 font-medium">
            {type === "INCREASE"
              ? "I-type o i-scan ang mga bagong serial numbers (bawat linya o pinaghihiwalay ng kuwit/comma)."
              : "I-type o i-scan ang serial number(s) ng item na aalisin (bawat linya o pinaghihiwalay ng kuwit/comma)."}
          </p>

          <textarea
            rows={3}
            value={serialNumbersText}
            disabled={isSaving}
            onChange={(e) => onSerialNumbersChange(e.target.value)}
            placeholder="SN-100293&#10;SN-100294"
            className="w-full rounded-xl border border-purple-200 bg-white p-3 font-mono text-xs text-slate-900 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
          />

          {hasDuplicateSerials ? (
            <p className="mt-1.5 text-xs font-bold text-rose-600 flex items-center gap-1">
              <AlertCircle size={13} /> May duplicate serial number sa listahan.
            </p>
          ) : null}

          {/* If Deducting, and we have known available serials for this item, show clickable suggestions */}
          {type === "DECREASE" && availableSerials.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-purple-200/60">
              <p className="text-[11px] font-bold text-purple-900 mb-1.5">
                Available Serials sa Branch (Pindutin para mabilis maidagdag):
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
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
                      className={`rounded-lg px-2 py-1 text-[10px] font-mono font-bold transition ${
                        isPicked
                          ? "bg-[var(--color-maroon)] text-white"
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

      {/* Reason / Remarks */}
      <div className="mt-4">
        <label className="block text-xs font-bold text-slate-700 mb-1.5">Reason / Remarks *</label>
        <input
          type="text"
          value={remarks}
          disabled={isSaving}
          onChange={(e) => onRemarksChange(e.target.value)}
          placeholder="Hal. Physical count adjustment, damaged item, customer replacement"
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)]"
        />
      </div>

      {/* Error Message */}
      {message ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="mt-5 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          disabled={isSaving}
          onClick={onClose}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSaving || (isSerialized && !isSerialCountValid)}
          onClick={onSave}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[var(--color-maroon-hover)] disabled:opacity-50"
        >
          <CheckCircle2 size={15} />
          {isSaving ? "Saving Adjustment..." : "Save Adjustment"}
        </button>
      </div>
    </section>
  )
}
