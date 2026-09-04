import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  LoaderCircle,
  Mail,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  User,
  UsersRound,
  X,
} from "lucide-react"

import {
  createSupplier,
  getSupplierById,
  getSupplierHistory,
  getSuppliers,
  updateSupplier,
  updateSupplierStatus,
} from "../../features/suppliers/suppliers.api"

const EMPTY_FORM = {
  supplierCode: "",
  name: "",
  contactPerson: "",
  contactNo: "",
  email: "",
  address: "",
  tin: "",
  notes: "",
}

const STATUS_BADGE_STYLES = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-600 border-slate-200",
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  ORDERED: "bg-blue-50 text-blue-700 border-blue-200",
  PARTIALLY_RECEIVED: "bg-amber-50 text-amber-700 border-amber-200",
  RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  POSTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  SENT_TO_SUPPLIER: "bg-amber-50 text-amber-700 border-amber-200",
  IN: "bg-slate-100 text-slate-700 border-slate-200",
  CHECKING: "bg-blue-50 text-blue-700 border-blue-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REPAIRED: "bg-teal-50 text-teal-700 border-teal-200",
  REPLACED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  OUT: "bg-slate-100 text-slate-700 border-slate-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
}

function apiError(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    fallback
  )
}

function formatMoney(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value, includeTime = false) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(date)
}

