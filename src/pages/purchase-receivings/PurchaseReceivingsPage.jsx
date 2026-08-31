import { useCallback, useEffect, useMemo, useState } from "react"
import { Boxes, CheckCircle2, ChevronLeft, ChevronRight, Eye, LoaderCircle, PackagePlus, Plus, Search, Trash2, X } from "lucide-react"

import { getItems } from "../../features/items/items.api"
import { getPurchaseOrders } from "../../features/purchase-orders/purchaseOrders.api"
import {
  createPurchaseReceiving,
  getPurchaseReceivingById,
  getPurchaseReceivings,
  updatePurchaseReceiving,
  updatePurchaseReceivingStatus,
} from "../../features/purchase-receivings/purchaseReceivings.api"
import { getSuppliers } from "../../features/suppliers/suppliers.api"

import {
  exportReceivingPdf,
  printReceiving,
} from "../../utils/businessDocumentExport"
const EMPTY_LINE = { itemId: "", purchaseOrderItemId: "", description: "", quantityReceived: "1", unitCost: "0", discountAmount: "0", batchCode: "", expiryDate: "", serialText: "" }

function apiError(error, fallback) {
  const details = error?.response?.data?.details
  const message = error?.response?.data?.error?.message || error?.response?.data?.message || fallback
  return Array.isArray(details) && details.length ? `${message}: ${details.join(", ")}` : message
}

function money(value) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function dateOnly(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-PH")
}

function toDateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

