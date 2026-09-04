import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Barcode, Check, CheckCircle2, ChevronRight, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react"

export default function SerialScannerModal({
  isOpen,
  onClose,
  title = "Assign Physical Serial Numbers",
  subtitle = "Scan barcode or type serial numbers for each item being dispatched.",
  transferCode = "",
  items = [], // [{ stockTransferItemId, itemId, itemName, itemCode, requiredQuantity, availableSerials }]
  isSubmitting = false,
  onConfirm,
}) {
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [selectedSerialsByItem, setSelectedSerialsByItem] = useState({}) // { [stockTransferItemId]: Array<{ id?: string, serialNumber: string, isNew?: boolean }> }
  const [scanInput, setScanInput] = useState("")
  const [scanFeedback, setScanFeedback] = useState(null) // { type: "error" | "success" | "warning" | "unlisted", message: string, serialNumber?: string }
  const inputRef = useRef(null)

  // Reset state when opened or items change
  useEffect(() => {
    if (isOpen) {
      setActiveItemIndex(0)
      setScanInput("")
      setScanFeedback(null)
      const initialMap = {}
      items.forEach((item) => {
        initialMap[item.stockTransferItemId] = []
      })
      setSelectedSerialsByItem(initialMap)
    }
  }, [isOpen, items])

  // Auto-focus the barcode input
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen, activeItemIndex])

  const currentItem = items[activeItemIndex] || null
  const currentSelected = currentItem ? (selectedSerialsByItem[currentItem.stockTransferItemId] || []) : []
  const availableSerials = currentItem?.availableSerials || []

  // Filter available serials based on search input if typing
  const filteredAvailableSerials = useMemo(() => {
    const query = scanInput.trim().toLowerCase()
    if (!query) return availableSerials
    return availableSerials.filter((s) => s.serialNumber?.toLowerCase().includes(query))
  }, [availableSerials, scanInput])

  const totalRequired = items.reduce((sum, item) => sum + Number(item.requiredQuantity || 0), 0)
  const totalSelected = Object.values(selectedSerialsByItem).reduce((sum, list) => sum + list.length, 0)
  const isAllComplete = items.length > 0 && items.every((item) => {
    const selected = selectedSerialsByItem[item.stockTransferItemId] || []
    return selected.length === Number(item.requiredQuantity || 0)
  })

  const handleScanSubmit = (event) => {
    event.preventDefault()
    if (!currentItem) return

    const raw = scanInput.trim()
    if (!raw) return

    const normalized = raw.toLowerCase()
    const alreadySelected = currentSelected.some(
      (s) => s.serialNumber?.trim().toLowerCase() === normalized
    )

    if (alreadySelected) {
      setScanFeedback({
        type: "warning",
        message: `Serial "${raw}" is already selected for this item.`,
      })
      return
    }

    if (currentSelected.length >= Number(currentItem.requiredQuantity || 0)) {
      setScanFeedback({
        type: "warning",
        message: `All ${currentItem.requiredQuantity} required units have already been selected for this item. Remove one first to replace it.`,
      })
      return
    }

    const match = availableSerials.find(
      (s) => s.serialNumber?.trim().toLowerCase() === normalized
    )

    if (!match) {
      setScanFeedback({
        type: "unlisted",
        serialNumber: raw,
        message: `Serial "${raw}" is not in this branch's available inventory.`,
      })
      return
    }

    // Add matched serial
    const nextSelected = [
      ...currentSelected,
      { id: match.id, serialNumber: match.serialNumber, isNew: false },
    ]
    setSelectedSerialsByItem((prev) => ({
      ...prev,
      [currentItem.stockTransferItemId]: nextSelected,
    }))

    setScanInput("")
    setScanFeedback({
      type: "success",
      message: `Scanned & added: ${match.serialNumber}`,
    })

    // If this item is now fulfilled and there is a next item, auto-advance tab
    if (nextSelected.length === Number(currentItem.requiredQuantity || 0) && activeItemIndex < items.length - 1) {
      setTimeout(() => {
        setActiveItemIndex((curr) => Math.min(curr + 1, items.length - 1))
        setScanFeedback(null)
      }, 500)
    }
  }

  const handleAddNewSerial = (rawSerial) => {
    if (!currentItem) return
    const raw = (rawSerial || scanInput).trim()
    if (!raw) return

    const normalized = raw.toLowerCase()
    const alreadySelected = currentSelected.some(
      (s) => s.serialNumber?.trim().toLowerCase() === normalized
    )

    if (alreadySelected) {
      setScanFeedback({
        type: "warning",
        message: `Serial "${raw}" is already selected for this item.`,
      })
      return
    }

    if (currentSelected.length >= Number(currentItem.requiredQuantity || 0)) {
      setScanFeedback({
        type: "warning",
        message: `All ${currentItem.requiredQuantity} required units have already been selected for this item.`,
      })
      return
    }

    const nextSelected = [
      ...currentSelected,
      { serialNumber: raw, isNew: true },
    ]
    setSelectedSerialsByItem((prev) => ({
      ...prev,
      [currentItem.stockTransferItemId]: nextSelected,
    }))

    setScanInput("")
    setScanFeedback({
      type: "success",
      message: `Added new physical serial: ${raw}`,
    })

    if (nextSelected.length === Number(currentItem.requiredQuantity || 0) && activeItemIndex < items.length - 1) {
      setTimeout(() => {
        setActiveItemIndex((curr) => Math.min(curr + 1, items.length - 1))
        setScanFeedback(null)
      }, 500)
    }
  }

  const toggleSerialSelection = (serial) => {
    if (!currentItem) return
    const isSelected = currentSelected.some(
      (s) => (s.id && s.id === serial.id) || s.serialNumber?.toLowerCase() === serial.serialNumber?.toLowerCase()
    )

    if (isSelected) {
      setSelectedSerialsByItem((prev) => ({
        ...prev,
        [currentItem.stockTransferItemId]: currentSelected.filter(
          (s) => (s.id ? s.id !== serial.id : s.serialNumber !== serial.serialNumber)
        ),
      }))
      setScanFeedback(null)
    } else {
      if (currentSelected.length >= Number(currentItem.requiredQuantity || 0)) {
        setScanFeedback({
          type: "warning",
          message: `All ${currentItem.requiredQuantity} required units have been selected.`,
        })
        return
      }
      setSelectedSerialsByItem((prev) => ({
        ...prev,
        [currentItem.stockTransferItemId]: [
          ...currentSelected,
          { id: serial.id, serialNumber: serial.serialNumber, isNew: false },
        ],
      }))
      setScanFeedback(null)
    }
  }

  const removeSelectedSerial = (target) => {
    if (!currentItem) return
    setSelectedSerialsByItem((prev) => ({
      ...prev,
      [currentItem.stockTransferItemId]: currentSelected.filter(
        (s) => (target.id ? s.id !== target.id : s.serialNumber !== target.serialNumber)
      ),
    }))
  }

  const handleConfirm = () => {
    if (!isAllComplete || isSubmitting) return
    const formatted = {}
    for (const item of items) {
      const list = selectedSerialsByItem[item.stockTransferItemId] || []
      formatted[item.stockTransferItemId] = {
        serialIds: list.filter((s) => !s.isNew && s.id).map((s) => s.id),
        newSerialNumbers: list.filter((s) => s.isNew).map((s) => s.serialNumber),
      }
    }
    onConfirm(formatted)
  }

  if (!isOpen) return null

  return (
    <div
      aria-labelledby="serial-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs"
      role="dialog"
    >
      <section className="my-auto flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Serial Scanner
            </span>
            <h2 className="mt-0.5 text-base font-black text-slate-900 leading-tight" id="serial-modal-title">
              {title} {transferCode ? `· ${transferCode}` : ""}
            </h2>
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        {/* Item Tabs (if multiple serialized items) */}
        {items.length > 1 && (
          <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/50 px-4 pt-2 gap-1.5">
            {items.map((item, idx) => {
              const selectedCount = (selectedSerialsByItem[item.stockTransferItemId] || []).length
              const reqCount = Number(item.requiredQuantity || 0)
              const isFilled = selectedCount === reqCount
              const isActive = idx === activeItemIndex

              return (
                <button
                  key={item.stockTransferItemId}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? "border-[var(--color-maroon)] text-[var(--color-maroon)] bg-white rounded-t-lg shadow-2xs"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                  onClick={() => {
                    setActiveItemIndex(idx)
                    setScanFeedback(null)
                    setScanInput("")
                  }}
                  type="button"
                >
                  {isFilled ? (
                    <CheckCircle2 className="text-emerald-600 shrink-0" size={13} />
                  ) : (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-mono">
                      {idx + 1}
                    </span>
                  )}
                  <span className="truncate max-w-[120px]">{item.itemName || item.itemCode}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                      isFilled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {selectedCount}/{reqCount}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {currentItem ? (
            <>
              {/* Active Item Card */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-100 bg-slate-50/75 p-3 gap-2.5">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-maroon)]">
                    {currentItem.itemCode}
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">
                    {currentItem.itemName}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Source inventory: {availableSerials.length} unit(s) available
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`rounded-xl px-3 py-1.5 text-center ${
                      currentSelected.length === Number(currentItem.requiredQuantity || 0)
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-wider">Units</p>
                    <p className="text-sm font-mono font-black">
                      {currentSelected.length} / {currentItem.requiredQuantity}
                    </p>
                  </div>
                </div>
              </div>

              {/* Barcode Scanner / Type Input */}
              <form className="relative" onSubmit={handleScanSubmit}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Scan Barcode / Type Serial Number
                </span>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Barcode size={16} />
                  </div>
                  <input
                    ref={inputRef}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-20 text-xs font-mono font-bold tracking-wider placeholder:font-normal placeholder:tracking-normal focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] outline-none transition"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setScanInput(e.target.value)
                      if (scanFeedback) setScanFeedback(null)
                    }}
                    placeholder="Scan barcode or type serial & press Enter…"
                    type="text"
                    value={scanInput}
                  />
                  <button
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--color-maroon)] px-3 py-1 text-[11px] font-bold text-white hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
                    disabled={!scanInput.trim() || isSubmitting}
                    type="submit"
                  >
                    Add
                  </button>
                </div>
              </form>

              {/* Real-time Feedback Banner */}
              {scanFeedback && (
                scanFeedback.type === "unlisted" ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
                    <div className="flex items-start gap-2 text-amber-900">
                      <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={15} />
                      <div>
                        <p className="font-bold">
                          Serial &ldquo;<span className="font-mono">{scanFeedback.serialNumber}</span>&rdquo; is not in source inventory.
                        </p>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Unrecorded or newly arrived unit? You can register and dispatch it directly.
                        </p>
                      </div>
                    </div>
                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-900 transition shrink-0 shadow-2xs"
                      onClick={() => handleAddNewSerial(scanFeedback.serialNumber)}
                      type="button"
                    >
                      <Plus size={14} /> Add as New Serial
                    </button>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition ${
                      scanFeedback.type === "error"
                        ? "bg-rose-50 text-rose-800 border border-rose-200"
                        : scanFeedback.type === "warning"
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {scanFeedback.type === "error" ? (
                      <AlertCircle className="shrink-0 text-rose-600" size={14} />
                    ) : scanFeedback.type === "warning" ? (
                      <AlertCircle className="shrink-0 text-amber-600" size={14} />
                    ) : (
                      <CheckCircle2 className="shrink-0 text-emerald-600" size={14} />
                    )}
                    <span>{scanFeedback.message}</span>
                  </div>
                )
              )}

              {/* Selected Serials Tray */}
              {currentSelected.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Selected Serials ({currentSelected.length})
                    </p>
                    <button
                      className="text-[10px] font-bold text-rose-600 hover:underline"
                      onClick={() =>
                        setSelectedSerialsByItem((prev) => ({
                          ...prev,
                          [currentItem.stockTransferItemId]: [],
                        }))
                      }
                      type="button"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {currentSelected.map((s) => {
                      return (
                        <span
                          key={s.id || s.serialNumber}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-mono font-semibold shadow-2xs ${
                            s.isNew
                              ? "bg-purple-50 border-purple-200 text-purple-900"
                              : "bg-white border-slate-200 text-slate-800"
                          }`}
                        >
                          <span>{s.serialNumber}</span>
                          {s.isNew && (
                            <span className="rounded bg-purple-200/80 px-1 py-0.2 text-[9px] font-sans font-bold text-purple-800">
                              New
                            </span>
                          )}
                          <button
                            aria-label="Remove serial"
                            className="rounded-full p-0.5 hover:text-rose-700 text-slate-400 transition ml-0.5"
                            onClick={() => removeSelectedSerial(s)}
                            type="button"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Available Serials Quick-List */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Available Serials in Branch ({filteredAvailableSerials.length})
                </p>
                {availableSerials.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
                    <AlertCircle className="mx-auto text-slate-400 mb-1" size={20} />
                    <p className="text-xs font-bold text-slate-700">
                      No Pre-existing Serial Numbers in Source Branch
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Type or scan the physical unit&apos;s serial number above to register and dispatch it.
                    </p>
                  </div>
                ) : filteredAvailableSerials.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                    <p className="text-xs font-semibold text-slate-400">
                      No serial matching &ldquo;{scanInput}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {filteredAvailableSerials.map((serial) => {
                      const isSelected = currentSelected.some(
                        (s) => (s.id && s.id === serial.id) || s.serialNumber?.toLowerCase() === serial.serialNumber?.toLowerCase()
                      )
                      return (
                        <button
                          key={serial.id}
                          className={`w-full flex items-center justify-between p-2.5 text-left text-xs transition hover:bg-slate-50 ${
                            isSelected ? "bg-emerald-50/70" : ""
                          }`}
                          onClick={() => toggleSerialSelection(serial)}
                          type="button"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-4 w-4 items-center justify-center rounded border text-white ${
                                isSelected
                                  ? "bg-emerald-600 border-emerald-600"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <Check size={11} />}
                            </div>
                            <div>
                              <p className="font-mono font-bold text-slate-900 text-xs">
                                {serial.serialNumber}
                              </p>
                              {serial.batch?.batchCode && (
                                <p className="text-[10px] text-slate-400">
                                  Batch: {serial.batch.batchCode}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                              isSelected
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-xs font-bold text-slate-400 py-6">
              No items selected.
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 px-5 py-3 gap-3">
          <div className="text-xs text-slate-500">
            <span>Dispatched:</span>{" "}
            <strong className="font-mono text-slate-900">
              {totalSelected} / {totalRequired}
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isAllComplete || isSubmitting}
              onClick={handleConfirm}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="animate-spin" size={14} />
                  <span>Fulfilling…</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Confirm & Dispatch</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
