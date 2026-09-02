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
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <p className="font-mono font-bold text-slate-900">
          {selectedItem?.itemCode || "PO item"}
        </p>

        <p className="mt-0.5 text-[11px] text-slate-600 truncate">
          {selectedItem?.itemName || "Item loaded from Purchase Order"}
        </p>

        {selectedItem?.barcode ? (
          <p className="text-[10px] text-slate-400">
            Barcode: {selectedItem.barcode}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
        Item / Barcode
      </span>

      <input
        autoComplete="off"
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400"
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
        placeholder="Scan barcode / search item code / name…"
        value={query}
      />

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {matches.length > 0 ? (
            matches.map((item) => (
              <button
                className="block w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 text-xs"
                key={item.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectItem(item)}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {item.itemName}
                    </p>

                    <p className="font-mono text-[10px] font-bold text-[var(--color-maroon)]">
                      {item.itemCode}
                    </p>

                    <p className="text-[10px] text-slate-500">
                      {item.barcode
                        ? `Barcode: ${item.barcode}`
                        : "No barcode"}
                    </p>
                  </div>

                  {item.isSerialized ? (
                    <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Serialized
                    </span>
                  ) : null}
                </div>
              </button>
            ))
          ) : (
            <div className="p-3 text-center">
              <p className="text-xs font-bold text-slate-800">
                No matching catalog item
              </p>

              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
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

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] hover:border-slate-300 placeholder:text-slate-400 placeholder:font-normal"
  const labelClass = "text-[11px] font-bold uppercase tracking-wider text-slate-600 block"

  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
      <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>
            Receiving Code
            <input className={`${inputClass} font-mono`} onChange={(event) => setForm((current) => ({ ...current, receivingCode: event.target.value }))} placeholder="Auto-generated if blank" value={form.receivingCode} />
          </label>
          <label className={labelClass}>
            Purchase Order
            <select className={inputClass} disabled={Boolean(initial?.id)} onChange={(event) => choosePo(event.target.value)} value={form.purchaseOrderId}>
              <option value="">Standalone receiving</option>
              {purchaseOrders.map((order) => <option key={order.id} value={order.id}>{order.poCode} · {order.supplierNameSnapshot}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Supplier <span className="text-red-600">*</span>
            <select className={inputClass} disabled={Boolean(initial?.id || selectedPo)} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))} required value={form.supplierId}>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplierCode} · {supplier.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Delivery Number
            <input className={inputClass} onChange={(event) => setForm((current) => ({ ...current, supplierDeliveryNo: event.target.value }))} placeholder="e.g. DR #12345" value={form.supplierDeliveryNo} />
          </label>
          <label className={labelClass}>
            Invoice Number
            <input className={inputClass} onChange={(event) => setForm((current) => ({ ...current, supplierInvoiceNo: event.target.value }))} placeholder="e.g. SI #67890" value={form.supplierInvoiceNo} />
          </label>
          <label className={labelClass}>
            Reference / Waybill
            <input className={inputClass} onChange={(event) => setForm((current) => ({ ...current, referenceNo: event.target.value }))} placeholder="Tracking / Waybill Ref" value={form.referenceNo} />
          </label>
        </div>

        <section className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">Received Items</h3>
              <p className="text-[11px] text-slate-500">Every line needs a batch code before posting. Serialized items require matching serial numbers.</p>
            </div>
            {!selectedPo ? (
              <button className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { ...EMPTY_LINE }] }))} type="button">
                <Plus size={13} /> Add Line
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            {form.items.map((line, index) => {
              const item = catalogItems.find((entry) => entry.id === line.itemId)
              const remainingPo = selectedPo?.items?.find((entry) => entry.id === line.purchaseOrderItemId)
              return (
                <article className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3" key={`${index}-${line.purchaseOrderItemId || line.itemId}`}>
                  <div className="grid gap-2.5 lg:grid-cols-[1.2fr_1.2fr_90px_110px_110px_38px]">
                    <ReceivingItemLookup
                      catalogItems={catalogItems}
                      disabled={Boolean(line.purchaseOrderItemId)}
                      itemId={line.itemId}
                      onSelect={(itemId) => chooseItem(index, itemId)}
                    />
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Description <span className="text-red-600">*</span></span>
                      <input
                        className={inputClass}
                        onChange={(event) => updateLine(index, { description: event.target.value })}
                        placeholder="Description"
                        required
                        value={line.description}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Qty</span>
                      <input
                        className={`${inputClass} font-mono`}
                        max={remainingPo ? Number(remainingPo.quantity) - Number(remainingPo.receivedQuantity) : undefined}
                        min={item?.isSerialized ? "1" : "0.01"}
                        onChange={(event) => updateLine(index, { quantityReceived: event.target.value })}
                        step={item?.isSerialized ? "1" : "0.01"}
                        type="number"
                        value={line.quantityReceived}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Unit Cost</span>
                      <input
                        className={`${inputClass} font-mono`}
                        min="0"
                        onChange={(event) => updateLine(index, { unitCost: event.target.value })}
                        step="0.01"
                        type="number"
                        value={line.unitCost}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Discount</span>
                      <input
                        className={`${inputClass} font-mono`}
                        min="0"
                        onChange={(event) => updateLine(index, { discountAmount: event.target.value })}
                        step="0.01"
                        type="number"
                        value={line.discountAmount}
                      />
                    </label>
                    <button className="grid size-8 place-items-center rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-30 transition self-end" disabled={form.items.length === 1 || Boolean(selectedPo)} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, lineIndex) => lineIndex !== index) }))} type="button">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                    <label className={labelClass}>
                      Batch Code
                      <input className={`${inputClass} font-mono`} onChange={(event) => updateLine(index, { batchCode: event.target.value })} placeholder="Auto-generated if blank" value={line.batchCode} />
                    </label>
                    <label className={labelClass}>
                      Expiry Date (Optional)
                      <input className={inputClass} onChange={(event) => updateLine(index, { expiryDate: event.target.value })} type="date" value={line.expiryDate} />
                    </label>
                    {!item ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 md:col-span-2 lg:col-span-3 text-xs">
                        <p className="font-bold text-slate-800">Serial Number Tracking</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">Select an item first to determine serialization.</p>
                      </div>
                    ) : item.isSerialized ? (
                      <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 md:col-span-2 lg:col-span-3 text-xs">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-bold text-slate-900">Serial Numbers (Required)</p>
                            <p className="text-[11px] text-slate-500">Scan or type serial barcode, then press Enter.</p>
                          </div>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              parseSerials(line.serialText).length === Number(line.quantityReceived || 0)
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {parseSerials(line.serialText).length}/{Number(line.quantityReceived || 0)} Serials Added
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <input
                            autoComplete="off"
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
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
                            className="rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition"
                            onClick={() => addScannedSerial(index)}
                            type="button"
                          >
                            Add
                          </button>
                        </div>

                        {serialScanMessages[index] ? (
                          <p className="text-[11px] font-bold text-red-600">{serialScanMessages[index]}</p>
                        ) : null}

                        {parseSerials(line.serialText).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 border border-slate-100 rounded-lg bg-slate-50/50">
                            {parseSerials(line.serialText).map((serialNumber) => (
                              <span
                                className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-800 shadow-2xs"
                                key={serialNumber}
                              >
                                {serialNumber}
                                <button
                                  aria-label={`Remove ${serialNumber}`}
                                  className="text-slate-400 hover:text-red-600 font-bold ml-1"
                                  onClick={() => removeSerial(index, serialNumber)}
                                  type="button"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 p-2 text-center text-[11px] text-slate-400">
                            No serial numbers scanned yet.
                          </div>
                        )}

                        <textarea
                          className="min-h-16 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400"
                          onChange={(event) => {
                            updateLine(index, {
                              serialText: event.target.value,
                            })
                            setSerialScanMessages((current) => ({
                              ...current,
                              [index]: "",
                            }))
                          }}
                          placeholder="You may also bulk paste multiple serial numbers here (one per line)…"
                          value={line.serialText}
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500 self-center">
                        Non-serialized item · Serial number not required
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <div className="grid gap-2.5 rounded-xl border border-slate-100 bg-slate-50/75 p-3 sm:grid-cols-3 text-xs">
          <div><p className="text-[10px] font-bold uppercase text-slate-500">Subtotal</p><p className="mt-0.5 font-mono font-bold text-slate-900 text-sm">{money(totals.subtotal)}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-500">Discount</p><p className="mt-0.5 font-mono font-bold text-slate-900 text-sm">{money(totals.discount)}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-500">Grand Total</p><p className="mt-0.5 font-mono font-black text-[var(--color-maroon)] text-base">{money(totals.subtotal - totals.discount)}</p></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Delivery Notes
            <textarea className={`${inputClass} min-h-[45px] h-[45px] resize-none`} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Delivery notes from supplier…" value={form.notes} />
          </label>
          <label className={labelClass}>
            Internal Notes
            <textarea className={`${inputClass} min-h-[45px] h-[45px] resize-none`} onChange={(event) => setForm((current) => ({ ...current, internalNotes: event.target.value }))} placeholder="Warehouse internal verification remarks…" value={form.internalNotes} />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
        <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition" onClick={onClose} type="button">Cancel</button>
        <button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50" disabled={isSaving || form.items.length === 0} type="submit">
          {isSaving ? "Saving…" : "Save Draft Receiving"}
        </button>
      </div>
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Supply chain</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Receiving / Deliveries</h1>
            <p className="mt-0.5 text-xs text-slate-500">Draft, validate, and post supplier deliveries into the correct branch inventory.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-maroon-hover)]" onClick={() => setEditing({})} type="button">
            <Plus size={15} />New Receiving
          </button>
        </div>
      </section>

      {message ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{message}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</div> : null}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:grid-cols-[1fr_200px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Receiving, invoice, delivery, supplier…" value={search} />
        </label>
        <select className="rounded-xl border border-slate-200 bg-white text-slate-800 px-3 py-2 text-xs outline-none focus:border-[var(--color-maroon)] font-semibold" onChange={(event) => { setStatus(event.target.value); setPage(1) }} value={status}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-500">
            <LoaderCircle className="animate-spin" size={16} />Loading deliveries…
          </div>
        ) : receivings.length === 0 ? (
          <div className="p-10 text-center">
            <Boxes className="mx-auto text-slate-300" size={36} />
            <p className="mt-2 text-xs font-bold text-slate-800">No matching receivings</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Receiving</th>
                    <th className="px-4 py-3">Supplier / PO</th>
                    <th className="px-4 py-3">References</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {receivings.map((receiving) => (
                    <tr key={receiving.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-slate-900">{receiving.receivingCode}</p>
                        <p className="text-[11px] text-slate-500">{dateOnly(receiving.receivingDate)} · {receiving.branch?.code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{receiving.supplierNameSnapshot}</p>
                        <p className="text-[11px] text-slate-500">{receiving.purchaseOrder?.poCode || "Standalone"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{receiving.supplierInvoiceNo || receiving.supplierDeliveryNo || receiving.referenceNo || "—"}</td>
                      <td className="px-4 py-3"><Status value={receiving.status} /></td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{money(receiving.grandTotal)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition" onClick={() => openDetail(receiving)} type="button"><Eye size={14} /></button>
                          {receiving.status === "DRAFT" ? (
                            <>
                              <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition" onClick={() => setEditing(receiving)} type="button">Edit</button>
                              <button className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition" disabled={isSaving} onClick={() => changeStatus(receiving, "POSTED")} type="button">Post Stock</button>
                              <button className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition" disabled={isSaving} onClick={() => changeStatus(receiving, "CANCELLED")} type="button">Cancel</button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2.5 p-3 lg:hidden">
              {receivings.map((receiving) => (
                <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs text-xs" key={receiving.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-bold text-slate-900">{receiving.receivingCode}</p>
                      <p className="text-[11px] text-slate-500">{receiving.supplierNameSnapshot}</p>
                    </div>
                    <Status value={receiving.status} />
                  </div>
                  <div className="mt-2.5 flex items-end justify-between border-t border-slate-100 pt-2 text-xs">
                    <p className="text-slate-500">{dateOnly(receiving.receivingDate)}</p>
                    <p className="font-mono font-bold text-[var(--color-maroon)]">{money(receiving.grandTotal)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button className="flex-1 min-w-[70px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => openDetail(receiving)} type="button">View</button>
                    {receiving.status === "DRAFT" ? (
                      <>
                        <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => setEditing(receiving)} type="button">Edit</button>
                        <button className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition" disabled={isSaving} onClick={() => changeStatus(receiving, "POSTED")} type="button">Post Stock</button>
                        <button className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition" disabled={isSaving} onClick={() => changeStatus(receiving, "CANCELLED")} type="button">Cancel</button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500">
          <p>Page {pagination.page || page} of {totalPages}</p>
          <div className="flex gap-1.5">
            <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft size={16} /></button>
            <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <section className="my-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Purchase Receiving</span>
                <h2 className="text-base font-black text-slate-900 leading-tight">{editing.id ? `Edit ${editing.receivingCode}` : "New Purchase Receiving"}</h2>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setEditing(null)} type="button"><X size={16} /></button>
            </div>
            <ReceivingForm catalogItems={catalogItems} initial={editing} isSaving={isSaving} onClose={() => setEditing(null)} onSave={save} purchaseOrders={purchaseOrders} suppliers={suppliers} />
          </section>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <section className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-maroon)]">{detail.receivingCode}</span>
                  <Status value={detail.status} />
                </div>
                <h2 className="mt-0.5 text-base font-black text-slate-900 leading-tight">{detail.supplierNameSnapshot}</h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
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
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
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
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  onClick={() => setDetail(null)}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {isDetailLoading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-500"><LoaderCircle className="animate-spin" size={16} />Loading receiving…</div>
            ) : (
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Purchase Order</p><p className="mt-1 font-semibold text-slate-900">{detail.purchaseOrder?.poCode || "Standalone"}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Reference</p><p className="mt-1 font-semibold text-slate-900">{detail.supplierInvoiceNo || detail.supplierDeliveryNo || detail.referenceNo || "—"}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Grand Total</p><p className="mt-1 font-mono font-black text-slate-900">{money(detail.grandTotal)}</p></div>
                </div>

                <div className="space-y-2.5">
                  {(detail.items || []).map((line) => (
                    <article className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs" key={line.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{line.item?.itemCode} · {line.item?.itemName}</p>
                          <p className="text-[11px] text-slate-500">{line.description}</p>
                          <p className="mt-1 text-[11px] text-slate-600 font-medium">Batch {line.batchCode || "not set"} · Qty {Number(line.quantityReceived)} · {money(line.unitCost)} each</p>
                        </div>
                        <p className="font-mono font-bold text-slate-900">{money(line.lineTotal)}</p>
                      </div>
                      {(line.serials || []).length ? (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                          {line.serials.map((serial) => (
                            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-700" key={serial.id}>{serial.serialNumber}</span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>

                {detail.status === "DRAFT" ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition" disabled={isSaving} onClick={() => changeStatus(detail, "POSTED")} type="button">
                      <PackagePlus size={14} />Post to Inventory
                    </button>
                    <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition" onClick={() => setEditing(detail)} type="button">
                      <CheckCircle2 size={14} />Review / Edit Draft
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}