function formatStatus(value) {
  if (!value) return "—"
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function Status({ value }) {
  const classes =
    value === "POSTED"
      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
      : value === "CANCELLED"
        ? "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
        : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${classes}`}>{formatStatus(value)}</span>
}

function parseSerials(value) {
  return String(value || "").split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean)
}

function ReceivingItemLookup({
  catalogItems,
  disabled,
  itemId,
  onSelect,
}) {
  const selectedItem = catalogItems.find((entry) => entry.id === itemId)

  const itemLabel = (item) => {
    if (!item) return ""

    return [
      item.itemCode,
      item.itemName,
      item.barcode ? `Barcode: ${item.barcode}` : null,
    ]
      .filter(Boolean)
      .join(" · ")
  }

  const [query, setQuery] = useState(() => itemLabel(selectedItem))
  const [isOpen, setIsOpen] = useState(false)
const normalizedQuery = query.trim().toLowerCase()

  const matches = useMemo(() => {
    if (!normalizedQuery) {
      return catalogItems.slice(0, 12)
    }

    return catalogItems
      .filter((item) => {
        const values = [
          item.itemCode,
          item.barcode,
          item.itemName,
          item.brand,
          item.modelName,
        ]

        return values.some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      })
      .slice(0, 12)
  }, [catalogItems, normalizedQuery])

  const selectItem = (item) => {
    if (!item) return

    setQuery(itemLabel(item))
    setIsOpen(false)
    onSelect(item.id)
  }

  const handleEnter = () => {
    const raw = query.trim()

    if (!raw) return

    const exactItem = catalogItems.find(
      (item) =>
        String(item.barcode || "").toLowerCase() === raw.toLowerCase() ||
        String(item.itemCode || "").toLowerCase() === raw.toLowerCase(),
    )

    if (exactItem) {
      selectItem(exactItem)
      return
    }

    if (matches.length === 1) {
      selectItem(matches[0])
    }
  }

  if (disabled) {
    return (
      <div className="rounded-xl border bg-white px-3 py-2.5">
        <p className="text-sm font-bold text-[var(--color-text-strong)]">
          {selectedItem?.itemCode || "PO item"}
        </p>

        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
          {selectedItem?.itemName || "Item loaded from Purchase Order"}
        </p>

        {selectedItem?.barcode ? (
          <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
            Barcode: {selectedItem.barcode}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative">
      <span className="mb-1 block text-xs font-bold text-[var(--color-muted)]">
        Item / Barcode
      </span>

      <input
        autoComplete="off"
        className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-[var(--color-maroon)]"
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150)
        }}
        onChange={(event) => {
          const value = event.target.value

          setQuery(value)
          setIsOpen(true)

          if (!value.trim()) {
            onSelect("")
          }
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            handleEnter()
          }

          if (event.key === "Escape") {
            setIsOpen(false)
          }
        }}
        placeholder="Scan Barcode / Search Item Code / Product Name"
        value={query}
      />

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-2xl">
          {matches.length > 0 ? (
            matches.map((item) => (
              <button
                className="block w-full rounded-xl px-3 py-3 text-left transition hover:bg-[var(--color-soft)]"
                key={item.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectItem(item)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--color-text-strong)]">
                      {item.itemName}
                    </p>

                    <p className="mt-1 text-xs font-bold text-[var(--color-maroon)]">
                      Item Code: {item.itemCode}
                    </p>

                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {item.barcode
                        ? `Barcode: ${item.barcode}`
                        : "No barcode assigned"}
                    </p>
                  </div>

                  {item.isSerialized ? (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                      Serialized
                    </span>
                  ) : null}
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm font-bold text-[var(--color-text-strong)]">
                No matching catalog item
              </p>

              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                Create the new product in Item Catalog first so Item Code,
                Barcode, inventory, and serial tracking stay under one master
                record.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function ReceivingForm({ initial, suppliers, purchaseOrders, catalogItems, isSaving, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    receivingCode: initial?.receivingCode || "",
    supplierId: initial?.supplierId || "",
    purchaseOrderId: initial?.purchaseOrderId || "",
    supplierDeliveryNo: initial?.supplierDeliveryNo || "",
    supplierInvoiceNo: initial?.supplierInvoiceNo || "",
    referenceNo: initial?.referenceNo || "",
    notes: initial?.notes || "",
    internalNotes: initial?.internalNotes || "",
    items: initial?.items?.length ? initial.items.map((line) => ({ itemId: line.itemId, purchaseOrderItemId: line.purchaseOrderItemId || "", description: line.description, quantityReceived: String(line.quantityReceived), unitCost: String(line.unitCost), discountAmount: String(line.discountAmount || 0), batchCode: line.batchCode || "", expiryDate: toDateInput(line.expiryDate), serialText: (line.serials || []).map((serial) => serial.serialNumber).join("\n") })) : [{ ...EMPTY_LINE }],
  }))
  const selectedPo = purchaseOrders.find((order) => order.id === form.purchaseOrderId)
  const [serialScanInputs, setSerialScanInputs] = useState({})
  const [serialScanMessages, setSerialScanMessages] = useState({})

  const totals = useMemo(() => form.items.reduce((sum, line) => ({ subtotal: sum.subtotal + Number(line.quantityReceived || 0) * Number(line.unitCost || 0), discount: sum.discount + Number(line.discountAmount || 0) }), { subtotal: 0, discount: 0 }), [form.items])

  const updateLine = (index, patch) => setForm((current) => ({
    ...current,
    items: current.items.map((line, lineIndex) =>
      lineIndex === index ? { ...line, ...patch } : line
    ),
  }))

  const addScannedSerial = (index) => {
    const rawValue = serialScanInputs[index] || ""
    const serialNumber = rawValue.trim()

    if (!serialNumber) return

    const line = form.items[index]
    const existingSerials = parseSerials(line?.serialText)

    const duplicate = existingSerials.some(
      (existing) => existing.toUpperCase() === serialNumber.toUpperCase(),
    )

    if (duplicate) {
      setSerialScanMessages((current) => ({
        ...current,
        [index]: `Serial ${serialNumber} is already added.`,
      }))
      return
    }

    const quantity = Number(line?.quantityReceived || 0)

    if (quantity > 0 && existingSerials.length >= quantity) {
      setSerialScanMessages((current) => ({
        ...current,
        [index]: `Serial count already matches quantity received (${quantity}).`,
      }))
      return
    }

    updateLine(index, {
      serialText: [...existingSerials, serialNumber].join("\n"),
    })

    setSerialScanInputs((current) => ({
      ...current,
      [index]: "",
    }))

    setSerialScanMessages((current) => ({
      ...current,
      [index]: "",
    }))
  }

  const removeSerial = (index, serialNumber) => {
    const line = form.items[index]

    const remaining = parseSerials(line?.serialText).filter(
      (serial) => serial !== serialNumber,
    )

    updateLine(index, {
      serialText: remaining.join("\n"),
    })

    setSerialScanMessages((current) => ({
      ...current,
      [index]: "",
    }))
  }
  const chooseItem = (index, itemId) => { const item = catalogItems.find((entry) => entry.id === itemId); updateLine(index, { itemId, purchaseOrderItemId: "", ...(item ? { description: `${item.itemCode} · ${item.itemName}` } : {}) }) }
  const choosePo = (purchaseOrderId) => {
    const order = purchaseOrders.find((entry) => entry.id === purchaseOrderId)
    setForm((current) => ({ ...current, purchaseOrderId, supplierId: order?.supplierId || current.supplierId, items: order ? order.items.filter((line) => Number(line.quantity) > Number(line.receivedQuantity)).map((line) => ({ itemId: line.itemId || "", purchaseOrderItemId: line.id, description: line.description, quantityReceived: String(Number(line.quantity) - Number(line.receivedQuantity)), unitCost: String(line.unitCost), discountAmount: "0", batchCode: "", expiryDate: "", serialText: "" })) : current.items }))
  }
  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-bold">Receiving code<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, receivingCode: event.target.value }))} placeholder="Automatic when blank" value={form.receivingCode} /></label><label className="text-sm font-bold">Purchase order<select className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" disabled={Boolean(initial?.id)} onChange={(event) => choosePo(event.target.value)} value={form.purchaseOrderId}><option value="">Standalone receiving</option>{purchaseOrders.map((order) => <option key={order.id} value={order.id}>{order.poCode} · {order.supplierNameSnapshot}</option>)}</select></label><label className="text-sm font-bold">Supplier<select className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" disabled={Boolean(initial?.id || selectedPo)} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))} required value={form.supplierId}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplierCode} · {supplier.name}</option>)}</select></label><label className="text-sm font-bold">Delivery number<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, supplierDeliveryNo: event.target.value }))} value={form.supplierDeliveryNo} /></label><label className="text-sm font-bold">Invoice number<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, supplierInvoiceNo: event.target.value }))} value={form.supplierInvoiceNo} /></label><label className="text-sm font-bold">Reference<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, referenceNo: event.target.value }))} value={form.referenceNo} /></label></div>
      <section><div className="flex items-center justify-between"><div><h3 className="font-black">Received items</h3><p className="text-xs text-[var(--color-muted)]">Every line needs a batch code before posting. Serialized quantity must match the serial list.</p></div>{!selectedPo ? <button className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { ...EMPTY_LINE }] }))} type="button">Add line</button> : null}</div><div className="mt-3 space-y-3">{form.items.map((line, index) => { const item = catalogItems.find((entry) => entry.id === line.itemId); const remainingPo = selectedPo?.items?.find((entry) => entry.id === line.purchaseOrderItemId); return <article className="space-y-3 rounded-2xl border bg-[var(--color-soft)] p-3" key={`${index}-${line.purchaseOrderItemId || line.itemId}`}><div className="grid gap-3 lg:grid-cols-[1.1fr_1.2fr_110px_120px_120px_44px]"><ReceivingItemLookup
  catalogItems={catalogItems}
  disabled={Boolean(line.purchaseOrderItemId)}
  itemId={line.itemId}
  onSelect={(itemId) => chooseItem(index, itemId)}
/><label className="block">
  <span className="mb-1 block text-xs font-bold text-[var(--color-muted)]">
    Description
  </span>
  <input
    className="w-full rounded-xl border px-3 py-2.5 text-sm"
    onChange={(event) => updateLine(index, { description: event.target.value })}
    placeholder="Description"
    required
    value={line.description}
  />
</label><label className="block">
  <span className="mb-1 block text-xs font-bold text-[var(--color-muted)]">
    Qty
  </span>
  <input
    className="w-full rounded-xl border px-3 py-2.5 text-sm"
    max={remainingPo ? Number(remainingPo.quantity) - Number(remainingPo.receivedQuantity) : undefined}
    min={item?.isSerialized ? "1" : "0.01"}
    onChange={(event) => updateLine(index, { quantityReceived: event.target.value })}
    step={item?.isSerialized ? "1" : "0.01"}
    type="number"
    value={line.quantityReceived}
  />
</label><label className="block">
  <span className="mb-1 block text-xs font-bold text-[var(--color-muted)]">
    Unit Cost
  </span>
  <input
    className="w-full rounded-xl border px-3 py-2.5 text-sm"
    min="0"
    onChange={(event) => updateLine(index, { unitCost: event.target.value })}
    step="0.01"
    type="number"
    value={line.unitCost}
  />
</label><label className="block">
  <span className="mb-1 block text-xs font-bold text-[var(--color-muted)]">
    Discount
  </span>
  <input
    className="w-full rounded-xl border px-3 py-2.5 text-sm"
    min="0"
    onChange={(event) => updateLine(index, { discountAmount: event.target.value })}
    step="0.01"
    type="number"
    value={line.discountAmount}
  />
</label><button className="grid size-10 place-items-center rounded-xl border border-rose-200 text-rose-700 disabled:opacity-30" disabled={form.items.length === 1 || Boolean(selectedPo)} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, lineIndex) => lineIndex !== index) }))} type="button"><Trash2 size={16} /></button></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-bold">Batch code<input className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" onChange={(event) => updateLine(index, { batchCode: event.target.value })} placeholder="Auto-generated if left blank" value={line.batchCode} /></label><label className="text-xs font-bold">Expiry date (optional)<input className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" onChange={(event) => updateLine(index, { expiryDate: event.target.value })} type="date" value={line.expiryDate} /></label>{!item ? (
  <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-4 md:col-span-2 lg:col-span-3">
    <p className="text-sm font-bold text-[var(--color-text-strong)]">
      Serial Number
    </p>

    <p className="mt-1 text-xs text-[var(--color-muted)]">
      Select or scan an item first. If the item is serialized, the Serial Number scanner will appear here.
    </p>
  </div>
) : item.isSerialized ? (
  <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 md:col-span-2 lg:col-span-3">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-[var(--color-text-strong)]">
          Serial Numbers
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          Scan the serial barcode or type the serial number, then press Enter.
        </p>
      </div>

      <span
        className={`rounded-full px-3 py-1 text-xs font-black ${
          parseSerials(line.serialText).length === Number(line.quantityReceived || 0)
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {parseSerials(line.serialText).length}/{Number(line.quantityReceived || 0)}
      </span>
    </div>

    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        autoComplete="off"
        autoFocus
        className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--color-maroon)] focus:bg-white"
        onChange={(event) => {
          setSerialScanInputs((current) => ({
            ...current,
            [index]: event.target.value,
          }))

          setSerialScanMessages((current) => ({
            ...current,
            [index]: "",
          }))
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            addScannedSerial(index)
          }
        }}
        placeholder="Scan serial barcode / Type Serial Number"
        value={serialScanInputs[index] || ""}
      />

      <button
        className="rounded-xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white"
        onClick={() => addScannedSerial(index)}
        type="button"
      >
        Add serial
      </button>
    </div>

    {serialScanMessages[index] ? (
      <p className="text-xs font-bold text-red-700">
        {serialScanMessages[index]}
      </p>
    ) : null}

    {parseSerials(line.serialText).length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {parseSerials(line.serialText).map((serialNumber) => (
          <span
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-soft)] px-3 py-2 text-xs font-bold"
            key={serialNumber}
          >
            {serialNumber}

            <button
              aria-label={`Remove ${serialNumber}`}
              className="text-red-700"
              onClick={() => removeSerial(index, serialNumber)}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed p-4 text-center text-xs text-[var(--color-muted)]">
        No serial numbers scanned yet.
      </div>
    )}

    <textarea
      className="min-h-24 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm"
      onChange={(event) => {
        updateLine(index, {
          serialText: event.target.value,
        })

        setSerialScanMessages((current) => ({
          ...current,
          [index]: "",
        }))
      }}
      placeholder="You may also paste multiple serial numbers here, one per line."
      value={line.serialText}
    />

    {parseSerials(line.serialText).length !== Number(line.quantityReceived || 0) ? (
      <p className="text-xs font-bold text-amber-700">
        Quantity received is {Number(line.quantityReceived || 0)}. Add exactly{" "}
        {Number(line.quantityReceived || 0)} unique serial number(s).
      </p>
    ) : (
      <p className="text-xs font-bold text-emerald-700">
        Serial count matches the receiving quantity.
      </p>
    )}
  </div>
) : (
  <div className="rounded-xl border border-dashed p-3 text-xs text-[var(--color-muted)]">
    Non-serialized item · Serial Number is not required
  </div>
)}</div></article> })}</div></section>
      <div className="grid gap-3 rounded-2xl bg-[var(--color-soft)] p-4 sm:grid-cols-3"><div><p className="text-xs text-[var(--color-muted)]">Subtotal</p><p className="font-black">{money(totals.subtotal)}</p></div><div><p className="text-xs text-[var(--color-muted)]">Discount</p><p className="font-black">{money(totals.discount)}</p></div><div><p className="text-xs text-[var(--color-muted)]">Grand total</p><p className="font-black text-[var(--color-maroon)]">{money(totals.subtotal - totals.discount)}</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Notes<textarea className="mt-2 min-h-20 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} value={form.notes} /></label><label className="text-sm font-bold">Internal notes<textarea className="mt-2 min-h-20 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, internalNotes: event.target.value }))} value={form.internalNotes} /></label></div>
      <div className="flex justify-end gap-2"><button className="rounded-xl border px-4 py-2.5 text-sm font-bold" onClick={onClose} type="button">Cancel</button><button className="rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={isSaving || form.items.length === 0} type="submit">{isSaving ? "Saving..." : "Save draft receiving"}</button></div>
    </form>
  )
}

