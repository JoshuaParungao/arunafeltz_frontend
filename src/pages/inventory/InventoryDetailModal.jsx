import { useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  History,
  Layers,
  LoaderCircle,
  Package,
  Search,
  Sliders,
  Tag,
  X,
} from "lucide-react"

function formatNumber(value) {
  const number = Number(value || 0)
  return number.toLocaleString("en-PH")
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  })
}

function formatDateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-PH", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function dateOnly(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-PH")
}

function StockBadge({ available, reorderLevel }) {
  const qty = Number(available || 0)
  const reorder = Number(reorderLevel || 0)

  if (qty <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
        <span className="size-1.5 rounded-full bg-rose-500" />
        Out of stock
      </span>
    )
  }

  if (reorder > 0 && qty <= reorder) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Low stock
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Stock is okay
    </span>
  )
}

function MovementTypeBadge({ type }) {
  const isPositive = ["IN", "RECEIVING", "PURCHASE_RECEIVING", "STOCK_IN", "TRANSFER_IN", "WARRANTY_RETURN"].includes(type) || type?.includes("INCREASE")
  const isNegative = ["OUT", "SALE", "POS_SALE", "TRANSFER_OUT", "DEFECTIVE", "SCRAP"].includes(type) || type?.includes("DECREASE")

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
        isPositive
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : isNegative
            ? "bg-rose-50 text-rose-700 border border-rose-200"
            : "bg-slate-100 text-slate-700 border border-slate-200"
      }`}
    >
      {isPositive ? <ArrowUpRight size={11} strokeWidth={2.5} /> : isNegative ? <ArrowDownRight size={11} strokeWidth={2.5} /> : null}
      {String(type || "MOVEMENT").replace(/_/g, " ")}
    </span>
  )
}

export default function InventoryDetailModal({
  item,
  batches = [],
  availableSerials = [],
  stockMovements = [],
  isLoadingMovements = false,
  movementMessage = "",
  canAdjust = false,
  canViewCost = false,
  onAdjust,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("overview")
  const [serialSearch, setSerialSearch] = useState("")
  const [copiedSerial, setCopiedSerial] = useState("")

  if (!item) return null

  const isSerialized = Boolean(item.isSerialized)
  const availableQty = Number(item.quantityAvailable || 0)
  const totalInQty = Number(item.quantityIn || 0)

  const filteredSerials = useMemo(() => {
    if (!serialSearch.trim()) return availableSerials
    const query = serialSearch.trim().toLowerCase()
    return availableSerials.filter((s) =>
      String(s.serialNumber || "").toLowerCase().includes(query)
    )
  }, [availableSerials, serialSearch])

  const copySerial = (text) => {
    if (!text) return
    navigator.clipboard?.writeText(text)
    setCopiedSerial(text)
    setTimeout(() => setCopiedSerial(""), 1500)
  }

  const copyAllSerials = () => {
    const list = availableSerials.map((s) => s.serialNumber).join("\n")
    if (!list) return
    navigator.clipboard?.writeText(list)
    setCopiedSerial("__ALL__")
    setTimeout(() => setCopiedSerial(""), 1500)
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: Package },
    { id: "batches", label: `Batches (${batches.length})`, icon: Layers },
    ...(isSerialized ? [{ id: "serials", label: `Serials (${availableSerials.length})`, icon: Hash }] : []),
    { id: "movements", label: `Movements (${stockMovements.length})`, icon: History },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        
        {/* Minimalist Header */}
        <header className="flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0 pr-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-50 text-[var(--color-maroon)] border border-slate-200/80 shadow-2xs">
              <Package size={22} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                  {item.itemName}
                </h3>
                <StockBadge available={availableQty} reorderLevel={item.reorderLevel} />
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]">
                  {item.itemCode}
                </span>
                {item.barcode ? (
                  <span className="font-mono text-slate-400 text-[11px]">
                    Barcode: {item.barcode}
                  </span>
                ) : null}
                <span className="text-slate-300">•</span>
                <span className="rounded-md bg-purple-50 border border-purple-200/70 text-purple-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {isSerialized ? "Serialized" : "Standard Product"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-600">
                  {item.branch?.name || item.branch?.code || "Branch"}
                </span>
              </div>
            </div>
          </div>

          <button
            aria-label="Close"
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        {/* Quick Metric Cards Strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 border-b border-slate-100 bg-slate-50/60 px-6 py-3.5 shrink-0 text-xs">
          <div className="rounded-xl bg-white border border-slate-200/80 p-2.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available Stock</p>
            <p className="mt-0.5 text-base font-black text-[var(--color-maroon)]">
              {formatNumber(availableQty)} <span className="text-[10px] font-normal text-slate-500">{item.unit?.name || "units"}</span>
            </p>
          </div>

          <div className="rounded-xl bg-white border border-slate-200/80 p-2.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Stock In</p>
            <p className="mt-0.5 text-base font-black text-slate-800">
              {formatNumber(totalInQty)}
            </p>
          </div>

          <div className="rounded-xl bg-white border border-slate-200/80 p-2.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Batches</p>
            <p className="mt-0.5 text-base font-black text-slate-800">
              {formatNumber(batches.length)}
            </p>
          </div>

          <div className="rounded-xl bg-white border border-slate-200/80 p-2.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Serials</p>
            <p className="mt-0.5 text-base font-black text-slate-800">
              {isSerialized ? formatNumber(availableSerials.length) : "N/A"}
            </p>
          </div>
        </div>

        {/* Minimalist Tabs Header */}
        <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? "border-[var(--color-maroon)] text-[var(--color-maroon)]"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
                type="button"
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Scrollable Body Content */}
        <div className="overflow-y-auto p-6 space-y-4 max-h-[50vh]">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Product Identification
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Item Code</span>
                      <span className="font-mono font-bold text-slate-900">{item.itemCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Barcode</span>
                      <span className="font-mono font-semibold text-slate-800">{item.barcode || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Brand</span>
                      <span className="font-semibold text-slate-800">{item.brand || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Model</span>
                      <span className="font-semibold text-slate-800">{item.modelName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Category</span>
                      <span className="font-semibold text-slate-800">{item.category?.name || "Uncategorized"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Inventory Specifications
                  </h4>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unit of Measure</span>
                      <span className="font-semibold text-slate-800">{item.unit?.name || "Pieces"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tracking Mode</span>
                      <span className="font-semibold text-slate-800">{isSerialized ? "Serialized" : "Standard Stock"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reorder Level</span>
                      <span className="font-bold text-slate-900">{formatNumber(item.reorderLevel)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Minimum Stock</span>
                      <span className="font-bold text-slate-900">{formatNumber(item.minimumStock || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned Branch</span>
                      <span className="font-bold text-[var(--color-maroon)]">{item.branch?.name || item.branch?.code || "Main"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 2: BATCHES */}
          {activeTab === "batches" ? (
            <div className="space-y-3">
              {batches.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[500px] text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Batch Code</th>
                        <th className="px-4 py-3 text-right">Available Qty</th>
                        <th className="px-4 py-3 text-right">Received Qty</th>
                        {canViewCost ? <th className="px-4 py-3 text-right">Cost Price</th> : null}
                        <th className="px-4 py-3 text-right">Expiry Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-slate-900">{batch.batchCode}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[var(--color-maroon)]">
                            {formatNumber(batch.quantityAvailable)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatNumber(batch.quantityIn || batch.quantityReceived)}
                          </td>
                          {canViewCost ? (
                            <td className="px-4 py-3 text-right font-mono text-slate-700">
                              {formatMoney(batch.costPrice)}
                            </td>
                          ) : null}
                          <td className="px-4 py-3 text-right text-slate-500">
                            {batch.expiryDate ? dateOnly(batch.expiryDate) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs">
                  <Layers className="mx-auto text-slate-300 mb-2" size={28} />
                  <p className="font-bold text-slate-700">No active batches</p>
                  <p className="text-slate-400 mt-0.5">Batches are generated when stock is received or stocked in.</p>
                </div>
              )}
            </div>
          ) : null}

          {/* TAB 3: SERIALS */}
          {activeTab === "serials" && isSerialized ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--color-maroon)] placeholder:text-slate-400"
                    onChange={(e) => setSerialSearch(e.target.value)}
                    placeholder="Search serial number…"
                    value={serialSearch}
                  />
                </div>
                {availableSerials.length > 0 ? (
                  <button
                    onClick={copyAllSerials}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shrink-0"
                    type="button"
                  >
                    {copiedSerial === "__ALL__" ? (
                      <>
                        <Check className="text-emerald-600" size={13} />
                        Copied all!
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        Copy all ({availableSerials.length})
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              {filteredSerials.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 max-h-[35vh] overflow-y-auto p-1">
                  {filteredSerials.map((s) => (
                    <div
                      key={s.id || s.serialNumber}
                      className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs transition hover:border-[var(--color-maroon)] hover:bg-white"
                    >
                      <span className="font-mono font-bold text-slate-800 select-all truncate pr-2">
                        {s.serialNumber}
                      </span>
                      <button
                        onClick={() => copySerial(s.serialNumber)}
                        className="text-slate-400 hover:text-[var(--color-maroon)] transition shrink-0"
                        title="Copy serial"
                        type="button"
                      >
                        {copiedSerial === s.serialNumber ? (
                          <Check className="text-emerald-600" size={13} />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs">
                  <Hash className="mx-auto text-slate-300 mb-2" size={28} />
                  <p className="font-bold text-slate-700">No available serials found</p>
                  <p className="text-slate-400 mt-0.5">
                    {serialSearch ? "Try adjusting your search query." : "All serials have been assigned, sold, or none recorded yet."}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* TAB 4: STOCK MOVEMENTS */}
          {activeTab === "movements" ? (
            <div className="space-y-3">
              {isLoadingMovements ? (
                <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-slate-500">
                  <LoaderCircle className="animate-spin" size={16} /> Loading movement history…
                </div>
              ) : movementMessage ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                  {movementMessage}
                </div>
              ) : stockMovements.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[550px] text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Movement / Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3">Reference / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockMovements.map((mov) => (
                        <tr key={mov.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3">
                            <p className="font-mono font-bold text-slate-900">{mov.movementCode || "MOV"}</p>
                            <p className="text-[10px] text-slate-400">{formatDateTime(mov.movementDate || mov.createdAt)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <MovementTypeBadge type={mov.type} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {Number(mov.quantity) > 0 ? `+${formatNumber(mov.quantity)}` : formatNumber(mov.quantity)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{mov.referenceNo || "—"}</p>
                            {mov.remarks ? <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{mov.remarks}</p> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs">
                  <History className="mx-auto text-slate-300 mb-2" size={28} />
                  <p className="font-bold text-slate-700">No stock movements recorded yet</p>
                  <p className="text-slate-400 mt-0.5">Movements will log automatically when adjustments, receiving, or sales occur.</p>
                </div>
              )}
            </div>
          ) : null}

        </div>

        {/* Minimalist Clean Footer */}
        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/75 px-6 py-3.5 shrink-0">
          <p className="text-xs text-slate-400 font-medium">
            Branch: <strong className="text-slate-600">{item.branch?.code || "MAIN"}</strong>
          </p>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              onClick={onClose}
              type="button"
            >
              Close
            </button>

            {canAdjust ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition"
                onClick={() => onAdjust(item)}
                type="button"
              >
                <Sliders size={14} />
                Adjust Stock
              </button>
            ) : null}
          </div>
        </footer>

      </div>
    </div>
  )
}
