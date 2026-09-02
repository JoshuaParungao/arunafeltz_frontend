import { useCallback, useEffect, useState } from "react"
import { Building2, ChevronLeft, ChevronRight, Eye, LoaderCircle, Pencil, Plus, Search, X } from "lucide-react"

import {
  createSupplier,
  getSupplierById,
  getSuppliers,
  updateSupplier,
  updateSupplierStatus,
} from "../../features/suppliers/suppliers.api"
import { getPurchaseOrders } from "../../features/purchase-orders/purchaseOrders.api"
import { getPurchaseReceivings } from "../../features/purchase-receivings/purchaseReceivings.api"

const EMPTY_FORM = { supplierCode: "", name: "", contactPerson: "", contactNo: "", email: "", address: "", tin: "", notes: "" }

function apiError(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}

function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  const isAct = value === "ACTIVE"
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-black ${
        isAct
          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
          : "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
      }`}
    >
      {formatStatus(value)}
    </span>
  )
}

function SupplierForm({ initial, isSaving, onClose, onSave }) {
  const [form, setForm] = useState(() => Object.fromEntries(
    Object.keys(EMPTY_FORM).map((key) => [key, initial?.[key] || ""]),
  ))
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] hover:border-slate-300 placeholder:text-slate-400 placeholder:font-normal"
  const labelClass = "text-[11px] font-bold uppercase tracking-wider text-slate-600 block"

  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
      <div className="max-h-[75vh] overflow-y-auto p-5 space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Supplier code
            <input className={`${inputClass} uppercase font-mono`} onChange={(event) => set("supplierCode", event.target.value)} placeholder="Auto-generated if blank" value={form.supplierCode || ""} />
          </label>
          <label className={labelClass}>
            Supplier name <span className="text-red-600">*</span>
            <input className={inputClass} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Apex Distribution Corp." required value={form.name || ""} />
          </label>
          <label className={labelClass}>
            Contact person
            <input className={inputClass} onChange={(event) => set("contactPerson", event.target.value)} placeholder="e.g. Juan Santos" value={form.contactPerson || ""} />
          </label>
          <label className={labelClass}>
            Contact number
            <input className={inputClass} inputMode="tel" onChange={(event) => set("contactNo", event.target.value)} placeholder="09xx xxx xxxx" value={form.contactNo || ""} />
          </label>
          <label className={labelClass}>
            Email
            <input className={inputClass} onChange={(event) => set("email", event.target.value)} placeholder="sales@supplier.com" type="email" value={form.email || ""} />
          </label>
          <label className={labelClass}>
            TIN
            <input className={`${inputClass} font-mono`} onChange={(event) => set("tin", event.target.value)} placeholder="000-000-000-000" value={form.tin || ""} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Address
            <textarea className={`${inputClass} min-h-[50px] h-[50px] resize-none`} onChange={(event) => set("address", event.target.value)} placeholder="Warehouse or office address" value={form.address || ""} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Notes
            <textarea className={`${inputClass} min-h-[50px] h-[50px] resize-none`} onChange={(event) => set("notes", event.target.value)} placeholder="Payment terms, delivery schedules, account notes…" value={form.notes || ""} />
          </label>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
        <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition" onClick={onClose} type="button">Cancel</button>
        <button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50" disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Save Supplier"}</button>
      </div>
    </form>
  )
}

export default function SuppliersPage({ selectedBranch, user }) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const [suppliers, setSuppliers] = useState([])
  const [pagination, setPagination] = useState({})
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [notice, setNotice] = useState("")
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [relatedOrders, setRelatedOrders] = useState([])
  const [relatedReceivings, setRelatedReceivings] = useState([])
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setMessage("")
    try {
      const response = await getSuppliers({ ...(branchId ? { branchId } : {}), ...(search.trim() ? { search: search.trim() } : {}), ...(status ? { status } : {}), page, limit: 20 })
      setSuppliers(response?.data?.items || [])
      setPagination(response?.data?.pagination || {})
    } catch (error) {
      setSuppliers([])
      setPagination({})
      setMessage(apiError(error, "Could not load suppliers."))
    } finally {
      setIsLoading(false)
    }
  }, [branchId, page, search, status])

  useEffect(() => {
    const timer = window.setTimeout(load, 200)
    return () => window.clearTimeout(timer)
  }, [load])

  const saveSupplier = async (form) => {
    setIsSaving(true)
    setMessage("")
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "string" && value.trim() === "" ? null : typeof value === "string" ? value.trim() : value]))
    if (!editing?.id) delete payload.supplierCode
    else if (!payload.supplierCode) delete payload.supplierCode
    try {
      const response = editing?.id ? await updateSupplier(editing.id, payload) : await createSupplier({ ...payload, ...(branchId ? { branchId } : {}) })
      setNotice(`${response?.data?.supplierCode || "Supplier"} saved.`)
      setEditing(null)
      await load()
    } catch (error) {
      setMessage(apiError(error, "Could not save supplier."))
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = async (supplier) => {
    setDetail(supplier)
    setRelatedOrders([])
    setRelatedReceivings([])
    setIsDetailLoading(true)
    try {
      const [supplierResponse, ordersResponse, receivingResponse] = await Promise.all([
        getSupplierById(supplier.id),
        getPurchaseOrders({ ...(branchId ? { branchId } : {}), supplierId: supplier.id, limit: 20 }),
        getPurchaseReceivings({ ...(branchId ? { branchId } : {}), supplierId: supplier.id, limit: 20 }),
      ])
      setDetail(supplierResponse?.data || supplier)
      setRelatedOrders(ordersResponse?.data?.items || [])
      setRelatedReceivings(receivingResponse?.data?.items || [])
    } catch (error) {
      setMessage(apiError(error, "Could not load supplier history."))
    } finally {
      setIsDetailLoading(false)
    }
  }

  const toggleStatus = async (supplier) => {
    const nextStatus = supplier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    if (!window.confirm(`${nextStatus === "INACTIVE" ? "Deactivate" : "Reactivate"} ${supplier.name}?`)) return
    try {
      await updateSupplierStatus(supplier.id, nextStatus)
      setNotice(`${supplier.supplierCode} is now ${nextStatus.toLowerCase()}.`)
      await load()
    } catch (error) {
      setMessage(apiError(error, "Could not update supplier status."))
    }
  }

  const totalPages = Math.max(1, pagination.totalPages || 1)
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Supply chain</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Suppliers</h1>
            <p className="mt-0.5 text-xs text-slate-500">Branch-safe supplier directory with purchase order and delivery history.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-maroon-hover)]" onClick={() => setEditing({})} type="button">
            <Plus size={15} />New Supplier
          </button>
        </div>
      </section>

      {message ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{message}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</div> : null}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:grid-cols-[1fr_200px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search name, code, contact, TIN…" value={search} />
        </label>
        <select className="rounded-xl border border-slate-200 bg-white text-slate-800 px-3 py-2 text-xs outline-none focus:border-[var(--color-maroon)] font-semibold" onChange={(event) => { setStatus(event.target.value); setPage(1) }} value={status}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-500">
            <LoaderCircle className="animate-spin" size={16} />Loading suppliers…
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="mx-auto text-slate-300" size={36} />
            <p className="mt-2 text-xs font-bold text-slate-800">No matching suppliers</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-slate-900">{supplier.supplierCode}</p>
                        <p className="font-semibold text-slate-800">{supplier.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{supplier.contactPerson || "—"}</p>
                        <p className="text-[11px] text-slate-500">{supplier.contactNo || supplier.email || "No contact"}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{supplier.branch?.code || "GLOBAL"}</td>
                      <td className="px-4 py-3"><Status value={supplier.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition" onClick={() => openDetail(supplier)} title="View" type="button"><Eye size={14} /></button>
                          <button className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition" onClick={() => setEditing(supplier)} title="Edit" type="button"><Pencil size={14} /></button>
                          <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition" onClick={() => toggleStatus(supplier)} type="button">{supplier.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2.5 p-3 lg:hidden">
              {suppliers.map((supplier) => (
                <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs text-xs" key={supplier.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-bold text-slate-900">{supplier.supplierCode}</p>
                      <p className="font-bold text-slate-800">{supplier.name}</p>
                    </div>
                    <Status value={supplier.status} />
                  </div>
                  <p className="mt-2 text-slate-500">{supplier.contactPerson || "No contact person"} · {supplier.contactNo || supplier.email || "No contact"}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => openDetail(supplier)} type="button">View</button>
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => setEditing(supplier)} type="button">Edit</button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500">
          <p>Page {pagination.page || page} of {totalPages} · {pagination.totalItems || 0} supplier(s)</p>
          <div className="flex gap-1.5">
            <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft size={16} /></button>
            <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <section className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Supplier Management</span>
                <h2 className="text-base font-black text-slate-900 leading-tight">{editing.id ? "Edit Supplier" : "New Supplier"}</h2>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setEditing(null)} type="button"><X size={16} /></button>
            </div>
            <SupplierForm initial={editing} isSaving={isSaving} onClose={() => setEditing(null)} onSave={saveSupplier} />
          </section>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <section className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-maroon)]">{detail.supplierCode}</span>
                <h2 className="text-base font-black text-slate-900 leading-tight">{detail.name}</h2>
                <p className="text-xs text-slate-500">{detail.branch?.name || "Global Supplier"}</p>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setDetail(null)} type="button"><X size={16} /></button>
            </header>
            {isDetailLoading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-500"><LoaderCircle className="animate-spin" size={16} />Loading history…</div>
            ) : (
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Contact</p><p className="mt-1 font-bold text-slate-900">{detail.contactPerson || "—"}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Phone / Email</p><p className="mt-1 break-words font-bold text-slate-900">{detail.contactNo || detail.email || "—"}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">TIN</p><p className="mt-1 font-mono font-bold text-slate-900">{detail.tin || "—"}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Status</p><p className="mt-1.5"><Status value={detail.status} /></p></div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2 text-xs">
                  <section>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">Recent Purchase Orders</h3>
                    <div className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
                      {relatedOrders.map((order) => (
                        <div className="flex items-center justify-between gap-3 p-2.5" key={order.id}>
                          <div><p className="font-bold text-slate-900">{order.poCode}</p><p className="text-[11px] text-slate-500">{dateOnly(order.orderDate)} · {formatStatus(order.status)}</p></div>
                          <p className="font-mono font-bold text-slate-900">{money(order.grandTotal)}</p>
                        </div>
                      ))}
                      {relatedOrders.length === 0 ? <p className="p-4 text-slate-500">No related purchase orders.</p> : null}
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">Recent Deliveries</h3>
                    <div className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
                      {relatedReceivings.map((receiving) => (
                        <div className="flex items-center justify-between gap-3 p-2.5" key={receiving.id}>
                          <div><p className="font-bold text-slate-900">{receiving.receivingCode}</p><p className="text-[11px] text-slate-500">{dateOnly(receiving.receivingDate)} · {formatStatus(receiving.status)}</p></div>
                          <p className="font-mono font-bold text-slate-900">{money(receiving.grandTotal)}</p>
                        </div>
                      ))}
                      {relatedReceivings.length === 0 ? <p className="p-4 text-slate-500">No related deliveries.</p> : null}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