export default function PurchaseReceivingsPage({ selectedBranch, user }) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const [receivings, setReceivings] = useState([])
  const [pagination, setPagination] = useState({})
  const [suppliers, setSuppliers] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [catalogItems, setCatalogItems] = useState([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [notice, setNotice] = useState("")
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const loadReferenceData = useCallback(async () => {
    const [supplierResponse, orderResponse, itemResponse] = await Promise.all([
      getSuppliers({ ...(branchId ? { branchId } : {}), status: "ACTIVE", limit: 100 }),
      getPurchaseOrders({ ...(branchId ? { branchId } : {}), limit: 100 }),
      getItems({ ...(branchId ? { branchId } : {}), status: "ACTIVE", limit: 100 }),
    ])
    setSuppliers(supplierResponse?.data?.items || [])
    setPurchaseOrders((orderResponse?.data?.items || []).filter((order) => ["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status)))
    setCatalogItems(itemResponse?.data?.items || [])
  }, [branchId])

  const load = useCallback(async () => {
    setIsLoading(true); setMessage("")
    try { const response = await getPurchaseReceivings({ ...(branchId ? { branchId } : {}), ...(search.trim() ? { search: search.trim() } : {}), ...(status ? { status } : {}), page, limit: 20 }); setReceivings(response?.data?.items || []); setPagination(response?.data?.pagination || {}) } catch (error) { setReceivings([]); setMessage(apiError(error, "Could not load purchase receivings.")) } finally { setIsLoading(false) }
  }, [branchId, page, search, status])

  useEffect(() => { const timer = window.setTimeout(async () => { try { await Promise.all([load(), loadReferenceData()]) } catch (error) { setMessage(apiError(error, "Could not load receiving reference data.")) } }, 150); return () => window.clearTimeout(timer) }, [load, loadReferenceData])

  const openDetail = async (receiving) => { setDetail(receiving); setIsDetailLoading(true); try { const response = await getPurchaseReceivingById(receiving.id); setDetail(response?.data || receiving) } catch (error) { setMessage(apiError(error, "Could not load receiving details.")) } finally { setIsDetailLoading(false) } }

  const save = async (form) => {
    setIsSaving(true); setMessage("")
    const payload = {
      ...(form.receivingCode.trim() ? { receivingCode: form.receivingCode.trim() } : {}),
      ...(!editing?.id ? { supplierId: form.supplierId, purchaseOrderId: form.purchaseOrderId || null, ...(branchId ? { branchId } : {}) } : {}),
      supplierDeliveryNo: form.supplierDeliveryNo.trim() || null,
      supplierInvoiceNo: form.supplierInvoiceNo.trim() || null,
      referenceNo: form.referenceNo.trim() || null,
      notes: form.notes.trim() || null,
      internalNotes: form.internalNotes.trim() || null,
      items: form.items.map((line) => ({ itemId: line.itemId, purchaseOrderItemId: line.purchaseOrderItemId || null, description: line.description.trim(), quantityReceived: Number(line.quantityReceived), unitCost: Number(line.unitCost), discountAmount: Number(line.discountAmount || 0), batchCode: line.batchCode.trim() || null, expiryDate: line.expiryDate || null, serialNumbers: parseSerials(line.serialText) })),
    }
    try { const response = editing?.id ? await updatePurchaseReceiving(editing.id, payload) : await createPurchaseReceiving(payload); setNotice(`${response?.data?.receivingCode || "Receiving"} saved as draft.`); setEditing(null); await Promise.all([load(), loadReferenceData()]) } catch (error) { setMessage(apiError(error, "Could not save purchase receiving.")) } finally { setIsSaving(false) }
  }

  const changeStatus = async (receiving, nextStatus) => {
    let cancellationReason
    if (nextStatus === "CANCELLED") { cancellationReason = window.prompt(`Reason for cancelling ${receiving.receivingCode}?`); if (!cancellationReason?.trim()) return } else if (!window.confirm(`Post ${receiving.receivingCode}? This will increase inventory and cannot be edited afterward.`)) return
    setIsSaving(true); setMessage("")
    try { await updatePurchaseReceivingStatus(receiving.id, { status: nextStatus, ...(cancellationReason ? { cancellationReason: cancellationReason.trim() } : {}) }); setNotice(`${receiving.receivingCode} is now ${nextStatus.toLowerCase()}.`); await Promise.all([load(), loadReferenceData()]); if (detail?.id === receiving.id) await openDetail(receiving) } catch (error) { setMessage(apiError(error, `Could not ${nextStatus === "POSTED" ? "post" : "cancel"} receiving.`)) } finally { setIsSaving(false) }
  }

  const totalPages = Math.max(1, pagination.totalPages || 1)
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">Supply chain</p><h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Receiving / Deliveries</h1><p className="mt-1 text-sm text-[var(--color-muted)]">Draft, validate, and post supplier deliveries into the correct branch inventory.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90" onClick={() => setEditing({})} type="button"><Plus size={17} />New receiving</button></div></section>
      {message ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</div> : null}{notice ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div> : null}
      <section className="grid gap-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-card sm:grid-cols-[1fr_240px]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} /><input className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Receiving, invoice, delivery, supplier" value={search} /></label><select className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)] font-bold" onChange={(event) => { setStatus(event.target.value); setPage(1) }} value={status}><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="POSTED">Posted</option><option value="CANCELLED">Cancelled</option></select></section>
      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">{isLoading ? <div className="flex items-center justify-center gap-2 p-10 font-bold text-[var(--color-muted)]"><LoaderCircle className="animate-spin" size={18} />Loading deliveries...</div> : receivings.length === 0 ? <div className="p-10 text-center"><Boxes className="mx-auto text-[var(--color-muted)]" size={40} /><p className="mt-3 font-black text-[var(--color-text-strong)]">No matching receivings</p></div> : <><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-[var(--color-soft)] text-xs uppercase text-[var(--color-muted)]"><tr><th className="px-4 py-3">Receiving</th><th className="px-4 py-3">Supplier / PO</th><th className="px-4 py-3">References</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--color-border)]">{receivings.map((receiving) => <tr key={receiving.id}><td className="px-4 py-4"><p className="font-black text-[var(--color-text-strong)]">{receiving.receivingCode}</p><p className="text-xs text-[var(--color-muted)]">{dateOnly(receiving.receivingDate)} · {receiving.branch?.code}</p></td><td className="px-4 py-4"><p className="font-bold text-[var(--color-text-strong)]">{receiving.supplierNameSnapshot}</p><p className="text-xs text-[var(--color-muted)]">{receiving.purchaseOrder?.poCode || "Standalone"}</p></td><td className="px-4 py-4">{receiving.supplierInvoiceNo || receiving.supplierDeliveryNo || receiving.referenceNo || "—"}</td><td className="px-4 py-4"><Status value={receiving.status} /></td><td className="px-4 py-4 text-right font-black text-[var(--color-text-strong)]">{money(receiving.grandTotal)}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button className="rounded-xl border border-[var(--color-border)] p-2 hover:bg-[var(--color-soft)]" onClick={() => openDetail(receiving)} type="button"><Eye size={16} /></button>{receiving.status === "DRAFT" ? <button className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-bold hover:bg-[var(--color-soft)]" onClick={() => setEditing(receiving)} type="button">Edit</button> : null}{receiving.status === "DRAFT" ? <button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white" disabled={isSaving} onClick={() => changeStatus(receiving, "POSTED")} type="button">Post stock</button> : null}{receiving.status === "DRAFT" ? <button className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700" disabled={isSaving} onClick={() => changeStatus(receiving, "CANCELLED")} type="button">Cancel</button> : null}</div></td></tr>)}</tbody></table></div><div className="grid gap-3 p-4 lg:hidden">{receivings.map((receiving) => <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm" key={receiving.id}><div className="flex items-start justify-between gap-2"><div><p className="font-black text-[var(--color-text-strong)]">{receiving.receivingCode}</p><p className="mt-1 text-sm text-[var(--color-muted)]">{receiving.supplierNameSnapshot}</p></div><Status value={receiving.status} /></div><div className="mt-3 flex items-end justify-between border-t border-[var(--color-border)] pt-3"><p className="text-sm text-[var(--color-muted)]">{dateOnly(receiving.receivingDate)}</p><p className="font-black text-[var(--color-maroon)]">{money(receiving.grandTotal)}</p></div><div className="mt-4 flex flex-wrap gap-2"><button className="flex-1 min-w-[70px] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--color-soft)]" onClick={() => openDetail(receiving)} type="button">View</button>{receiving.status === "DRAFT" ? <><button className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--color-soft)]" onClick={() => setEditing(receiving)} type="button">Edit</button><button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(receiving, "POSTED")} type="button">Post stock</button><button className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(receiving, "CANCELLED")} type="button">Cancel</button></> : null}</div></article>)}</div></>}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] p-4"><p className="text-sm text-[var(--color-muted)]">Page {pagination.page || page} of {totalPages}</p><div className="flex gap-2"><button className="rounded-xl border border-[var(--color-border)] p-2 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft size={18} /></button><button className="rounded-xl border border-[var(--color-border)] p-2 disabled:opacity-30" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={18} /></button></div></div></section>
      {editing ? <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3 sm:p-6 backdrop-blur-xs"><section className="mx-auto max-w-7xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] p-5 shadow-2xl"><div className="mb-5 flex justify-between"><h2 className="text-xl font-black text-[var(--color-text-strong)]">{editing.id ? `Edit ${editing.receivingCode}` : "New purchase receiving"}</h2><button className="rounded-xl border border-[var(--color-border)] p-2 hover:bg-[var(--color-soft)]" onClick={() => setEditing(null)} type="button"><X size={18} /></button></div><ReceivingForm catalogItems={catalogItems} initial={editing} isSaving={isSaving} onClose={() => setEditing(null)} onSave={save} purchaseOrders={purchaseOrders} suppliers={suppliers} /></section></div> : null}
      {detail ? <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3 sm:p-6 backdrop-blur-xs"><section className="mx-auto max-w-5xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] shadow-2xl"><header className="flex items-start justify-between border-b border-[var(--color-border)] p-5"><div><p className="text-xs font-black text-[var(--color-maroon)]">{detail.receivingCode}</p><h2 className="mt-1 text-xl font-black text-[var(--color-text-strong)]">{detail.supplierNameSnapshot}</h2><div className="mt-2"><Status value={detail.status} /></div></div><div className="flex flex-wrap items-center justify-end gap-2">
  <button
    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-bold hover:bg-[var(--color-soft)]"
    onClick={() =>
      exportReceivingPdf(detail, {
        branch: detail.branch || selectedBranch,
        generatedBy: user,
      })
    }
    type="button"
  >
    Export PDF
  </button>

  <button
    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-bold hover:bg-[var(--color-soft)]"
    onClick={() =>
      printReceiving(detail, {
        branch: detail.branch || selectedBranch,
        generatedBy: user,
      })
    }
    type="button"
  >
    Print
  </button>

  <button
    className="rounded-xl border border-[var(--color-border)] p-2 hover:bg-[var(--color-soft)]"
    onClick={() => setDetail(null)}
    type="button"
  >
    <X size={18} />
  </button>
