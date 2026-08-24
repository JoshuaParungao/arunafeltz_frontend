import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Barcode, Check, CheckCircle2, ChevronRight, LoaderCircle, Search, Trash2, X } from "lucide-react"

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
  const [selectedSerialsByItem, setSelectedSerialsByItem] = useState({}) // { [stockTransferItemId]: string[] (serialIds) }
  const [scanInput, setScanInput] = useState("")
  const [scanFeedback, setScanFeedback] = useState(null) // { type: "error" | "success" | "warning", message: string }
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
  const currentSelectedIds = currentItem ? (selectedSerialsByItem[currentItem.stockTransferItemId] || []) : []
  const availableSerials = currentItem?.availableSerials || []

  // Filter available serials based on search input if typing
  const filteredAvailableSerials = useMemo(() => {
    const query = scanInput.trim().toLowerCase()
    if (!query) return availableSerials
    return availableSerials.filter((s) => s.serialNumber?.toLowerCase().includes(query))
  }, [availableSerials, scanInput])

  const totalRequired = items.reduce((sum, item) => sum + Number(item.requiredQuantity || 0), 0)
  const totalSelected = Object.values(selectedSerialsByItem).reduce((sum, ids) => sum + ids.length, 0)
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
    const match = availableSerials.find(
      (s) => s.serialNumber?.trim().toLowerCase() === normalized
    )

    if (!match) {
      setScanFeedback({
        type: "error",
        message: `Serial number "${raw}" doesn't exist in this branch's available inventory.`,
      })
      return
    }

    if (currentSelectedIds.includes(match.id)) {
      setScanFeedback({
        type: "warning",
        message: `Serial "${match.serialNumber}" is already selected for this item.`,
      })
      return
    }

    if (currentSelectedIds.length >= Number(currentItem.requiredQuantity || 0)) {
      setScanFeedback({
        type: "warning",
        message: `All ${currentItem.requiredQuantity} required units have already been selected for this item. Remove one first to replace it.`,
      })
      return
    }

    // Add matched serial
    const nextSelected = [...currentSelectedIds, match.id]
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

  const toggleSerialSelection = (serialId) => {
    if (!currentItem) return
    const isSelected = currentSelectedIds.includes(serialId)

    if (isSelected) {
      setSelectedSerialsByItem((prev) => ({
        ...prev,
        [currentItem.stockTransferItemId]: currentSelectedIds.filter((id) => id !== serialId),
      }))
      setScanFeedback(null)
    } else {
      if (currentSelectedIds.length >= Number(currentItem.requiredQuantity || 0)) {
        setScanFeedback({
          type: "warning",
          message: `All ${currentItem.requiredQuantity} required units have been selected.`,
        })
        return
      }
      setSelectedSerialsByItem((prev) => ({
        ...prev,
        [currentItem.stockTransferItemId]: [...currentSelectedIds, serialId],
      }))
      setScanFeedback(null)
    }
  }

  const removeSelectedSerial = (serialId) => {
    if (!currentItem) return
    setSelectedSerialsByItem((prev) => ({
      ...prev,
      [currentItem.stockTransferItemId]: currentSelectedIds.filter((id) => id !== serialId),
    }))
  }

  const handleConfirm = () => {
    if (!isAllComplete || isSubmitting) return
    onConfirm(selectedSerialsByItem)
  }

  if (!isOpen) return null

  return (
    <div
      aria-labelledby="serial-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-5 backdrop-blur-xs"
      role="dialog"
    >
      <section className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--color-border)] p-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7A1F2B]/10 text-[#7A1F2B]">
                <Barcode size={18} />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#7A1F2B]">
                Barcode Scanner & Serial Selection
              </p>
            </div>
            <h2 className="mt-1 text-xl font-black text-[var(--color-text-strong)]" id="serial-modal-title">
              {title} {transferCode ? `· ${transferCode}` : ""}
            </h2>
            <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
              {subtitle}
            </p>
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-muted)] hover:bg-slate-50 transition"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Item Tabs (if multiple serialized items) */}
        {items.length > 1 && (
          <div className="flex overflow-x-auto border-b border-[var(--color-border)] bg-slate-50 px-5 pt-3 gap-2">
            {items.map((item, idx) => {
              const selectedCount = (selectedSerialsByItem[item.stockTransferItemId] || []).length
              const reqCount = Number(item.requiredQuantity || 0)
              const isFilled = selectedCount === reqCount
              const isActive = idx === activeItemIndex

              return (
                <button
                  key={item.stockTransferItemId}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black transition whitespace-nowrap ${
                    isActive
                      ? "border-[#7A1F2B] text-[#7A1F2B] bg-white rounded-t-xl"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
                  }`}
                  onClick={() => {
                    setActiveItemIndex(idx)
                    setScanFeedback(null)
                    setScanInput("")
                  }}
                  type="button"
                >
                  {isFilled ? (
                    <CheckCircle2 className="text-emerald-600 shrink-0" size={14} />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px]">
                      {idx + 1}
                    </span>
                  )}
                  <span>{item.itemName || item.itemCode}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isFilled
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {selectedCount} / {reqCount}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {currentItem ? (
            <>
              {/* Active Item Card */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-[var(--color-soft)] p-4 gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-muted)]">
                    Item Code: {currentItem.itemCode}
                  </span>
                  <h3 className="text-base font-black text-[var(--color-text-strong)]">
                    {currentItem.itemName}
                  </h3>
                  <p className="text-xs font-bold text-[var(--color-muted)] mt-0.5">
                    Total available in source inventory: {availableSerials.length} unit(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`rounded-2xl px-4 py-2 text-center ${
                      currentSelectedIds.length === Number(currentItem.requiredQuantity || 0)
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase">Selected Units</p>
                    <p className="text-lg font-black">
                      {currentSelectedIds.length} / {currentItem.requiredQuantity}
                    </p>
                  </div>
                </div>
              </div>

              {/* Barcode Scanner / Type Input */}
              <form className="relative" onSubmit={handleScanSubmit}>
                <label className="block text-xs font-black uppercase tracking-wide text-[var(--color-muted)] mb-1.5">
                  Scan Barcode / Type Serial Number
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Barcode size={20} />
                  </div>
                  <input
                    ref={inputRef}
                    className="w-full rounded-2xl border-2 border-[var(--color-border)] bg-white py-3.5 pl-12 pr-28 text-sm font-black tracking-wider placeholder:font-normal placeholder:tracking-normal focus:border-[#7A1F2B] focus:outline-hidden transition"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setScanInput(e.target.value)
                      if (scanFeedback) setScanFeedback(null)
                    }}
                    placeholder="Scan barcode or type serial & press Enter..."
                    type="text"
                    value={scanInput}
                  />
                  <button
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl bg-[#7A1F2B] px-3.5 py-2 text-xs font-black text-white hover:bg-[#631823] transition disabled:opacity-50"
                    disabled={!scanInput.trim() || isSubmitting}
                    type="submit"
                  >
                    Enter / Add
                  </button>
                </div>
              </form>

              {/* Real-time Feedback Banner */}
              {scanFeedback && (
                <div
                  className={`flex items-center gap-2 rounded-2xl p-3.5 text-xs font-bold transition ${
                    scanFeedback.type === "error"
                      ? "bg-rose-50 text-rose-800 border border-rose-200"
                      : scanFeedback.type === "warning"
                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {scanFeedback.type === "error" ? (
                    <AlertCircle className="shrink-0 text-rose-600" size={16} />
                  ) : scanFeedback.type === "warning" ? (
                    <AlertCircle className="shrink-0 text-amber-600" size={16} />
                  ) : (
                    <CheckCircle2 className="shrink-0 text-emerald-600" size={16} />
                  )}
                  <span>{scanFeedback.message}</span>
                </div>
              )}

              {/* Selected Serials Tray */}
              {currentSelectedIds.length > 0 && (
                <div className="rounded-2xl border border-[var(--color-border)] p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black uppercase text-[var(--color-text-strong)]">
                      Selected Serials for this Item ({currentSelectedIds.length})
                    </p>
                    <button
                      className="text-[11px] font-bold text-rose-600 hover:underline"
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
                  <div className="flex flex-wrap gap-2">
                    {currentSelectedIds.map((id) => {
                      const serial = availableSerials.find((s) => s.id === id)
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-300 px-3 py-1.5 text-xs font-black text-[var(--color-text-strong)] shadow-xs"
                        >
                          <Barcode size={13} className="text-slate-400" />
                          <span>{serial?.serialNumber || id}</span>
                          <button
                            aria-label="Remove serial"
                            className="rounded-full p-0.5 hover:bg-rose-100 hover:text-rose-700 text-slate-400 transition ml-0.5"
                            onClick={() => removeSelectedSerial(id)}
                            type="button"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Available Serials Quick-List */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">
                  Available Serials in Branch ({filteredAvailableSerials.length})
                </p>
                {availableSerials.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-rose-300 bg-rose-50/50 p-6 text-center">
                    <AlertCircle className="mx-auto text-rose-500 mb-2" size={24} />
                    <p className="text-sm font-black text-rose-800">
                      No Available Serial Numbers in Source Branch
                    </p>
                    <p className="text-xs text-rose-600 mt-1">
                      This item cannot be dispatched because there are no units with status 'AVAILABLE'.
                    </p>
                  </div>
                ) : filteredAvailableSerials.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                    <p className="text-sm font-bold text-[var(--color-muted)]">
                      No serial matching "{scanInput}"
                    </p>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                    {filteredAvailableSerials.map((serial) => {
                      const isSelected = currentSelectedIds.includes(serial.id)
                      return (
                        <button
                          key={serial.id}
                          className={`w-full flex items-center justify-between p-3 text-left text-xs font-bold transition hover:bg-slate-50 ${
                            isSelected ? "bg-emerald-50/70" : ""
                          }`}
                          onClick={() => toggleSerialSelection(serial.id)}
                          type="button"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-lg border text-white ${
                                isSelected
                                  ? "bg-emerald-600 border-emerald-600"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <Check size={13} />}
                            </div>
                            <div>
                              <p className="font-black text-[var(--color-text-strong)] font-mono text-sm">
                                {serial.serialNumber}
                              </p>
                              {serial.batch?.batchCode && (
                                <p className="text-[10px] text-[var(--color-muted)] font-sans">
                                  Batch: {serial.batch.batchCode}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                              isSelected
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isSelected ? "Selected" : "Click to select"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-sm font-bold text-[var(--color-muted)] py-8">
              No items selected.
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-[var(--color-border)] bg-slate-50 p-4 gap-3">
          <div className="text-xs text-[var(--color-muted)]">
            <span className="font-bold">Total Dispatched Units:</span>{" "}
            <span className="font-black text-[var(--color-text-strong)]">
              {totalSelected} of {totalRequired} serial(s) assigned
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              className="flex-1 sm:flex-none rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 text-xs font-black text-[var(--color-text-strong)] hover:bg-slate-100 transition disabled:opacity-50"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex-1 sm:flex-none rounded-2xl bg-emerald-700 px-6 py-3 text-xs font-black text-white hover:bg-emerald-800 transition disabled:cursor-not-allowed disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
              disabled={!isAllComplete || isSubmitting}
              onClick={handleConfirm}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="animate-spin" size={16} />
                  <span>Fulfilling Transfer...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Confirm & Dispatch Transfer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
