import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  History,
  LoaderCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  UserRoundCheck,
  Wrench,
  X,
  Zap,
} from "lucide-react"

import { getCustomers } from "../../features/customers/customers.api"
import { generateUUID } from "../../utils/uuid"
import {
  cancelServicePayment,
  createServiceJob,
  createServicePayment,
  getServiceJobById,
  getServiceJobs,
  getServiceTechnicians,
  releaseServiceJob,
  updateServiceJobAssignment,
  updateServiceJobStatus,
} from "../../features/service-jobs/serviceJobs.api"

const CREATE_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN", "TECHNICIAN", "CASHIER"])
const LIFECYCLE_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN", "CASHIER", "TECHNICIAN"])
const ASSIGNMENT_MANAGER_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN", "CASHIER", "TECHNICIAN"])
const PAYMENT_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN", "CASHIER", "TECHNICIAN"])
const PAYMENT_CANCELLER_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN"])
const IMMEDIATE_PAYMENT_METHODS = ["CASH", "GCASH", "BANK_TRANSFER", "OTHER"]
const RECEIVABLE_PROVIDERS = ["CREDIT_CARD", "DEBIT_CARD", "HOMECREDIT", "SALMON", "KYRO", "OTHER_FINANCING", "IN_HOUSE_INSTALLMENT"]
const RECEIVABLE_PROVIDER_VALUES = new Set(RECEIVABLE_PROVIDERS)
const INSTALLMENT_TERMS = ["STRAIGHT", "MONTH_3", "MONTH_6", "MONTH_9", "MONTH_12", "MONTH_18", "MONTH_24"]
const ACTIVE_STATUSES = new Set(["PENDING", "IN_PROGRESS", "READY_FOR_RELEASE"])
const STATUSES = ["PENDING", "IN_PROGRESS", "READY_FOR_RELEASE", "COMPLETED", "CANCELLED"]
const REPAIR_TYPES = [
  { value: "ORDINARY_REPAIR", label: "Standard service / repair" },
  { value: "BOARD_LEVEL_REPAIR", label: "Specialized / Advanced repair" },
]
const COMPLETED_OUTCOMES = new Set(["REPAIRED", "SERVICE_COMPLETED"])
const UNREPAIRED_OUTCOMES = new Set([
  "UNREPAIRED",
  "CUSTOMER_PULL_OUT",
  "NO_FAULT_FOUND",
  "DECLINED",
  "OTHER",
])
const RELEASE_OUTCOMES = [
  { value: "REPAIRED", label: "Repaired" },
  { value: "SERVICE_COMPLETED", label: "Service completed" },
  { value: "UNREPAIRED", label: "Unrepaired" },
  { value: "CUSTOMER_PULL_OUT", label: "Customer pull-out" },
  { value: "NO_FAULT_FOUND", label: "No fault found" },
  { value: "DECLINED", label: "Repair declined" },
  { value: "OTHER", label: "Other" },
]
const FIELD_CLASS =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-[var(--color-maroon)]/10"

const EMPTY_CREATE = {
  customerId: "",
  customerNameSnapshot: "",
  customerContactSnapshot: "",
  assignedTechnicianId: "",
  jobTitle: "",
  deviceDescription: "",
  serialNumber: "",
  problemDescription: "",
  accessoriesReceived: "",
  receivingRemarks: "",
  diagnosis: "",
  serviceNotes: "",
  repairType: "ORDINARY_REPAIR",
  baseServiceCharge: "",
  markupPercent: "",
  isQuickService: false,
}

function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function moneyOrDash(value) {
  return value === null || value === undefined || value === "" ? "—" : money(value)
}

