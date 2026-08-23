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

function Status({ value }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${value === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{value}</span>
}

function SupplierForm({ initial, isSaving, onClose, onSave }) {
  const [form, setForm] = useState(() => Object.fromEntries(
    Object.keys(EMPTY_FORM).map((key) => [key, initial?.[key] || ""]),
  ))
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Supplier code<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => set("supplierCode", event.target.value)} placeholder="Automatic when blank" value={form.supplierCode || ""} /></label><label className="text-sm font-bold">Supplier name<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => set("name", event.target.value)} required value={form.name || ""} /></label><label className="text-sm font-bold">Contact person<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => set("contactPerson", event.target.value)} value={form.contactPerson || ""} /></label><label className="text-sm font-bold">Contact number<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => set("contactNo", event.target.value)} value={form.contactNo || ""} /></label><label className="text-sm font-bold">Email<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => set("email", event.target.value)} type="email" value={form.email || ""} /></label><label className="text-sm font-bold">TIN<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => set("tin", event.target.value)} value={form.tin || ""} /></label><label className="text-sm font-bold sm:col-span-2">Address<textarea className="mt-2 min-h-20 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => set("address", event.target.value)} value={form.address || ""} /></label><label className="text-sm font-bold sm:col-span-2">Notes<textarea className="mt-2 min-h-20 w-full rounded-xl border px-3 py-3 font-normal" onChange={(event) => set("notes", event.target.value)} value={form.notes || ""} /></label></div>
      <div className="flex justify-end gap-2"><button className="rounded-xl border px-4 py-2.5 text-sm font-bold" onClick={onClose} type="button">Cancel</button><button className="rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Save supplier"}</button></div>
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
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">Supply chain</p><h1 className="mt-2 text-2xl font-black">Suppliers</h1><p className="mt-1 text-sm text-[var(--color-muted)]">Branch-safe supplier directory with purchase order and delivery history.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white" onClick={() => setEditing({})} type="button"><Plus size={17} />New supplier</button></div></section>
      {message ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</div> : null}{notice ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div> : null}
      <section className="grid gap-3 rounded-3xl border bg-white p-4 shadow-card sm:grid-cols-[1fr_240px]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} /><input className="w-full rounded-xl border py-3 pl-10 pr-3 text-sm" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search name, code, contact, TIN" value={search} /></label><select className="rounded-xl border px-3 py-3 text-sm" onChange={(event) => { setStatus(event.target.value); setPage(1) }} value={status}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></section>
      <section className="overflow-hidden rounded-3xl border bg-white shadow-card">{isLoading ? <div className="flex items-center justify-center gap-2 p-10"><LoaderCircle className="animate-spin" size={18} />Loading suppliers...</div> : suppliers.length === 0 ? <div className="p-10 text-center"><Building2 className="mx-auto text-[var(--color-muted)]" size={40} /><p className="mt-3 font-black">No matching suppliers</p></div> : <><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[var(--color-soft)] text-xs uppercase text-[var(--color-muted)]"><tr><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y">{suppliers.map((supplier) => <tr key={supplier.id}><td className="px-4 py-4"><p className="font-black">{supplier.supplierCode}</p><p>{supplier.name}</p></td><td className="px-4 py-4"><p>{supplier.contactPerson || "—"}</p><p className="text-xs text-[var(--color-muted)]">{supplier.contactNo || supplier.email || "No contact recorded"}</p></td><td className="px-4 py-4">{supplier.branch?.code || "GLOBAL"}</td><td className="px-4 py-4"><Status value={supplier.status} /></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button className="rounded-xl border p-2" onClick={() => openDetail(supplier)} title="View" type="button"><Eye size={16} /></button><button className="rounded-xl border p-2" onClick={() => setEditing(supplier)} title="Edit" type="button"><Pencil size={16} /></button><button className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => toggleStatus(supplier)} type="button">{supplier.status === "ACTIVE" ? "Deactivate" : "Activate"}</button></div></td></tr>)}</tbody></table></div><div className="grid gap-3 p-4 lg:hidden">{suppliers.map((supplier) => <article className="rounded-2xl border p-4" key={supplier.id}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{supplier.supplierCode}</p><p className="mt-1">{supplier.name}</p></div><Status value={supplier.status} /></div><p className="mt-3 text-sm text-[var(--color-muted)]">{supplier.contactPerson || "No contact person"} · {supplier.contactNo || supplier.email || "No contact"}</p><div className="mt-4 grid grid-cols-2 gap-2"><button className="rounded-xl border px-3 py-2 text-sm font-bold" onClick={() => openDetail(supplier)} type="button">View</button><button className="rounded-xl border px-3 py-2 text-sm font-bold" onClick={() => setEditing(supplier)} type="button">Edit</button></div></article>)}</div></>}
        <div className="flex items-center justify-between border-t p-4"><p className="text-sm text-[var(--color-muted)]">Page {pagination.page || page} of {totalPages} · {pagination.totalItems || 0} supplier(s)</p><div className="flex gap-2"><button className="rounded-xl border p-2 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft size={18} /></button><button className="rounded-xl border p-2 disabled:opacity-30" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={18} /></button></div></div></section>

      {editing ? <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-3 sm:p-6"><section className="mx-auto max-w-3xl rounded-3xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">{editing.id ? "Edit supplier" : "New supplier"}</h2><button className="rounded-xl border p-2" onClick={() => setEditing(null)} type="button"><X size={18} /></button></div><SupplierForm initial={editing} isSaving={isSaving} onClose={() => setEditing(null)} onSave={saveSupplier} /></section></div> : null}

      {detail ? <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-3 sm:p-6"><section className="mx-auto max-w-5xl rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b p-5"><div><p className="text-xs font-black text-[var(--color-maroon)]">{detail.supplierCode}</p><h2 className="mt-1 text-xl font-black">{detail.name}</h2><p className="mt-1 text-sm text-[var(--color-muted)]">{detail.branch?.name || "Global supplier"}</p></div><button className="rounded-xl border p-2" onClick={() => setDetail(null)} type="button"><X size={18} /></button></header>{isDetailLoading ? <div className="flex items-center justify-center gap-2 p-10"><LoaderCircle className="animate-spin" size={18} />Loading history...</div> : <div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">Contact</p><p className="mt-1 font-bold">{detail.contactPerson || "—"}</p></div><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">Phone / email</p><p className="mt-1 break-words font-bold">{detail.contactNo || detail.email || "—"}</p></div><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">TIN</p><p className="mt-1 font-bold">{detail.tin || "—"}</p></div><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs text-[var(--color-muted)]">Status</p><p className="mt-2"><Status value={detail.status} /></p></div></div><div className="grid gap-5 lg:grid-cols-2"><section><h3 className="font-black">Recent purchase orders</h3><div className="mt-3 divide-y overflow-hidden rounded-2xl border">{relatedOrders.map((order) => <div className="flex items-center justify-between gap-3 p-3 text-sm" key={order.id}><div><p className="font-bold">{order.poCode}</p><p className="text-xs text-[var(--color-muted)]">{dateOnly(order.orderDate)} · {order.status}</p></div><p className="font-black">{money(order.grandTotal)}</p></div>)}{relatedOrders.length === 0 ? <p className="p-5 text-sm text-[var(--color-muted)]">No related purchase orders.</p> : null}</div></section><section><h3 className="font-black">Recent deliveries</h3><div className="mt-3 divide-y overflow-hidden rounded-2xl border">{relatedReceivings.map((receiving) => <div className="flex items-center justify-between gap-3 p-3 text-sm" key={receiving.id}><div><p className="font-bold">{receiving.receivingCode}</p><p className="text-xs text-[var(--color-muted)]">{dateOnly(receiving.receivingDate)} · {receiving.status}</p></div><p className="font-black">{money(receiving.grandTotal)}</p></div>)}{relatedReceivings.length === 0 ? <p className="p-5 text-sm text-[var(--color-muted)]">No related deliveries.</p> : null}</div></section></div></div>}</section></div> : null}
    </div>
  )
}
