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
        placeholder="Scan Barcode / Search Item Code / Product Name"
        value={query}
      />

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-2xl">
          {matches.length ? (
            matches.map((item) => (
              <button
                className="block w-full rounded-xl px-3 py-3 text-left transition hover:bg-[var(--color-soft)]"
                key={item.id}
                onClick={() => selectItem(item)}
                onMouseDown={(event) => event.preventDefault()}
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
            <div className="p-4">
              <p className="text-sm font-bold text-[var(--color-text-strong)]">
                No matching catalog item
              </p>

              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                For a new inventory product, create it in Items / Catalog first.
                For shipping or miscellaneous charges, leave the item unlinked
                and type the description.
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

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(form)
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">
          PO code

          <input
            className="mt-2 w-full rounded-xl border px-3 py-3 font-normal"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                poCode: event.target.value,
              }))
            }
            placeholder="Automatic when blank"
            value={form.poCode}
          />
        </label>

        <label className="text-sm font-bold">
          Supplier

          <select
            className="mt-2 w-full rounded-xl border px-3 py-3 font-normal"
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

        <label className="text-sm font-bold">
          Expected date (optional)

          <input
            className="mt-2 w-full rounded-xl border px-3 py-3 font-normal"
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

        <label className="text-sm font-bold">
          Notes

          <input
            className="mt-2 w-full rounded-xl border px-3 py-3 font-normal"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            value={form.notes}
          />
        </label>
      </div>

      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-black">
              Purchase lines
            </h3>

            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Scan barcode or search by Item Code / Product Name.
              Scanning the same selected item again adds +1 Qty.
            </p>
          </div>

          <button
            className="rounded-xl border px-3 py-2 text-xs font-bold"
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
            Add line
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {form.items.map((line, index) => (
            <article
              className="rounded-2xl border bg-[var(--color-soft)] p-3"
              key={`${index}-${line.itemId}`}
            >
              <div className="grid items-end gap-3 lg:grid-cols-[1.5fr_1.2fr_100px_130px_130px_44px]">
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
                  <span className="mb-1 block text-xs font-bold text-[var(--color-muted)]">
                    Description
                  </span>

                  <input
                    className="w-full rounded-xl border px-3 py-2.5 text-sm"
                    onChange={(event) =>
                      updateLine(index, {
                        description:
                          event.target.value,
                      })
                    }
                    placeholder="Description"
                    required
                    value={line.description}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[var(--color-muted)]">
                    Qty
                  </span>

                  <input
                    className="w-full rounded-xl border px-3 py-2.5 text-sm"
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
                  <span className="mb-1 block text-xs font-bold text-[var(--color-muted)]">
                    Unit Cost
                  </span>

                  <input
                    className="w-full rounded-xl border px-3 py-2.5 text-sm"
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
                  <span className="mb-1 block text-xs font-bold text-[var(--color-muted)]">
                    Discount
                  </span>

                  <input
                    className="w-full rounded-xl border px-3 py-2.5 text-sm"
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
                  className="grid size-10 place-items-center rounded-xl border border-rose-200 text-rose-700 disabled:opacity-30"
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
                  <Trash2 size={16} />
                </button>
              </div>

              {!line.itemId ? (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  No catalog item selected. Use an unlinked line only for
                  shipping or miscellaneous charges.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-3 rounded-2xl bg-[var(--color-soft)] p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--color-muted)]">
            Subtotal
          </p>
          <p className="font-black">
            {money(totals.subtotal)}
          </p>
        </div>

        <div>
          <p className="text-xs text-[var(--color-muted)]">
            Discount
          </p>
          <p className="font-black">
            {money(totals.discount)}
          </p>
        </div>

        <div>
          <p className="text-xs text-[var(--color-muted)]">
            Grand total
          </p>
          <p className="font-black text-[var(--color-maroon)]">
            {money(
              totals.subtotal -
                totals.discount,
            )}
          </p>
        </div>
      </div>

      <label className="block text-sm font-bold">
        Internal notes

        <textarea
          className="mt-2 min-h-20 w-full rounded-xl border px-3 py-3 font-normal"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              internalNotes:
                event.target.value,
            }))
          }
          value={form.internalNotes}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          className="rounded-xl border px-4 py-2.5 text-sm font-bold"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>

        <button
          className="rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          disabled={isSaving}
          type="submit"
        >
          {isSaving
            ? "Saving..."
            : "Save draft PO"}
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
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">Supply chain</p><h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Purchase Orders</h1><p className="mt-1 text-sm text-[var(--color-muted)]">Create costed drafts, order them deliberately, and track receiving progress.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90" onClick={() => setEditing({})} type="button"><Plus size={17} />New PO</button></div></section>
      {message ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</div> : null}{notice ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div> : null}
      <section className="grid gap-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-card sm:grid-cols-[1fr_240px]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} /><input className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="PO code, supplier, notes" value={search} /></label><select className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)] font-bold" onChange={(event) => { setStatus(event.target.value); setPage(1) }} value={status}><option value="">All statuses</option>{["DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"].map((value) => <option key={value} value={value}>{formatStatus(value)}</option>)}</select></section>
      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">{isLoading ? <div className="flex items-center justify-center gap-2 p-10 font-bold text-[var(--color-muted)]"><LoaderCircle className="animate-spin" size={18} />Loading purchase orders...</div> : orders.length === 0 ? <div className="p-10 text-center"><ClipboardList className="mx-auto text-[var(--color-muted)]" size={40} /><p className="mt-3 font-black text-[var(--color-text-strong)]">No matching purchase orders</p></div> : <><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-[var(--color-soft)] text-xs uppercase text-[var(--color-muted)]"><tr><th className="px-4 py-3">PO / date</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--color-border)]">{orders.map((order) => <tr key={order.id}><td className="px-4 py-4"><p className="font-black text-[var(--color-text-strong)]">{order.poCode}</p><p className="text-xs text-[var(--color-muted)]">{dateOnly(order.orderDate)} · {order.branch?.code}</p></td><td className="px-4 py-4">{order.supplierNameSnapshot || order.supplier?.name}</td><td className="px-4 py-4">{dateOnly(order.expectedDate)}</td><td className="px-4 py-4"><Status value={order.status} /></td><td className="px-4 py-4 text-right font-black text-[var(--color-text-strong)]">{money(order.grandTotal)}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button className="rounded-xl border border-[var(--color-border)] p-2 hover:bg-[var(--color-soft)]" onClick={() => openDetail(order)} type="button"><Eye size={16} /></button>{order.status === "DRAFT" ? <button className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-bold hover:bg-[var(--color-soft)]" onClick={() => setEditing(order)} type="button">Edit</button> : null}{order.status === "DRAFT" ? <button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white" disabled={isSaving} onClick={() => changeStatus(order, "ORDERED")} type="button">Order</button> : null}{order.status === "DRAFT" ? <button className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700" disabled={isSaving} onClick={() => changeStatus(order, "CANCELLED")} type="button">Cancel</button> : null}</div></td></tr>)}</tbody></table></div><div className="grid gap-3 p-4 lg:hidden">{orders.map((order) => <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm" key={order.id}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-black text-[var(--color-text-strong)]">{order.poCode}</p><p className="mt-1 text-sm text-[var(--color-muted)] truncate">{order.supplierNameSnapshot || order.supplier?.name}</p></div><Status value={order.status} /></div><div className="mt-3 flex items-end justify-between border-t border-[var(--color-border)] pt-3"><div><p className="text-xs text-[var(--color-muted)]">Order date</p><p className="font-bold">{dateOnly(order.orderDate)}</p></div><div className="text-right"><p className="text-xs text-[var(--color-muted)]">Grand total</p><p className="font-black text-[var(--color-maroon)]">{money(order.grandTotal)}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button className="flex-1 min-w-[70px] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--color-soft)]" onClick={() => openDetail(order)} type="button">View PO</button>{order.status === "DRAFT" ? <><button className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--color-soft)]" onClick={() => setEditing(order)} type="button">Edit</button><button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(order, "ORDERED")} type="button">Order</button><button className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(order, "CANCELLED")} type="button">Cancel</button></> : null}{["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status) && onNavigate ? <button className="rounded-xl bg-[var(--color-maroon)] px-3 py-2 text-xs font-bold text-white shadow-sm" onClick={() => onNavigate("receivings")} type="button">Receive</button> : null}</div></article>)}</div></>}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] p-4"><p className="text-sm text-[var(--color-muted)]">Page {pagination.page || page} of {totalPages}</p><div className="flex gap-2"><button className="rounded-xl border border-[var(--color-border)] p-2 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft size={18} /></button><button className="rounded-xl border border-[var(--color-border)] p-2 disabled:opacity-30" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={18} /></button></div></div></section>

      {editing ? <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3 sm:p-6 backdrop-blur-xs"><section className="mx-auto max-w-6xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] p-5 shadow-2xl"><div className="mb-5 flex justify-between"><h2 className="text-xl font-black text-[var(--color-text-strong)]">{editing.id ? `Edit ${editing.poCode}` : "New purchase order"}</h2><button className="rounded-xl border border-[var(--color-border)] p-2 hover:bg-[var(--color-soft)]" onClick={() => setEditing(null)} type="button"><X size={18} /></button></div><PurchaseOrderForm catalogItems={catalogItems} initial={editing} isSaving={isSaving} onClose={() => setEditing(null)} onSave={save} suppliers={suppliers} /></section></div> : null}
      {detail ? <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3 sm:p-6 backdrop-blur-xs"><section className="mx-auto max-w-5xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] shadow-2xl"><header className="flex items-start justify-between border-b border-[var(--color-border)] p-5"><div><p className="text-xs font-black text-[var(--color-maroon)]">{detail.poCode}</p><h2 className="mt-1 text-xl font-black text-[var(--color-text-strong)]">{detail.supplierNameSnapshot}</h2><div className="mt-2"><Status value={detail.status} /></div></div><div className="flex flex-wrap items-center justify-end gap-2">
  <button
    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-bold hover:bg-[var(--color-soft)]"
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
    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-bold hover:bg-[var(--color-soft)]"
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
    className="rounded-xl border border-[var(--color-border)] p-2 hover:bg-[var(--color-soft)]"
    onClick={() => setDetail(null)}
    type="button"
  >
    <X size={18} />
  </button>
