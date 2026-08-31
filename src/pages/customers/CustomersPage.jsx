import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  Mail,
  MapPin,
  Phone,
  Plus,
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
    outstandingCreditBalance: 0,
  },
  quotations: { items: [], totalItems: 0, limit: 10 },
  sales: { items: [], totalItems: 0, limit: 10 },
  creditAccounts: { items: [], totalItems: 0, limit: 10 },
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
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 px-3 py-5 sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
    >
      <section
        className={`max-h-[calc(100svh-2.5rem)] w-full ${size} overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-white shadow-card`}
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
      <span className="text-sm font-bold text-[var(--color-text-strong)]">
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

  return (
    <ModalFrame
      labelledBy="customer-editor-title"
      onClose={() => {
        if (!isSaving) onClose()
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-accent)]">
              {isEdit ? "Customer record" : "New customer"}
            </p>
            <h2
              className="mt-1 text-xl font-bold text-[var(--color-text-strong)]"
              id="customer-editor-title"
            >
              {isEdit ? `Edit ${customer.fullName}` : "Create customer"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Branch: {activeBranch?.code || customer?.branch?.code || "Not selected"}
            </p>
          </div>

          <button
            aria-label="Close customer form"
            className="rounded-2xl border border-[var(--color-border)] p-2 text-[var(--color-muted)] transition hover:bg-[var(--color-soft)]"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {errorMessage ? <ErrorBanner>{errorMessage}</ErrorBanner> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" required>
              <input
                autoFocus
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                maxLength={200}
                onChange={(event) => updateField("fullName", event.target.value)}
                placeholder="Customer name"
                required
                value={form.fullName}
              />
            </FormField>

            <FormField label={isEdit ? "Customer code (system reference)" : "Customer code (optional)"} required={isEdit}>
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold uppercase text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                maxLength={80}
                onChange={(event) => updateField("customerCode", event.target.value)}
                placeholder={isEdit ? "Customer code" : "Auto-generated if left blank"}
                required={isEdit}
                value={form.customerCode}
              />
            </FormField>

            <FormField label="Assigned Price Number / Tier" required>
              <select
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                onChange={(event) => updateField("priceTier", event.target.value)}
                value={form.priceTier}
              >
                <option value="1">Price 1 (Standard / Retail)</option>
                <option value="2">Price 2 (Wholesale / Regular)</option>
                <option value="3">Price 3 (Special / Dealer)</option>
                <option value="4">Price 4 (VIP / Partner)</option>
                <option value="5">Price 5 (Special Project)</option>
              </select>
            </FormField>

            <FormField label="Mobile number">
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
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
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
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
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                  maxLength={200}
                  onChange={(event) => updateField("companyName", event.target.value)}
                  placeholder="Optional business or organization"
                  value={form.companyName}
                />
              </FormField>
            </div>

            <div className="sm:col-span-2">
              <FormField label="Address">
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
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
                  className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                  maxLength={1000}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder="Optional notes for staff"
                  value={form.notes}
                />
              </FormField>
            </div>
          </div>

          {!isEdit && !form.customerCode.trim() ? (
            <p className="rounded-2xl bg-[var(--color-soft)] p-4 text-sm leading-6 text-[var(--color-muted)]">
              The next customer code for this branch will be generated automatically.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            className="rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:opacity-60"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-2xl bg-[#7A1F2B] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#641824] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : isEdit ? "Save changes" : "Create customer"}
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
      size="max-w-lg"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[var(--color-accent)]">Customer status</p>
            <h2
              className="mt-1 text-xl font-bold text-[var(--color-text-strong)]"
              id="customer-status-title"
            >
              {isDeactivation ? "Deactivate customer?" : "Reactivate customer?"}
            </h2>
          </div>
          <button
            aria-label="Close status confirmation"
            className="rounded-2xl border border-[var(--color-border)] p-2 text-[var(--color-muted)] transition hover:bg-[var(--color-soft)]"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
          <span className="font-bold text-[var(--color-text-strong)]">{customer.fullName}</span>{" "}
          will be marked {formatStatus(targetStatus).toLowerCase()}.
          {isDeactivation
            ? " Existing quotations, sales, and credit history remain unchanged and auditable."
            : " The customer can be selected again in supported workflows."}
        </p>

        {errorMessage ? (
          <div className="mt-4">
            <ErrorBanner>{errorMessage}</ErrorBanner>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:opacity-60"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Keep current status
          </button>
          <button
            className={`rounded-2xl px-5 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDeactivation
                ? "bg-red-700 hover:bg-red-800"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
            disabled={isSaving}
            onClick={confirmStatusChange}
            type="button"
          >
            {isSaving
              ? "Updating..."
              : isDeactivation
                ? "Deactivate customer"
                : "Reactivate customer"}
          </button>
        </div>
      </div>
    </ModalFrame>
  )
}

function DetailValue({ children, icon: Icon, label }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[var(--color-soft)] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
        <Icon size={15} />
        <span>{label}</span>
      </div>
      <div className="mt-2 break-words text-sm font-bold leading-6 text-[var(--color-text-strong)]">
        {children || "—"}
      </div>
    </div>
  )
}

function EmptyHistory({ label }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center">
      <ClipboardList className="text-[var(--color-muted)]" size={34} />
      <p className="mt-3 font-bold text-[var(--color-text-strong)]">No {label} yet</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Activity linked to this customer will appear here.
      </p>
    </div>
  )
}

function QuotationHistory({ data }) {
  const items = Array.isArray(data?.items) ? data.items : []

  if (items.length === 0) return <EmptyHistory label="quotation history" />

  return (
    <div className="space-y-3">
      {items.map((quotation) => (
        <article
          className="rounded-2xl border border-[var(--color-border)] bg-white p-4"
          key={quotation.id}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-bold text-[var(--color-text-strong)]">
                {quotation.quotationCode}
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {quotation.title || "Quotation"} · {formatDate(quotation.createdAt, true)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                Prepared by {quotation.preparedBy?.fullName || "Unassigned"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <StatusBadge status={quotation.status} />
              <p className="font-bold text-[var(--color-text-strong)]">
                {formatMoney(quotation.grandTotal)}
              </p>
            </div>
          </div>

          {Array.isArray(quotation.items) && quotation.items.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)]">
              <div className="border-b border-[var(--color-border)] bg-slate-50 px-3 py-2 text-xs font-bold text-[var(--color-muted)]">
                Quoted Items ({quotation.items.length})
              </div>
              <div className="divide-y divide-[var(--color-border)] text-xs">
                {quotation.items.map((line, idx) => (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" key={line.id || idx}>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-[var(--color-text-strong)]">
                        {line.quantity}× {line.description}
                      </span>
                      {line.warrantyDuration ? (
                        <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {line.warrantyDuration}
                        </span>
                      ) : null}
                      {line.priceTier ? (
                        <span className="ml-1.5 text-[10px] font-semibold text-[var(--color-muted)]">
                          (Price {line.priceTier})
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right font-medium text-[var(--color-text-strong)]">
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
        <p className="text-center text-xs font-semibold text-[var(--color-muted)]">
          Showing the latest {items.length} of {data.totalItems} quotations.
        </p>
      ) : null}
    </div>
  )
}

function SalesHistory({ data }) {
  const items = Array.isArray(data?.items) ? data.items : []

  if (items.length === 0) return <EmptyHistory label="sales history" />

  return (
    <div className="space-y-3">
      {items.map((sale) => (
        <article
          className="rounded-2xl border border-[var(--color-border)] bg-white p-4"
          key={sale.id}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-bold text-[var(--color-text-strong)]">{sale.receiptCode}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {formatDate(sale.saleDate, true)} · Sales Agent: {sale.cashier?.fullName || "Unassigned"}
              </p>
              {sale.quotation?.quotationCode ? (
                <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                  From quotation {sale.quotation.quotationCode}
                </p>
              ) : null}
            </div>
            <div className="sm:text-right">
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <StatusBadge status={sale.status} />
                <StatusBadge status={sale.paymentStatus} />
              </div>
              <p className="mt-2 font-bold text-[var(--color-text-strong)]">
                {formatMoney(sale.grandTotal)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                Paid {formatMoney(sale.amountPaid)}
              </p>
            </div>
          </div>

          {Array.isArray(sale.items) && sale.items.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)]">
              <div className="border-b border-[var(--color-border)] bg-slate-50 px-3 py-2 text-xs font-bold text-[var(--color-muted)]">
                Purchased Items ({sale.items.length})
              </div>
              <div className="divide-y divide-[var(--color-border)] text-xs">
                {sale.items.map((line, idx) => (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" key={line.id || idx}>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-[var(--color-text-strong)]">
                        {line.quantity}× {line.description}
                      </span>
                      {line.serial?.serialNumber ? (
                        <span className="ml-2 inline-block rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
                          S/N: {line.serial.serialNumber}
                        </span>
                      ) : null}
                      {line.warrantyDuration ? (
                        <span className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {line.warrantyDuration}
                        </span>
                      ) : null}
                      {line.priceTier ? (
                        <span className="ml-1 text-[10px] font-semibold text-[var(--color-muted)]">
                          (Price {line.priceTier})
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right font-medium text-[var(--color-text-strong)]">
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
        <p className="text-center text-xs font-semibold text-[var(--color-muted)]">
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
    <div className="space-y-4">
      {items.map((account) => {
        const collections = Array.isArray(account.collections) ? account.collections : []

        return (
          <article
            className="rounded-2xl border border-[var(--color-border)] bg-white p-4"
            key={account.id}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-bold text-[var(--color-text-strong)]">{account.creditCode}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {formatTerm(account.term)} · Opened {formatDate(account.createdAt)}
                </p>
                {account.sale?.receiptCode ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                    Sale {account.sale.receiptCode}
                  </p>
                ) : null}
              </div>
              <div className="sm:text-right">
                <StatusBadge status={account.status} />
                <p className="mt-2 text-xs font-bold uppercase text-[var(--color-muted)]">
                  Remaining balance
                </p>
                <p className="mt-1 font-bold text-[var(--color-text-strong)]">
                  {formatMoney(account.remainingBalance)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--color-soft)] p-3">
                <p className="text-xs font-bold text-[var(--color-muted)]">Financed balance</p>
                <p className="mt-1 text-sm font-bold text-[var(--color-text-strong)]">
                  {formatMoney(account.balanceAmount)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--color-soft)] p-3">
                <p className="text-xs font-bold text-[var(--color-muted)]">Collected</p>
                <p className="mt-1 text-sm font-bold text-[var(--color-text-strong)]">
                  {formatMoney(account.totalCollected)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--color-soft)] p-3">
                <p className="text-xs font-bold text-[var(--color-muted)]">Next due</p>
                <p className="mt-1 text-sm font-bold text-[var(--color-text-strong)]">
                  {formatDate(account.nextDueDate)}
                </p>
              </div>
            </div>

            {collections.length > 0 ? (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Recent collections
                </p>
                <div className="mt-2 space-y-2">
                  {collections.map((collection) => (
                    <div
                      className="flex flex-col gap-2 rounded-xl bg-[var(--color-soft)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      key={collection.id}
                    >
                      <div>
                        <p className="font-bold text-[var(--color-text-strong)]">
                          {collection.collectionCode}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                          {formatDate(collection.paidAt, true)} · {formatStatus(collection.paymentMethod)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 sm:justify-end">
                        <StatusBadge status={collection.status} />
                        <p className="font-bold text-[var(--color-text-strong)]">
                          {formatMoney(collection.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {account._count?.collections > collections.length ? (
                  <p className="mt-2 text-xs font-semibold text-[var(--color-muted)]">
                    Showing the latest {collections.length} of {account._count.collections} collections.
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>
        )
      })}
      {data.totalItems > items.length ? (
        <p className="text-center text-xs font-semibold text-[var(--color-muted)]">
          Showing the latest {items.length} of {data.totalItems} credit accounts.
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
  const [activeTab, setActiveTab] = useState("quotations")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const requestIdRef = useRef(0)

  const loadCustomer = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    setErrorMessage("")

    try {
      const [customerResponse, historyResponse] = await Promise.all([
        getCustomerById(initialCustomer.id),
        getCustomerHistory(initialCustomer.id, { limit: 10 }),
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
    { id: "quotations", label: "Quotations", count: summary.quotationCount || 0 },
    { id: "sales", label: "Sales", count: summary.saleCount || 0 },
    { id: "credits", label: "Credits", count: summary.creditAccountCount || 0 },
  ]

  return (
    <ModalFrame labelledBy="customer-detail-title" onClose={onClose} size="max-w-5xl">
      <div className="flex flex-col gap-4 border-b border-[var(--color-border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[var(--color-accent)]">Customer profile</p>
            <StatusBadge status={customer.status} />
            <span className="rounded-xl bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              Price {customer.priceTier || 1}
            </span>
          </div>
          <h2
            className="mt-1 break-words text-xl font-bold text-[var(--color-text-strong)] sm:text-2xl"
            id="customer-detail-title"
          >
            {customer.fullName}
          </h2>
          {customer.companyName ? (
            <p className="mt-1 text-sm font-semibold text-[var(--color-muted)]">
              {customer.companyName}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            aria-label="Refresh customer details"
            className="rounded-2xl border border-[var(--color-border)] p-2.5 text-[var(--color-muted)] transition hover:bg-[var(--color-soft)]"
            disabled={isLoading}
            onClick={loadCustomer}
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={17} />
          </button>
          {canManage ? (
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
              onClick={() => onEdit(customer)}
              type="button"
            >
              <Edit3 size={16} />
              Edit
            </button>
          ) : null}
          <button
            aria-label="Close customer details"
            className="rounded-2xl border border-[var(--color-border)] p-2.5 text-[var(--color-muted)] transition hover:bg-[var(--color-soft)]"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {errorMessage ? (
          <div className="space-y-3">
            <ErrorBanner>{errorMessage}</ErrorBanner>
            <button
              className="rounded-2xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
              onClick={loadCustomer}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailValue icon={Building2} label="Branch">
            {customer.branch?.name
              ? `${customer.branch.code} · ${customer.branch.name}`
              : customer.branch?.code || "—"}
          </DetailValue>
          <DetailValue icon={Tag} label="Price Tier">
            Price {customer.priceTier || 1}
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
          <div className="sm:col-span-1 lg:col-span-3">
            <DetailValue icon={MapPin} label="Address">
              {customer.address || "—"}
            </DetailValue>
          </div>
        </div>

        {customer.notes ? (
          <div className="rounded-2xl border border-[var(--color-border)] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Internal notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-strong)]">
              {customer.notes}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold text-[var(--color-muted)]">Quotations</p>
            <p className="mt-1 text-xl font-bold text-[var(--color-text-strong)]">
              {summary.quotationCount || 0}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold text-[var(--color-muted)]">Sales</p>
            <p className="mt-1 text-xl font-bold text-[var(--color-text-strong)]">
              {summary.saleCount || 0}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold text-[var(--color-muted)]">Credit accounts</p>
            <p className="mt-1 text-xl font-bold text-[var(--color-text-strong)]">
              {summary.creditAccountCount || 0}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold text-[var(--color-muted)]">Outstanding credit</p>
            <p className="mt-1 text-xl font-bold text-[var(--color-text-strong)]">
              {formatMoney(summary.outstandingCreditBalance)}
            </p>
          </div>
        </div>

        <section>
          <div className="flex max-w-full gap-2 overflow-x-auto border-b border-[var(--color-border)] pb-3">
            {tabs.map((tab) => (
              <button
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  activeTab === tab.id
                    ? "bg-[#7A1F2B] text-white"
                    : "bg-[var(--color-soft)] text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="mt-4">
            {errorMessage ? null : isLoading ? (
              <div className="rounded-2xl bg-[var(--color-soft)] p-6 text-sm font-semibold text-[var(--color-muted)]">
                Loading customer history...
              </div>
            ) : activeTab === "quotations" ? (
              <QuotationHistory data={history.quotations} />
            ) : activeTab === "sales" ? (
              <SalesHistory data={history.sales} />
            ) : (
              <CreditHistory data={history.creditAccounts} />
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[var(--color-muted)]">
            <p>Created {formatDate(customer.createdAt, true)}</p>
            <p className="mt-1">
              Last updated {formatDate(customer.updatedAt, true)}
              {customer.updatedBy?.fullName ? ` by ${customer.updatedBy.fullName}` : ""}
            </p>
          </div>
          {canManage ? (
            <button
              className={`rounded-2xl border px-4 py-2.5 text-sm font-bold transition ${
                customer.status === "ACTIVE"
                  ? "border-red-200 text-red-700 hover:bg-red-50"
                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              }`}
              onClick={() =>
                onRequestStatus(customer, customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")
              }
              type="button"
            >
              {customer.status === "ACTIVE" ? "Deactivate customer" : "Reactivate customer"}
            </button>
          ) : null}
        </div>
      </div>
    </ModalFrame>
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
