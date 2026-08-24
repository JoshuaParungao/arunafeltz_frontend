import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  LoaderCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react"

import { getCustomers } from "../../features/customers/customers.api"
import { getItems } from "../../features/items/items.api"
import { getSaleById, getSales } from "../../features/sales/sales.api"
import {
  createWarrantyClaim,
  getWarrantyClaimById,
  getWarrantyClaims,
  releaseWarrantyClaim,
  updateWarrantyClaimStatus,
} from "../../features/warranty-claims/warrantyClaims.api"

const CREATE_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN", "CASHIER", "TECHNICIAN"])
const ACTION_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN", "CASHIER", "TECHNICIAN"])
const STATUSES = ["IN", "CHECKING", "SENT_TO_SUPPLIER", "APPROVED", "REJECTED", "REPAIRED", "REPLACED", "OUT"]
const NEXT_STATUSES = {
  IN: ["CHECKING"],
  CHECKING: ["SENT_TO_SUPPLIER", "APPROVED", "REJECTED", "REPAIRED"],
  SENT_TO_SUPPLIER: ["APPROVED", "REJECTED", "REPAIRED", "REPLACED"],
  APPROVED: ["REPAIRED", "REPLACED"],
  REJECTED: [],
  REPAIRED: [],
  REPLACED: [],
  OUT: [],
}
const RELEASE_READY = new Set(["REJECTED", "REPAIRED", "REPLACED"])
const FIELD_CLASS =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-[var(--color-maroon)]/10"

function dateTime(value) {
  if (!value) return "—"
  const valueDate = new Date(value)
  return Number.isNaN(valueDate.getTime()) ? "—" : valueDate.toLocaleString("en-PH")
}

function apiError(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error?.message || fallback
}

