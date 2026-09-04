import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Tag,
  UsersRound,
  X,
} from "lucide-react"

import { USER_ROLES } from "../../constants/roles"
import {
  createCustomer,
  getCustomerById,
  getCustomerHistory,
  getCustomers,
  updateCustomerById,
} from "../../features/customers/customers.api"
import SaleReceiptModal from "../../components/sales/SaleReceiptModal"
import JobOrderReceiptModal from "../../components/services/JobOrderReceiptModal"
import QuotationDetailDialog from "../../components/quotations/QuotationDetailDialog"

const CUSTOMER_MANAGER_ROLES = new Set([
  USER_ROLES.SUPER_OWNER,
  USER_ROLES.BRANCH_OWNER,
  USER_ROLES.ADMIN,
  USER_ROLES.CASHIER,
  USER_ROLES.TECHNICIAN,
])

const EMPTY_HISTORY = {
  summary: {
    quotationCount: 0,
    saleCount: 0,
    creditAccountCount: 0,
    serviceJobCount: 0,
    warrantyClaimCount: 0,
    totalLifetimeSpent: 0,
    completedSalesTotal: 0,
    completedServicesTotal: 0,
    outstandingCreditBalance: 0,
  },
  quotations: { items: [], totalItems: 0, limit: 50 },
  sales: { items: [], totalItems: 0, limit: 50 },
  serviceJobs: { items: [], totalItems: 0, limit: 50 },
  creditAccounts: { items: [], totalItems: 0, limit: 50 },
  warrantyClaims: { items: [], totalItems: 0, limit: 50 },
}

const STATUS_STYLES = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CONVERTED: "bg-emerald-50 text-emerald-700",
  PAID: "bg-emerald-50 text-emerald-700",
  POSTED: "bg-emerald-50 text-emerald-700",
  SENT: "bg-blue-50 text-blue-700",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700",
  UNPAID: "bg-amber-50 text-amber-700",
  DRAFT: "bg-slate-100 text-slate-700",
  INACTIVE: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-50 text-red-700",
  DEFAULTED: "bg-red-50 text-red-700",
  REFUNDED: "bg-red-50 text-red-700",
  PARTIALLY_REFUNDED: "bg-orange-50 text-orange-700",
}

function formatMoney(value) {
  const amount = Number(value ?? 0)

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

function formatStatus(status) {
  return String(status || "Unknown")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatWord(value) {
  return formatStatus(value)
}

function formatTerm(term) {
  if (!term) return "—"
  if (term === "STRAIGHT") return "Straight"

  const monthCount = String(term).replace("MONTH_", "")
  return `${monthCount} months`
}

function getApiErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    fallbackMessage
  )
}

function toNullableText(value) {
  const normalized = String(value ?? "").trim()
  return normalized || null
}

function StatusBadge({ status }) {
  const normalizedStatus = String(status || "UNKNOWN").toUpperCase()

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
        STATUS_STYLES[normalizedStatus] || "bg-slate-100 text-slate-700"
      }`}
    >
      {formatStatus(normalizedStatus)}
    </span>
  )
}

function ErrorBanner({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
      <AlertCircle className="mt-0.5 shrink-0" size={18} />
      <span>{children}</span>
    </div>
  )
}

function ModalFrame({ children, labelledBy, onClose, size = "max-w-3xl" }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
    >
      <section
        className={`max-h-[calc(100svh-2rem)] w-full ${size} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  )
}

function FormField({ children, label, required = false }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {children}
    </label>
  )
}