function formatStatus(value) {
  if (!value) return "Unknown"
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function StatusBadge({ status }) {
  const norm = String(status || "").toUpperCase()
  const style = STATUS_BADGE_STYLES[norm] || "bg-slate-100 text-slate-700 border-slate-200"
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${style}`}
    >
      {formatStatus(norm)}
    </span>
  )
}

function SupplierFormModal({ initial, isSaving, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(
      Object.keys(EMPTY_FORM).map((key) => [key, initial?.[key] || ""]),
    ),
  )

  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }))

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] hover:border-slate-300 placeholder:text-slate-400 placeholder:font-normal"
  const labelClass =
    "text-[11px] font-bold uppercase tracking-wider text-slate-600 block"

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
      <section className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Supplier Directory
            </span>
            <h2 className="text-base font-black text-slate-900 leading-tight">
              {initial?.id ? `Edit ${initial.name}` : "New Supplier"}
            </h2>
          </div>
          <button
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSave(form)
          }}
        >
          <div className="max-h-[75vh] overflow-y-auto p-5 space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Supplier code
                <input
                  className={`${inputClass} uppercase font-mono`}
                  onChange={(event) => set("supplierCode", event.target.value)}
                  placeholder="Auto-generated if blank"
                  value={form.supplierCode || ""}
                />
              </label>

              <label className={labelClass}>
                Supplier name <span className="text-red-600">*</span>
                <input
                  autoFocus
                  className={inputClass}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="e.g. Apex Distribution Corp."
                  required
                  value={form.name || ""}
                />
              </label>

              <label className={labelClass}>
                Contact person
                <input
                  className={inputClass}
                  onChange={(event) =>
                    set("contactPerson", event.target.value)
                  }
                  placeholder="e.g. Juan Santos"
                  value={form.contactPerson || ""}
                />
              </label>

              <label className={labelClass}>
                Contact number
                <input
                  className={inputClass}
                  inputMode="tel"
                  onChange={(event) => set("contactNo", event.target.value)}
                  placeholder="09xx xxx xxxx"
                  value={form.contactNo || ""}
                />
              </label>

              <label className={labelClass}>
                Email address
                <input
                  className={inputClass}
                  onChange={(event) => set("email", event.target.value)}
                  placeholder="sales@supplier.com"
                  type="email"
                  value={form.email || ""}
                />
              </label>

              <label className={labelClass}>
                TIN (Tax Identification Number)
                <input
                  className={`${inputClass} font-mono`}
                  onChange={(event) => set("tin", event.target.value)}
                  placeholder="000-000-000-000"
                  value={form.tin || ""}
                />
              </label>

              <label className={`${labelClass} sm:col-span-2`}>
                Address
                <textarea
                  className={`${inputClass} min-h-[50px] h-[50px] resize-none`}
                  onChange={(event) => set("address", event.target.value)}
                  placeholder="Warehouse, office or showroom address…"
                  value={form.address || ""}
                />
              </label>

              <label className={`${labelClass} sm:col-span-2`}>
                Notes & Terms
                <textarea
                  className={`${inputClass} min-h-[50px] h-[50px] resize-none`}
                  onChange={(event) => set("notes", event.target.value)}
                  placeholder="Payment terms, delivery days, return policies, account remarks…"
                  value={form.notes || ""}
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              disabled={isSaving}
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
              {isSaving ? "Saving…" : initial?.id ? "Save Changes" : "Create Supplier"}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function SupplierLedgerModal({ historyData, isLoading, onClose, onEdit, supplier }) {
  const [activeTab, setActiveTab] = useState("orders") // 'orders' | 'receivings' | 'returns' | 'info'
  const [tabSearch, setTabSearch] = useState("")

  const summary = historyData?.summary || {
    totalPurchaseOrderCount: 0,
    totalPurchaseOrderAmount: 0,
    totalReceivingCount: 0,
    totalReceivingAmount: 0,
    totalReturnCount: 0,
    activeRmaCount: 0,
    resolvedRmaCount: 0,
  }

  const purchaseOrders = useMemo(() => {
    const items = historyData?.purchaseOrders?.items || []
    if (!tabSearch.trim()) return items
    const q = tabSearch.toLowerCase().trim()
    return items.filter(
      (po) =>
        po.poCode?.toLowerCase().includes(q) ||
        po.status?.toLowerCase().includes(q) ||
        po.notes?.toLowerCase().includes(q) ||
        po.items?.some((it) => it.description?.toLowerCase().includes(q)),
    )
  }, [historyData?.purchaseOrders?.items, tabSearch])

  const purchaseReceivings = useMemo(() => {
    const items = historyData?.purchaseReceivings?.items || []
    if (!tabSearch.trim()) return items
    const q = tabSearch.toLowerCase().trim()
    return items.filter(
      (pr) =>
        pr.receivingCode?.toLowerCase().includes(q) ||
        pr.supplierDeliveryNo?.toLowerCase().includes(q) ||
        pr.supplierInvoiceNo?.toLowerCase().includes(q) ||
        pr.referenceNo?.toLowerCase().includes(q) ||
        pr.status?.toLowerCase().includes(q) ||
        pr.items?.some((it) => it.description?.toLowerCase().includes(q)),
    )
  }, [historyData?.purchaseReceivings?.items, tabSearch])

  const returns = useMemo(() => {
    const items = historyData?.returns?.items || []
    if (!tabSearch.trim()) return items
    const q = tabSearch.toLowerCase().trim()
    return items.filter(
      (r) =>
        r.claimCode?.toLowerCase().includes(q) ||
        r.supplierReferenceNo?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q) ||
        r.issueDescription?.toLowerCase().includes(q) ||
        r.diagnosis?.toLowerCase().includes(q) ||
        r.remarks?.toLowerCase().includes(q) ||
        r.item?.itemName?.toLowerCase().includes(q) ||
        r.serial?.serialNumber?.toLowerCase().includes(q),
    )
  }, [historyData?.returns?.items, tabSearch])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/65 p-2 sm:p-4 md:p-6 backdrop-blur-xs">
      <section className="my-auto flex flex-col max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-maroon)] text-white shadow-xs font-black text-sm">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[var(--color-maroon)]">
                  {supplier.supplierCode}
                </span>
                <StatusBadge status={supplier.status} />
                <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  {supplier.branch?.code || "GLOBAL"}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                {supplier.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
              onClick={() => onEdit(supplier)}
              type="button"
            >
              <Pencil size={13} /> Edit Supplier
            </button>
            <button
              aria-label="Close modal"
              className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              onClick={onClose}
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Top Lifetime KPI Metrics */}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Purchase Orders
              </span>
              <Package size={15} className="text-blue-600" />
            </div>
            <p className="mt-1 font-mono text-base font-black text-slate-900">
              {formatMoney(summary.totalPurchaseOrderAmount)}
            </p>
            <p className="text-[11px] font-semibold text-blue-700/80">
              {summary.totalPurchaseOrderCount} order(s) placed
            </p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Deliveries Received
              </span>
              <Truck size={15} className="text-emerald-600" />
            </div>
            <p className="mt-1 font-mono text-base font-black text-slate-900">
              {formatMoney(summary.totalReceivingAmount)}
            </p>
            <p className="text-[11px] font-semibold text-emerald-700/80">
              {summary.totalReceivingCount} stock-in receiving(s)
            </p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Returns / RMA
              </span>
              <RotateCcw size={15} className="text-amber-600" />
            </div>
            <p className="mt-1 font-mono text-base font-black text-slate-900">
              {summary.totalReturnCount} Claim(s)
            </p>
            <p className="text-[11px] font-semibold text-amber-700/80">
              {summary.activeRmaCount} pending / in-process
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Contact & Details
              </span>
              <Phone size={15} className="text-slate-400" />
            </div>
            <p className="mt-1 truncate text-xs font-bold text-slate-800">
              {supplier.contactPerson || "No contact person"}
            </p>
            <p className="truncate text-[11px] font-medium text-slate-500">
              {supplier.contactNo || supplier.email || "No phone/email"}
            </p>
          </div>
        </div>

        {/* Tab Navigation & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5">
          <nav className="flex gap-1.5 overflow-x-auto text-xs font-bold">
            <button
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
                activeTab === "orders"
                  ? "bg-[var(--color-maroon)] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => {
                setActiveTab("orders")
                setTabSearch("")
              }}
              type="button"
            >
              <Package size={14} />
              <span>Purchase Orders</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                  activeTab === "orders"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {historyData?.purchaseOrders?.totalItems || 0}
              </span>
            </button>

            <button
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
                activeTab === "receivings"
                  ? "bg-[var(--color-maroon)] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => {
                setActiveTab("receivings")
                setTabSearch("")
              }}
              type="button"
            >
              <Truck size={14} />
              <span>Deliveries / Receivings</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                  activeTab === "receivings"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {historyData?.purchaseReceivings?.totalItems || 0}
              </span>
            </button>

            <button
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
                activeTab === "returns"
                  ? "bg-[var(--color-maroon)] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => {
                setActiveTab("returns")
                setTabSearch("")
              }}
              type="button"
            >
              <RotateCcw size={14} />
              <span>Returns & RMA Monitoring</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                  activeTab === "returns"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {historyData?.returns?.totalItems || 0}
              </span>
            </button>

            <button
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition ${
                activeTab === "info"
                  ? "bg-[var(--color-maroon)] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => {
                setActiveTab("info")
                setTabSearch("")
              }}
              type="button"
            >
              <Building2 size={14} />
              <span>Supplier Profile</span>
            </button>
          </nav>

          {activeTab !== "info" ? (
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--color-maroon)] placeholder:text-slate-400"
                onChange={(e) => setTabSearch(e.target.value)}
                placeholder={`Search in ${activeTab}…`}
                value={tabSearch}
              />
            </div>
          ) : null}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <LoaderCircle size={28} className="animate-spin text-[var(--color-maroon)]" />
              <p className="mt-2 text-xs font-bold text-slate-600">
                Loading supplier history & transactions…
              </p>
            </div>
          ) : null}

          {/* TAB 1: PURCHASE ORDERS */}
          {!isLoading && activeTab === "orders" ? (
            <div className="space-y-3">
              {purchaseOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                  <Package className="mx-auto text-slate-300" size={36} />
                  <p className="mt-2 text-xs font-bold text-slate-800">
                    No purchase orders recorded
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Purchase orders created for this supplier will be listed here.
                  </p>
                </div>
              ) : (
                purchaseOrders.map((po) => (
                  <article
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition"
                    key={po.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[var(--color-maroon)]">
                            {po.poCode}
                          </span>
                          <StatusBadge status={po.status} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Ordered: {formatDate(po.orderDate, true)}
                          {po.expectedDate
                            ? ` · Expected: ${formatDate(po.expectedDate)}`
                            : ""}
                          {po.orderedBy?.fullName
                            ? ` · By ${po.orderedBy.fullName}`
                            : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-500">
                          Grand Total
                        </span>
                        <p className="font-mono text-base font-black text-slate-900">
                          {formatMoney(po.grandTotal)}
                        </p>
                      </div>
                    </div>

                    {/* Order Line Items */}
                    {Array.isArray(po.items) && po.items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-100 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-4 py-2">#</th>
                              <th className="px-4 py-2">Item Description</th>
                              <th className="px-4 py-2 text-center">Ordered Qty</th>
                              <th className="px-4 py-2 text-center">Received Qty</th>
                              <th className="px-4 py-2 text-right">Unit Cost</th>
                              <th className="px-4 py-2 text-right">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {po.items.map((item, idx) => (
                              <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2 font-mono text-slate-400">
                                  {item.lineNo || idx + 1}
                                </td>
                                <td className="px-4 py-2">
                                  <p className="font-semibold text-slate-800">
                                    {item.description}
                                  </p>
                                  {item.item?.itemCode ? (
                                    <span className="font-mono text-[10px] text-slate-500">
                                      Code: {item.item.itemCode}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-2 text-center font-mono font-bold text-slate-800">
                                  {Number(item.quantity || 0)}
                                </td>
                                <td className="px-4 py-2 text-center font-mono">
                                  <span
                                    className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${
                                      Number(item.receivedQuantity || 0) >=
                                      Number(item.quantity || 0)
                                        ? "bg-emerald-50 text-emerald-700"
                                        : Number(item.receivedQuantity || 0) > 0
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {Number(item.receivedQuantity || 0)}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-slate-700">
                                  {formatMoney(item.unitCost)}
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">
                                  {formatMoney(item.lineTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {po.notes ? (
                      <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-2 text-[11px] text-slate-600">
                        <strong className="font-semibold text-slate-700">Notes: </strong>
                        {po.notes}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          ) : null}

          {/* TAB 2: DELIVERIES / PURCHASE RECEIVINGS */}
          {!isLoading && activeTab === "receivings" ? (
            <div className="space-y-3">
              {purchaseReceivings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                  <Truck className="mx-auto text-slate-300" size={36} />
                  <p className="mt-2 text-xs font-bold text-slate-800">
                    No deliveries or receivings recorded
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Stock deliveries received from this supplier will appear here.
                  </p>
                </div>
              ) : (
                purchaseReceivings.map((pr) => (
                  <article
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition"
                    key={pr.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[var(--color-maroon)]">
                            {pr.receivingCode}
                          </span>
                          <StatusBadge status={pr.status} />
                          {pr.purchaseOrder?.poCode ? (
                            <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700 border border-blue-200">
                              PO: {pr.purchaseOrder.poCode}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Received: {formatDate(pr.receivingDate, true)}
                          {pr.supplierDeliveryNo
                            ? ` · DR #${pr.supplierDeliveryNo}`
                            : ""}
                          {pr.supplierInvoiceNo
                            ? ` · Inv #${pr.supplierInvoiceNo}`
                            : ""}
                          {pr.postedBy?.fullName
                            ? ` · Posted by ${pr.postedBy.fullName}`
                            : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-500">
                          Received Total
                        </span>
                        <p className="font-mono text-base font-black text-slate-900">
                          {formatMoney(pr.grandTotal)}
                        </p>
                      </div>
                    </div>

                    {/* Received Items Breakdown */}
                    {Array.isArray(pr.items) && pr.items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-100 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-4 py-2">#</th>
                              <th className="px-4 py-2">Received Item</th>
                              <th className="px-4 py-2 text-center">Batch / Serials</th>
                              <th className="px-4 py-2 text-center">Qty Received</th>
                              <th className="px-4 py-2 text-right">Unit Cost</th>
                              <th className="px-4 py-2 text-right">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {pr.items.map((item, idx) => (
                              <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2 font-mono text-slate-400">
                                  {item.lineNo || idx + 1}
                                </td>
                                <td className="px-4 py-2">
                                  <p className="font-semibold text-slate-800">
                                    {item.description}
                                  </p>
                                  {item.item?.itemCode ? (
                                    <span className="font-mono text-[10px] text-slate-500">
                                      Code: {item.item.itemCode}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {item.batchCode ? (
                                    <span className="inline-block rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-purple-700 mr-1">
                                      Batch: {item.batchCode}
                                    </span>
                                  ) : null}
                                  {Array.isArray(item.serials) && item.serials.length > 0 ? (
                                    <span className="inline-block rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
                                      {item.serials.length} Serial(s)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-center font-mono font-bold text-emerald-700">
                                  {Number(item.quantityReceived || 0)}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-slate-700">
                                  {formatMoney(item.unitCost)}
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">
                                  {formatMoney(item.lineTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {pr.notes ? (
                      <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-2 text-[11px] text-slate-600">
                        <strong className="font-semibold text-slate-700">Notes: </strong>
                        {pr.notes}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          ) : null}

          {/* TAB 3: RETURNS & RMA MONITORING */}
          {!isLoading && activeTab === "returns" ? (
            <div className="space-y-3">
              {returns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                  <RotateCcw className="mx-auto text-slate-300" size={36} />
                  <p className="mt-2 text-xs font-bold text-slate-800">
                    No supplier returns or RMA claims recorded
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Warranty items returned/dispatched to this supplier for RMA repair or replacement will be tracked here.
                  </p>
                </div>
              ) : (
                returns.map((claim) => (
                  <article
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition space-y-3 text-xs"
                    key={claim.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[var(--color-maroon)]">
                            {claim.claimCode}
                          </span>
                          <StatusBadge status={claim.status} />
                          {claim.supplierReferenceNo ? (
                            <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                              RMA Ref: {claim.supplierReferenceNo}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Received: {formatDate(claim.receivedAt, true)}
                          {claim.sentToSupplierAt
                            ? ` · Dispatched to Supplier: ${formatDate(claim.sentToSupplierAt, true)}`
                            : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[11px] font-bold text-slate-700">
                          {claim.customer?.fullName || "Walk-in Customer"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Branch: {claim.branch?.code || "Branch"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Product & Serial
                        </span>
                        <p className="mt-1 font-bold text-slate-900">
                          {claim.item?.itemName || "Item"}
                        </p>
                        {claim.serial?.serialNumber ? (
                          <p className="mt-0.5 font-mono text-[11px] font-bold text-indigo-700">
                            S/N: {claim.serial.serialNumber}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-slate-600">
                          <strong>Issue: </strong>
                          {claim.issueDescription || claim.customerComplaint || "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Resolution & Monitoring Status
                        </span>
                        <p className="mt-1 text-slate-800">
                          <strong>Diagnosis: </strong>
                          {claim.diagnosis || "Under supplier inspection"}
                        </p>
                        {claim.actionTaken ? (
                          <p className="mt-0.5 text-slate-800">
                            <strong>Action: </strong>
                            {claim.actionTaken}
                          </p>
                        ) : null}
                        {claim.remarks ? (
                          <p className="mt-1 text-[11px] italic text-slate-500">
                            {claim.remarks}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {/* TAB 4: SUPPLIER PROFILE & NOTES */}
          {!isLoading && activeTab === "info" ? (
            <div className="space-y-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Supplier Code
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {supplier.supplierCode}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Company Name
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {supplier.name}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Contact Person
                  </span>
                  <p className="mt-1 font-bold text-slate-900">
                    {supplier.contactPerson || "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Contact Number
                  </span>
                  <p className="mt-1 font-mono font-bold text-slate-900">
                    {supplier.contactNo || "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Email Address
                  </span>
                  <p className="mt-1 font-medium text-slate-900">
                    {supplier.email || "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Tax Identification (TIN)
                  </span>
                  <p className="mt-1 font-mono font-bold text-slate-900">
                    {supplier.tin || "—"}
                  </p>
                </div>

                <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Physical / Billing Address
                  </span>
                  <p className="mt-1 text-slate-900">
                    {supplier.address || "No address on file."}
                  </p>
                </div>

                <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Notes & Agreed Payment Terms
                  </span>
                  <p className="mt-1 whitespace-pre-line text-slate-800 leading-relaxed">
                    {supplier.notes || "No additional notes or terms configured."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 px-5 py-3 text-xs">
          <p className="text-slate-500">
            Registered on {formatDate(supplier.createdAt)}
          </p>
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  )
}

export default function SuppliersPage({ selectedBranch, user }) {
  const branchId =
    selectedBranch?.id || user?.branchId || user?.branch?.id || ""
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
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [historyData, setHistoryData] = useState(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setMessage("")
    try {
      const response = await getSuppliers({
        ...(branchId ? { branchId } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
        page,
        limit: 20,
      })
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

  const openLedger = async (supplier) => {
    setSelectedSupplier(supplier)
    setHistoryData(null)
    setIsHistoryLoading(true)
    try {
      const response = await getSupplierHistory(supplier.id, { limit: 50 })
      setHistoryData(response?.data || null)
    } catch (error) {
      setMessage(apiError(error, "Could not load supplier transactions."))
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const saveSupplier = async (form) => {
    setIsSaving(true)
    setMessage("")
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        typeof value === "string" && value.trim() === ""
          ? null
          : typeof value === "string"
            ? value.trim()
            : value,
      ]),
    )
    if (!editing?.id) delete payload.supplierCode
    else if (!payload.supplierCode) delete payload.supplierCode

    try {
      const response = editing?.id
        ? await updateSupplier(editing.id, payload)
        : await createSupplier({
            ...payload,
            ...(branchId ? { branchId } : {}),
          })
      setNotice(`${response?.data?.supplierCode || "Supplier"} saved.`)
      setEditing(null)
      await load()
      if (selectedSupplier?.id === editing?.id) {
        openLedger(response?.data || selectedSupplier)
      }
    } catch (error) {
      setMessage(apiError(error, "Could not save supplier."))
    } finally {
      setIsSaving(false)
    }
  }

  const toggleStatus = async (supplier) => {
    const nextStatus = supplier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    if (
      !window.confirm(
        `${nextStatus === "INACTIVE" ? "Deactivate" : "Reactivate"} ${supplier.name}?`,
      )
    )
      return
    try {
      await updateSupplierStatus(supplier.id, nextStatus)
      setNotice(
        `${supplier.supplierCode} is now ${nextStatus.toLowerCase()}.`,
      )
      await load()
    } catch (error) {
      setMessage(apiError(error, "Could not update supplier status."))
    }
  }

  const totalPages = Math.max(1, pagination.totalPages || 1)

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Supply chain & Procurement
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">
              Supplier Directory & Ledger
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Complete supplier ledger with purchase orders, stock receivings, returns & RMA monitoring.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-maroon-hover)]"
            onClick={() => setEditing({})}
            type="button"
          >
            <Plus size={15} /> New Supplier
          </button>
        </div>
      </section>

      {message ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          <AlertCircle size={16} />
          <span>{message}</span>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Filter & Search Bar */}
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:grid-cols-[1fr_200px]">
        <label className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)] placeholder:text-slate-400"
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search supplier name, code, contact person, phone, TIN…"
            value={search}
          />
        </label>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          value={status}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </section>

      {/* Main Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-500">
            <LoaderCircle className="animate-spin" size={16} />
            Loading suppliers…
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="mx-auto text-slate-300" size={36} />
            <p className="mt-2 text-xs font-bold text-slate-800">
              No matching suppliers found
            </p>
            <p className="text-[11px] text-slate-500">
              Try adjusting your search criteria or register a new supplier.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Supplier Code & Name</th>
                    <th className="px-4 py-3">Contact Details</th>
                    <th className="px-4 py-3">TIN / Address</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {suppliers.map((supplier) => (
                    <tr
                      className="hover:bg-slate-50/60 transition cursor-pointer"
                      key={supplier.id}
                      onClick={() => openLedger(supplier)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-bold text-[var(--color-maroon)]">
                            {supplier.supplierCode}
                          </p>
                        </div>
                        <p className="font-bold text-slate-900 text-sm">
                          {supplier.name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">
                          {supplier.contactPerson || "—"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {supplier.contactNo || supplier.email || "No contact info"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[11px] font-semibold text-slate-700">
                          {supplier.tin ? `TIN: ${supplier.tin}` : "—"}
                        </p>
                        <p className="truncate max-w-xs text-[11px] text-slate-500">
                          {supplier.address || "No address"}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {supplier.branch?.code || "GLOBAL"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={supplier.status} />
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1.5">
                          <button
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-black shadow-xs transition"
                            onClick={() => openLedger(supplier)}
                            type="button"
                          >
                            <FileSpreadsheet size={13} /> Ledger & History
                          </button>
                          <button
                            className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 shadow-2xs transition"
                            onClick={() => setEditing(supplier)}
                            title="Edit"
                            type="button"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
                            onClick={() => toggleStatus(supplier)}
                            type="button"
                          >
                            {supplier.status === "ACTIVE"
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid gap-2.5 p-3 lg:hidden">
              {suppliers.map((supplier) => (
                <article
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs space-y-2.5 cursor-pointer hover:border-slate-300 transition"
                  key={supplier.id}
                  onClick={() => openLedger(supplier)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs font-bold text-[var(--color-maroon)]">
                        {supplier.supplierCode}
                      </p>
                      <p className="font-black text-slate-900 text-sm">
                        {supplier.name}
                      </p>
                    </div>
                    <StatusBadge status={supplier.status} />
                  </div>

                  <p className="text-slate-600">
                    {supplier.contactPerson || "No contact person"} ·{" "}
                    {supplier.contactNo || supplier.email || "No contact"}
                  </p>

                  <div
                    className="grid grid-cols-2 gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-bold shadow-xs hover:bg-black"
                      onClick={() => openLedger(supplier)}
                      type="button"
                    >
                      <FileSpreadsheet size={13} /> Ledger
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      onClick={() => setEditing(supplier)}
                      type="button"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500">
          <p>
            Page {pagination.page || page} of {totalPages} ·{" "}
            {pagination.totalItems || 0} supplier(s)
          </p>
          <div className="flex gap-1.5">
            <button
              className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Create / Edit Supplier Modal */}
      {editing ? (
        <SupplierFormModal
          initial={editing}
          isSaving={isSaving}
          onClose={() => setEditing(null)}
          onSave={saveSupplier}
        />
      ) : null}

      {/* Supplier 360 Ledger Modal */}
      {selectedSupplier ? (
        <SupplierLedgerModal
          historyData={historyData}
          isLoading={isHistoryLoading}
          onClose={() => {
            setSelectedSupplier(null)
            setHistoryData(null)
          }}
          onEdit={(sup) => setEditing(sup)}
          supplier={selectedSupplier}
        />
      ) : null}
    </div>
  )
}