function formatStatus(status) {
  if (!status) return "—"
  return String(status)
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function statusTone(status) {
  if (status === "OUT") return "bg-[var(--color-soft)] text-[var(--color-text-strong)]"
  if (["REPAIRED", "REPLACED", "APPROVED"].includes(status)) return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
  if (status === "REJECTED") return "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
  if (status === "SENT_TO_SUPPLIER") return "bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300"
  if (status === "CHECKING") return "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
  return "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300"
}

function StatusBadge({ status }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${statusTone(status)}`}>{formatStatus(status)}</span>
}

function Modal({ children, onClose, title, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-3 sm:p-6 backdrop-blur-xs">
      <section aria-label={title} aria-modal="true" className={`my-auto w-full overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] shadow-2xl ${wide ? "max-w-5xl" : "max-w-3xl"}`} role="dialog">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4 sm:px-6">
          <h2 className="text-lg font-black text-[var(--color-text-strong)]">{title}</h2>
          <button aria-label="Close" className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-[var(--color-soft)]" onClick={onClose} type="button"><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Field({ children, label }) {
  return <label className="block text-sm font-bold text-[var(--color-text-strong)]">{label}{children}</label>
}

function unwrapList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.data)) return response.data.data
  if (Array.isArray(response?.data?.items)) return response.data.items
  if (Array.isArray(response?.items)) return response.items
  return []
}

const EMPTY_CREATE = {
  customerId: "",
  saleId: "",
  saleItemId: "",
  itemId: "",
  issueDescription: "",
  customerComplaint: "",
  diagnosis: "",
  actionTaken: "",
  supplierName: "",
  supplierReferenceNo: "",
  remarks: "",
}

export default function WarrantyPage({ selectedBranch, user }) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const canCreate = CREATE_ROLES.has(user?.role)
  const canAct = ACTION_ROLES.has(user?.role)
  const [claims, setClaims] = useState([])
  const [meta, setMeta] = useState({})
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [sales, setSales] = useState([])
  const [selectedSale, setSelectedSale] = useState(null)
  const [saleSearchText, setSaleSearchText] = useState("")
  const [isSaleDropdownOpen, setIsSaleDropdownOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaleLoading, setIsSaleLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [notice, setNotice] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)
  const [actionStatus, setActionStatus] = useState("")
  const [actionForm, setActionForm] = useState({ diagnosis: "", actionTaken: "", supplierName: "", supplierReferenceNo: "", remarks: "" })
  const [showRelease, setShowRelease] = useState(false)
  const [releaseForm, setReleaseForm] = useState({ actionTaken: "", remarks: "" })

  const loadClaims = useCallback(async () => {
    const response = await getWarrantyClaims({
      ...(branchId ? { branchId } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      page,
      limit: 20,
    })
    setClaims(Array.isArray(response?.data) ? response.data : [])
    setMeta(response?.meta || {})
  }, [branchId, page, search, statusFilter])

  const loadReferences = useCallback(async () => {
    if (!canCreate) return
    const branchParams = { ...(branchId ? { branchId } : {}), limit: 100 }
    const [customerResponse, itemResponse, saleResponse] = await Promise.all([
      getCustomers({ ...branchParams, status: "ACTIVE" }),
      getItems({ ...branchParams, status: "ACTIVE" }),
      getSales(branchParams),
    ])
    setCustomers(unwrapList(customerResponse))
    setItems(unwrapList(itemResponse))
    setSales(unwrapList(saleResponse).filter((sale) => sale.status !== "CANCELLED"))
  }, [branchId, canCreate])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      await Promise.all([loadClaims(), loadReferences()])
    } catch (error) {
      setErrorMessage(apiError(error, "Could not load warranty claims."))
    } finally {
      setIsLoading(false)
    }
  }, [loadClaims, loadReferences])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 180)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const openDetail = async (claim) => {
    setSelectedClaim(claim)
    setIsDetailLoading(true)
    setErrorMessage("")
    try {
      const response = await getWarrantyClaimById(claim.id)
      setSelectedClaim(response?.data || claim)
    } catch (error) {
      setErrorMessage(apiError(error, "Could not load warranty claim details."))
    } finally {
      setIsDetailLoading(false)
    }
  }

  const selectSale = async (saleId) => {
    setCreateForm((form) => ({ ...form, saleId, saleItemId: "", itemId: "" }))
    setSelectedSale(null)
    if (!saleId) return
    setIsSaleLoading(true)
    try {
      const response = await getSaleById(saleId)
      const sale = response?.data || null
      setSelectedSale(sale)
      setCreateForm((form) => ({ ...form, customerId: sale?.customer?.id || "" }))
    } catch (error) {
      setErrorMessage(apiError(error, "Could not load the selected sale."))
    } finally {
      setIsSaleLoading(false)
    }
  }

  const selectSaleItem = (saleItemId) => {
    const line = selectedSale?.items?.find((item) => item.id === saleItemId)
    setCreateForm((form) => ({ ...form, saleItemId, itemId: line?.itemId || "" }))
  }

  const submitCreate = async (event) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await createWarrantyClaim({
        ...(user?.role === "SUPER_OWNER" && branchId ? { branchId } : {}),
        customerId: createForm.customerId || undefined,
        saleId: createForm.saleId || undefined,
        saleItemId: createForm.saleItemId || undefined,
        ...(!createForm.saleItemId && createForm.itemId ? { itemId: createForm.itemId } : {}),
        issueDescription: createForm.issueDescription.trim(),
        customerComplaint: createForm.customerComplaint.trim() || undefined,
        diagnosis: createForm.diagnosis.trim() || undefined,
        actionTaken: createForm.actionTaken.trim() || undefined,
        supplierName: createForm.supplierName.trim() || undefined,
        supplierReferenceNo: createForm.supplierReferenceNo.trim() || undefined,
        remarks: createForm.remarks.trim() || undefined,
      })
      setCreateForm(EMPTY_CREATE)
      setSelectedSale(null)
      setShowCreate(false)
      setNotice(`${response?.data?.claimCode || "Warranty claim"} received.`)
      setPage(1)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not create warranty claim."))
    } finally {
      setIsSaving(false)
    }
  }

  const beginStatusAction = (status) => {
    setActionStatus(status)
    setActionForm({
      diagnosis: selectedClaim?.diagnosis || "",
      actionTaken: selectedClaim?.actionTaken || "",
      supplierName: selectedClaim?.supplierName || "",
      supplierReferenceNo: selectedClaim?.supplierReferenceNo || "",
      remarks: selectedClaim?.remarks || "",
    })
  }

  const submitStatus = async (event) => {
    event.preventDefault()
    if (!selectedClaim || !actionStatus || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await updateWarrantyClaimStatus(selectedClaim.id, {
        status: actionStatus,
        diagnosis: actionForm.diagnosis.trim() || undefined,
        actionTaken: actionForm.actionTaken.trim() || undefined,
        supplierName: actionForm.supplierName.trim() || undefined,
        supplierReferenceNo: actionForm.supplierReferenceNo.trim() || undefined,
        remarks: actionForm.remarks.trim() || undefined,
      })
      setSelectedClaim(response?.data || selectedClaim)
      setActionStatus("")
      setNotice(`${selectedClaim.claimCode} moved to ${actionStatus.replaceAll("_", " ")}.`)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not update warranty status."))
    } finally {
      setIsSaving(false)
    }
  }

  const openRelease = () => {
    setReleaseForm({ actionTaken: selectedClaim?.actionTaken || "", remarks: selectedClaim?.remarks || "" })
    setShowRelease(true)
  }

  const submitRelease = async (event) => {
    event.preventDefault()
    if (!selectedClaim || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await releaseWarrantyClaim(selectedClaim.id, {
        actionTaken: releaseForm.actionTaken.trim() || undefined,
        remarks: releaseForm.remarks.trim() || undefined,
      })
      setSelectedClaim(response?.data || selectedClaim)
      setShowRelease(false)
      setNotice(`${selectedClaim.claimCode} released to the customer.`)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not release warranty claim."))
    } finally {
      setIsSaving(false)
    }
  }

  const pageSummary = useMemo(() => ({
    active: claims.filter((claim) => !["OUT", "REJECTED", "REPAIRED", "REPLACED"].includes(claim.status)).length,
    supplier: claims.filter((claim) => claim.status === "SENT_TO_SUPPLIER").length,
    release: claims.filter((claim) => RELEASE_READY.has(claim.status)).length,
  }), [claims])
  const totalPages = Math.max(1, meta.totalPages || 1)
  const selectedFormItem = items.find((item) => item.id === createForm.itemId)

  const filteredSales = useMemo(() => {
    const query = saleSearchText.trim().toLowerCase()
    if (!query) return sales.slice(0, 30)
    return sales
      .filter((s) => {
        return [
          s.receiptCode,
          s.customer?.fullName,
          s.customer?.customerCode,
          s.customer?.mobileNumber,
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(query))
      })
      .slice(0, 30)
  }, [sales, saleSearchText])

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">After-sales</p><h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Warranty Claims</h1><p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">Keep intake, supplier processing, repair or replacement outcomes, and customer release traceable without recording warranty work as new revenue.</p></div>
          <div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold" disabled={isLoading} onClick={refresh} type="button"><RefreshCw className={isLoading ? "animate-spin" : ""} size={16} /> Refresh</button>{canCreate ? <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white" onClick={() => setShowCreate(true)} type="button"><Plus size={17} /> Receive claim</button> : null}</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{[["Active on this page", pageSummary.active, ClipboardCheck], ["With supplier", pageSummary.supplier, ShieldCheck], ["Ready to release", pageSummary.release, PackageCheck]].map(([label, value, Icon]) => <div className="rounded-2xl bg-slate-50 p-4" key={label}><Icon className="text-[var(--color-maroon)]" size={18} /><p className="mt-3 text-2xl font-black">{value}</p><p className="text-xs font-bold text-[var(--color-muted)]">{label}</p></div>)}</div>
      </section>

      {notice ? <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><span>{notice}</span><button onClick={() => setNotice("")} type="button"><X size={16} /></button></div> : null}
      {errorMessage ? <div className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"><CircleAlert className="mt-0.5 shrink-0" size={17} /><span>{errorMessage}</span></div> : null}

      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-card sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
          <label className="relative">
            <Search className="absolute left-3.5 top-3 text-[var(--color-muted)]" size={17} />
            <input aria-label="Search warranty claims" className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search claim code, issue, supplier, or notes" value={search} />
          </label>
          <select aria-label="Filter warranty status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3.5 py-2.5 text-sm font-bold" onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} value={statusFilter}>
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
          </select>
        </div>
        {isLoading ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={32} /></div> : claims.length === 0 ? <div className="grid min-h-64 place-items-center text-center"><div><ShieldCheck className="mx-auto text-[var(--color-muted)]" size={40} /><p className="mt-3 font-black text-[var(--color-text-strong)]">No warranty claims found</p><p className="mt-1 text-sm text-[var(--color-muted)]">Adjust the filters or receive a new claim.</p></div></div> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{claims.map((claim) => <button className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition hover:border-[var(--color-maroon)]/40 hover:shadow-sm" key={claim.id} onClick={() => openDetail(claim)} type="button"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-[var(--color-maroon)]">{claim.claimCode}</p><h3 className="mt-1 line-clamp-2 font-black text-[var(--color-text-strong)]">{claim.issueDescription}</h3></div><StatusBadge status={claim.status} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="font-bold text-[var(--color-muted)]">Customer</p><p className="mt-1 truncate font-bold">{claim.customer?.fullName || "Walk-in / unlinked"}</p></div><div><p className="font-bold text-[var(--color-muted)]">Item</p><p className="mt-1 truncate font-bold">{claim.item?.itemName || claim.saleItem?.itemNameSnapshot || "Unlinked item"}</p></div><div><p className="font-bold text-[var(--color-muted)]">Serial</p><p className="mt-1 truncate font-bold">{claim.serial?.serialNumber || "—"}</p></div><div><p className="font-bold text-[var(--color-muted)]">Received</p><p className="mt-1 font-bold">{dateTime(claim.receivedAt)}</p></div></div></button>)}</div>}
        <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4"><p className="text-xs font-bold text-[var(--color-muted)]">{meta.total || 0} claim{meta.total === 1 ? "" : "s"}</p><div className="flex items-center gap-2"><button aria-label="Previous page" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-[var(--color-text-strong)] disabled:opacity-40" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => value - 1)} type="button"><ChevronLeft size={17} /></button><span className="text-xs font-black text-[var(--color-text-strong)]">{page} / {totalPages}</span><button aria-label="Next page" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-[var(--color-text-strong)] disabled:opacity-40" disabled={page >= totalPages || isLoading} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={17} /></button></div></div>
      </section>

      {showCreate ? <Modal onClose={() => { setShowCreate(false); setSaleSearchText(""); setIsSaleDropdownOpen(false) }} title="Receive warranty claim" wide><form onSubmit={submitCreate}><div className="max-h-[72vh] space-y-5 overflow-y-auto p-5 sm:p-6"><div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-800 dark:text-sky-300">Link a sold line whenever available. The backend verifies that sale, customer, item, and serial references belong to the same branch and transaction. Claims may remain unlinked for legitimate walk-in warranty intake.</div><div className="grid gap-4 lg:grid-cols-2"><div className="block text-sm font-bold text-[var(--color-text-strong)]"><span>Original sale (optional)</span>{selectedSale ? (<div className="mt-1.5 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 shadow-xs"><div><p className="font-black text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-600" /><span>{selectedSale.receiptCode}</span></p><p className="mt-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{selectedSale.customer?.fullName || "Walk-in"} · {dateTime(selectedSale.saleDate)}</p></div><button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-700 transition" onClick={() => { selectSale(""); setSaleSearchText("") }} title="Remove linked sale"><X size={16} /></button></div>) : (<div className="relative mt-1.5"><div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} /><input type="text" className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-[var(--color-maroon)]/10" placeholder="Scan receipt barcode or type receipt / customer name..." value={saleSearchText} onFocus={() => setIsSaleDropdownOpen(true)} onChange={(e) => { setSaleSearchText(e.target.value); setIsSaleDropdownOpen(true) }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const query = saleSearchText.trim().toLowerCase(); const exact = sales.find((s) => s.receiptCode?.toLowerCase() === query); if (exact) { selectSale(exact.id); setSaleSearchText(""); setIsSaleDropdownOpen(false) } } }} /></div>{isSaleDropdownOpen && (<div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl divide-y divide-[var(--color-border)]"><button type="button" className="w-full p-2.5 text-left text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-soft)] transition" onClick={() => { selectSale(""); setSaleSearchText(""); setIsSaleDropdownOpen(false) }}>No linked sale (Walk-in intake)</button>{filteredSales.length === 0 ? (<p className="p-3 text-xs font-bold text-[var(--color-muted)] text-center">No matching sales found for "{saleSearchText}"</p>) : (filteredSales.map((sale) => (<button key={sale.id} type="button" className="w-full p-2.5 text-left hover:bg-[var(--color-soft)] transition flex items-center justify-between" onClick={() => { selectSale(sale.id); setSaleSearchText(""); setIsSaleDropdownOpen(false) }}><div><p className="text-xs font-black text-[var(--color-text-strong)]">{sale.receiptCode}</p><p className="text-[11px] text-[var(--color-muted)] font-semibold">{sale.customer?.fullName || "Walk-in"} · {dateTime(sale.saleDate)}</p></div><span className="text-[10px] font-bold text-[var(--color-maroon)] bg-[var(--color-maroon-soft)] px-2 py-0.5 rounded-md">Select</span></button>)))}</div>)}</div>)}</div><Field label="Sold line (recommended when sale is linked)"><select className={FIELD_CLASS} disabled={!selectedSale || isSaleLoading} onChange={(event) => selectSaleItem(event.target.value)} value={createForm.saleItemId}><option value="">{isSaleLoading ? "Loading sale…" : "No specific sold line"}</option>{selectedSale?.items?.map((line) => <option key={line.id} value={line.id}>{line.lineNo}. {line.itemNameSnapshot || line.description}{line.serialId ? " · serialized" : ""}</option>)}</select></Field></div><div className="grid gap-4 lg:grid-cols-2"><Field label="Customer (optional)"><select className={FIELD_CLASS} disabled={Boolean(selectedSale?.customer)} onChange={(event) => setCreateForm((form) => ({ ...form, customerId: event.target.value }))} value={createForm.customerId}><option value="">Walk-in / unlinked customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName} · {customer.customerCode}</option>)}</select></Field><Field label="Item (optional)"><select className={FIELD_CLASS} disabled={Boolean(createForm.saleItemId)} onChange={(event) => setCreateForm((form) => ({ ...form, itemId: event.target.value }))} value={createForm.itemId}><option value="">Unlinked item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.itemCode} · {item.itemName}</option>)}</select>{selectedFormItem && !selectedFormItem.hasWarranty ? <span className="mt-1 block text-xs font-bold text-amber-700">Catalog marks this item as having no warranty. Confirm eligibility before receiving it.</span> : null}</Field></div><div className="grid gap-4 lg:grid-cols-2"><Field label="Issue description *"><textarea autoFocus className={FIELD_CLASS} onChange={(event) => setCreateForm((form) => ({ ...form, issueDescription: event.target.value }))} required rows="3" value={createForm.issueDescription} /></Field><Field label="Customer complaint"><textarea className={FIELD_CLASS} onChange={(event) => setCreateForm((form) => ({ ...form, customerComplaint: event.target.value }))} rows="3" value={createForm.customerComplaint} /></Field><Field label="Initial diagnosis"><textarea className={FIELD_CLASS} onChange={(event) => setCreateForm((form) => ({ ...form, diagnosis: event.target.value }))} rows="3" value={createForm.diagnosis} /></Field><Field label="Action already taken"><textarea className={FIELD_CLASS} onChange={(event) => setCreateForm((form) => ({ ...form, actionTaken: event.target.value }))} rows="3" value={createForm.actionTaken} /></Field></div><div className="grid gap-4 lg:grid-cols-2"><Field label="Supplier name"><input className={FIELD_CLASS} onChange={(event) => setCreateForm((form) => ({ ...form, supplierName: event.target.value }))} value={createForm.supplierName} /></Field><Field label="Supplier reference"><input className={FIELD_CLASS} onChange={(event) => setCreateForm((form) => ({ ...form, supplierReferenceNo: event.target.value }))} value={createForm.supplierReferenceNo} /></Field></div><Field label="Remarks"><textarea className={FIELD_CLASS} onChange={(event) => setCreateForm((form) => ({ ...form, remarks: event.target.value }))} rows="2" value={createForm.remarks} /></Field></div><div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6"><button className="rounded-xl border px-4 py-2.5 text-sm font-bold" onClick={() => { setShowCreate(false); setSaleSearchText(""); setIsSaleDropdownOpen(false) }} type="button">Cancel</button><button className="rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white" disabled={isSaving} type="submit">{isSaving ? "Receiving…" : "Receive claim"}</button></div></form></Modal> : null}

      {selectedClaim ? <Modal onClose={() => { setSelectedClaim(null); setActionStatus(""); setShowRelease(false) }} title={selectedClaim.claimCode} wide><div className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">{isDetailLoading ? <div className="grid min-h-48 place-items-center"><LoaderCircle className="animate-spin" /></div> : <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="max-w-3xl text-xl font-black">{selectedClaim.issueDescription}</h3><p className="mt-1 text-sm text-[var(--color-muted)]">Received {dateTime(selectedClaim.receivedAt)} · {selectedClaim.branch?.name || selectedClaim.branch?.code}</p></div><StatusBadge status={selectedClaim.status} /></div><div className="grid gap-3 rounded-2xl bg-[var(--color-soft)] p-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs font-bold text-[var(--color-muted)]">Customer</p><p className="mt-1 font-bold">{selectedClaim.customer?.fullName || "Walk-in / unlinked"}</p></div><div><p className="text-xs font-bold text-[var(--color-muted)]">Item</p><p className="mt-1 font-bold">{selectedClaim.item?.itemName || selectedClaim.saleItem?.itemNameSnapshot || "Unlinked"}</p></div><div><p className="text-xs font-bold text-[var(--color-muted)]">Serial</p><p className="mt-1 font-bold">{selectedClaim.serial?.serialNumber || "—"}</p></div><div><p className="text-xs font-bold text-[var(--color-muted)]">Original sale</p><p className="mt-1 font-bold">{selectedClaim.sale?.receiptCode || "—"}</p></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Customer complaint", selectedClaim.customerComplaint], ["Diagnosis", selectedClaim.diagnosis], ["Action taken", selectedClaim.actionTaken], ["Supplier", selectedClaim.supplierName], ["Supplier reference", selectedClaim.supplierReferenceNo], ["Remarks", selectedClaim.remarks]].map(([label, value]) => <div key={label}><p className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{value || "—"}</p></div>)}</div><div><p className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">Lifecycle</p><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[["Received", selectedClaim.receivedAt], ["Checking", selectedClaim.checkingAt], ["Sent to supplier", selectedClaim.sentToSupplierAt], ["Approved", selectedClaim.approvedAt], ["Rejected", selectedClaim.rejectedAt], ["Repaired", selectedClaim.repairedAt], ["Replaced", selectedClaim.replacedAt], ["Released", selectedClaim.releasedAt]].map(([label, value]) => <div className={`rounded-xl p-3 ${value ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-[var(--color-soft)] text-[var(--color-muted)]"}`} key={label}><p className="text-xs font-black">{label}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{dateTime(value)}</p></div>)}</div></div><div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">{canAct ? NEXT_STATUSES[selectedClaim.status]?.map((status) => <button className={status === "REJECTED" ? "rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700" : "rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white"} key={status} onClick={() => beginStatusAction(status)} type="button">Mark {formatStatus(status).toLowerCase()}</button>) : null}{canAct && RELEASE_READY.has(selectedClaim.status) ? <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-black text-white" onClick={openRelease} type="button"><CheckCircle2 size={17} /> Release claim</button> : null}</div></div>}</div></Modal> : null}

      {actionStatus ? <Modal onClose={() => setActionStatus("")} title={`Move claim to ${formatStatus(actionStatus)}`}><form onSubmit={submitStatus}><div className="max-h-[70vh] space-y-4 overflow-y-auto p-5 sm:p-6"><div className="rounded-2xl bg-[var(--color-soft)] p-4 text-sm text-[var(--color-muted)]">This appends a timestamped lifecycle outcome and records the acting user. The original sale remains unchanged.</div><Field label="Diagnosis"><textarea className={FIELD_CLASS} onChange={(event) => setActionForm((form) => ({ ...form, diagnosis: event.target.value }))} rows="3" value={actionForm.diagnosis} /></Field><Field label="Action taken"><textarea className={FIELD_CLASS} onChange={(event) => setActionForm((form) => ({ ...form, actionTaken: event.target.value }))} rows="3" value={actionForm.actionTaken} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Supplier name"><input className={FIELD_CLASS} onChange={(event) => setActionForm((form) => ({ ...form, supplierName: event.target.value }))} value={actionForm.supplierName} /></Field><Field label="Supplier reference"><input className={FIELD_CLASS} onChange={(event) => setActionForm((form) => ({ ...form, supplierReferenceNo: event.target.value }))} value={actionForm.supplierReferenceNo} /></Field></div><Field label="Remarks"><textarea className={FIELD_CLASS} onChange={(event) => setActionForm((form) => ({ ...form, remarks: event.target.value }))} rows="2" value={actionForm.remarks} /></Field></div><div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6"><button className="rounded-xl border px-4 py-2.5 text-sm font-bold" onClick={() => setActionStatus("")} type="button">Back</button><button className={actionStatus === "REJECTED" ? "rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white" : "rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white"} disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Confirm status"}</button></div></form></Modal> : null}

      {showRelease ? <Modal onClose={() => setShowRelease(false)} title="Release warranty claim"><form onSubmit={submitRelease}><div className="space-y-4 p-5 sm:p-6"><div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"><strong>Confirm physical release.</strong> This closes the claim as OUT and records who released it. It cannot be moved back into processing.</div><Field label="Final action taken"><textarea className={FIELD_CLASS} onChange={(event) => setReleaseForm((form) => ({ ...form, actionTaken: event.target.value }))} rows="3" value={releaseForm.actionTaken} /></Field><Field label="Release remarks"><textarea className={FIELD_CLASS} onChange={(event) => setReleaseForm((form) => ({ ...form, remarks: event.target.value }))} rows="3" value={releaseForm.remarks} /></Field></div><div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6"><button className="rounded-xl border px-4 py-2.5 text-sm font-bold" onClick={() => setShowRelease(false)} type="button">Back</button><button className="rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white" disabled={isSaving} type="submit">{isSaving ? "Releasing…" : "Confirm release"}</button></div></form></Modal> : null}
    </div>
  )
}