</div></header>{isDetailLoading ? <div className="flex items-center justify-center gap-2 p-10 font-bold text-[var(--color-muted)]"><LoaderCircle className="animate-spin" size={18} />Loading PO...</div> : <div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">Ordered</p><p className="font-bold">{dateOnly(detail.orderDate)}</p></div><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">Expected</p><p className="font-bold">{dateOnly(detail.expectedDate)}</p></div><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">Grand total</p><p className="font-black text-[var(--color-text-strong)]">{money(detail.grandTotal)}</p></div></div><div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[var(--color-soft)] text-xs uppercase text-[var(--color-muted)]"><tr><th className="p-3">Item</th><th className="p-3 text-right">Ordered</th><th className="p-3 text-right">Received</th><th className="p-3 text-right">Unit cost</th><th className="p-3 text-right">Line total</th></tr></thead><tbody className="divide-y divide-[var(--color-border)]">{(detail.items || []).map((line) => <tr key={line.id}><td className="p-3"><p className="font-bold text-[var(--color-text-strong)]">{line.description}</p><p className="text-xs text-[var(--color-muted)]">{line.item?.itemCode || "Unlinked line"}</p></td><td className="p-3 text-right">{Number(line.quantity)}</td><td className="p-3 text-right">{Number(line.receivedQuantity)}</td><td className="p-3 text-right">{money(line.unitCost)}</td><td className="p-3 text-right font-black text-[var(--color-text-strong)]">{money(line.lineTotal)}</td></tr>)}</tbody></table></div><div className="flex flex-wrap gap-2 pt-2">{detail.status === "DRAFT" ? <><button className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-xs font-bold hover:bg-[var(--color-soft)]" onClick={() => { const target = detail; setDetail(null); setEditing(target) }} type="button">Edit draft</button><button className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(detail, "ORDERED")} type="button">Mark as Ordered</button><button className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50" disabled={isSaving} onClick={() => changeStatus(detail, "CANCELLED")} type="button">Cancel PO</button></> : null}{["ORDERED", "PARTIALLY_RECEIVED"].includes(detail.status) && onNavigate ? <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white" onClick={() => onNavigate("receivings")} type="button"><Send size={16} />Open receiving</button> : null}</div></div>}</section></div> : null}
    </div>
  )
}