function percentOrDash(value) {
  return value === null || value === undefined || value === ""
    ? "—"
    : `${Number(value).toLocaleString("en-PH", { maximumFractionDigits: 4 })}%`
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

function normalizedMarkup(value) {
  return value === "" || value === undefined || value === null ? 0 : Number(value)
}

function isValidMarkup(value) {
  const markup = normalizedMarkup(value)
  return Number.isFinite(markup) && markup >= 0 && markup < 100
}

function isValidBaseServiceCharge(value) {
  const base = value === "" || value === undefined || value === null ? 0 : Number(value)
  return Number.isFinite(base) && base >= 0
}

function getMarkupAdjustedPrice(basePrice, markupPercent) {
  const base = Number(basePrice || 0)
  const markup = normalizedMarkup(markupPercent)

  if (!Number.isFinite(base)) return 0
  if (!Number.isFinite(markup) || markup < 0 || markup >= 100) return base

  return roundMoney(base / (1 - markup / 100))
}

function isSeniorTechnician(technician) {
  return technician?.incentiveClassification === "SENIOR_TECHNICIAN"
}

function isEligibleForRepairType(technician, repairType) {
  return repairType !== "BOARD_LEVEL_REPAIR" || isSeniorTechnician(technician)
}

function technicianLabel(technician) {
  const name = technician?.fullName || technician?.username || "Technician"
  return technician?.incentiveClassification
    ? `${name} · ${friendly(technician.incentiveClassification)}`
    : name
}

function dateTime(value) {
  if (!value) return "—"
  const valueDate = new Date(value)
  return Number.isNaN(valueDate.getTime())
    ? "—"
    : valueDate.toLocaleString("en-PH", { timeZone: "Asia/Manila" })
}

function friendly(value) {
  return value ? String(value).replaceAll("_", " ") : "—"
}

function apiError(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error?.message || fallback
}

function statusTone(status) {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
    case "READY_FOR_RELEASE":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
    case "CANCELLED":
      return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
    default:
      return "bg-[var(--color-soft)] text-[var(--color-text-strong)]"
  }
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${statusTone(status)}`}>
      {friendly(status)}
    </span>
  )
}

function Modal({ children, onClose, title, width = "max-w-3xl" }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-3 sm:p-6 backdrop-blur-xs">
      <section
        aria-label={title}
        aria-modal="true"
        className={`my-auto w-full ${width} overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] shadow-2xl`}
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 sm:px-6 bg-[var(--color-card)]">
          <h2 className="text-lg font-black text-[var(--color-text-strong)]">{title}</h2>
          <button
            aria-label="Close"
            className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-[var(--color-soft)]"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Field({ children, label }) {
  return (
    <label className="block text-sm font-bold text-[var(--color-text-strong)]">
      {label}
      {children}
    </label>
  )
}

function ServicePricingFields({ baseServiceCharge, markupPercent, onBaseChange, onMarkupChange }) {
  const baseIsValid = isValidBaseServiceCharge(baseServiceCharge)
  const markupIsValid = isValidMarkup(markupPercent)
  const finalServiceCharge =
    baseIsValid && markupIsValid
      ? getMarkupAdjustedPrice(baseServiceCharge, markupPercent)
      : 0
  const numericBase = baseIsValid ? Number(baseServiceCharge || 0) : 0

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Base service charge *">
          <input
            className={FIELD_CLASS}
            min="0"
            onChange={(event) => onBaseChange(event.target.value)}
            required
            step="0.01"
            type="number"
            value={baseServiceCharge}
          />
        </Field>
        <Field label="Markup % (optional)">
          <input
            className={FIELD_CLASS}
            max="99.9999"
            min="0"
            onChange={(event) => onMarkupChange(event.target.value)}
            step="0.0001"
            type="number"
            value={markupPercent}
          />
        </Field>
      </div>
      {!markupIsValid ? (
        <p className="text-xs font-bold text-rose-500">Markup must be at least 0% and less than 100%.</p>
      ) : null}
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <div><p className="font-bold text-[var(--color-muted)]">Base</p><p className="mt-1 font-black text-[var(--color-text-strong)]">{money(numericBase)}</p></div>
        <div><p className="font-bold text-[var(--color-muted)]">Markup amount</p><p className="mt-1 font-black text-[var(--color-text-strong)]">{money(Math.max(finalServiceCharge - numericBase, 0))}</p></div>
        <div><p className="font-bold text-[var(--color-muted)]">Final customer price</p><p className="mt-1 font-black text-[var(--color-maroon)]">{money(finalServiceCharge)}</p></div>
      </div>
    </div>
  )
}

function FinancialSnapshot({ compact = false, job }) {
  const snapshotFields = [
    ["Repair Cost %", percentOrDash(job.repairCostPercentSnapshot)],
    ["Company Share %", percentOrDash(job.companySharePercentSnapshot)],
    ["Repair Cost Pool", moneyOrDash(job.repairCostPoolAmountSnapshot)],
    ["Company Share Amount", moneyOrDash(job.companyShareAmountSnapshot)],
    ["Repair Fee", moneyOrDash(job.repairFeeSnapshot)],
    ["Repair Incentive Rate", percentOrDash(job.repairIncentiveRateSnapshot)],
    ["Repair Incentive Amount", moneyOrDash(job.repairIncentiveAmountSnapshot)],
    ["Remaining/unallocated Repair Cost Pool", moneyOrDash(job.unallocatedRepairCostPoolSnapshot)],
  ]
  const hasSnapshot = Boolean(job.financialSnapshotAt) || snapshotFields.some(([, value]) => value !== "—")

  if (!hasSnapshot) return null

  return (
    <section className={compact ? "mt-3 rounded-xl bg-slate-50 p-3" : "rounded-2xl border border-[var(--color-border)] p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={compact ? "text-[11px] font-black uppercase tracking-wide" : "font-black"}>Stored financial snapshot</p>
        <p className="text-[10px] font-bold text-[var(--color-muted)]">Captured {dateTime(job.financialSnapshotAt)}</p>
      </div>
      <div className={compact ? "mt-2 grid grid-cols-2 gap-2 text-[10px]" : "mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4"}>
        {snapshotFields.map(([label, value]) => (
          <div key={label}>
            <p className="font-bold text-[var(--color-muted)]">{label}</p>
            <p className="mt-0.5 font-black">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function printText(value, maxLength = 240) {
  const text = String(value || "—").trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function PrintField({ label, value, wide = false }) {
  return (
    <div className={wide ? "jo-print-field jo-print-wide" : "jo-print-field"}>
      <p className="jo-print-label">{label}</p>
      <p className="jo-print-value">{printText(value)}</p>
    </div>
  )
}

function JobOrderPrintCopy({ copyLabel, job }) {
  const customerName = job.customerNameSnapshot || job.customer?.fullName || "Walk-in customer"
  const customerContact =
    job.customerContactSnapshot ||
    [job.customer?.mobileNumber, job.customer?.email].filter(Boolean).join(" / ") ||
    "—"
  const postedPayments = (job.payments || []).filter(
    (payment) => payment.status === "POSTED",
  )
  const directTotal = postedPayments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0,
  )
  const paymentText = job.creditAccount
    ? `${friendly(job.paymentState)} · ${friendly(job.creditAccount.provider)} · AR ${money(job.creditAccount.remainingBalance)}`
    : `${friendly(job.paymentState)} · collected ${money(directTotal)}`
  const hasFinancialSnapshot =
    copyLabel === "STORE COPY" &&
    (Boolean(job.financialSnapshotAt) || [
      job.repairCostPercentSnapshot,
      job.companySharePercentSnapshot,
      job.repairCostPoolAmountSnapshot,
      job.companyShareAmountSnapshot,
      job.repairFeeSnapshot,
      job.repairIncentiveRateSnapshot,
      job.repairIncentiveAmountSnapshot,
      job.unallocatedRepairCostPoolSnapshot,
    ].some((value) => value !== null && value !== undefined))

  return (
    <section className="job-order-print-copy">
      <header className="jo-print-header">
        <div>
          <p className="jo-print-brand">ARUNAFELTZ COMPUTER</p>
          <h1>Services / Job Order</h1>
          <p>{job.branch?.name || "Arunafeltz Computer branch"}</p>
          <p>{[job.branch?.address, job.branch?.contactNo].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="jo-print-reference">
          <strong>{copyLabel}</strong>
          <span>JO No. {job.jobCode}</span>
          <span>Received {dateTime(job.receivedAt)}</span>
        </div>
      </header>

      <div className="jo-print-grid jo-print-grid-3">
        <PrintField label="Customer" value={customerName} />
        <PrintField label="Contact" value={customerContact} />
        <PrintField label="Service type / title" value={job.jobTitle} />
        <PrintField label="Device / unit" value={job.deviceDescription} />
        <PrintField label="Serial number" value={job.serialNumber} />
        <PrintField label="Repair category" value={friendly(job.repairType)} />
        <PrintField label="Assigned technician" value={job.assignedTechnician ? technicianLabel(job.assignedTechnician) : "Unassigned"} />
        <PrintField label="Service Done By" value={job.serviceDoneBy ? technicianLabel(job.serviceDoneBy) : "—"} />
      </div>

      <div className="jo-print-grid jo-print-grid-2">
        <PrintField label="Reported issue / request" value={job.problemDescription} wide />
        <PrintField label="Accessories received" value={job.accessoriesReceived} wide />
        <PrintField label="Physical condition / receiving remarks" value={job.receivingRemarks} wide />
        <PrintField label="Diagnosis / service performed" value={[job.diagnosis, job.serviceNotes].filter(Boolean).join(" — ")} wide />
      </div>

      <div className="jo-print-grid jo-print-grid-4">
        <PrintField label="Base service charge" value={moneyOrDash(job.baseServiceCharge)} />
        <PrintField label="Markup" value={percentOrDash(job.markupPercent)} />
        <PrintField label="Service markup amount" value={moneyOrDash(job.serviceMarkupAmount)} />
        <PrintField label="Final service charge" value={moneyOrDash(job.finalServiceCharge)} />
        <PrintField label="Payment" value={paymentText} />
        <PrintField label="Release outcome" value={friendly(job.releaseOutcome)} />
        <PrintField label="Received by" value={job.receivedBy?.fullName || job.createdBy?.fullName} />
        <PrintField label="Released by" value={job.releasedBy?.fullName} />
        <PrintField label="Release date" value={dateTime(job.releasedAt)} />
        <PrintField label="Release notes" value={job.releaseNotes || job.cancellationReason} />
      </div>

      {hasFinancialSnapshot ? (
        <div className="jo-print-grid jo-print-grid-4">
          <PrintField label="Repair Cost %" value={percentOrDash(job.repairCostPercentSnapshot)} />
          <PrintField label="Company Share %" value={percentOrDash(job.companySharePercentSnapshot)} />
          <PrintField label="Repair Cost Pool" value={moneyOrDash(job.repairCostPoolAmountSnapshot)} />
          <PrintField label="Company Share Amount" value={moneyOrDash(job.companyShareAmountSnapshot)} />
          <PrintField label="Repair Fee" value={moneyOrDash(job.repairFeeSnapshot)} />
          <PrintField label="Repair Incentive Rate" value={percentOrDash(job.repairIncentiveRateSnapshot)} />
          <PrintField label="Repair Incentive Amount" value={moneyOrDash(job.repairIncentiveAmountSnapshot)} />
          <PrintField label="Remaining/unallocated Repair Cost Pool" value={moneyOrDash(job.unallocatedRepairCostPoolSnapshot)} />
          <PrintField label="Financial snapshot at" value={dateTime(job.financialSnapshotAt)} />
        </div>
      ) : null}

      <footer className="jo-print-signatures">
        <div><span>Customer signature / date</span></div>
        <div><span>Receiving / releasing staff signature</span></div>
      </footer>
    </section>
  )
}

function JobOrderPrintPreview({ job, onClose }) {
  return createPortal(
    <div aria-label="Printable job order" aria-modal="true" className="job-order-print-overlay" role="dialog">
      <div className="job-order-print-shell">
        <div className="job-order-print-actions">
          <div>
            <p className="font-black text-white">One-page Job Order preview</p>
            <p className="text-xs text-white/70">Customer and store copies print on one A4 sheet.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-xl border border-white/30 px-4 py-2 text-sm font-bold text-white" onClick={onClose} type="button">
              Close
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-[var(--color-maroon)]" onClick={() => window.print()} type="button">
              <Printer size={16} /> Print A4
            </button>
          </div>
        </div>
        <article className="job-order-print-document">
          <JobOrderPrintCopy copyLabel="CUSTOMER COPY" job={job} />
          <div className="job-order-cut-line"><span>CUT HERE</span></div>
          <JobOrderPrintCopy copyLabel="STORE COPY" job={job} />
        </article>
      </div>
    </div>,
    document.body,
  )
}

function lifecycleChoices(job) {
  if (job.status === "PENDING") {
    return job.isQuickService ? ["READY_FOR_RELEASE", "CANCELLED"] : ["IN_PROGRESS", "CANCELLED"]
  }
  if (job.status === "IN_PROGRESS") return ["READY_FOR_RELEASE", "CANCELLED"]
  if (job.status === "READY_FOR_RELEASE") return ["CANCELLED"]
  return []
}

export default function ServicesPage({ selectedBranch, user }) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const canCreate = CREATE_ROLES.has(user?.role)
  const canUpdateLifecycle = LIFECYCLE_ROLES.has(user?.role)
  const canManageAssignment = ASSIGNMENT_MANAGER_ROLES.has(user?.role)
  const canCollectPayment = PAYMENT_ROLES.has(user?.role)
  const canCancelPayment = PAYMENT_CANCELLER_ROLES.has(user?.role)

  const [jobs, setJobs] = useState([])
  const [meta, setMeta] = useState({})
  const [customers, setCustomers] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [repairTypeFilter, setRepairTypeFilter] = useState("")
  const [quickOnly, setQuickOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [notice, setNotice] = useState("")

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)
  const [actionStatus, setActionStatus] = useState("")
  const [actionForm, setActionForm] = useState({
    diagnosis: "",
    serviceNotes: "",
    cancellationReason: "",
    repairType: "",
    serviceDoneById: "",
    baseServiceCharge: "",
    markupPercent: "",
  })
  const [showAssignment, setShowAssignment] = useState(false)
  const [assignmentId, setAssignmentId] = useState("")
  const [showRelease, setShowRelease] = useState(false)
  const [releaseForm, setReleaseForm] = useState({
    releaseOutcome: "SERVICE_COMPLETED",
    releaseNotes: "",
    repairType: "",
    serviceDoneById: "",
    baseServiceCharge: "",
    markupPercent: "",
    diagnosis: "",
    serviceNotes: "",
  })
  const [showPayment, setShowPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    arrangement: "CASH",
    settlementMethod: "CASH",
    amount: "",
    referenceNo: "",
    remarks: "",
    providerReferenceNo: "",
    term: "MONTH_3",
    dueDay: "",
    firstDueDate: "",
    receivableRemarks: "",
  })
  const paymentRequestRef = useRef({ signature: "", key: "" })
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false)

  const loadJobs = useCallback(async () => {
    const response = await getServiceJobs({
      ...(branchId ? { branchId } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(repairTypeFilter ? { repairType: repairTypeFilter } : {}),
      ...(quickOnly ? { isQuickService: true } : {}),
      page,
      limit: 20,
    })
    setJobs(Array.isArray(response?.data) ? response.data : [])
    setMeta(response?.meta || {})
  }, [branchId, page, quickOnly, repairTypeFilter, search, statusFilter])

  const loadReferences = useCallback(async () => {
    if (!canCreate || (user?.role === "SUPER_OWNER" && !branchId)) return
    const params = { ...(branchId ? { branchId } : {}), status: "ACTIVE", limit: 100 }
    const [customerResponse, technicianResponse] = await Promise.all([
      getCustomers(params),
      getServiceTechnicians(branchId ? { branchId } : {}),
    ])
    const customerData = customerResponse?.data
    setCustomers(Array.isArray(customerData) ? customerData : customerData?.data || [])
    setTechnicians(Array.isArray(technicianResponse?.data) ? technicianResponse.data : [])
  }, [branchId, canCreate, user?.role])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      await Promise.all([loadJobs(), loadReferences()])
    } catch (error) {
      setErrorMessage(apiError(error, "Could not load job orders."))
    } finally {
      setIsLoading(false)
    }
  }, [loadJobs, loadReferences])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 180)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const openDetail = async (job) => {
    setSelectedJob(job)
    setIsDetailLoading(true)
    setErrorMessage("")
    try {
      const response = await getServiceJobById(job.id)
      setSelectedJob(response?.data || job)
    } catch (error) {
      setErrorMessage(apiError(error, "Could not load job order details."))
    } finally {
      setIsDetailLoading(false)
    }
  }

  const reloadSelected = async (jobId = selectedJob?.id) => {
    if (!jobId) return
    const response = await getServiceJobById(jobId)
    setSelectedJob(response?.data || selectedJob)
  }

  const submitCreate = async (event) => {
    event.preventDefault()
    if (isSaving) return
    if (!isValidBaseServiceCharge(createForm.baseServiceCharge)) {
      setErrorMessage("Base service charge must be a valid non-negative amount.")
      return
    }
    if (!isValidMarkup(createForm.markupPercent)) {
      setErrorMessage("Markup must be at least 0% and less than 100%.")
      return
    }

    const selectedAssignee = technicians.find(
      (technician) => technician.id === createForm.assignedTechnicianId,
    )
    if (
      createForm.assignedTechnicianId &&
      (!selectedAssignee ||
        !isEligibleForRepairType(selectedAssignee, createForm.repairType) ||
        (user?.role === "TECHNICIAN" && selectedAssignee.id !== user.id))
    ) {
      setErrorMessage("Choose an eligible technician for this repair category.")
      return
    }

    const baseServiceCharge = Number(createForm.baseServiceCharge || 0)
    const markupPercent = normalizedMarkup(createForm.markupPercent)
    const finalServiceCharge = getMarkupAdjustedPrice(baseServiceCharge, markupPercent)
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await createServiceJob({
        ...(user?.role === "SUPER_OWNER" && branchId ? { branchId } : {}),
        jobTitle: createForm.jobTitle.trim(),
        customerId: createForm.customerId || undefined,
        customerNameSnapshot: !createForm.customerId ? createForm.customerNameSnapshot.trim() || undefined : undefined,
        customerContactSnapshot: !createForm.customerId ? createForm.customerContactSnapshot.trim() || undefined : undefined,
        assignedTechnicianId: createForm.assignedTechnicianId || undefined,
        deviceDescription: createForm.deviceDescription.trim() || undefined,
        serialNumber: createForm.serialNumber.trim() || undefined,
        problemDescription: createForm.problemDescription.trim() || undefined,
        accessoriesReceived: createForm.accessoriesReceived.trim() || undefined,
        receivingRemarks: createForm.receivingRemarks.trim() || undefined,
        diagnosis: createForm.diagnosis.trim() || undefined,
        serviceNotes: createForm.serviceNotes.trim() || undefined,
        repairType: createForm.repairType,
        baseServiceCharge,
        markupPercent,
        estimatedServiceCharge: finalServiceCharge,
        isQuickService: createForm.isQuickService,
      })
      setCreateForm(EMPTY_CREATE)
      setShowCreate(false)
      setNotice(`${response?.data?.jobCode || "Job order"} received.`)
      setPage(1)
      await loadJobs()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not create job order."))
    } finally {
      setIsSaving(false)
    }
  }

  const beginLifecycleAction = (status) => {
    const existingPerformerId =
      selectedJob?.serviceDoneById || selectedJob?.serviceDoneBy?.id || ""
    setActionStatus(status)
    setActionForm({
      diagnosis: selectedJob?.diagnosis || "",
      serviceNotes: selectedJob?.serviceNotes || "",
      cancellationReason: "",
      repairType: selectedJob?.repairType || "",
      serviceDoneById:
        user?.role === "TECHNICIAN" && existingPerformerId !== user.id
          ? ""
          : existingPerformerId,
      baseServiceCharge: String(
        selectedJob?.baseServiceCharge ?? selectedJob?.estimatedServiceCharge ?? "",
      ),
      markupPercent: String(selectedJob?.markupPercent ?? ""),
    })
  }

  const submitLifecycleAction = async (event) => {
    event.preventDefault()
    if (!selectedJob || !actionStatus || isSaving) return
    const isReadyAction = actionStatus === "READY_FOR_RELEASE"
    const repairType = selectedJob.repairType || actionForm.repairType
    const selectedPerformer = technicians.find(
      (technician) => technician.id === actionForm.serviceDoneById,
    )

    if (actionStatus !== "CANCELLED" && !repairType) {
      setErrorMessage("Select the repair category before continuing this legacy job order.")
      return
    }

    if (isReadyAction && !actionForm.serviceDoneById) {
      setErrorMessage("Service Done By is required before the job can be marked ready for release.")
      return
    }
    if (
      isReadyAction &&
      (!selectedPerformer ||
        !isEligibleForRepairType(selectedPerformer, repairType) ||
        (user?.role === "TECHNICIAN" && selectedPerformer.id !== user.id))
    ) {
      setErrorMessage("Choose an eligible Service Done By performer for this repair category.")
      return
    }
    if (isReadyAction && !isValidBaseServiceCharge(actionForm.baseServiceCharge)) {
      setErrorMessage("Base service charge must be a valid non-negative amount.")
      return
    }
    if (isReadyAction && !isValidMarkup(actionForm.markupPercent)) {
      setErrorMessage("Markup must be at least 0% and less than 100%.")
      return
    }

    setIsSaving(true)
    setErrorMessage("")
    try {
      await updateServiceJobStatus(selectedJob.id, {
        status: actionStatus,
        diagnosis: actionForm.diagnosis.trim() || undefined,
        serviceNotes: actionForm.serviceNotes.trim() || undefined,
        ...(actionStatus === "CANCELLED" ? { cancellationReason: actionForm.cancellationReason.trim() } : {}),
        ...(repairType && actionStatus !== "CANCELLED" ? { repairType } : {}),
        ...(isReadyAction
          ? {
              serviceDoneById: actionForm.serviceDoneById,
              baseServiceCharge: Number(actionForm.baseServiceCharge || 0),
              markupPercent: normalizedMarkup(actionForm.markupPercent),
            }
          : {}),
      })
      setActionStatus("")
      setNotice(`${selectedJob.jobCode} moved to ${friendly(actionStatus)}.`)
      await Promise.all([reloadSelected(selectedJob.id), loadJobs()])
    } catch (error) {
      setErrorMessage(apiError(error, "Could not update the job order status."))
    } finally {
      setIsSaving(false)
    }
  }

  const openAssignment = () => {
    setAssignmentId(selectedJob?.assignedTechnicianId || "")
    setShowAssignment(true)
  }

  const submitAssignment = async (event) => {
    event.preventDefault()
    if (!selectedJob || isSaving) return
    const selectedAssignee = technicians.find(
      (technician) => technician.id === assignmentId,
    )
    if (
      assignmentId &&
      (!selectedAssignee ||
        !isEligibleForRepairType(
          selectedAssignee,
          selectedJob.repairType || "ORDINARY_REPAIR",
        ) ||
        (user?.role === "TECHNICIAN" && selectedAssignee.id !== user.id))
    ) {
      setErrorMessage("Choose an eligible technician for this repair category.")
      return
    }
    setIsSaving(true)
    setErrorMessage("")
    try {
      await updateServiceJobAssignment(selectedJob.id, {
        assignedTechnicianId: assignmentId || null,
      })
      setShowAssignment(false)
      setNotice(`Assignment updated for ${selectedJob.jobCode}.`)
      await Promise.all([reloadSelected(selectedJob.id), loadJobs()])
    } catch (error) {
      setErrorMessage(apiError(error, "Could not update the technician assignment."))
    } finally {
      setIsSaving(false)
    }
  }

  const claimUnassignedJob = async () => {
    if (!selectedJob || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      await updateServiceJobAssignment(selectedJob.id, { assignedTechnicianId: user.id })
      setNotice(`${selectedJob.jobCode} assigned to you.`)
      await Promise.all([reloadSelected(selectedJob.id), loadJobs()])
    } catch (error) {
      setErrorMessage(apiError(error, "Could not claim this job order."))
    } finally {
      setIsSaving(false)
    }
  }

  const openRelease = () => {
    const completedWork = selectedJob?.status === "READY_FOR_RELEASE"
    const existingPerformerId =
      selectedJob?.serviceDoneById || selectedJob?.serviceDoneBy?.id || ""
    setReleaseForm({
      releaseOutcome: completedWork ? "SERVICE_COMPLETED" : "CUSTOMER_PULL_OUT",
      releaseNotes: "",
      repairType: selectedJob?.repairType || "",
      serviceDoneById:
        user?.role === "TECHNICIAN" && existingPerformerId !== user.id
          ? ""
          : existingPerformerId,
      baseServiceCharge: String(
        selectedJob?.baseServiceCharge ??
          selectedJob?.finalServiceCharge ??
          selectedJob?.estimatedServiceCharge ??
          0,
      ),
      markupPercent: String(selectedJob?.markupPercent ?? 0),
      diagnosis: selectedJob?.diagnosis || "",
      serviceNotes: selectedJob?.serviceNotes || "",
    })
    setShowRelease(true)
  }

  const submitRelease = async (event) => {
    event.preventDefault()
    if (!selectedJob || isSaving) return
    const isCompletedRelease = COMPLETED_OUTCOMES.has(releaseForm.releaseOutcome)
    const repairType = selectedJob.repairType || releaseForm.repairType
    const selectedPerformer = technicians.find(
      (technician) => technician.id === releaseForm.serviceDoneById,
    )

    if (isCompletedRelease && !repairType) {
      setErrorMessage("Select the repair category before completing this legacy job order.")
      return
    }

    if (isCompletedRelease && !releaseForm.serviceDoneById) {
      setErrorMessage("Service Done By is required for a completed release.")
      return
    }
    if (
      isCompletedRelease &&
      (!selectedPerformer ||
        !isEligibleForRepairType(selectedPerformer, repairType) ||
        (user?.role === "TECHNICIAN" && selectedPerformer.id !== user.id))
    ) {
      setErrorMessage("Choose an eligible Service Done By performer for this repair category.")
      return
    }
    if (!isValidBaseServiceCharge(releaseForm.baseServiceCharge)) {
      setErrorMessage("Base service charge must be a valid non-negative amount.")
      return
    }
    if (!isValidMarkup(releaseForm.markupPercent)) {
      setErrorMessage("Markup must be at least 0% and less than 100%.")
      return
    }

    setIsSaving(true)
    setErrorMessage("")
    try {
      await releaseServiceJob(selectedJob.id, {
        releaseOutcome: releaseForm.releaseOutcome,
        releaseNotes: releaseForm.releaseNotes.trim() || undefined,
        ...(repairType ? { repairType } : {}),
        baseServiceCharge: Number(releaseForm.baseServiceCharge || 0),
        markupPercent: normalizedMarkup(releaseForm.markupPercent),
        ...(isCompletedRelease
          ? {
              serviceDoneById: releaseForm.serviceDoneById,
            }
          : {}),
        diagnosis: releaseForm.diagnosis.trim() || undefined,
        serviceNotes: releaseForm.serviceNotes.trim() || undefined,
      })
      setShowRelease(false)
      setNotice(`${selectedJob.jobCode} released as ${friendly(releaseForm.releaseOutcome)}.`)
      await Promise.all([reloadSelected(selectedJob.id), loadJobs()])
    } catch (error) {
      setErrorMessage(apiError(error, "Could not release the job order."))
    } finally {
      setIsSaving(false)
    }
  }

  const openPayment = () => {
    setPaymentForm({
      arrangement: "CASH",
      settlementMethod: "CASH",
      amount: String(selectedJob?.remainingBalance || ""),
      referenceNo: "",
      remarks: "",
      providerReferenceNo: "",
      term: "MONTH_3",
      dueDay: "",
      firstDueDate: "",
      receivableRemarks: "",
    })
    setShowPayment(true)
  }

  const submitPayment = async (event) => {
    event.preventDefault()
    if (!selectedJob || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const isReceivable = RECEIVABLE_PROVIDER_VALUES.has(
        paymentForm.arrangement,
      )
      const amount = Number(paymentForm.amount || 0)
      const settlementPayload = {
        paymentMethod:
          amount > 0
            ? isReceivable
              ? paymentForm.settlementMethod
              : paymentForm.arrangement
            : undefined,
        amount,
        referenceNo: paymentForm.referenceNo.trim() || undefined,
        remarks: paymentForm.remarks.trim() || undefined,
        receivable: isReceivable
          ? {
              provider: paymentForm.arrangement,
              providerReferenceNo:
                paymentForm.providerReferenceNo.trim() || undefined,
              ...(paymentForm.arrangement === "IN_HOUSE_INSTALLMENT"
                ? {
                    term: paymentForm.term,
                    dueDay:
                      paymentForm.dueDay === ""
                        ? undefined
                        : Number(paymentForm.dueDay),
                    firstDueDate: paymentForm.firstDueDate
                      ? new Date(
                          `${paymentForm.firstDueDate}T00:00:00+08:00`,
                        ).toISOString()
                      : undefined,
                  }
                : {}),
              remarks: paymentForm.receivableRemarks.trim() || undefined,
            }
          : undefined,
      }
      const requestSignature = JSON.stringify({
        serviceJobId: selectedJob.id,
        ...settlementPayload,
      })

      if (paymentRequestRef.current.signature !== requestSignature) {
        paymentRequestRef.current = {
          signature: requestSignature,
          key: generateUUID(),
        }
      }

      await createServicePayment(selectedJob.id, {
        ...settlementPayload,
        idempotencyKey: paymentRequestRef.current.key,
      })
      setShowPayment(false)
      paymentRequestRef.current = { signature: "", key: "" }
      setNotice(`Settlement posted for ${selectedJob.jobCode}.`)
      await Promise.all([reloadSelected(selectedJob.id), loadJobs()])
    } catch (error) {
      setErrorMessage(apiError(error, "Could not post the service payment."))
    } finally {
      setIsSaving(false)
    }
  }

  const reversePayment = async (payment) => {
    const cancellationReason = window.prompt(
      `Reason for cancelling ${payment.paymentCode}?`,
    )
    if (!cancellationReason?.trim() || isSaving) return

    setIsSaving(true)
    setErrorMessage("")
    try {
      await cancelServicePayment(payment.id, {
        cancellationReason: cancellationReason.trim(),
      })
      setNotice(`${payment.paymentCode} cancelled with its linked cash event where applicable.`)
      await Promise.all([reloadSelected(selectedJob.id), loadJobs()])
    } catch (error) {
      setErrorMessage(apiError(error, "Could not cancel the service payment."))
    } finally {
      setIsSaving(false)
    }
  }

  const totals = useMemo(
    () => ({
      open: jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length,
      quick: jobs.filter((job) => job.isQuickService).length,
      ready: jobs.filter((job) => job.status === "READY_FOR_RELEASE").length,
      released: jobs.filter((job) => job.releasedAt).length,
    }),
    [jobs],
  )
  const totalPages = Math.max(1, meta.totalPages || 1)
  const selectedIsActive = selectedJob && ACTIVE_STATUSES.has(selectedJob.status)
  const selectedTechnicianId =
    selectedJob?.assignedTechnicianId || selectedJob?.assignedTechnician?.id
  const currentTechnician =
    technicians.find((technician) => technician.id === user?.id) || user
  const actionableRepairTypes =
    user?.role === "TECHNICIAN" && !isSeniorTechnician(currentTechnician)
      ? REPAIR_TYPES.filter((type) => type.value === "ORDINARY_REPAIR")
      : REPAIR_TYPES
  const technicianOptionsFor = (repairType) =>
    technicians.filter(
      (technician) =>
        isEligibleForRepairType(technician, repairType) &&
        (user?.role !== "TECHNICIAN" || technician.id === user.id),
    )
  const createTechnicianOptions = technicianOptionsFor(createForm.repairType)
  const selectedRepairType = selectedJob?.repairType || ""
  const actionRepairType = selectedRepairType || actionForm.repairType
  const releaseRepairType = selectedRepairType || releaseForm.repairType
  const assignmentTechnicianOptions = selectedRepairType
    ? technicianOptionsFor(selectedRepairType)
    : []
  const actionPerformerOptions = actionRepairType
    ? technicianOptionsFor(actionRepairType)
    : []
  const releasePerformerOptions = releaseRepairType
    ? technicianOptionsFor(releaseRepairType)
    : []
  const technicianCanHandleSelectedRepair =
    user?.role !== "TECHNICIAN" ||
    isEligibleForRepairType(currentTechnician, selectedRepairType)
  const canActOnSelected =
    canUpdateLifecycle &&
    technicianCanHandleSelectedRepair &&
    (user?.role !== "TECHNICIAN" || selectedTechnicianId === user?.id)
  const canSelfClaim =
    user?.role === "TECHNICIAN" &&
    Boolean(selectedRepairType) &&
    technicianCanHandleSelectedRepair &&
    selectedIsActive &&
    !selectedTechnicianId
  const canOpenAssignment =
    canManageAssignment &&
    user?.role !== "TECHNICIAN" &&
    selectedIsActive &&
    Boolean(selectedRepairType)
  const canPaySelected =
    canCollectPayment &&
    !selectedJob?.creditAccount &&
    Number(selectedJob?.remainingBalance || 0) > 0 &&
    (selectedJob?.status === "COMPLETED" || Boolean(selectedJob?.releasedAt))
  const allowedReleaseOutcomes =
    selectedJob?.status === "READY_FOR_RELEASE"
      ? RELEASE_OUTCOMES
      : RELEASE_OUTCOMES.filter((outcome) => UNREPAIRED_OUTCOMES.has(outcome.value))
  const releaseIsCompleted = COMPLETED_OUTCOMES.has(releaseForm.releaseOutcome)

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">Operations</p>
            <h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Services / Job Orders</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
              Receive repairs and quick technical work, separate the performer from each action actor, release with an explicit outcome, and retain a printable audit trail.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold" disabled={isLoading} onClick={refresh} type="button">
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} /> Refresh
            </button>
            {canCreate ? (
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={user?.role === "SUPER_OWNER" && !branchId}
                onClick={() => setShowCreate(true)}
                type="button"
              >
                <Plus size={17} /> New job order
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Open on this page", totals.open, Clock3],
            ["Quick services", totals.quick, Zap],
            ["Ready for release", totals.ready, CheckCircle2],
            ["Released", totals.released, UserRoundCheck],
          ].map(([label, value, Icon]) => (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm" key={label}>
              <Icon className="text-[var(--color-maroon)]" size={18} />
              <p className="mt-3 text-2xl font-black text-[var(--color-text-strong)]">{value}</p>
              <p className="text-xs font-bold text-[var(--color-muted)]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {notice ? (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <span>{notice}</span><button onClick={() => setNotice("")} type="button"><X size={16} /></button>
        </div>
      ) : null}
      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-700 dark:text-rose-300">
          <CircleAlert className="mt-0.5 shrink-0" size={17} /><span>{errorMessage}</span>
        </div>
      ) : null}

      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-card sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_210px_auto]">
          <label className="relative">
            <Search className="absolute left-3.5 top-3 text-[var(--color-muted)]" size={17} />
            <input
              aria-label="Search job orders"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[var(--color-maroon)]"
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Search JO, customer, device, serial, or title"
              value={search}
            />
          </label>
          <select
            aria-label="Filter service status"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3.5 py-2.5 text-sm font-bold"
            onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            value={statusFilter}
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{friendly(status)}</option>)}
          </select>
          <select
            aria-label="Filter repair category"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3.5 py-2.5 text-sm font-bold"
            onChange={(event) => { setRepairTypeFilter(event.target.value); setPage(1) }}
            value={repairTypeFilter}
          >
            <option value="">All repair categories</option>
            {REPAIR_TYPES.map((repairType) => <option key={repairType.value} value={repairType.value}>{repairType.label}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3.5 py-2.5 text-sm font-bold">
            <input checked={quickOnly} onChange={(event) => { setQuickOnly(event.target.checked); setPage(1) }} type="checkbox" /> Quick only
          </label>
        </div>

        {isLoading ? (
          <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={32} /></div>
        ) : jobs.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-center">
            <div><Wrench className="mx-auto text-[var(--color-muted)]" size={38} /><p className="mt-3 font-black text-[var(--color-text-strong)]">No job orders found</p><p className="mt-1 text-sm text-[var(--color-muted)]">Adjust the filters or receive a new service.</p></div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {jobs.map((job) => (
              <button className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition hover:border-[var(--color-maroon)]/40 hover:shadow-sm" key={job.id} onClick={() => openDetail(job)} type="button">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-[var(--color-maroon)]">{job.jobCode}</p>
                      {job.isQuickService ? <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-300">QUICK</span> : null}
                      <span className="rounded-full bg-[var(--color-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--color-text-strong)]">{friendly(job.repairType)}</span>
                    </div>
                    <h3 className="mt-1 truncate font-black text-[var(--color-text-strong)]">{job.jobTitle}</h3>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-[var(--color-muted)]">{job.deviceDescription || job.problemDescription || "No device details supplied."}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><p className="font-bold text-[var(--color-muted)]">Customer</p><p className="mt-1 truncate font-bold">{job.customerNameSnapshot || job.customer?.fullName || "Walk-in"}</p></div>
                  <div><p className="font-bold text-[var(--color-muted)]">Assigned technician</p><p className="mt-1 truncate font-bold">{job.assignedTechnician ? technicianLabel(job.assignedTechnician) : "Unassigned"}</p></div>
                  <div><p className="font-bold text-[var(--color-muted)]">Service Done By</p><p className="mt-1 truncate font-bold">{job.serviceDoneBy ? technicianLabel(job.serviceDoneBy) : "—"}</p></div>
                  <div><p className="font-bold text-[var(--color-muted)]">Repair category</p><p className="mt-1 font-bold">{friendly(job.repairType)}</p></div>
                  <div><p className="font-bold text-[var(--color-muted)]">Received</p><p className="mt-1 font-bold">{dateTime(job.receivedAt)}</p></div>
                  <div><p className="font-bold text-[var(--color-muted)]">Pricing / payment</p><p className="mt-1 font-bold">Base {moneyOrDash(job.baseServiceCharge)} · {percentOrDash(job.markupPercent)} markup</p><p className="mt-0.5 font-black">Final {moneyOrDash(job.finalServiceCharge)} · {friendly(job.paymentState)}</p></div>
                </div>
                <FinancialSnapshot compact job={job} />
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <p className="text-xs font-bold text-[var(--color-muted)]">{meta.total || 0} job order{meta.total === 1 ? "" : "s"}</p>
          <div className="flex items-center gap-2">
            <button aria-label="Previous page" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-[var(--color-text-strong)] disabled:opacity-40" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => value - 1)} type="button"><ChevronLeft size={17} /></button>
            <span className="text-xs font-black text-[var(--color-text-strong)]">{page} / {totalPages}</span>
            <button aria-label="Next page" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-[var(--color-text-strong)] disabled:opacity-40" disabled={page >= totalPages || isLoading} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={17} /></button>
          </div>
        </div>
      </section>

      {showCreate ? (
        <Modal onClose={() => setShowCreate(false)} title="Receive service / create Job Order" width="max-w-4xl">
          <form onSubmit={submitCreate}>
            <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5 sm:p-6">
              <label className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <input checked={createForm.isQuickService} className="mt-1" onChange={(event) => setCreateForm((form) => ({ ...form, isQuickService: event.target.checked }))} type="checkbox" />
                <span><strong className="block text-sm text-amber-900 dark:text-amber-200">Quick / same-day service</strong><span className="text-xs text-amber-800 dark:text-amber-300">Skips IN PROGRESS and may move directly from received to service performed.</span></span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Repair category *">
                  <select
                    className={FIELD_CLASS}
                    onChange={(event) => {
                      const repairType = event.target.value
                      setCreateForm((form) => {
                        const currentAssignee = technicians.find(
                          (technician) => technician.id === form.assignedTechnicianId,
                        )
                        return {
                          ...form,
                          repairType,
                          assignedTechnicianId:
                            currentAssignee && isEligibleForRepairType(currentAssignee, repairType)
                              ? form.assignedTechnicianId
                              : "",
                        }
                      })
                    }}
                    required
                    value={createForm.repairType}
                  >
                    {actionableRepairTypes.map((repairType) => <option key={repairType.value} value={repairType.value}>{repairType.label}</option>)}
                  </select>
                </Field>
                <Field label="Customer record (optional)">
                  <select className={FIELD_CLASS} onChange={(event) => setCreateForm((form) => ({ ...form, customerId: event.target.value }))} value={createForm.customerId}>
                    <option value="">Walk-in / receiving snapshot</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.fullName}{customer.companyName ? ` (${customer.companyName})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigned technician (optional at intake; not Service Done By)">
                  <select className={FIELD_CLASS} onChange={(event) => setCreateForm((form) => ({ ...form, assignedTechnicianId: event.target.value }))} value={createForm.assignedTechnicianId}>
                    <option value="">Unassigned</option>
                    {createTechnicianOptions.map((technician) => <option key={technician.id} value={technician.id}>{technicianLabel(technician)}</option>)}
                  </select>
                </Field>
              </div>

              {createForm.repairType === "BOARD_LEVEL_REPAIR" ? (
                <p className="rounded-2xl bg-sky-50 p-3 text-xs font-bold text-sky-800">Specialized / advanced repairs may only be assigned to and performed by a Senior Technician / Specialist. The backend verifies eligibility when this Job Order is saved.</p>
              ) : null}

              {!createForm.customerId ? (
                <div className="grid gap-4 rounded-2xl bg-[var(--color-soft)] p-4 sm:grid-cols-2">
                  <Field label="Walk-in customer name"><input className={FIELD_CLASS} maxLength="180" onChange={(event) => setCreateForm((form) => ({ ...form, customerNameSnapshot: event.target.value }))} value={createForm.customerNameSnapshot} /></Field>
                  <Field label="Customer contact"><input className={FIELD_CLASS} maxLength="250" onChange={(event) => setCreateForm((form) => ({ ...form, customerContactSnapshot: event.target.value }))} value={createForm.customerContactSnapshot} /></Field>
                </div>
              ) : null}

              <Field label="Job title / service type *"><input autoFocus className={FIELD_CLASS} maxLength="180" onChange={(event) => setCreateForm((form) => ({ ...form, jobTitle: event.target.value }))} required value={createForm.jobTitle} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Device / unit description"><textarea className={FIELD_CLASS} maxLength="500" onChange={(event) => setCreateForm((form) => ({ ...form, deviceDescription: event.target.value }))} rows="3" value={createForm.deviceDescription} /></Field>
                <Field label="Serial number"><input className={FIELD_CLASS} maxLength="180" onChange={(event) => setCreateForm((form) => ({ ...form, serialNumber: event.target.value }))} value={createForm.serialNumber} /></Field>
                <Field label="Reported issue / service request"><textarea className={FIELD_CLASS} maxLength="2000" onChange={(event) => setCreateForm((form) => ({ ...form, problemDescription: event.target.value }))} rows="3" value={createForm.problemDescription} /></Field>
                <Field label="Accessories received"><textarea className={FIELD_CLASS} maxLength="1200" onChange={(event) => setCreateForm((form) => ({ ...form, accessoriesReceived: event.target.value }))} rows="3" value={createForm.accessoriesReceived} /></Field>
                <Field label="Physical condition / receiving remarks"><textarea className={FIELD_CLASS} maxLength="2000" onChange={(event) => setCreateForm((form) => ({ ...form, receivingRemarks: event.target.value }))} rows="3" value={createForm.receivingRemarks} /></Field>
                <Field label="Initial diagnosis"><textarea className={FIELD_CLASS} maxLength="2000" onChange={(event) => setCreateForm((form) => ({ ...form, diagnosis: event.target.value }))} rows="3" value={createForm.diagnosis} /></Field>
              </div>
              <Field label="Service notes"><textarea className={FIELD_CLASS} maxLength="3000" onChange={(event) => setCreateForm((form) => ({ ...form, serviceNotes: event.target.value }))} rows="2" value={createForm.serviceNotes} /></Field>
              <ServicePricingFields
                baseServiceCharge={createForm.baseServiceCharge}
                markupPercent={createForm.markupPercent}
                onBaseChange={(value) => setCreateForm((form) => ({ ...form, baseServiceCharge: value }))}
                onMarkupChange={(value) => setCreateForm((form) => ({ ...form, markupPercent: value }))}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6">
              <button className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold" onClick={() => setShowCreate(false)} type="button">Cancel</button>
              <button className="rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={isSaving} type="submit">{isSaving ? "Receiving…" : "Receive & create JO"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {selectedJob ? (
        <Modal onClose={() => { setSelectedJob(null); setActionStatus(""); setShowPayment(false); setShowRelease(false); setShowAssignment(false); setIsPrintPreviewOpen(false) }} title={selectedJob.jobCode} width="max-w-4xl">
          <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">
            {isDetailLoading ? (
              <div className="grid min-h-48 place-items-center"><LoaderCircle className="animate-spin" /></div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black">{selectedJob.jobTitle}</h3>
                      {selectedJob.isQuickService ? <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2.5 py-1 text-xs font-black">QUICK SERVICE</span> : null}
                      <span className="rounded-full bg-[var(--color-soft)] px-2.5 py-1 text-xs font-black text-[var(--color-text-strong)]">{friendly(selectedJob.repairType)}</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">Received {dateTime(selectedJob.receivedAt)} · {selectedJob.branch?.name || selectedJob.branch?.code}</p>
                  </div>
                  <div className="flex items-center gap-2"><StatusBadge status={selectedJob.status} /><button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-black" onClick={() => setIsPrintPreviewOpen(true)} type="button"><Printer size={15} /> Print JO</button></div>
                </div>

                <div className="grid gap-3 rounded-2xl bg-[var(--color-soft)] p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Customer</p><p className="mt-1 font-bold">{selectedJob.customerNameSnapshot || selectedJob.customer?.fullName || "Walk-in"}</p><p className="text-xs text-[var(--color-muted)]">{selectedJob.customerContactSnapshot || "No contact supplied"}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Repair category</p><p className="mt-1 font-bold">{friendly(selectedJob.repairType)}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Assigned technician</p><p className="mt-1 font-bold">{selectedJob.assignedTechnician ? technicianLabel(selectedJob.assignedTechnician) : "Unassigned"}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Service Done By</p><p className="mt-1 font-bold">{selectedJob.serviceDoneBy ? technicianLabel(selectedJob.serviceDoneBy) : "—"}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Received by</p><p className="mt-1 font-bold">{selectedJob.receivedBy?.fullName || selectedJob.createdBy?.fullName || "—"}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Payment state</p><p className="mt-1 font-bold">{friendly(selectedJob.paymentState)}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Base service charge</p><p className="mt-1 font-bold">{moneyOrDash(selectedJob.baseServiceCharge)}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Markup</p><p className="mt-1 font-bold">{percentOrDash(selectedJob.markupPercent)}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Service markup amount</p><p className="mt-1 font-bold">{moneyOrDash(selectedJob.serviceMarkupAmount)}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Final service charge</p><p className="mt-1 font-bold">{moneyOrDash(selectedJob.finalServiceCharge)}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Release outcome</p><p className="mt-1 font-bold">{friendly(selectedJob.releaseOutcome)}</p></div>
                  <div><p className="text-xs font-bold text-[var(--color-muted)]">Released by / at</p><p className="mt-1 font-bold">{selectedJob.releasedBy?.fullName || "—"}</p><p className="text-xs text-[var(--color-muted)]">{dateTime(selectedJob.releasedAt)}</p></div>
                </div>

                <FinancialSnapshot job={selectedJob} />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Device / unit", selectedJob.deviceDescription],
                    ["Serial number", selectedJob.serialNumber],
                    ["Reported issue / request", selectedJob.problemDescription],
                    ["Accessories received", selectedJob.accessoriesReceived],
                    ["Physical condition / receiving remarks", selectedJob.receivingRemarks],
                    ["Diagnosis", selectedJob.diagnosis],
                    ["Service performed / notes", selectedJob.serviceNotes],
                    ["Release notes", selectedJob.releaseNotes],
                  ].map(([label, value]) => (
                    <div key={label}><p className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{value || "—"}</p></div>
                  ))}
                </div>

                {selectedJob.cancellationReason && !selectedJob.releaseOutcome ? (
                  <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700"><strong>Cancellation reason:</strong> {selectedJob.cancellationReason}</div>
                ) : null}

                {(selectedJob.payments || []).length > 0 || selectedJob.creditAccount ? (
                  <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 font-black text-emerald-800"><Banknote size={18} /> Settlement history</div>
                    {(selectedJob.payments || []).map((payment) => (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/80 p-3 text-sm" key={payment.id}>
                        <div><p className="font-black">{payment.paymentCode} · {friendly(payment.paymentMethod)} · {money(payment.amount)}</p><p className="mt-1 text-xs text-emerald-700">Collected {dateTime(payment.paidAt)} by {payment.collectedBy?.fullName || "—"} · {friendly(payment.status)}</p></div>
                        {canCancelPayment && payment.status === "POSTED" && !selectedJob.creditAccount ? <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700" disabled={isSaving} onClick={() => reversePayment(payment)} type="button">Cancel payment</button> : null}
                      </div>
                    ))}
                    {selectedJob.creditAccount ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><p className="font-black">AR {selectedJob.creditAccount.creditCode} · {friendly(selectedJob.creditAccount.provider)}</p><p className="mt-1">Remaining {money(selectedJob.creditAccount.remainingBalance)} · collected {money(selectedJob.creditAccount.totalCollected)}</p><p className="mt-1 text-xs">Further settlements are posted through Accounts Receivable collections.</p></div> : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 border-y border-[var(--color-border)] py-4">
                  {canOpenAssignment ? <button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold" onClick={openAssignment} type="button"><UserRoundCheck size={17} /> Change assignment</button> : null}
                  {canSelfClaim ? <button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold" disabled={isSaving} onClick={claimUnassignedJob} type="button"><UserRoundCheck size={17} /> Assign to me</button> : null}
                  {canActOnSelected ? lifecycleChoices(selectedJob).map((status) => (
                    <button className={status === "CANCELLED" ? "rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700" : "rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white"} key={status} onClick={() => beginLifecycleAction(status)} type="button">
                      {status === "IN_PROGRESS" ? "Start work" : status === "READY_FOR_RELEASE" ? "Mark service performed" : "Cancel without release"}
                    </button>
                  )) : null}
                  {canActOnSelected && selectedIsActive ? <button className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white" onClick={openRelease} type="button">Release job</button> : null}
                  {canPaySelected ? <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-gold)] px-4 py-2.5 text-sm font-black" onClick={openPayment} type="button"><Banknote size={17} /> Post payment / AR</button> : null}
                </div>

                <section>
                  <div className="flex items-center gap-2"><History size={18} className="text-[var(--color-maroon)]" /><h4 className="font-black">Action history</h4></div>
                  <div className="mt-3 space-y-2">
                    {(selectedJob.actionHistory || []).map((entry) => (
                      <div className="rounded-2xl border border-[var(--color-border)] p-3" key={entry.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black">{friendly(entry.action)}</p><p className="text-xs text-[var(--color-muted)]">{dateTime(entry.createdAt)}</p></div>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">{entry.description || "Lifecycle action recorded."}</p>
                        <p className="mt-1 text-xs font-bold">Action by {entry.actor?.fullName || "System"}{entry.metadata?.previousStatus ? ` · ${friendly(entry.metadata.previousStatus)} → ${friendly(entry.metadata.status)}` : ""}</p>
                      </div>
                    ))}
                    {(selectedJob.actionHistory || []).length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">No action entries are available for this historical record.</p> : null}
                  </div>
                </section>
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {actionStatus ? (
        <Modal onClose={() => setActionStatus("")} title={actionStatus === "CANCELLED" ? "Cancel job without release" : "Update Job Order status"}>
          <form onSubmit={submitLifecycleAction}>
            <div className="space-y-4 p-5 sm:p-6">
              {actionStatus === "CANCELLED" ? <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700"><strong>This closes the workflow without recording customer release.</strong> Use “Release job” for pull-outs, declines, no-fault, or unrepaired returns.</div> : null}
              {actionStatus !== "CANCELLED" ? (
                <Field label="Repair category *">
                  <select
                    className={FIELD_CLASS}
                    disabled={Boolean(selectedJob?.repairType)}
                    onChange={(event) => setActionForm((form) => ({ ...form, repairType: event.target.value, serviceDoneById: "" }))}
                    required
                    value={actionForm.repairType}
                  >
                    <option value="">Select the verified category</option>
                    {actionableRepairTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                  {!selectedJob?.repairType ? <p className="mt-2 text-xs font-semibold text-amber-800">This legacy job has no saved category. Choose it explicitly; it will not be guessed or backfilled silently.</p> : null}
                </Field>
              ) : null}
              {actionStatus === "READY_FOR_RELEASE" ? (
                <>
                  <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-800">
                    <p><strong>Repair category:</strong> {friendly(actionRepairType)}</p>
                    <p className="mt-1 text-xs">Service Done By is the actual performer and remains separate from the assigned technician and the user recording this action.</p>
                  </div>
                  <Field label="Service Done By *">
                    <select className={FIELD_CLASS} onChange={(event) => setActionForm((form) => ({ ...form, serviceDoneById: event.target.value }))} required value={actionForm.serviceDoneById}>
                      <option value="">Select the actual service performer</option>
                      {actionPerformerOptions.map((technician) => <option key={technician.id} value={technician.id}>{technicianLabel(technician)}</option>)}
                    </select>
                  </Field>
                  {actionRepairType === "BOARD_LEVEL_REPAIR" ? <p className="text-xs font-bold text-sky-800">Only Senior Technicians / Specialists are available for specialized work. Backend eligibility checks remain authoritative.</p> : null}
                  <ServicePricingFields
                    baseServiceCharge={actionForm.baseServiceCharge}
                    markupPercent={actionForm.markupPercent}
                    onBaseChange={(value) => setActionForm((form) => ({ ...form, baseServiceCharge: value }))}
                    onMarkupChange={(value) => setActionForm((form) => ({ ...form, markupPercent: value }))}
                  />
                </>
              ) : null}
              <Field label="Diagnosis"><textarea className={FIELD_CLASS} maxLength="2000" onChange={(event) => setActionForm((form) => ({ ...form, diagnosis: event.target.value }))} rows="3" value={actionForm.diagnosis} /></Field>
              <Field label="Service performed / notes"><textarea className={FIELD_CLASS} maxLength="3000" onChange={(event) => setActionForm((form) => ({ ...form, serviceNotes: event.target.value }))} rows="3" value={actionForm.serviceNotes} /></Field>
              {actionStatus === "CANCELLED" ? <Field label="Cancellation reason *"><textarea className={FIELD_CLASS} maxLength="2000" onChange={(event) => setActionForm((form) => ({ ...form, cancellationReason: event.target.value }))} required rows="3" value={actionForm.cancellationReason} /></Field> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6"><button className="rounded-xl border px-4 py-2.5 text-sm font-bold" onClick={() => setActionStatus("")} type="button">Back</button><button className={actionStatus === "CANCELLED" ? "rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white" : "rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white"} disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Save status"}</button></div>
          </form>
        </Modal>
      ) : null}

      {showAssignment ? (
        <Modal onClose={() => setShowAssignment(false)} title="Assign service technician">
          <form onSubmit={submitAssignment}>
            <div className="space-y-4 p-5 sm:p-6">
              <p className="text-sm text-[var(--color-muted)]">Assignment is for workflow ownership only. The actual performer and incentive beneficiary are captured separately as Service Done By when work is marked ready.</p>
              <p className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-700">Repair category: {friendly(selectedRepairType)}</p>
              <Field label="Assigned technician">
                <select className={FIELD_CLASS} onChange={(event) => setAssignmentId(event.target.value)} value={assignmentId}>
                  <option value="">Unassigned</option>
                  {assignmentId && !assignmentTechnicianOptions.some((technician) => technician.id === assignmentId) ? (
                    <option disabled value={assignmentId}>{selectedJob?.assignedTechnician ? `${technicianLabel(selectedJob.assignedTechnician)} · not eligible for this category` : "Current assignment is not eligible"}</option>
                  ) : null}
                  {assignmentTechnicianOptions.map((technician) => <option key={technician.id} value={technician.id}>{technicianLabel(technician)}</option>)}
                </select>
              </Field>
              {selectedRepairType === "BOARD_LEVEL_REPAIR" ? <p className="text-xs font-bold text-sky-800">Only Senior Technicians / Specialists may be assigned to specialized repairs. Backend validation remains authoritative.</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6"><button className="rounded-xl border px-4 py-2.5 text-sm font-bold" onClick={() => setShowAssignment(false)} type="button">Cancel</button><button className="rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white" disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Save assignment"}</button></div>
          </form>
        </Modal>
      ) : null}

      {showRelease ? (
        <Modal onClose={() => setShowRelease(false)} title="Release Job Order">
          <form onSubmit={submitRelease}>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-800">A repaired/service-completed release closes the JO as completed. An unrepaired, pull-out, no-fault, declined, or other release closes it without claiming that a repair was completed.</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Release outcome *"><select className={FIELD_CLASS} onChange={(event) => setReleaseForm((form) => ({ ...form, releaseOutcome: event.target.value }))} value={releaseForm.releaseOutcome}>{allowedReleaseOutcomes.map((outcome) => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}</select></Field>
                <Field label={releaseIsCompleted ? "Repair category *" : "Repair category (optional for legacy pull-out)"}>
                  <select
                    className={FIELD_CLASS}
                    disabled={Boolean(selectedJob?.repairType)}
                    onChange={(event) => setReleaseForm((form) => ({ ...form, repairType: event.target.value, serviceDoneById: "" }))}
                    required={releaseIsCompleted}
                    value={releaseForm.repairType}
                  >
                    <option value="">Unknown legacy category</option>
                    {actionableRepairTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </Field>
              </div>
              {releaseIsCompleted ? (
                <>
                  <Field label="Service Done By *">
                    <select className={FIELD_CLASS} onChange={(event) => setReleaseForm((form) => ({ ...form, serviceDoneById: event.target.value }))} required value={releaseForm.serviceDoneById}>
                      <option value="">Select the actual service performer</option>
                      {releasePerformerOptions.map((technician) => <option key={technician.id} value={technician.id}>{technicianLabel(technician)}</option>)}
                    </select>
                  </Field>
                  <p className="text-xs text-[var(--color-muted)]">Service Done By must be confirmed explicitly and is never copied from Assigned Technician. Technician accounts may select only themselves.</p>
                  {releaseRepairType === "BOARD_LEVEL_REPAIR" ? <p className="text-xs font-bold text-sky-800">Only Senior Technicians / Specialists are available for specialized work. Backend eligibility checks remain authoritative.</p> : null}
                </>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>No repair incentive will be recorded.</strong> Keep the charge at zero for a no-charge pull-out, or retain an actual diagnostic/service charge where applicable.</div>
              )}
              <ServicePricingFields
                baseServiceCharge={releaseForm.baseServiceCharge}
                markupPercent={releaseForm.markupPercent}
                onBaseChange={(value) => setReleaseForm((form) => ({ ...form, baseServiceCharge: value }))}
                onMarkupChange={(value) => setReleaseForm((form) => ({ ...form, markupPercent: value }))}
              />
              <Field label={releaseForm.releaseOutcome === "OTHER" ? "Release notes *" : "Release notes"}><textarea className={FIELD_CLASS} maxLength="2000" onChange={(event) => setReleaseForm((form) => ({ ...form, releaseNotes: event.target.value }))} required={releaseForm.releaseOutcome === "OTHER"} rows="3" value={releaseForm.releaseNotes} /></Field>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Diagnosis"><textarea className={FIELD_CLASS} maxLength="2000" onChange={(event) => setReleaseForm((form) => ({ ...form, diagnosis: event.target.value }))} rows="3" value={releaseForm.diagnosis} /></Field><Field label="Service performed / notes"><textarea className={FIELD_CLASS} maxLength="3000" onChange={(event) => setReleaseForm((form) => ({ ...form, serviceNotes: event.target.value }))} rows="3" value={releaseForm.serviceNotes} /></Field></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6"><button className="rounded-xl border px-4 py-2.5 text-sm font-bold" onClick={() => setShowRelease(false)} type="button">Back</button><button className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white" disabled={isSaving} type="submit">{isSaving ? "Releasing…" : "Confirm release"}</button></div>
          </form>
        </Modal>
      ) : null}

      {showPayment ? (
        <Modal onClose={() => setShowPayment(false)} title="Post service settlement">
          <form onSubmit={submitPayment}>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-[var(--color-muted)]">Outstanding service amount</p><p className="mt-1 text-2xl font-black">{money(selectedJob?.remainingBalance)}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Settlement arrangement *"><select className={FIELD_CLASS} onChange={(event) => { const arrangement = event.target.value; setPaymentForm((form) => ({ ...form, arrangement, amount: RECEIVABLE_PROVIDER_VALUES.has(arrangement) ? "0" : String(selectedJob?.remainingBalance || "") })) }} value={paymentForm.arrangement}><optgroup label="Immediate settlement">{IMMEDIATE_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{friendly(method)}</option>)}</optgroup><optgroup label="Accounts receivable">{RECEIVABLE_PROVIDERS.map((provider) => <option key={provider} value={provider}>{friendly(provider)}</option>)}</optgroup></select></Field>
                <Field label={RECEIVABLE_PROVIDER_VALUES.has(paymentForm.arrangement) ? "Immediate settlement / downpayment" : "Payment amount *"}><input className={FIELD_CLASS} max={Number(selectedJob?.remainingBalance || 0)} min="0" onChange={(event) => setPaymentForm((form) => ({ ...form, amount: event.target.value }))} required step="0.01" type="number" value={paymentForm.amount} /></Field>
              </div>
              {RECEIVABLE_PROVIDER_VALUES.has(paymentForm.arrangement) ? <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-sm font-black text-blue-900">Open AR · {friendly(paymentForm.arrangement)}</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Immediate settlement method"><select className={FIELD_CLASS} onChange={(event) => setPaymentForm((form) => ({ ...form, settlementMethod: event.target.value }))} value={paymentForm.settlementMethod}>{IMMEDIATE_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{friendly(method)}</option>)}</select></Field><Field label="Provider reference"><input className={FIELD_CLASS} maxLength="180" onChange={(event) => setPaymentForm((form) => ({ ...form, providerReferenceNo: event.target.value }))} value={paymentForm.providerReferenceNo} /></Field></div>{paymentForm.arrangement === "IN_HOUSE_INSTALLMENT" ? <div className="grid gap-4 sm:grid-cols-3"><Field label="Term *"><select className={FIELD_CLASS} onChange={(event) => setPaymentForm((form) => ({ ...form, term: event.target.value }))} value={paymentForm.term}>{INSTALLMENT_TERMS.map((term) => <option key={term} value={term}>{friendly(term)}</option>)}</select></Field><Field label="Due day"><input className={FIELD_CLASS} max="31" min="1" onChange={(event) => setPaymentForm((form) => ({ ...form, dueDay: event.target.value }))} step="1" type="number" value={paymentForm.dueDay} /></Field><Field label="First due date"><input className={FIELD_CLASS} onChange={(event) => setPaymentForm((form) => ({ ...form, firstDueDate: event.target.value }))} type="date" value={paymentForm.firstDueDate} /></Field></div> : null}<Field label="AR remarks"><textarea className={FIELD_CLASS} maxLength="1000" onChange={(event) => setPaymentForm((form) => ({ ...form, receivableRemarks: event.target.value }))} rows="2" value={paymentForm.receivableRemarks} /></Field><p className="text-xs text-blue-800">Only in-house installment requires a named customer and uses saved installment settings. Other providers keep a principal AR balance without invented installment math.</p></div> : null}
              <Field label="Reference number"><input className={FIELD_CLASS} maxLength="180" onChange={(event) => setPaymentForm((form) => ({ ...form, referenceNo: event.target.value }))} value={paymentForm.referenceNo} /></Field>
              <Field label="Remarks"><textarea className={FIELD_CLASS} maxLength="1000" onChange={(event) => setPaymentForm((form) => ({ ...form, remarks: event.target.value }))} rows="2" value={paymentForm.remarks} /></Field>
              <p className="text-xs text-[var(--color-muted)]">Partial immediate payments are supported. A receivable covers the remaining source amount atomically; subsequent payments are posted from Accounts Receivable.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6"><button className="rounded-xl border px-4 py-2.5 text-sm font-bold" onClick={() => setShowPayment(false)} type="button">Cancel</button><button className="rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white" disabled={isSaving} type="submit">{isSaving ? "Posting…" : "Post settlement"}</button></div>
          </form>
        </Modal>
      ) : null}

      {isPrintPreviewOpen && selectedJob ? <JobOrderPrintPreview job={selectedJob} onClose={() => setIsPrintPreviewOpen(false)} /> : null}
    </div>
  )
}
