import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ClipboardList, Eye, LoaderCircle, Plus, Search, Send, Trash2, X } from "lucide-react"

import { getItems } from "../../features/items/items.api"
import {
  createPurchaseOrder,
  getPurchaseOrderById,
  getPurchaseOrders,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
} from "../../features/purchase-orders/purchaseOrders.api"
import { getSuppliers } from "../../features/suppliers/suppliers.api"

import {
  exportPurchaseOrderPdf,
  printPurchaseOrder,
} from "../../utils/businessDocumentExport"
const EMPTY_LINE = { itemId: "", description: "", quantity: "1", unitCost: "0", discountAmount: "0" }

function apiError(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
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
    value === "RECEIVED"
      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
      : value === "CANCELLED"
        ? "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
        : value === "DRAFT"
          ? "bg-[var(--color-soft)] text-[var(--color-text-strong)]"
          : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${classes}`}>{formatStatus(value)}</span>
}

function toDateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

function PurchaseOrderItemLookup({
  catalogItems,
  itemId,
  onRepeat,
  onSelect,
}) {
  const selectedItem = catalogItems.find((item) => item.id === itemId)

  const getItemLabel = (item) => {
    if (!item) return ""

    return `${item.itemCode} · ${item.itemName}`
  }

  const [query, setQuery] = useState(() => getItemLabel(selectedItem))
  const [isOpen, setIsOpen] = useState(false)

  const normalizedQuery = query.trim().toLowerCase()

  const matches = useMemo(() => {
    if (!normalizedQuery) {
      return catalogItems.slice(0, 12)
    }

    return catalogItems
      .filter((item) => {
        const searchableValues = [
          item.itemCode,
          item.barcode,
          item.itemName,
          item.brand,
          item.modelName,
        ]

        return searchableValues.some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      })
      .slice(0, 12)
  }, [catalogItems, normalizedQuery])

  const selectItem = (item) => {
    if (!item) return

    setQuery(getItemLabel(item))
    setIsOpen(false)
    onSelect(item.id)
  }

  const submitLookup = () => {
    const rawValue = query.trim()

    if (!rawValue) return

    const exactItem = catalogItems.find(
      (item) =>
        String(item.barcode || "").toLowerCase() === rawValue.toLowerCase() ||
        String(item.itemCode || "").toLowerCase() === rawValue.toLowerCase(),
    )

    if (exactItem) {
      if (exactItem.id === itemId) {
        onRepeat()
        setQuery(getItemLabel(exactItem))
        setIsOpen(false)
        return
      }

      selectItem(exactItem)
      return
    }

    if (matches.length === 1) {
      selectItem(matches[0])
    }
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

          if (!value.trim() && itemId) {
            onSelect("")
          }
        }}
        onFocus={(event) => {
          event.target.select()
          setIsOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            submitLookup()
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
          {matches.length ? (
            matches.map((item) => (
              <button
                className="block w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 text-xs"
                key={item.id}
                onClick={() => selectItem(item)}
                onMouseDown={(event) => event.preventDefault()}
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
            <div className="p-3">
              <p className="text-xs font-bold text-slate-800">
                No matching catalog item
              </p>

              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                For a new inventory product, create it in Item Catalog first.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function PurchaseOrderForm({
  initial,
  suppliers,
  catalogItems,
  isSaving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() => ({
    poCode: initial?.poCode || "",
    supplierId: initial?.supplierId || "",
    expectedDate: toDateInput(initial?.expectedDate),
    notes: initial?.notes || "",
    internalNotes: initial?.internalNotes || "",
    items: initial?.items?.length
      ? initial.items.map((line) => ({
          itemId: line.itemId || "",
          description: line.description,
          quantity: String(line.quantity),
          unitCost: String(line.unitCost),
          discountAmount: String(line.discountAmount || 0),
        }))
      : [{ ...EMPTY_LINE }],
  }))

  const totals = useMemo(
    () =>
      form.items.reduce(
        (sum, line) => {
          const gross =
            Number(line.quantity || 0) *
            Number(line.unitCost || 0)

          return {
            subtotal: sum.subtotal + gross,
            discount:
              sum.discount +
              Number(line.discountAmount || 0),
          }
        },
        {
          subtotal: 0,
          discount: 0,
        },
      ),
    [form.items],
  )

  const updateLine = (index, patch) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              ...patch,
            }
          : line,
      ),
    }))
  }

  const chooseItem = (index, itemId) => {
    const item = catalogItems.find(
      (entry) => entry.id === itemId,
    )

    updateLine(index, {
      itemId,
      ...(item
        ? {
            description: `${item.itemCode} · ${item.itemName}`,
          }
        : {}),
    })
  }

  const repeatItemScan = (index) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              quantity: String(
                Number(line.quantity || 0) + 1,
              ),
            }
          : line,
      ),
    }))
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] hover:border-slate-300 placeholder:text-slate-400 placeholder:font-normal"
  const labelClass = "text-[11px] font-bold uppercase tracking-wider text-slate-600 block"

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSave(form)
      }}
    >
      <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>
            PO Code
            <input
              className={`${inputClass} font-mono`}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  poCode: event.target.value,
                }))
              }
              placeholder="Auto-generated if blank"
              value={form.poCode}
            />
          </label>

          <label className={labelClass}>
            Supplier <span className="text-red-600">*</span>
            <select
              className={inputClass}
              disabled={Boolean(initial?.id)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  supplierId: event.target.value,
                }))
              }
              required
              value={form.supplierId}
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierCode} · {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Expected Date
            <input
              className={inputClass}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expectedDate: event.target.value,
                }))
              }
              type="date"
              value={form.expectedDate}
            />
          </label>

          <label className={labelClass}>
            Supplier Notes
            <input
              className={inputClass}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Delivery terms, instructions…"
              value={form.notes}
            />
          </label>
        </div>

        <section className="space-y-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
                Purchase Order Lines
              </h3>
              <p className="text-[11px] text-slate-500">
                Scan barcode or search by Item Code. Scanning the same item again adds +1 Qty.
              </p>
            </div>

            <button
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  items: [
                    ...current.items,
                    { ...EMPTY_LINE },
                  ],
                }))
              }
              type="button"
            >
              <Plus size={13} /> Add Line
            </button>
          </div>

          <div className="space-y-2.5">
            {form.items.map((line, index) => (
              <article
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5"
                key={`${index}-${line.itemId}`}
              >
                <div className="grid items-end gap-2.5 lg:grid-cols-[1.5fr_1.2fr_90px_110px_110px_38px]">
                  <PurchaseOrderItemLookup
                    catalogItems={catalogItems}
                    itemId={line.itemId}
                    onRepeat={() =>
                      repeatItemScan(index)
                    }
                    onSelect={(itemId) =>
                      chooseItem(index, itemId)
                    }
                  />

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Description <span className="text-red-600">*</span>
                    </span>

                    <input
                      className={inputClass}
                      onChange={(event) =>
                        updateLine(index, {
                          description:
                            event.target.value,
                        })
                      }
                      placeholder="Line description"
                      required
                      value={line.description}
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Qty
                    </span>

                    <input
                      className={`${inputClass} font-mono`}
                      min="0.01"
                      onChange={(event) =>
                        updateLine(index, {
                          quantity:
                            event.target.value,
                        })
                      }
                      step="0.01"
                      type="number"
                      value={line.quantity}
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Unit Cost
                    </span>

                    <input
                      className={`${inputClass} font-mono`}
                      min="0"
                      onChange={(event) =>
                        updateLine(index, {
                          unitCost:
                            event.target.value,
                        })
                      }
                      step="0.01"
                      type="number"
                      value={line.unitCost}
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Discount
                    </span>

                    <input
                      className={`${inputClass} font-mono`}
                      min="0"
                      onChange={(event) =>
                        updateLine(index, {
                          discountAmount:
                            event.target.value,
                        })
                      }
                      step="0.01"
                      type="number"
                      value={line.discountAmount}
                    />
                  </label>

                  <button
                    className="grid size-8 place-items-center rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-30 transition"
                    disabled={form.items.length === 1}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        items: current.items.filter(
                          (_, lineIndex) =>
                            lineIndex !== index,
                        ),
                      }))
                    }
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="grid gap-2.5 rounded-xl border border-slate-100 bg-slate-50/75 p-3 sm:grid-cols-3 text-xs">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Subtotal
            </p>
            <p className="mt-0.5 font-mono font-bold text-slate-900 text-sm">
              {money(totals.subtotal)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Discount
            </p>
            <p className="mt-0.5 font-mono font-bold text-slate-900 text-sm">
              {money(totals.discount)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Grand Total
            </p>
            <p className="mt-0.5 font-mono font-black text-[var(--color-maroon)] text-base">
              {money(
                totals.subtotal -
                  totals.discount,
              )}
            </p>
          </div>
        </div>

        <label className="block">
          <span className={labelClass}>Internal Notes</span>
          <textarea
            className={`${inputClass} min-h-[45px] h-[45px] resize-none`}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                internalNotes:
                  event.target.value,
              }))
            }
            placeholder="Warehouse notes, authorization remarks…"
            value={form.internalNotes}
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
        <button
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>

        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
          disabled={isSaving}
          type="submit"
        >
          {isSaving
            ? "Saving…"
            : "Save Draft PO"}
        </button>
      </div>
    </form>
  )
}

export default function PurchaseOrdersPage({ selectedBranch, user, onNavigate }) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const [orders, setOrders] = useState([])
  const [pagination, setPagination] = useState({})
  const [suppliers, setSuppliers] = useState([])
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
    const [supplierResponse, itemResponse] = await Promise.all([
      getSuppliers({ ...(branchId ? { branchId } : {}), status: "ACTIVE", limit: 100 }),
      getItems({ ...(branchId ? { branchId } : {}), status: "ACTIVE", limit: 100 }),
    ])
    setSuppliers(supplierResponse?.data?.items || [])
    setCatalogItems(itemResponse?.data?.items || [])
  }, [branchId])

  const load = useCallback(async () => {
    setIsLoading(true)
    setMessage("")
    try {
      const response = await getPurchaseOrders({ ...(branchId ? { branchId } : {}), ...(search.trim() ? { search: search.trim() } : {}), ...(status ? { status } : {}), page, limit: 20 })
      setOrders(response?.data?.items || [])
      setPagination(response?.data?.pagination || {})
    } catch (error) {
      setOrders([])
      setMessage(apiError(error, "Could not load purchase orders."))
    } finally {
      setIsLoading(false)
    }
  }, [branchId, page, search, status])

  useEffect(() => { const timer = window.setTimeout(async () => { try { await Promise.all([load(), loadReferenceData()]) } catch (error) { setMessage(apiError(error, "Could not load purchase order reference data.")) } }, 150); return () => window.clearTimeout(timer) }, [load, loadReferenceData])

  const openDetail = async (order) => {
    setDetail(order)
    setIsDetailLoading(true)
    try { const response = await getPurchaseOrderById(order.id); setDetail(response?.data || order) } catch (error) { setMessage(apiError(error, "Could not load purchase order details.")) } finally { setIsDetailLoading(false) }
  }

  const save = async (form) => {
    setIsSaving(true)
    setMessage("")
    const payload = {
      ...(form.poCode.trim() ? { poCode: form.poCode.trim() } : {}),
      ...(!editing?.id ? { supplierId: form.supplierId, ...(branchId ? { branchId } : {}) } : {}),
      expectedDate: form.expectedDate || null,
      notes: form.notes.trim() || null,
      internalNotes: form.internalNotes.trim() || null,
      items: form.items.map((line) => ({ itemId: line.itemId || null, description: line.description.trim(), quantity: Number(line.quantity), unitCost: Number(line.unitCost), discountAmount: Number(line.discountAmount || 0) })),
    }
    try {
      const response = editing?.id ? await updatePurchaseOrder(editing.id, payload) : await createPurchaseOrder(payload)
      setNotice(`${response?.data?.poCode || "Purchase order"} saved as draft.`)
      setEditing(null)
      await load()
    } catch (error) { setMessage(apiError(error, "Could not save purchase order.")) } finally { setIsSaving(false) }
  }

  const changeStatus = async (order, nextStatus) => {
    let cancellationReason
    if (nextStatus === "CANCELLED") { cancellationReason = window.prompt(`Reason for cancelling ${order.poCode}?`); if (!cancellationReason?.trim()) return }
    else if (!window.confirm(`Mark ${order.poCode} as ordered? This locks draft editing.`)) return
    setIsSaving(true)
    try { await updatePurchaseOrderStatus(order.id, { status: nextStatus, ...(cancellationReason ? { cancellationReason: cancellationReason.trim() } : {}) }); setNotice(`${order.poCode} is now ${nextStatus.toLowerCase()}.`); await load(); if (detail?.id === order.id) await openDetail(order) } catch (error) { setMessage(apiError(error, "Could not update purchase order status.")) } finally { setIsSaving(false) }
  }

  const totalPages = Math.max(1, pagination.totalPages || 1)
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Supply chain</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Purchase Orders</h1>
            <p className="mt-0.5 text-xs text-slate-500">Create costed drafts, order them deliberately, and track receiving progress.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-maroon-hover)]" onClick={() => setEditing({})} type="button">
            <Plus size={15} />New PO
          </button>
        </div>
      </section>

      {message ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{message}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</div> : null}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:grid-cols-[1fr_200px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="PO code, supplier, notes…" value={search} />
        </label>
        <select className="rounded-xl border border-slate-200 bg-white text-slate-800 px-3 py-2 text-xs outline-none focus:border-[var(--color-maroon)] font-semibold" onChange={(event) => { setStatus(event.target.value); setPage(1) }} value={status}>
          <option value="">All statuses</option>
          {["DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"].map((value) => (
            <option key={value} value={value}>{formatStatus(value)}</option>
          ))}
        </select>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-500">
            <LoaderCircle className="animate-spin" size={16} />Loading purchase orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList className="mx-auto text-slate-300" size={36} />
            <p className="mt-2 text-xs font-bold text-slate-800">No matching purchase orders</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">PO / Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Expected</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-slate-900">{order.poCode}</p>
                        <p className="text-[11px] text-slate-500">{dateOnly(order.orderDate)} · {order.branch?.code}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{order.supplierNameSnapshot || order.supplier?.name}</td>
                      <td className="px-4 py-3 text-slate-600">{dateOnly(order.expectedDate)}</td>
                      <td className="px-4 py-3"><Status value={order.status} /></td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{money(order.grandTotal)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition" onClick={() => openDetail(order)} type="button"><Eye size={14} /></button>
                          {order.status === "DRAFT" ? (
                            <>
                              <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition" onClick={() => setEditing(order)} type="button">Edit</button>
                              <button className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition" disabled={isSaving} onClick={() => changeStatus(order, "ORDERED")} type="button">Order</button>
                              <button className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition" disabled={isSaving} onClick={() => changeStatus(order, "CANCELLED")} type="button">Cancel</button>
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
              {orders.map((order) => (
                <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs text-xs" key={order.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-slate-900">{order.poCode}</p>
                      <p className="text-[11px] text-slate-500 truncate">{order.supplierNameSnapshot || order.supplier?.name}</p>
                    </div>
                    <Status value={order.status} />
                  </div>
                  <div className="mt-2.5 flex items-end justify-between border-t border-slate-100 pt-2 text-xs">
                    <div><p className="text-[10px] uppercase text-slate-400">Order Date</p><p className="font-semibold text-slate-700">{dateOnly(order.orderDate)}</p></div>
                    <div className="text-right"><p className="text-[10px] uppercase text-slate-400">Grand Total</p><p className="font-mono font-bold text-[var(--color-maroon)]">{money(order.grandTotal)}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button className="flex-1 min-w-[70px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => openDetail(order)} type="button">View PO</button>
                    {order.status === "DRAFT" ? (
                      <>
                        <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => setEditing(order)} type="button">Edit</button>
                        <button className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(order, "ORDERED")} type="button">Order</button>
                        <button className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(order, "CANCELLED")} type="button">Cancel</button>
                      </>
                    ) : null}
                    {["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status) && onNavigate ? (
                      <button className="rounded-lg bg-[var(--color-maroon)] px-3 py-1.5 text-xs font-bold text-white shadow-2xs" onClick={() => onNavigate("receivings")} type="button">Receive</button>
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
          <section className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Purchase Order</span>
                <h2 className="text-base font-black text-slate-900 leading-tight">{editing.id ? `Edit ${editing.poCode}` : "New Purchase Order"}</h2>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setEditing(null)} type="button"><X size={16} /></button>
            </div>
            <PurchaseOrderForm catalogItems={catalogItems} initial={editing} isSaving={isSaving} onClose={() => setEditing(null)} onSave={save} suppliers={suppliers} />
          </section>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <section className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-maroon)]">{detail.poCode}</span>
                  <Status value={detail.status} />
                </div>
                <h2 className="mt-0.5 text-base font-black text-slate-900 leading-tight">{detail.supplierNameSnapshot}</h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  onClick={() =>
                    exportPurchaseOrderPdf(detail, {
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
                    printPurchaseOrder(detail, {
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
              <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-500">
                <LoaderCircle className="animate-spin" size={16} />Loading PO…
              </div>
            ) : (
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Ordered Date</p><p className="mt-1 font-semibold text-slate-900">{dateOnly(detail.orderDate)}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Expected Date</p><p className="mt-1 font-semibold text-slate-900">{dateOnly(detail.expectedDate)}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Grand Total</p><p className="mt-1 font-mono font-black text-slate-900">{money(detail.grandTotal)}</p></div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[650px] text-left text-xs">
                    <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="p-3">Item</th>
                        <th className="p-3 text-right">Ordered</th>
                        <th className="p-3 text-right">Received</th>
                        <th className="p-3 text-right">Unit Cost</th>
                        <th className="p-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(detail.items || []).map((line) => (
                        <tr key={line.id}>
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{line.description}</p>
                            <p className="font-mono text-[10px] text-slate-500">{line.item?.itemCode || "Unlinked line"}</p>
                          </td>
                          <td className="p-3 text-right font-mono">{Number(line.quantity)}</td>
                          <td className="p-3 text-right font-mono">{Number(line.receivedQuantity)}</td>
                          <td className="p-3 text-right font-mono">{money(line.unitCost)}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">{money(line.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {detail.status === "DRAFT" ? (
                    <>
                      <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition" onClick={() => { const target = detail; setDetail(null); setEditing(target) }} type="button">Edit Draft</button>
                      <button className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(detail, "ORDERED")} type="button">Mark as Ordered</button>
                      <button className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(detail, "CANCELLED")} type="button">Cancel PO</button>
                    </>
                  ) : null}
                  {["ORDERED", "PARTIALLY_RECEIVED"].includes(detail.status) && onNavigate ? (
                    <button className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition" onClick={() => onNavigate("receivings")} type="button">
                      <Send size={14} />Open Receiving
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}



