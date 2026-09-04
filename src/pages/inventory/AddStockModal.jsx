import { useState, useEffect, useMemo } from "react"
import { AlertCircle, CheckCircle2, Hash, Layers, PackagePlus, Search, X } from "lucide-react"
import { getItems } from "../../features/items/items.api"
import { createStockIn } from "../../features/inventory/inventory.api"

export default function AddStockModal({
  isOpen,
  onClose,
  onSuccess,
  branchId,
  branchName,
}) {
  const [searchText, setSearchText] = useState("")
  const [catalogItems, setCatalogItems] = useState([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  const [quantity, setQuantity] = useState("1")
  const [unitCost, setUnitCost] = useState("")
  const [referenceNo, setReferenceNo] = useState("")
  const [remarks, setRemarks] = useState("Manual stock intake")
  const [serialNumbersText, setSerialNumbersText] = useState("")

  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Reset form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchText("")
      setSelectedItem(null)
      setCatalogItems([])
      setQuantity("1")
      setUnitCost("")
      setReferenceNo("")
      setRemarks("Manual stock intake")
      setSerialNumbersText("")
      setErrorMessage("")
      loadCatalog("")
    }
  }, [isOpen, branchId])

  const loadCatalog = async (query = "") => {
    setIsLoadingCatalog(true)
    try {
      const res = await getItems({
        branchId,
        search: query.trim() || undefined,
        limit: 25,
      })
      const list = res?.data?.data || res?.data?.items || []
      setCatalogItems(list)
    } catch (err) {
      console.error("Could not load catalog items:", err)
    } finally {
      setIsLoadingCatalog(false)
    }
  }

  // Handle item selection
  const handleSelectItem = (item) => {
    setSelectedItem(item)
    setUnitCost(item.costPrice !== null && item.costPrice !== undefined ? String(item.costPrice) : "")
    setSerialNumbersText("")
    setErrorMessage("")
  }

  // Parsed serial numbers
  const isSerialized = Boolean(selectedItem?.isSerialized)
  const numQuantity = Number(quantity || 0)

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
    !isSerialized || (enteredSerials.length === numQuantity && !hasDuplicateSerials)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedItem) {
      setErrorMessage("Please select an item from the catalog.")
      return
    }

    if (!Number.isFinite(numQuantity) || numQuantity <= 0) {
      setErrorMessage("Please enter a valid positive quantity.")
      return
    }

    if (isSerialized) {
      if (enteredSerials.length !== numQuantity) {
        setErrorMessage(
          `Serialized item requires exactly ${numQuantity} serial number(s). Currently entered: ${enteredSerials.length}.`
        )
        return
      }

      if (hasDuplicateSerials) {
        setErrorMessage("Duplicate serial numbers found in the input. Each serial must be unique.")
        return
      }
    }

    setIsSaving(true)
    setErrorMessage("")

    try {
      await createStockIn({
        branchId,
        itemId: selectedItem.id,
        quantity: numQuantity,
        unitCost: unitCost ? Number(unitCost) : undefined,
        referenceNo: referenceNo.trim() || undefined,
        remarks: remarks.trim() || "Manual stock intake",
        serialNumbers: isSerialized ? enteredSerials : undefined,
      })

      onSuccess?.(`Successfully added ${numQuantity} unit(s) of ${selectedItem.itemName}!`)
      onClose()
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        "Could not add stock. Please check inputs and try again."
      setErrorMessage(msg)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[var(--color-maroon)] text-white shadow-xs">
              <PackagePlus size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Add Stock</h2>
              <p className="text-xs text-slate-500 font-medium">
                {branchName ? `Branch: ${branchName}` : "Branch Stock Intake"}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="grid size-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Step 1: Product Selection */}
          {!selectedItem ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                1. Select Product from Catalog *
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value)
                    loadCatalog(e.target.value)
                  }}
                  placeholder="Search by product name, code, brand..."
                  className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                />
              </div>

              {/* Catalog Items List */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50/50 p-2">
                {isLoadingCatalog ? (
                  <p className="p-4 text-center text-xs text-slate-400 font-medium">Loading catalog products...</p>
                ) : catalogItems.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-400 font-medium">No products found matching &quot;{searchText}&quot;</p>
                ) : (
                  catalogItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className="w-full flex items-center justify-between rounded-xl bg-white p-3 text-left border border-slate-100 shadow-xs hover:border-[var(--color-maroon)] hover:bg-rose-50/30 transition group"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-xs font-black text-slate-900 truncate group-hover:text-[var(--color-maroon)]">
                          {item.itemName}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {item.itemCode} {item.brand ? `• ${item.brand}` : ""}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                          item.isSerialized
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {item.isSerialized ? "Serialized" : "Standard"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Selected Item Preview */
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Selected Product
                </span>
                <h4 className="text-sm font-black text-slate-900 mt-0.5">{selectedItem.itemName}</h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {selectedItem.itemCode} {selectedItem.brand ? `• ${selectedItem.brand}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                      isSerialized
                        ? "bg-purple-100 text-purple-800 border border-purple-300"
                        : "bg-slate-200 text-slate-800 border border-slate-300"
                    }`}
                  >
                    {isSerialized ? "Serialized (Serials Required)" : "Standard Non-serialized"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shrink-0"
              >
                Change
              </button>
            </div>
          )}

          {/* Step 2: Intake Details (Shown once item is selected) */}
          {selectedItem ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Quantity to Add *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-black text-slate-900 outline-none focus:border-[var(--color-maroon)]"
                    placeholder="1"
                  />
                </div>

                {/* Unit Cost */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Unit Cost (₱) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder={selectedItem.costPrice ? String(selectedItem.costPrice) : "0.00"}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                  />
                </div>
              </div>

              {/* Reference & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Reference No. <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Hal. Old stock, Delivery, Inv-01"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Remarks / Notes
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Manual stock intake"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                  />
                </div>
              </div>

              {/* Serial Numbers (If Serialized) */}
              {isSerialized ? (
                <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Hash size={15} className="text-purple-700" />
                      <label className="text-xs font-black text-purple-900">
                        Serial Numbers *
                      </label>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                        enteredSerials.length === numQuantity && !hasDuplicateSerials
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {enteredSerials.length} of {numQuantity} entered
                    </span>
                  </div>

                  <p className="text-[11px] text-purple-700/80 font-medium">
                    I-type o i-scan ang mga serial numbers (bawat linya o pinaghihiwalay ng kuwit/comma).
                  </p>

                  <textarea
                    rows={4}
                    value={serialNumbersText}
                    onChange={(e) => setSerialNumbersText(e.target.value)}
                    placeholder="SN-10001&#10;SN-10002"
                    className="w-full rounded-xl border border-purple-200 bg-white p-3 font-mono text-xs text-slate-900 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                  />

                  {hasDuplicateSerials ? (
                    <p className="text-xs font-bold text-rose-600 flex items-center gap-1">
                      <AlertCircle size={13} /> May duplicate serial number sa listahan.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Automatic Batch Notice */}
              <div className="rounded-xl bg-slate-100/70 p-3 text-[11px] text-slate-500 font-medium flex items-center gap-2">
                <Layers size={14} className="text-slate-400 shrink-0" />
                <span>
                  Awtomatikong gagawan ng date-based batch (<code className="font-mono text-slate-700">BAT-{new Date().toISOString().slice(0, 10).replace(/-/g, "")}-XXXX</code>) ang stock na ito nang walang error.
                </span>
              </div>
            </div>
          ) : null}

          {/* Error Message */}
          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !selectedItem || (isSerialized && !isSerialCountValid)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[var(--color-maroon-hover)] disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              {isSaving ? "Adding Stock..." : "Confirm & Add Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