</div></header>{isDetailLoading ? <div className="flex items-center justify-center gap-2 p-10 font-bold text-[var(--color-muted)]"><LoaderCircle className="animate-spin" size={18} />Loading receiving...</div> : <div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">Purchase order</p><p className="font-bold">{detail.purchaseOrder?.poCode || "Standalone"}</p></div><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">Reference</p><p className="font-bold">{detail.supplierInvoiceNo || detail.supplierDeliveryNo || detail.referenceNo || "—"}</p></div><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">Grand total</p><p className="font-black text-[var(--color-text-strong)]">{money(detail.grandTotal)}</p></div></div><div className="space-y-3">{(detail.items || []).map((line) => <article className="rounded-2xl border border-[var(--color-border)] p-4" key={line.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-black text-[var(--color-text-strong)]">{line.item?.itemCode} · {line.item?.itemName}</p><p className="mt-1 text-sm text-[var(--color-muted)]">{line.description}</p><p className="mt-1 text-xs">Batch {line.batchCode || "not set"} · Qty {Number(line.quantityReceived)} · {money(line.unitCost)} each</p></div><p className="font-black text-[var(--color-text-strong)]">{money(line.lineTotal)}</p></div>{(line.serials || []).length ? <div className="mt-3 flex flex-wrap gap-2">{line.serials.map((serial) => <span className="rounded-lg bg-[var(--color-soft)] px-2 py-1 text-xs font-bold" key={serial.id}>{serial.serialNumber}</span>)}</div> : null}</article>)}</div>{detail.status === "DRAFT" ? <div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700" disabled={isSaving} onClick={() => changeStatus(detail, "POSTED")} type="button"><PackagePlus size={16} />Post to inventory</button><button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-bold hover:bg-[var(--color-soft)]" onClick={() => setEditing(detail)} type="button"><CheckCircle2 size={16} />Review/edit draft</button></div> : null}</div>}</section></div> : null}
    </div>
  )
}