function CustomerEditorModal({ activeBranch, customer, mode, onClose, onSaved }) {
  const isEdit = mode === "edit"
  const [form, setForm] = useState(() => ({
    customerCode: customer?.customerCode || "",
    fullName: customer?.fullName || "",
    mobileNumber: customer?.mobileNumber || "",
    email: customer?.email || "",
    companyName: customer?.companyName || "",
    address: customer?.address || "",
    notes: customer?.notes || "",
    priceTier: customer?.priceTier ? String(customer.priceTier) : "1",
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const fullName = form.fullName.trim()
    const customerCode = form.customerCode.trim()

    if (!fullName) {
      setErrorMessage("Full name is required.")
      return
    }

    if (isEdit && !customerCode) {
      setErrorMessage("Customer code is required when editing a customer.")
      return
    }

    if (!isEdit && !activeBranch?.id) {
      setErrorMessage("Select a branch before creating a customer.")
      return
    }

    const payload = {
      fullName,
      mobileNumber: toNullableText(form.mobileNumber),
      email: toNullableText(form.email),
      companyName: toNullableText(form.companyName),
      address: toNullableText(form.address),
      notes: toNullableText(form.notes),
      priceTier: Number(form.priceTier) || 1,
    }

    if (customerCode) payload.customerCode = customerCode
    if (!isEdit) payload.branchId = activeBranch.id

    setIsSaving(true)
    setErrorMessage("")

    try {
      const response = isEdit
        ? await updateCustomerById(customer.id, payload)
        : await createCustomer(payload)
      const savedCustomer = response?.data

      if (!response?.success || !savedCustomer) {
        throw new Error("Invalid customer response")
      }

      onSaved(savedCustomer, isEdit ? "updated" : "created")
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          `Unable to ${isEdit ? "update" : "create"} the customer. Please try again.`,
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] hover:border-slate-300 placeholder:text-slate-400 placeholder:font-normal"

  return (
    <ModalFrame
      labelledBy="customer-editor-title"
      onClose={() => {
        if (!isSaving) onClose()
      }}
      size="max-w-2xl"
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              {isEdit ? "Customer Record" : "New Customer"}
            </span>
            <h2
              className="text-base font-black text-slate-900 leading-tight"
              id="customer-editor-title"
            >
              {isEdit ? `Edit ${customer.fullName}` : "Create Customer"}
            </h2>
            <p className="text-xs text-slate-500">
              Branch: {activeBranch?.code || customer?.branch?.code || "Not selected"}
            </p>
          </div>

          <button
            aria-label="Close customer form"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-3.5">
          {errorMessage ? <ErrorBanner>{errorMessage}</ErrorBanner> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Full name" required>
              <input
                autoFocus
                className={inputClass}
                maxLength={200}
                onChange={(event) => updateField("fullName", event.target.value)}
                placeholder="Customer full name"
                required
                value={form.fullName}
              />
            </FormField>

            <FormField label={isEdit ? "Customer code" : "Customer code (optional)"} required={isEdit}>
              <input
                className={`${inputClass} uppercase font-mono`}
                maxLength={80}
                onChange={(event) => updateField("customerCode", event.target.value)}
                placeholder={isEdit ? "Customer code" : "Auto-generated if blank"}
                required={isEdit}
                value={form.customerCode}
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Base Price Tier (Default for New Items)" required>
                <select
                  className={inputClass}
                  onChange={(event) => updateField("priceTier", event.target.value)}
                  value={form.priceTier}
                >
                  <option value="1">Price 1 (Standard / Retail)</option>
                  <option value="2">Price 2 (Wholesale / Regular)</option>
                  <option value="3">Price 3 (Special / Dealer)</option>
                  <option value="4">Price 4 (VIP / Partner)</option>
                  <option value="5">Price 5 (Special Project)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Default tier for new items. Specific item prices bought in POS are remembered automatically per customer.
                </p>
              </FormField>
            </div>

            <FormField label="Mobile number">
              <input
                className={inputClass}
                inputMode="tel"
                maxLength={50}
                onChange={(event) => updateField("mobileNumber", event.target.value)}
                placeholder="09xx xxx xxxx"
                type="tel"
                value={form.mobileNumber}
              />
            </FormField>

            <FormField label="Email">
              <input
                className={inputClass}
                maxLength={200}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="name@example.com"
                type="email"
                value={form.email}
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Company name">
                <input
                  className={inputClass}
                  maxLength={200}
                  onChange={(event) => updateField("companyName", event.target.value)}
                  placeholder="Optional business or company name"
                  value={form.companyName}
                />
              </FormField>
            </div>

            <div className="sm:col-span-2">
              <FormField label="Address">
                <textarea
                  className={`${inputClass} min-h-[50px] h-[50px] resize-none`}
                  maxLength={500}
                  onChange={(event) => updateField("address", event.target.value)}
                  placeholder="Customer address"
                  value={form.address}
                />
              </FormField>
            </div>

            <div className="sm:col-span-2">
              <FormField label="Internal notes">
                <textarea
                  className={`${inputClass} min-h-[50px] h-[50px] resize-none`}
                  maxLength={1000}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder="Optional notes for staff reference…"
                  value={form.notes}
                />
              </FormField>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-60"
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
            {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}

function CustomerStatusDialog({ customer, onClose, onSaved, targetStatus }) {
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const isDeactivation = targetStatus === "INACTIVE"

  const confirmStatusChange = async () => {
    setIsSaving(true)
    setErrorMessage("")

    try {
      const response = await updateCustomerById(customer.id, { status: targetStatus })
      const updatedCustomer = response?.data

      if (!response?.success || !updatedCustomer) {
        throw new Error("Invalid customer response")
      }

      onSaved(updatedCustomer, targetStatus)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to update the customer status. Please try again."),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ModalFrame
      labelledBy="customer-status-title"
      onClose={() => {
        if (!isSaving) onClose()
      }}
      size="max-w-md"
    >
      <div>
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Customer Status</span>
            <h2
              className="text-base font-black text-slate-900 leading-tight"
              id="customer-status-title"
            >
              {isDeactivation ? "Deactivate Customer?" : "Reactivate Customer?"}
            </h2>
          </div>
          <button
            aria-label="Close status confirmation"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs leading-5 text-slate-600">
            <strong className="text-slate-900">{customer.fullName}</strong>{" "}
            will be marked {formatStatus(targetStatus).toLowerCase()}.
            {isDeactivation
              ? " Existing quotations, sales, and credit history remain unchanged and fully auditable."
              : " The customer can be selected again in supported workflows."}
          </p>

          {errorMessage ? <ErrorBanner>{errorMessage}</ErrorBanner> : null}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-60"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 ${
              isDeactivation
                ? "bg-red-700 hover:bg-red-800"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
            disabled={isSaving}
            onClick={confirmStatusChange}
            type="button"
          >
            {isSaving
              ? "Updating…"
              : isDeactivation
                ? "Deactivate Customer"
                : "Reactivate Customer"}
          </button>
        </div>
      </div>
    </ModalFrame>
  )
}

function DetailValue({ children, icon: Icon, label }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <Icon size={13} />
        <span>{label}</span>
      </div>
      <div className="mt-1 break-words font-bold text-slate-900">
        {children || "—"}
      </div>
    </div>
  )
}

function EmptyHistory({ label }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-slate-200 p-6 text-center">
      <ClipboardList className="text-slate-400" size={28} />
      <p className="mt-2 text-xs font-bold text-slate-800">No {label} yet</p>
      <p className="text-[11px] text-slate-500">
        Activity linked to this customer will appear here.
      </p>
    </div>
  )
}

function QuotationHistory({ data, onViewQuotation }) {
  const items = Array.isArray(data?.items) ? data.items : []

  if (items.length === 0) return <EmptyHistory label="quotation history" />

  return (
    <div className="space-y-2.5">
      {items.map((quotation) => (
        <article
          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs space-y-2 hover:border-slate-300 transition"
          key={quotation.id}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <button
                className="font-bold text-[var(--color-maroon)] hover:underline text-left text-sm"
                onClick={() => onViewQuotation?.(quotation)}
                type="button"
              >
                {quotation.quotationCode}
              </button>
              <p className="mt-0.5 text-slate-500">
                {quotation.title || "Quotation"} · {formatDate(quotation.createdAt, true)}
              </p>
              <p className="text-[11px] font-medium text-slate-500">
                Prepared by {quotation.preparedBy?.fullName || "Unassigned"}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <StatusBadge status={quotation.status} />
                <p className="font-mono font-bold text-slate-900 text-sm">
                  {formatMoney(quotation.grandTotal)}
                </p>
              </div>
              <button
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-black shadow-xs transition"
                onClick={() => onViewQuotation?.(quotation)}
                type="button"
              >
                <FileText size={12} /> View Quotation
              </button>
            </div>
          </div>

          {Array.isArray(quotation.items) && quotation.items.length > 0 ? (
            <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 bg-slate-100/70 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                Quoted Items ({quotation.items.length})
              </div>
              <div className="divide-y divide-slate-200 text-xs">
                {quotation.items.map((line, idx) => (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5" key={line.id || idx}>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-800">
                        {line.quantity}× {line.description}
                      </span>
                      {line.warrantyDuration ? (
                        <span className="ml-2 inline-block rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {line.warrantyDuration}
                        </span>
                      ) : null}
                      {line.priceTier ? (
                        <span className="ml-1 text-[10px] font-semibold text-slate-500">
                          (Price {line.priceTier})
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right font-mono font-medium text-slate-900">
                      {formatMoney(line.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      ))}
      {data.totalItems > items.length ? (
        <p className="text-center text-[11px] font-semibold text-slate-500">
          Showing the latest {items.length} of {data.totalItems} quotations.
        </p>
      ) : null}
    </div>
  )
}

function SalesHistory({ data, onViewSale }) {
  const items = Array.isArray(data?.items) ? data.items : []

  if (items.length === 0) return <EmptyHistory label="sales history" />

  return (
    <div className="space-y-2.5">
      {items.map((sale) => (
        <article
          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs space-y-2 hover:border-slate-300 transition"
          key={sale.id}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <button
                className="font-bold text-[var(--color-maroon)] hover:underline text-left text-sm"
                onClick={() => onViewSale?.(sale)}
                type="button"
              >
                {sale.receiptCode || sale.saleCode}
              </button>
              <p className="mt-0.5 text-slate-500">
                {formatDate(sale.saleDate, true)} · Cashier: {sale.cashier?.fullName || "Unassigned"}
              </p>
              {sale.quotation?.quotationCode ? (
                <p className="text-[11px] font-medium text-slate-500">
                  From quotation {sale.quotation.quotationCode}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col sm:items-end gap-1.5">
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                <StatusBadge status={sale.status} />
                <StatusBadge status={sale.paymentStatus} />
              </div>
              <p className="font-mono font-bold text-slate-900 text-sm">
                {formatMoney(sale.grandTotal)}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-medium text-slate-500">
                  Paid {formatMoney(sale.amountPaid)}
                </p>
                <button
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-maroon)] text-white px-2.5 py-1 text-[11px] font-bold hover:bg-[var(--color-maroon-hover)] shadow-xs transition"
                  onClick={() => onViewSale?.(sale)}
                  type="button"
                >
                  <Printer size={12} /> View Receipt
                </button>
              </div>
            </div>
          </div>

          {Array.isArray(sale.items) && sale.items.length > 0 ? (
            <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 bg-slate-100/70 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                Purchased Items ({sale.items.length})
              </div>
              <div className="divide-y divide-slate-200 text-xs">
                {sale.items.map((line, idx) => (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5" key={line.id || idx}>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-800">
                        {line.quantity}× {line.description}
                      </span>
                      {line.serial?.serialNumber ? (
                        <span className="ml-2 inline-block rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
                          S/N: {line.serial.serialNumber}
                        </span>
                      ) : null}
                      {line.warrantyDuration ? (
                        <span className="ml-1.5 inline-block rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {line.warrantyDuration}
                        </span>
                      ) : null}
                      {line.priceTier ? (
                        <span className="ml-1 text-[10px] font-semibold text-slate-500">
                          (Price {line.priceTier})
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right font-mono font-medium text-slate-900">
                      {formatMoney(line.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      ))}
      {data.totalItems > items.length ? (
        <p className="text-center text-[11px] font-semibold text-slate-500">
          Showing the latest {items.length} of {data.totalItems} sales.
        </p>
      ) : null}
    </div>
  )
}

function CreditHistory({ data }) {
  const items = Array.isArray(data?.items) ? data.items : []

  if (items.length === 0) return <EmptyHistory label="credit history" />

  return (
    <div className="space-y-2.5">
      {items.map((account) => {
        const collections = Array.isArray(account.collections) ? account.collections : []

        return (
          <article
            className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs"
            key={account.id}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-bold text-slate-900">{account.creditCode}</p>
                <p className="mt-0.5 text-slate-500">
                  {formatTerm(account.term)} · Opened {formatDate(account.createdAt)}
                </p>
                {account.sale?.receiptCode ? (
                  <p className="text-[11px] font-medium text-slate-500">
                    Sale {account.sale.receiptCode}
                  </p>
                ) : null}
              </div>
              <div className="sm:text-right">
                <StatusBadge status={account.status} />
                <p className="mt-1 font-mono font-bold text-slate-900">
                  {formatMoney(account.balanceAmount)}
                </p>
                <p className="text-[11px] text-slate-500">
                  Principal {formatMoney(account.principalAmount)}
                </p>
              </div>
            </div>

            {collections.length > 0 ? (
              <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-200 bg-slate-100/70 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                  Payment Collections ({collections.length})
                </div>
                <div className="divide-y divide-slate-200 text-xs">
                  {collections.map((coll) => (
                    <div className="flex items-center justify-between px-3 py-1.5" key={coll.id}>
                      <div>
                        <span className="font-semibold text-slate-800">
                          {coll.receiptCode || "Payment"}
                        </span>
                        <span className="ml-2 text-[11px] text-slate-500">
                          {formatDate(coll.collectionDate || coll.createdAt)}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-emerald-700">
                        {formatMoney(coll.amountPaid)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

function ServiceJobHistory({ data, onViewJob }) {
  const items = Array.isArray(data?.items) ? data.items : []

  if (items.length === 0) return <EmptyHistory label="service & repair history" />

  return (
    <div className="space-y-2.5">
      {items.map((job) => (
        <article
          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs space-y-2 hover:border-slate-300 transition"
          key={job.id}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="font-bold text-blue-700 hover:underline text-left text-sm"
                  onClick={() => onViewJob?.(job)}
                  type="button"
                >
                  {job.jobCode}
                </button>
                {job.isQuickService ? (
                  <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[9px] font-black text-amber-800 uppercase">
                    ⚡ Quick Service
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-slate-800 font-bold">
                {job.jobTitle || job.deviceDescription || "Service Repair"}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Received: {formatDate(job.receivedAt, true)}
                {job.assignedTechnician?.fullName ? ` · Tech: ${job.assignedTechnician.fullName}` : ""}
              </p>
            </div>
            <div className="sm:text-right flex flex-col sm:items-end gap-1">
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                <StatusBadge status={job.status} />
                {job.releaseOutcome ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                    {formatWord(job.releaseOutcome)}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 font-mono font-black text-slate-900 text-sm">
                {formatMoney(job.finalServiceCharge)}
              </p>
              <div className="flex items-center gap-2">
                {job.releasedAt ? (
                  <p className="text-[10px] text-emerald-700 font-semibold">
                    Released {formatDate(job.releasedAt)}
                  </p>
                ) : null}
                <button
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-700 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-blue-800 shadow-xs transition"
                  onClick={() => onViewJob?.(job)}
                  type="button"
                >
                  <Printer size={12} /> View Job Order
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 grid gap-1.5 sm:grid-cols-2 text-[11px]">
            {job.deviceDescription ? (
              <div>
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Unit / Device:</span>
                <span className="font-semibold text-slate-800">{job.deviceDescription}</span>
                {job.serialNumber ? (
                  <span className="ml-1 font-mono text-slate-500">({job.serialNumber})</span>
                ) : null}
              </div>
            ) : null}
            {job.problemDescription ? (
              <div>
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Problem / Defect:</span>
                <span className="font-semibold text-slate-800">{job.problemDescription}</span>
              </div>
            ) : null}
            {job.diagnosis ? (
              <div className="sm:col-span-2">
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Diagnosis:</span>
                <span className="text-slate-700">{job.diagnosis}</span>
              </div>
            ) : null}
            {job.serviceNotes ? (
              <div className="sm:col-span-2">
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Service Notes:</span>
                <span className="text-slate-700">{job.serviceNotes}</span>
              </div>
            ) : null}
          </div>

          {Array.isArray(job.payments) && job.payments.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-[10px]">
              <span className="font-bold text-slate-400">Payments:</span>
              {job.payments.map((p) => (
                <span key={p.id} className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-emerald-800 font-bold">
                  {p.paymentMethod || "Payment"}: {formatMoney(p.amount)} ({p.status})
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
      {data.totalItems > items.length ? (
        <p className="text-center text-[11px] font-semibold text-slate-400">
          Showing latest {items.length} of {data.totalItems} service jobs.
        </p>
      ) : null}
    </div>
  )
}

function WarrantyClaimHistory({ data }) {
  const items = Array.isArray(data?.items) ? data.items : []

  if (items.length === 0) return <EmptyHistory label="warranty claim history" />

  return (
    <div className="space-y-2.5">
      {items.map((claim) => (
        <article
          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs space-y-2 hover:border-slate-300 transition"
          key={claim.id}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-bold text-[var(--color-maroon)]">{claim.claimCode}</p>
              <p className="mt-0.5 text-slate-800 font-bold">
                {claim.item?.itemName || claim.item?.name || "Product Item"}
                {claim.serial?.serialNumber ? (
                  <span className="ml-2 font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                    S/N: {claim.serial.serialNumber}
                  </span>
                ) : null}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Claim Filed: {formatDate(claim.receivedAt, true)}
                {claim.sale?.receiptCode ? ` · From Sale: ${claim.sale.receiptCode}` : ""}
              </p>
            </div>
            <div className="sm:text-right flex flex-col sm:items-end">
              <StatusBadge status={claim.status} />
              {claim.releasedAt ? (
                <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                  Released {formatDate(claim.releasedAt)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 grid gap-1.5 sm:grid-cols-2 text-[11px]">
            <div>
              <span className="font-bold text-slate-400 uppercase text-[9px] block">Reported Defect:</span>
              <span className="font-semibold text-slate-800">{claim.issueDescription || claim.customerComplaint || "—"}</span>
            </div>
            {claim.diagnosis ? (
              <div>
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Diagnosis:</span>
                <span className="text-slate-700">{claim.diagnosis}</span>
              </div>
            ) : null}
            {claim.actionTaken ? (
              <div className="sm:col-span-2">
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Resolution / Action:</span>
                <span className="font-semibold text-emerald-800">{claim.actionTaken}</span>
              </div>
            ) : null}
          </div>
        </article>
      ))}
      {data.totalItems > items.length ? (
        <p className="text-center text-[11px] font-semibold text-slate-400">
          Showing latest {items.length} of {data.totalItems} warranty claims.
        </p>
      ) : null}
    </div>
  )
}


function CustomerDetailModal({
  canManage,
  customer: initialCustomer,
  onClose,
  onEdit,
  onRequestStatus,
  refreshKey,
}) {
  const [customer, setCustomer] = useState(initialCustomer)
  const [history, setHistory] = useState(EMPTY_HISTORY)
  const [activeTab, setActiveTab] = useState("sales")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [previewSale, setPreviewSale] = useState(null)
  const [previewJob, setPreviewJob] = useState(null)
  const [previewQuotation, setPreviewQuotation] = useState(null)
  const requestIdRef = useRef(0)

  const loadCustomer = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    setErrorMessage("")

    try {
      const [customerResponse, historyResponse] = await Promise.all([
        getCustomerById(initialCustomer.id),
        getCustomerHistory(initialCustomer.id, { limit: 50 }),
      ])

      if (requestId !== requestIdRef.current) return

      if (!customerResponse?.success || !customerResponse?.data) {
        throw new Error("Invalid customer response")
      }

      setCustomer(customerResponse.data)
      setHistory(historyResponse?.success && historyResponse?.data ? historyResponse.data : EMPTY_HISTORY)
    } catch (error) {
      if (requestId !== requestIdRef.current) return

      setErrorMessage(
        getApiErrorMessage(error, "Unable to load this customer and their history."),
      )
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [initialCustomer.id])

  useEffect(() => {
    const timer = window.setTimeout(loadCustomer, 0)

    return () => {
      window.clearTimeout(timer)
      requestIdRef.current += 1
    }
  }, [loadCustomer, refreshKey])

  const summary = history?.summary || EMPTY_HISTORY.summary
  const tabs = [
    { id: "sales", label: "Purchases & Invoices", icon: "🛒", count: summary.saleCount || 0 },
    { id: "services", label: "Services & Repairs", icon: "🛠️", count: summary.serviceJobCount || 0 },
    { id: "quotations", label: "Quotations", icon: "📄", count: summary.quotationCount || 0 },
    { id: "credits", label: "Credit Accounts", icon: "💳", count: summary.creditAccountCount || 0 },
    { id: "warranty", label: "Warranty Claims", icon: "🛡️", count: summary.warrantyClaimCount || 0 },
  ]

  return (
    <>
      <ModalFrame labelledBy="customer-detail-title" onClose={onClose} size="max-w-4xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Customer Ledger</span>
              <StatusBadge status={customer.status} />
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                Price Tier {customer.priceTier || 1}
              </span>
            </div>
            <h2
              className="mt-0.5 truncate text-base font-black text-slate-900 leading-tight"
              id="customer-detail-title"
            >
              {customer.fullName}
            </h2>
            {customer.companyName ? (
              <p className="text-xs text-slate-500 font-medium">
                {customer.companyName}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              aria-label="Refresh customer details"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              disabled={isLoading}
              onClick={loadCustomer}
              type="button"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={15} />
            </button>
            {canManage ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                onClick={() => onEdit(customer)}
                type="button"
              >
                <Edit3 size={14} />
                Edit
              </button>
            ) : null}
            <button
              aria-label="Close customer details"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              onClick={onClose}
              type="button"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
          {errorMessage ? (
            <div className="space-y-2">
              <ErrorBanner>{errorMessage}</ErrorBanner>
              <button
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                onClick={loadCustomer}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : null}

          {/* Customer Profile Contact Strip */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <DetailValue icon={Building2} label="Branch">
              {customer.branch?.name
                ? `${customer.branch.code} · ${customer.branch.name}`
                : customer.branch?.code || "—"}
            </DetailValue>
            <DetailValue icon={Tag} label="Price Tier">
              Price Tier {customer.priceTier || 1}
            </DetailValue>
            <DetailValue icon={Phone} label="Mobile number">
              {customer.mobileNumber || "—"}
            </DetailValue>
            <DetailValue icon={Mail} label="Email">
              {customer.email || "—"}
            </DetailValue>
            <DetailValue icon={Building2} label="Company">
              {customer.companyName || "—"}
            </DetailValue>
            <div className="sm:col-span-1 lg:col-span-1">
              <DetailValue icon={MapPin} label="Address">
                {customer.address || "—"}
              </DetailValue>
            </div>
          </div>

          {customer.notes ? (
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Internal notes
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
                {customer.notes}
              </p>
            </div>
          ) : null}

          {/* 360-Degree Lifetime Activity Stats */}
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-red-50/30 p-3 shadow-2xs">
              <p className="text-[10px] font-black uppercase text-slate-400">Total Lifetime Spent</p>
              <p className="mt-0.5 text-lg font-black text-[var(--color-maroon)]">
                {formatMoney(summary.totalLifetimeSpent || 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <p className="text-[10px] font-black uppercase text-slate-400">Purchases / Sales</p>
              <p className="mt-0.5 text-base font-bold text-slate-900">
                {summary.saleCount || 0} sale(s)
              </p>
              <p className="text-[11px] text-slate-500 font-semibold">{formatMoney(summary.completedSalesTotal || 0)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <p className="text-[10px] font-black uppercase text-slate-400">Repairs & Services</p>
              <p className="mt-0.5 text-base font-bold text-slate-900">
                {summary.serviceJobCount || 0} job(s)
              </p>
              <p className="text-[11px] text-slate-500 font-semibold">{formatMoney(summary.completedServicesTotal || 0)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <p className="text-[10px] font-black uppercase text-slate-400">Outstanding Credit</p>
              <p className="mt-0.5 text-base font-mono font-bold text-slate-900">
                {formatMoney(summary.outstandingCreditBalance)}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold">{summary.creditAccountCount || 0} account(s)</p>
            </div>
          </div>

          {/* Transaction History Tabs */}
          <section className="space-y-3">
            <div className="flex max-w-full gap-1.5 overflow-x-auto border-b border-slate-200 pb-2">
              {tabs.map((tab) => (
                <button
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    activeTab === tab.id
                      ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.icon} {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="mt-3">
              {errorMessage ? null : isLoading ? (
                <div className="rounded-xl bg-slate-50 p-6 text-xs font-semibold text-slate-500 text-center">
                  Loading complete customer transaction records…
                </div>
              ) : activeTab === "sales" ? (
                <SalesHistory data={history.sales} onViewSale={setPreviewSale} />
              ) : activeTab === "services" ? (
                <ServiceJobHistory data={history.serviceJobs} onViewJob={setPreviewJob} />
              ) : activeTab === "quotations" ? (
                <QuotationHistory data={history.quotations} onViewQuotation={setPreviewQuotation} />
              ) : activeTab === "credits" ? (
                <CreditHistory data={history.creditAccounts} />
              ) : (
                <WarrantyClaimHistory data={history.warrantyClaims} />
              )}
            </div>
          </section>

          <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="text-slate-500 text-[11px]">
              <p>Created {formatDate(customer.createdAt, true)}</p>
              <p>
                Last updated {formatDate(customer.updatedAt, true)}
                {customer.updatedBy?.fullName ? ` by ${customer.updatedBy.fullName}` : ""}
              </p>
            </div>
            {canManage ? (
              <button
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                  customer.status === "ACTIVE"
                    ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
                    : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                }`}
                onClick={() =>
                  onRequestStatus(customer, customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")
                }
                type="button"
              >
                {customer.status === "ACTIVE" ? "Deactivate Customer" : "Reactivate Customer"}
              </button>
            ) : null}
          </div>
        </div>
      </ModalFrame>

      {/* Official Receipt & Document Modals */}
      {previewSale ? (
        <SaleReceiptModal
          onClose={() => setPreviewSale(null)}
          sale={previewSale}
          saleId={previewSale.id}
        />
      ) : null}

      {previewJob ? (
        <JobOrderReceiptModal
          job={previewJob}
          jobId={previewJob.id}
          onClose={() => setPreviewJob(null)}
        />
      ) : null}

      {previewQuotation ? (
        <QuotationDetailDialog
          onClose={() => setPreviewQuotation(null)}
          quotation={previewQuotation}
        />
      ) : null}
    </>
  )
}

function CustomerMobileCard({ canManage, customer, onEdit, onRequestStatus, onView }) {
  return (
    <article className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-bold text-[var(--color-text-strong)]">
            {customer.fullName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
              Price {customer.priceTier || 1}
            </span>
          </div>
        </div>
        <StatusBadge status={customer.status} />
      </div>

      <div className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
        <p className="flex items-start gap-2">
          <Phone className="mt-0.5 shrink-0" size={15} />
          <span className="break-all">{customer.mobileNumber || "No mobile number"}</span>
        </p>
        <p className="flex items-start gap-2">
          <Mail className="mt-0.5 shrink-0" size={15} />
          <span className="break-all">{customer.email || "No email"}</span>
        </p>
        <p className="flex items-start gap-2">
          <Building2 className="mt-0.5 shrink-0" size={15} />
          <span className="break-words">
            {customer.companyName || "No company"} · {customer.branch?.code || "No branch"}
          </span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] px-3 py-2.5 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
          onClick={() => onView(customer)}
          type="button"
        >
          <Eye size={15} />
          View
        </button>
        {canManage ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] px-3 py-2.5 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
            onClick={() => onEdit(customer)}
            type="button"
          >
            <Edit3 size={15} />
            Edit
          </button>
        ) : null}
        {canManage ? (
          <button
            className={`col-span-2 rounded-2xl border px-3 py-2.5 text-sm font-bold transition ${
              customer.status === "ACTIVE"
                ? "border-red-200 text-red-700 hover:bg-red-50"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            }`}
            onClick={() =>
              onRequestStatus(customer, customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")
            }
            type="button"
          >
            {customer.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
          </button>
        ) : null}
      </div>
    </article>
  )
}

function CustomersPage({ selectedBranch, user }) {
  const [customers, setCustomers] = useState([])
  const [pagination, setPagination] = useState(null)
  const [searchText, setSearchText] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [noticeMessage, setNoticeMessage] = useState("")
  const [editor, setEditor] = useState(null)
  const [detailCustomer, setDetailCustomer] = useState(null)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const [statusRequest, setStatusRequest] = useState(null)
  const requestIdRef = useRef(0)
  const pageSize = 10

  const activeBranch = selectedBranch || user?.branch || null
  const activeBranchId = activeBranch?.id
  const canManage = useMemo(
    () => CUSTOMER_MANAGER_ROLES.has(user?.role),
    [user?.role],
  )

  const loadCustomers = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    setErrorMessage("")

    try {
      const params = {
        page,
        limit: pageSize,
      }

      if (activeBranchId) params.branchId = activeBranchId
      if (searchText.trim()) params.search = searchText.trim()
      if (statusFilter) params.status = statusFilter

      const response = await getCustomers(params)

      if (requestId !== requestIdRef.current) return

      const result = response?.data

      if (!response?.success || !result) {
        throw new Error("Invalid customer response")
      }

      if (result.pagination && page > result.pagination.totalPages) {
        setCustomers([])
        setPagination(result.pagination)
        setPage(Math.max(1, result.pagination.totalPages))
        return
      }

      setCustomers(Array.isArray(result.items) ? result.items : [])
      setPagination(result.pagination || null)
    } catch (error) {
      if (requestId !== requestIdRef.current) return

      setCustomers([])
      setPagination(null)
      setErrorMessage(
        getApiErrorMessage(error, "Unable to load customers right now. Please try again."),
      )
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [activeBranchId, page, searchText, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(loadCustomers, searchText.trim() ? 300 : 0)

    return () => {
      window.clearTimeout(timer)
      requestIdRef.current += 1
    }
  }, [loadCustomers, searchText])

  const openEditor = (mode, customer = null) => {
    setEditor({ mode, customer, key: `${mode}-${customer?.id || Date.now()}` })
  }

  const handleSavedCustomer = (savedCustomer, action) => {
    setEditor(null)
    setCustomers((current) =>
      current.map((customer) => (customer.id === savedCustomer.id ? savedCustomer : customer)),
    )

    if (detailCustomer?.id === savedCustomer.id) {
      setDetailCustomer(savedCustomer)
      setDetailRefreshKey((current) => current + 1)
    }

    setNoticeMessage(
      action === "created"
        ? `${savedCustomer.fullName} was created successfully.`
        : `${savedCustomer.fullName} was updated successfully.`,
    )

    if (action === "created" && page !== 1) {
      setPage(1)
    } else {
      loadCustomers()
    }
  }

  const handleSavedStatus = (savedCustomer, targetStatus) => {
    setStatusRequest(null)
    setCustomers((current) =>
      current.map((customer) => (customer.id === savedCustomer.id ? savedCustomer : customer)),
    )

    if (detailCustomer?.id === savedCustomer.id) {
      setDetailCustomer(savedCustomer)
      setDetailRefreshKey((current) => current + 1)
    }

    setNoticeMessage(
      `${savedCustomer.fullName} is now ${formatStatus(targetStatus).toLowerCase()}.`,
    )
    loadCustomers()
  }

  const clearFilters = () => {
    setSearchText("")
    setStatusFilter("")
    setPage(1)
  }

  const totalPages = pagination?.totalPages || 1
  const totalItems = pagination?.totalItems ?? customers.length
  const hasFilters = Boolean(searchText.trim() || statusFilter)

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-accent)]">Customers</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
            Customer directory
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
            Maintain customer contact details and review linked quotations, sales, and credit history.
          </p>
          {activeBranch ? (
            <p className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--color-soft)] px-3 py-1.5 text-xs font-bold text-[var(--color-muted)]">
              <Building2 className="shrink-0" size={14} />
              <span className="truncate">
                {activeBranch.code} · {activeBranch.name}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)] disabled:opacity-60"
            disabled={isLoading}
            onClick={loadCustomers}
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
            Refresh
          </button>
          {canManage ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#7A1F2B] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#641824] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!activeBranch?.id}
              onClick={() => openEditor("create")}
              type="button"
            >
              <Plus size={17} />
              New customer
            </button>
          ) : null}
        </div>
      </div>

      {noticeMessage ? (
        <section className="flex items-start justify-between gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">
          <span>{noticeMessage}</span>
          <button
            aria-label="Dismiss message"
            className="shrink-0 rounded-lg p-1 transition hover:bg-emerald-100"
            onClick={() => setNoticeMessage("")}
            type="button"
          >
            <X size={16} />
          </button>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Search
            </span>
            <span className="relative mt-2 block">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                size={18}
              />
              <input
                className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] py-3 pl-11 pr-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                onChange={(event) => {
                  setSearchText(event.target.value)
                  setPage(1)
                }}
                placeholder="Code, name, mobile, email, or company"
                value={searchText}
              />
            </span>
          </label>

          <label className="lg:w-56">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Status
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              value={statusFilter}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row lg:pb-0">
            <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-muted)]">
              {totalItems} customer(s)
            </div>
            <button
              className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasFilters}
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="space-y-3 rounded-3xl border border-red-200 bg-red-50 p-5">
          <ErrorBanner>{errorMessage}</ErrorBanner>
          <button
            className="rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
            onClick={loadCustomers}
            type="button"
          >
            Try again
          </button>
        </section>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        {isLoading ? (
          <div className="p-6 text-sm font-semibold text-[var(--color-muted)]">
            Loading customers... Please wait.
          </div>
        ) : customers.length === 0 ? (
          <div className="grid place-items-center p-8 text-center">
            <UsersRound className="text-[var(--color-muted)]" size={40} />
            <p className="mt-3 font-bold text-[var(--color-text-strong)]">
              {hasFilters ? "No matching customers found" : "No customers yet"}
            </p>
            <p className="mt-1 max-w-md text-sm leading-6 text-[var(--color-muted)]">
              {hasFilters
                ? "Try a different search or clear the status filter."
                : canManage
                  ? "Create the first customer for this branch. Walk-in transactions can still proceed without one."
                  : "Customer records for this branch will appear here when available."}
            </p>
            {canManage && !hasFilters ? (
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#7A1F2B] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#641824] disabled:opacity-60"
                disabled={!activeBranch?.id}
                onClick={() => openEditor("create")}
                type="button"
              >
                <Plus size={16} />
                Create customer
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {customers.map((customer) => (
                    <tr className="align-top transition hover:bg-[var(--color-soft)]" key={customer.id}>
                      <td className="min-w-52 px-4 py-4">
                        <p className="font-bold text-[var(--color-text-strong)]">
                          {customer.fullName}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                            Price {customer.priceTier || 1}
                          </span>
                        </div>
                      </td>
                      <td className="min-w-52 px-4 py-4 text-[var(--color-muted)]">
                        <p className="break-all">{customer.mobileNumber || "—"}</p>
                        <p className="mt-1 break-all text-xs">{customer.email || "—"}</p>
                      </td>
                      <td className="min-w-40 px-4 py-4 text-[var(--color-muted)]">
                        {customer.companyName || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                        {customer.branch?.code || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <StatusBadge status={customer.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-[var(--color-muted)]">
                        {formatDate(customer.updatedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                            onClick={() => setDetailCustomer(customer)}
                            type="button"
                          >
                            <Eye size={14} />
                            View
                          </button>
                          {canManage ? (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                              onClick={() => openEditor("edit", customer)}
                              type="button"
                            >
                              <Edit3 size={14} />
                              Edit
                            </button>
                          ) : null}
                          {canManage ? (
                            <button
                              className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                                customer.status === "ACTIVE"
                                  ? "border-red-200 text-red-700 hover:bg-red-50"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              }`}
                              onClick={() =>
                                setStatusRequest({
                                  customer,
                                  targetStatus:
                                    customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                                })
                              }
                              type="button"
                            >
                              {customer.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 lg:hidden">
              {customers.map((customer) => (
                <CustomerMobileCard
                  canManage={canManage}
                  customer={customer}
                  key={customer.id}
                  onEdit={(selectedCustomer) => openEditor("edit", selectedCustomer)}
                  onRequestStatus={(selectedCustomer, targetStatus) =>
                    setStatusRequest({ customer: selectedCustomer, targetStatus })
                  }
                  onView={setDetailCustomer}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {!isLoading && customers.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-[var(--color-muted)]">
            Page {pagination?.page || page} of {totalPages} · {totalItems} customer(s)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!pagination?.hasPreviousPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!pagination?.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
      ) : null}

      {editor ? (
        <CustomerEditorModal
          activeBranch={activeBranch || editor.customer?.branch}
          customer={editor.customer}
          key={editor.key}
          mode={editor.mode}
          onClose={() => setEditor(null)}
          onSaved={handleSavedCustomer}
        />
      ) : null}

      {detailCustomer ? (
        <CustomerDetailModal
          canManage={canManage}
          customer={detailCustomer}
          onClose={() => setDetailCustomer(null)}
          onEdit={(customer) => {
            setDetailCustomer(null)
            openEditor("edit", customer)
          }}
          onRequestStatus={(customer, targetStatus) => {
            setDetailCustomer(null)
            setStatusRequest({ customer, targetStatus })
          }}
          refreshKey={detailRefreshKey}
        />
      ) : null}

      {statusRequest ? (
        <CustomerStatusDialog
          customer={statusRequest.customer}
          key={`${statusRequest.customer.id}-${statusRequest.targetStatus}`}
          onClose={() => setStatusRequest(null)}
          onSaved={handleSavedStatus}
          targetStatus={statusRequest.targetStatus}
        />
      ) : null}
    </div>
  )
}

export default CustomersPage
