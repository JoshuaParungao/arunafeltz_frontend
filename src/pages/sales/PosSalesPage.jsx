import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  AlertCircle,
  Barcode,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  PackageSearch,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react"

import { USER_ROLES, getRoleLabel } from "../../constants/roles"
import { createCustomer, getCustomers, updateCustomerById } from "../../features/customers/customers.api"
import {
  getInventoryBatches,
  getInventorySerials,
} from "../../features/inventory/inventory.api"
import { getItems } from "../../features/items/items.api"
import { parseItemWarranty } from "../items/ItemsPage"
import {
  createQuotation,
  getQuotationById,
  getQuotations,
  getQuotationServiceStaff,
  updateQuotationStatus,
} from "../../features/quotations/quotations.api"
import {
  getServiceJobs,
  getServiceJobById,
  getServiceCatalog,
  updateServiceJobStatus,
  releaseServiceJob,
} from "../../features/service-jobs/serviceJobs.api"
import { extractServiceTasks, extractServiceParts } from "../services/serviceJobForms"
import { generateUUID } from "../../utils/uuid"
import {
  appendSaleItems,
  cancelSale,
  createSaleReturn,
  createSale,
  getSaleById,
  getSales,
} from "../../features/sales/sales.api"
import { getInstallmentBasisSettings } from "../../features/settings/settings.api"
import {
  exportReportExcel,
  exportWarrantyReceiptPdf,
  groupReceiptItems,
  printWarrantyReceipt,
} from "../../utils/businessDocumentExport"
import ExportExcelButton from "../../components/common/ExportExcelButton"
import QuotationDetailDialog from "../../components/quotations/QuotationDetailDialog"
import QuotationConversionDialog from "../../components/quotations/QuotationConversionDialog"
import { serializeQuotationNotes } from "../../utils/quotationSettlement"
import {
  saveFormDraft,
  getFormDraft,
  clearFormDraft,
  saveCustomerItemTier,
  getCustomerItemTiers,
} from "../../lib/sessionStorage"

const SALE_MANAGER_ROLES = new Set([
  USER_ROLES.SUPER_OWNER,
  USER_ROLES.BRANCH_OWNER,
  USER_ROLES.ADMIN,
  USER_ROLES.CASHIER,
  USER_ROLES.TECHNICIAN,
])

const SALE_CANCELLER_ROLES = new Set([
  USER_ROLES.SUPER_OWNER,
  USER_ROLES.BRANCH_OWNER,
  USER_ROLES.ADMIN,
])

const IMMEDIATE_PAYMENT_METHODS = [
  ["CASH", "Cash"],
  ["GCASH", "GCash"],
  ["BANK_TRANSFER", "Bank transfer"],
  ["OTHER", "Other"],
]

const RECEIVABLE_PROVIDERS = [
  ["CREDIT_CARD", "Credit card receivable"],
  ["DEBIT_CARD", "Debit card receivable"],
  ["HOMECREDIT", "Home Credit"],
  ["SALMON", "Salmon"],
  ["SKYRO", "Skyro"],
  ["OTHER_FINANCING", "Other financing"],
  ["IN_HOUSE_INSTALLMENT", "In-house installment"],
]

const RECEIVABLE_PROVIDER_VALUES = new Set(
  RECEIVABLE_PROVIDERS.map(([value]) => value),
)

const PRICING_TERMS = {
  CASH: {
    id: "CASH",
    label: "Cash Discounted Price",
    shortLabel: "Cash Discount",
    divisor: 1.0,
    markupPercent: 0,
    note: "Cash, GCash, Bank Transfer",
  },
  SRP: {
    id: "SRP",
    label: "Suggested Retail Price",
    shortLabel: "SRP (Cash / 0.96)",
    divisor: 0.96,
    markupPercent: 4,
    note: "Straight Finance / Card (Cash / 0.96)",
  },
  REGULAR: {
    id: "REGULAR",
    label: "Regular Price",
    shortLabel: "Regular (Cash / 0.875)",
    divisor: 0.875,
    markupPercent: 12.5,
    note: "Installment Basis (Cash / 0.875)",
  },
}

const INSTALLMENT_TERMS = [
  ["CASH_PROMO", "Cash Promo (0% Interest) (Tier Price)"],
  ["STRAIGHT", "Straight (Rate: 0.96)"],
  ["MONTH_3", "3 months (Rate: 0.96)"],
  ["MONTH_6", "6 months (Rate: 0.935)"],
  ["MONTH_9", "9 months (Rate: 0.905)"],
  ["MONTH_12", "12 months (Rate: 0.875)"],
  ["MONTH_18", "18 months (Rate: 0.815)"],
  ["MONTH_24", "24 months (Rate: 0.755)"],
]

const INSTALLMENT_TERM_MONTHS = {
  CASH_PROMO: 1,
  STRAIGHT: 1,
  MONTH_3: 3,
  MONTH_6: 6,
  MONTH_9: 9,
  MONTH_12: 12,
  MONTH_18: 18,
  MONTH_24: 24,
}

const DEFAULT_INSTALLMENT_BASIS = {
  CASH_PROMO: 1.0,
  STRAIGHT: 0.96,
  MONTH_3: 0.96,
  MONTH_6: 0.935,
  MONTH_9: 0.905,
  MONTH_12: 0.875,
  MONTH_18: 0.815,
  MONTH_24: 0.755,
}

const DEFAULT_TERM_RATES = {
  ...DEFAULT_INSTALLMENT_BASIS,
  TERM_3M: 0.96,
  TERM_6M: 0.935,
  TERM_9M: 0.905,
  TERM_12M: 0.875,
  TERM_18M: 0.815,
  TERM_24M: 0.755,
}

const RETURN_METHODS = [
  ["CASH", "Cash"],
  ["GCASH", "GCash"],
  ["BANK_TRANSFER", "Bank transfer"],
  ["CARD", "Card"],
  ["STORE_CREDIT", "Store credit (recorded)"],
]

const SALE_STATUS_STYLES = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  PAID: "bg-emerald-50 text-emerald-700",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700",
  UNPAID: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-red-50 text-red-700",
  REFUNDED: "bg-slate-100 text-slate-700",
  PARTIALLY_REFUNDED: "bg-orange-50 text-orange-700",
}

function formatMoney(value) {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value, includeTime = true) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date)
}

function formatStatus(value) {
  return String(value || "Unknown")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function createRequestKey() {
  return generateUUID()
}

const ERROR_CODE_TRANSLATIONS = {
  CASH_SOURCE_CONFLICT: "A cash register conflict occurred while recording this payment.",
  STAFF_CUSTOM_PRICE_NOT_ALLOWED: "Custom pricing is not permitted for staff accounts.",
  CANNOT_APPEND_TO_SALE_IN_CURRENT_STATUS: "Items cannot be added to a sale in its current status.",
  INSUFFICIENT_PAYMENT_FOR_ADDED_ITEMS: "The tendered payment is less than the total for the added items.",
  SERIAL_NOT_AVAILABLE: "The entered serial number is not available or has already been sold.",
  SERIAL_REQUIRED: "A serial number is required for this item.",
  BATCH_NOT_FOUND: "No active stock batch found for this item in this branch.",
  INSUFFICIENT_BATCH_QUANTITY: "Insufficient stock available in this branch.",
  ITEM_NOT_FOUND: "The requested item was not found in this branch.",
  CREDIT_ACCOUNT_NOT_FOUND: "The associated credit account was not found.",
  CANNOT_APPEND_TO_INACTIVE_CREDIT_ACCOUNT: "Cannot add items to an inactive or cancelled credit account.",
  RECEIVABLE_INITIAL_SETTLEMENT_EXCEEDS_TOTAL: "Downpayment cannot exceed the total purchase price.",
  SALE_NOT_FOUND: "Sale record not found.",
  BRANCH_ACCESS_DENIED: "You do not have access to records from another branch.",
}

function getApiErrorMessage(error, fallback) {
  const raw =
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    (typeof error?.response?.data?.error === "string" ? error.response.data.error : null) ||
    error?.message ||
    fallback
  return ERROR_CODE_TRANSLATIONS[raw] || raw
}

function getCatalogRows(response) {
  if (Array.isArray(response)) return response

  const result = response || {}
  const innerData = result.data || {}

  if (Array.isArray(result.items)) return result.items
  if (Array.isArray(innerData.items)) return innerData.items
  if (Array.isArray(result.data)) return result.data
  if (Array.isArray(innerData.data)) return innerData.data
  if (Array.isArray(result.records)) return result.records
  if (Array.isArray(innerData.records)) return innerData.records

  return []
}

function getInventoryRows(response) {
  if (Array.isArray(response)) return response

  const result = response || {}
  const innerData = result.data || {}

  if (Array.isArray(result.data)) return result.data
  if (Array.isArray(innerData.data)) return innerData.data
  if (Array.isArray(result.items)) return result.items
  if (Array.isArray(innerData.items)) return innerData.items
  if (Array.isArray(result.records)) return result.records
  if (Array.isArray(innerData.records)) return innerData.records

  return []
}

function getSaleListResult(response) {
  const result = response || {}
  const innerData = result.data || {}

  const rows = Array.isArray(result.data)
    ? result.data
    : Array.isArray(innerData.items)
      ? innerData.items
      : Array.isArray(innerData.data)
        ? innerData.data
        : Array.isArray(result.items)
          ? result.items
          : Array.isArray(result.records)
            ? result.records
            : []

  return {
    rows,
    meta: result.meta || innerData.pagination || result.pagination || null,
  }
}

const TIER_LABELS = {
  1: "SRP / Retail",
  2: "Wholesale / Dealer",
  3: "VIP / Contractor",
  4: "Corporate / Special",
  5: "Promo / Clearance",
}

function availablePriceTiers(item) {
  const tiers = [1, 2, 3, 4, 5].filter((tier) => {
    const value = Number(item?.[`price${tier}`])
    return Number.isFinite(value) && value >= 0
  })

  return tiers.length > 0 ? tiers : [1]
}

function defaultPriceTier(item) {
  const tiers = availablePriceTiers(item)
  return tiers.find((tier) => Number(item?.[`price${tier}`]) > 0) || tiers[0]
}

function getMarkupAdjustedPrice(basePrice, markupPercent) {
  const base = Number(basePrice || 0)
  const markup =
    markupPercent === "" || markupPercent === undefined || markupPercent === null
      ? 0
      : Number(markupPercent)

  if (!Number.isFinite(base)) return 0
  if (!Number.isFinite(markup) || markup < 0 || markup >= 100) return base

  return roundMoney(base / (1 - markup / 100))
}

function getServiceMarkupAdjustedPrice(basePrice, markupPercent) {
  const base = Number(basePrice || 0)
  const markup =
    markupPercent === "" || markupPercent === undefined || markupPercent === null
      ? 0
      : Number(markupPercent)

  if (!Number.isFinite(base)) return 0
  if (!Number.isFinite(markup) || markup < 0 || markup >= 100) return base

  return Math.round((base / (1 - markup / 100)) * 100) / 100
}

function getLineBaseUnitPrice(line) {
  if (line.type === "SERVICE") return Number(line.baseUnitPrice ?? line.unitPrice ?? 0)
  return Number(line.item?.[`price${line.priceTier}`] || 0)
}

function getLineUnitPrice(line, term = "CASH") {
  let base = 0
  if (line.type === "SERVICE") {
    base = getServiceMarkupAdjustedPrice(
      getLineBaseUnitPrice(line),
      line.markupPercent,
    )
  } else {
    base = getMarkupAdjustedPrice(
      getLineBaseUnitPrice(line),
      line.markupPercent,
    )
  }

  const divisor = PRICING_TERMS[term]?.divisor || 1.0
  if (divisor !== 1.0) {
    return Math.round((base / divisor) * 100) / 100
  }
  return base
}

function getLineGross(line, term = "CASH") {
  return Number(line.quantity || 0) * getLineUnitPrice(line, term)
}

function getLineTotal(line, term = "CASH") {
  return Math.max(getLineGross(line, term) - Number(line.discountAmount || 0), 0)
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function getReturnedLineAmount(sale, saleItemId) {
  return (sale?.returnRequests || []).reduce(
    (requestTotal, request) =>
      requestTotal +
      (request.items || [])
        .filter((item) => item.saleItemId === saleItemId)
        .reduce((lineTotal, item) => lineTotal + Number(item.lineRefundAmount || 0), 0),
    0,
  )
}

function StatusBadge({ status }) {
  const normalized = String(status || "UNKNOWN").toUpperCase()

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        SALE_STATUS_STYLES[normalized] || "bg-slate-100 text-slate-700"
      }`}
    >
      {formatStatus(normalized)}
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

function SaleDetailDialog({
  canCancel,
  canReturn,
  errorMessage,
  isLoading,
  onAddItems,
  onCancelSale,
  onClose,
  onReturnItems,
  sale,
  isCheckoutPreview = false,
  onConfirmCheckout = null,
  isSubmittingCheckout = false,
}) {
  const [previewCustomerName, setPreviewCustomerName] = useState(sale?.customer?.fullName || "")
  const [previewCustomerAddress, setPreviewCustomerAddress] = useState(sale?.customer?.address || "")
  const [previewCustomerPhone, setPreviewCustomerPhone] = useState(
    sale?.customer?.mobileNumber || sale?.customer?.phone || ""
  )
  const [previewCustomerEmail, setPreviewCustomerEmail] = useState(sale?.customer?.email || "")
  const [previewCustomerCompany, setPreviewCustomerCompany] = useState(sale?.customer?.companyName || "")
  const [previewRemarks, setPreviewRemarks] = useState(sale?.remarks || "")
  const [checkoutError, setCheckoutError] = useState("")

  useEffect(() => {
    setPreviewCustomerName(sale?.customer?.fullName || "")
    setPreviewCustomerAddress(sale?.customer?.address || "")
    setPreviewCustomerPhone(sale?.customer?.mobileNumber || sale?.customer?.phone || "")
    setPreviewCustomerEmail(sale?.customer?.email || "")
    setPreviewCustomerCompany(sale?.customer?.companyName || "")
    setPreviewRemarks(sale?.remarks || "")
    setCheckoutError("")
  }, [sale])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const branchAddress =
    sale?.branch?.address ||
    "Kingspire Business Centre, Km.71, Mac Arthur Highway, San Isidro, City of San Fernando, Pampanga"
  const branchContact = sale?.branch?.contactNo || "0961-873-5798 / 045-404-0673"

  const paymentType = useMemo(() => {
    if (sale?.creditAccount) {
      const provider = sale.creditAccount.provider || sale.paymentMethod || "CREDIT_CARD"
      const providerName = formatStatus(provider)
      if ((sale?.payments || []).length > 0) {
        const dpMethods = sale.payments
          .map((p) => formatStatus(p.paymentMethod))
          .join(", ")
        return `${providerName} (DP: ${dpMethods})`
      }
      return `${providerName} Receivable`
    }
    if ((sale?.payments || []).length > 0) {
      return sale.payments
        .map((p) => formatStatus(p.paymentMethod))
        .join(", ")
    }
    return "CASH"
  }, [sale])

  const termsText = useMemo(() => {
    const term = sale?.creditAccount?.term || sale?.receivable?.term || sale?.creditTerm
    if (term === "CASH_PROMO") {
      return "Cash Promo (0% Interest)"
    }
    if (term === "STRAIGHT") {
      return "Straight"
    }
    if (term) {
      return formatStatus(term)
    }
    return "FULL / OUTRIGHT"
  }, [sale])

  const technicianName = useMemo(() => {
    let name =
      sale?.technician?.fullName ||
      sale?.quotation?.serviceDoneBy?.fullName ||
      ""

    if (!name) {
      const itemWithDoneBy = (sale?.items || []).find((item) =>
        typeof item.description === "string" && item.description.includes("[Done by:")
      )
      if (itemWithDoneBy) {
        const match = itemWithDoneBy.description.match(/\[Done by:\s*([^\]]+)\]/)
        if (match && match[1]) {
          name = match[1].trim()
        }
      }
    }

    return name || "—"
  }, [sale])

  const isCredit = Boolean(sale?.creditAccount || sale?.installmentCalculation)
  const paidAmount = Number(
    sale?.amountPaid ??
      sale?.creditAccount?.downpaymentAmount ??
      sale?.creditAccount?.initialPaymentAmount ??
      sale?.installmentCalculation?.downpayment ??
      0
  )
  const isCreditCardWithDp =
    (sale?.creditAccount?.provider === "CREDIT_CARD" ||
      sale?.installmentCalculation?.isCreditCardWithDp ||
      sale?.paymentMethod === "CREDIT_CARD") &&
    paidAmount > 0
  const cashPromoTotal = Number(
    sale?.creditAccount?.cashPromoTotalAmount ??
      sale?.creditAccount?.sourceTotalAmountSnapshot ??
      sale?.installmentCalculation?.cashPromoTotal ??
      sale?.subtotal ??
      0
  )
  const rawTermBasis = Number(
    sale?.creditAccount?.termBasis ||
      sale?.installmentCalculation?.termBasis ||
      0
  )
  const termKey = sale?.creditAccount?.term || sale?.creditTerm
  const termBasis = rawTermBasis > 0 && rawTermBasis < 1
    ? rawTermBasis
    : (termKey && DEFAULT_TERM_RATES[termKey]) || 1
  const savedRegular = Number(
    sale?.creditAccount?.regularPriceTotalAmount ||
      sale?.creditAccount?.principalAmount ||
      sale?.installmentCalculation?.regularPriceTotalAmount ||
      0
  )
  const rawTotalAmount = isCredit && savedRegular > 0
    ? savedRegular
    : Number(sale?.grandTotal || sale?.subtotal || 0)

  const ccSwipeAmount = isCreditCardWithDp && termBasis < 1 && cashPromoTotal > 0
    ? Math.round((Math.max(cashPromoTotal - paidAmount, 0) / termBasis) * 100) / 100
    : null
  const totalAmount = ccSwipeAmount != null
    ? Math.round((paidAmount + ccSwipeAmount) * 100) / 100
    : (termBasis < 1 && termBasis > 0 && cashPromoTotal > 0
        ? (savedRegular > cashPromoTotal ? savedRegular : Math.round((cashPromoTotal / termBasis) * 100) / 100)
        : rawTotalAmount)
  const balanceToPay = ccSwipeAmount != null
    ? ccSwipeAmount
    : Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100)

  const groupedItems = useMemo(() => {
    return groupReceiptItems(sale?.items || [], {
      termBasis,
      isCreditCardWithDp,
    })
  }, [sale?.items, termBasis, isCreditCardWithDp])

  const handleConfirmCheckout = () => {
    setCheckoutError("")

    if (!previewCustomerName.trim()) {
      setCheckoutError("Customer Full Name is required before completing the sale.")
      return
    }

    if (!previewCustomerPhone.trim()) {
      setCheckoutError("Contact / Mobile No. is required for the warranty receipt.")
      return
    }

    if (!previewCustomerAddress.trim()) {
      setCheckoutError("Address (Street, City, Province) is required for the warranty receipt.")
      return
    }

    if (onConfirmCheckout) {
      onConfirmCheckout({
        customerName: previewCustomerName.trim(),
        customerAddress: previewCustomerAddress.trim(),
        customerPhone: previewCustomerPhone.trim(),
        customerEmail: previewCustomerEmail.trim(),
        customerCompany: previewCustomerCompany.trim() || undefined,
        remarks: previewRemarks.trim(),
      })
    }
  }

  return createPortal(
    <div
      aria-labelledby="sale-detail-title"
      aria-modal="true"
      className="sale-receipt-print-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-2 sm:p-6"
      role="dialog"
    >
      <div className="sale-receipt-print-shell mx-auto min-h-full max-w-4xl py-2 sm:py-6">
        <section className="sale-receipt-print-document overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-2xl">
          {/* Top Bar for Dialog Controls */}
          <header className="sale-receipt-print-actions flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold text-white ${
                  isCheckoutPreview ? "bg-amber-600" : "bg-[var(--color-maroon)]"
                }`}
              >
                <ReceiptText size={14} />
                {isCheckoutPreview ? "SALE CHECKOUT PREVIEW" : "WARRANTY RECEIPT"}
              </span>
              {sale?.quotation?.isPcBuild || sale?.remarks?.includes("[PC BUILD]") || sale?.isPcBuild ? (
                <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-white">
                  🖥️ PC Build / Set
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {isCheckoutPreview && onConfirmCheckout ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-soft transition hover:bg-emerald-700 disabled:opacity-50"
                  disabled={isSubmittingCheckout}
                  onClick={handleConfirmCheckout}
                  type="button"
                >
                  {isSubmittingCheckout ? (
                    <>
                      <LoaderCircle className="animate-spin" size={14} />
                      Completing…
                    </>
                  ) : (
                    <>
                      <ReceiptText size={14} />
                      Complete Sale · {formatMoney(totalAmount)}
                    </>
                  )}
                </button>
              ) : (
                <>
                  {onAddItems && ["COMPLETED", "PARTIALLY_REFUNDED"].includes(sale?.status) ? (
                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-soft transition hover:bg-emerald-800"
                      onClick={() => onAddItems(sale)}
                      title="Add items to this receipt"
                      type="button"
                    >
                      <Plus size={15} /> Add Items
                    </button>
                  ) : null}
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100"
                    onClick={() => exportWarrantyReceiptPdf(sale)}
                    title="Export as PDF file"
                    type="button"
                  >
                    <Download size={15} /> Export PDF
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-3.5 py-2 text-xs font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]"
                    onClick={() => printWarrantyReceipt(sale)}
                    title="Print receipt"
                    type="button"
                  >
                    <Printer size={15} /> Print receipt
                  </button>
                </>
              )}
              <button
                aria-label="Close sale details"
                className="rounded-xl border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-100"
                onClick={onClose}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* Customer Details Input Panel for Checkout Preview */}
          {isCheckoutPreview ? (
            <div className="sale-receipt-print-actions border-b border-amber-200 bg-amber-50/70 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-amber-200 text-amber-900 font-bold text-xs">
                    <UserRound size={13} />
                  </span>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-950">
                      Customer Information for Warranty Receipt
                    </h3>
                    <p className="text-[11px] text-amber-800">
                      Please ensure contact number and complete address are provided before finalizing.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 shrink-0">
                  Updates receipt in real-time
                </span>
              </div>

              {checkoutError ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-2.5 text-xs font-bold text-red-700">
                  <AlertCircle className="shrink-0" size={15} />
                  <span>{checkoutError}</span>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                    Customer Full Name <span className="text-red-500">*</span>
                  </span>
                  <input
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] transition"
                    value={previewCustomerName}
                    onChange={(e) => {
                      setPreviewCustomerName(e.target.value)
                      if (checkoutError) setCheckoutError("")
                    }}
                    placeholder="e.g. Juan Dela Cruz"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                    Contact / Mobile No. <span className="text-red-500">*</span>
                  </span>
                  <input
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] transition"
                    value={previewCustomerPhone}
                    onChange={(e) => {
                      setPreviewCustomerPhone(e.target.value)
                      if (checkoutError) setCheckoutError("")
                    }}
                    placeholder="e.g. 0917-123-4567 / 0961-873-5798"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                    Address (Street, City, Province) <span className="text-red-500">*</span>
                  </span>
                  <input
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] transition"
                    value={previewCustomerAddress}
                    onChange={(e) => {
                      setPreviewCustomerAddress(e.target.value)
                      if (checkoutError) setCheckoutError("")
                    }}
                    placeholder="e.g. Brgy. San Isidro, CSFP"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                    Company <span className="text-slate-500 font-normal">(Optional)</span>
                  </span>
                  <input
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] transition"
                    value={previewCustomerCompany}
                    onChange={(e) => setPreviewCustomerCompany(e.target.value)}
                    placeholder="e.g. Company / Business Name"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                    Sale Remarks / Warranty Notes <span className="text-slate-500 font-normal">(Optional)</span>
                  </span>
                  <input
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] transition"
                    value={previewRemarks}
                    onChange={(e) => setPreviewRemarks(e.target.value)}
                    placeholder="e.g. Warranty notes, special instructions, freebies..."
                  />
                </label>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center gap-3 p-8 text-sm font-semibold text-slate-500">
              <LoaderCircle className="animate-spin" size={18} />
              Loading warranty receipt…
            </div>
          ) : errorMessage ? (
            <div className="p-6">
              <ErrorBanner>{errorMessage}</ErrorBanner>
            </div>
          ) : sale ? (
            <div className="p-6 sm:p-8 space-y-6">
              {/* Receipt Body Matching WARRANTY-RECEIPT.xlsx */}
              <div className="border border-slate-300 p-5 rounded-xl bg-white shadow-xs font-sans text-xs text-slate-900">
                {/* Header Grid: Left = Store info, Right = Customer & Sale meta */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-4 border-b border-slate-200">
                  {/* Left Store Info */}
                  <div className="md:col-span-6 space-y-1">
                    <h1 className="text-sm font-black tracking-tight text-slate-950 uppercase leading-snug">
                      ARUNAFELTZ COMPUTER PARTS AND ACCESSORIES SHOP
                    </h1>
                    <p className="text-[11px] text-slate-700 leading-normal">
                      {branchAddress}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-800">
                      {branchContact}
                    </p>
                  </div>

                  {/* Right Customer / Sales Meta */}
                  <div className="md:col-span-6 grid grid-cols-3 gap-y-1 text-[11px]">
                    <span className="font-bold text-slate-600">Date:</span>
                    <span className="col-span-2 font-bold uppercase">{formatDate(sale.saleDate)}</span>

                    <span className="font-bold text-slate-600">Customer Name:</span>
                    <span className="col-span-2 font-bold uppercase">
                      {(isCheckoutPreview ? previewCustomerName : sale.customer?.fullName) || "WALK-IN CUSTOMER"}
                      {(isCheckoutPreview ? previewCustomerCompany : sale.customer?.companyName) ? (
                        <span className="ml-1.5 text-slate-500 font-semibold normal-case">
                          ({isCheckoutPreview ? previewCustomerCompany : sale.customer?.companyName})
                        </span>
                      ) : null}
                    </span>

                    <span className="font-bold text-slate-600">Address:</span>
                    <span className="col-span-2">
                      {(isCheckoutPreview ? previewCustomerAddress : sale.customer?.address) || "—"}
                    </span>

                    <span className="font-bold text-slate-600">Contact No.:</span>
                    <span className="col-span-2">
                      {(isCheckoutPreview ? previewCustomerPhone : (sale.customer?.mobileNumber || sale.customer?.email)) || "—"}
                    </span>

                    <span className="font-bold text-slate-600">Salesman:</span>
                    <span className="col-span-2 font-bold uppercase">{sale.cashier?.fullName || sale.cashier?.username || "—"}</span>

                    <span className="font-bold text-slate-600">Payment Type:</span>
                    <span className="col-span-2">{paymentType}</span>

                    <span className="font-bold text-slate-600">TERMS:</span>
                    <span className="col-span-2">{termsText}</span>

                    <span className="font-bold text-slate-600">TECHNICIAN:</span>
                    <span className="col-span-2 font-bold uppercase">{technicianName}</span>
                  </div>
                </div>

                {/* Banner: Exact Original WARRANTY RECEIPT & Receipt No */}
                <div className="py-2.5 my-1 flex items-center justify-between">
                  <div className="flex-1 text-center pl-12">
                    <h2 className="text-base font-bold italic tracking-wide text-[#002060] uppercase leading-none">
                      WARRANTY RECEIPT
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 text-right text-xs">
                    <span className="font-bold italic text-[#002060]">No.</span>
                    <span className="font-mono font-bold text-[#002060] text-sm border-b border-[#002060] pb-0.5">
                      {sale.receiptCode}
                    </span>
                  </div>
                </div>

                {/* Items Table with Exact Columns & Style */}
                <div className="overflow-x-auto my-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-t-2 border-b-2 border-slate-900 text-slate-900 font-bold uppercase text-[11px]">
                        <th className="py-2 px-2 w-[15%]">ITEM CODE</th>
                        <th className="py-2 px-2 w-[40%]">ITEM DESCRIPTION</th>
                        <th className="py-2 px-1 text-center w-[8%]">QTY.</th>
                        <th className="py-2 px-1 text-center w-[11%] print:hidden text-[#002060]">
                          AVAIL. STOCK
                        </th>
                        <th className="py-2 px-2 text-right w-[13%]">UNIT PRICE</th>
                        <th className="py-2 px-2 text-right w-[13%]">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {groupedItems.map((item) => (
                        <tr className="hover:bg-slate-50/50" key={item.id}>
                          <td className="py-2 px-2 font-mono font-semibold text-slate-700 align-top">
                            {item.itemCode}
                          </td>
                          <td className="py-2 px-2 align-top space-y-0.5">
                            <p className="font-medium text-slate-900">
                              {item.description}
                              {item.warrantyBadge ? ` | ${item.warrantyBadge}` : ""}
                            </p>
                            {item.serialNumbers?.length > 0 ? (
                              <p className="text-[11px] font-mono text-slate-600">
                                S/N: <strong className="text-slate-800">{item.serialNumbers.join(", ")}</strong>
                              </p>
                            ) : null}
                            {Number(item.returnedQuantity || 0) > 0 ? (
                              <p className="text-[10px] font-bold text-orange-700">
                                Returned: {Number(item.returnedQuantity)}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-2 px-1 text-center font-bold align-top">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-1 text-center align-top print:hidden">
                            {item.availableStock !== null && item.availableStock !== undefined ? (
                              item.availableStock >= Number(item.quantity || 1) ? (
                                <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {item.availableStock}
                                </span>
                              ) : item.availableStock > 0 ? (
                                <span
                                  className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-300"
                                  title={`Remaining stock: ${item.availableStock}`}
                                >
                                  {item.availableStock} (Low)
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                                  title="0 Available in branch"
                                >
                                  0 (Out)
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right align-top font-mono">
                            {formatMoney(item.unitPrice)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold align-top font-mono">
                            {formatMoney(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Remarks / Notes */}
                {(isCheckoutPreview ? previewRemarks : sale.remarks) ? (
                  <div className="mt-2 mb-1 px-1 text-xs text-slate-700">
                    <span className="font-bold text-slate-900">Remarks: </span>
                    <span className="font-medium text-slate-800">
                      {isCheckoutPreview ? previewRemarks : sale.remarks}
                    </span>
                  </div>
                ) : null}

                {/* Double Border Separator */}
                <div className="border-t-2 border-b border-slate-900 my-1 pt-0.5" />

                {/* Totals & Non-BIR Notice */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 py-3 items-start">
                  <div className="sm:col-span-6 space-y-2">
                    <p className="italic text-xs font-semibold text-slate-600">
                      This receipt is not valid for input tax.
                    </p>
                  </div>

                  <div className="sm:col-span-6 space-y-1.5 text-xs text-right">
                    {isCredit || isCreditCardWithDp || Boolean(sale?.creditAccount) ? (
                      <>
                        <div className="flex justify-between text-slate-600">
                          <span>ORIGINAL CASH PRICE</span>
                          <span>{formatMoney(cashPromoTotal > 0 ? cashPromoTotal : totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>CASH DOWNPAYMENT</span>
                          <span>{formatMoney(paidAmount)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                          <span>Balance to pay</span>
                          <span>{formatMoney(balanceToPay)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between font-bold text-slate-900 text-sm">
                          <span>TOTAL AMOUNT</span>
                          <span>{formatMoney(totalAmount)}</span>
                        </div>
                        {paidAmount > 0 ? (
                          <div className="flex justify-between text-slate-700">
                            <span>AMOUNT PAID</span>
                            <span>{formatMoney(paidAmount)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                          <span>BALANCE TO PAY</span>
                          <span>{formatMoney(balanceToPay)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Warranty Disclaimers */}
                <div className="border-t border-slate-200 pt-3 text-center space-y-1">
                  <p className="font-bold text-[11px] text-slate-900 uppercase">
                    NO WARRANTY ON SOFTWARE/S (O.S. - WINDOWS and MS OFFICE), IF ANY
                  </p>
                  <p className="text-[10px] text-slate-600">
                    Pls. read all WARRANTY GUIDELINES &amp; PROCEDURES at the back of this page. (BRING –IN WARRANTY)
                  </p>
                </div>

                {/* Signatures Section */}
                <div className="mt-8 pt-4 border-t border-slate-200">
                  <p className="text-right text-[10px] italic text-slate-600 mb-6">
                    Received Items in good order and Condition
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-xs">
                    <div className="space-y-6">
                      <p className="text-left font-bold text-slate-600 text-[11px]">Prepared by:</p>
                      <div className="border-b border-slate-400 pt-2 font-semibold text-[11px] uppercase min-h-[1.5rem]">
                        {sale.cashier?.fullName || sale.cashier?.username || "\u00A0"}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="text-left font-bold text-slate-600 text-[11px]">Warehouse:</p>
                      <div className="border-b border-slate-400 pt-2 font-semibold text-[11px] text-slate-400 min-h-[1.5rem]">
                        &nbsp;
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="text-left font-bold text-slate-600 text-[11px]">Releasing:</p>
                      <div className="border-b border-slate-400 pt-2 font-semibold text-[11px] text-slate-400 min-h-[1.5rem]">
                        &nbsp;
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="text-left font-bold text-slate-600 text-[11px]">Received by:</p>
                      <div className="border-b border-slate-400 pt-2 text-[10px] text-slate-500">
                        Signature over Printed Name
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Checkout Preview Confirmation Action Bar */}
              {isCheckoutPreview && onConfirmCheckout ? (
                <div className="sale-receipt-print-actions flex items-center justify-end gap-3 pt-2">
                  <button
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                    disabled={isSubmittingCheckout}
                    onClick={onClose}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-soft hover:bg-emerald-700 transition disabled:opacity-50"
                    disabled={isSubmittingCheckout}
                    onClick={handleConfirmCheckout}
                    type="button"
                  >
                    {isSubmittingCheckout ? (
                      <>
                        <LoaderCircle className="animate-spin" size={15} />
                        Completing Sale…
                      </>
                    ) : (
                      <>
                        <ReceiptText size={15} />
                        Complete Sale · {formatMoney(totalAmount)}
                      </>
                    )}
                  </button>
                </div>
              ) : null}

              {/* Optional Administrative Actions for Authorized Staff (Excluded from Print via sale-receipt-print-actions) */}
              {(sale.payments || []).length > 0 || sale.creditAccount || (sale.returnRequests || []).length > 0 || canCancel || canReturn ? (
                <div className="sale-receipt-print-actions space-y-4 pt-2">
                  {sale.creditAccount ? (
                    <section className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900">
                      <p className="font-black text-sm">Accounts receivable · {sale.creditAccount.creditCode}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <p><span className="font-semibold">Provider:</span> {formatStatus(sale.creditAccount.provider)}</p>
                        <p><span className="font-semibold">Source total:</span> {formatMoney(sale.creditAccount.sourceTotalAmountSnapshot)}</p>
                        <p><span className="font-semibold">Balance:</span> {formatMoney(sale.creditAccount.remainingBalance)}</p>
                        <p><span className="font-semibold">Term:</span> {sale.creditAccount.term ? formatStatus(sale.creditAccount.term) : "Not applicable"}</p>
                      </div>
                    </section>
                  ) : null}

                  {(sale.returnRequests || []).length > 0 ? (
                    <section>
                      <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Completed returns</h3>
                      <div className="mt-2 space-y-2">
                        {sale.returnRequests.map((request) => (
                          <article className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-950" key={request.id}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-black">{request.returnCode}</p>
                                <p className="mt-0.5 text-[11px] text-orange-800">{formatDate(request.completedAt)} · {formatStatus(request.refundMethod)}</p>
                              </div>
                              <strong>{formatMoney(request.totalRefundAmount)}</strong>
                            </div>
                            <p className="mt-2 font-semibold">{request.reason}</p>
                            <div className="mt-2 space-y-1">
                              {(request.items || []).map((item) => (
                                <div className="flex justify-between gap-4 border-t border-orange-200 pt-1 text-[11px]" key={item.id}>
                                  <span>{item.description} · Qty {Number(item.quantity || 0)}{item.serial?.serialNumber ? ` · ${item.serial.serialNumber}` : ""}</span>
                                  <strong>{formatMoney(item.lineRefundAmount)}</strong>
                                </div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {(canCancel || canReturn || onAddItems) && ["COMPLETED", "PARTIALLY_REFUNDED"].includes(sale.status) ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Audit Actions & Reversals
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-500 max-w-md">
                          Authorized staff can add items to this sale, process an item refund/return, or void the whole sale receipt.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {onAddItems ? (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-800"
                              onClick={() => onAddItems(sale)}
                              type="button"
                            >
                              <Plus size={14} /> Add Items to Receipt
                            </button>
                          ) : null}
                          {canReturn && !sale.creditAccount && (sale.items || []).some((item) => item.itemId && Number(item.remainingReturnQuantity || 0) > 0) ? (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-orange-700"
                              onClick={() => onReturnItems(sale)}
                              type="button"
                            >
                              <RotateCcw size={14} /> Item Refund / Return
                            </button>
                          ) : null}
                          {canCancel && sale.status === "COMPLETED" ? (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                              onClick={() => onCancelSale(sale)}
                              type="button"
                            >
                              <X size={14} /> Void Receipt
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>,
    document.body,
  )
}

function CancelSaleDialog({ isSaving, onClose, onConfirm, sale }) {
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState("")

  const submit = (event) => {
    event.preventDefault()
    const normalizedReason = reason.trim()

    if (!normalizedReason) {
      setMessage("Enter a cancellation reason. It will remain on the sale audit record.")
      return
    }

    onConfirm(normalizedReason)
  }

  return (
    <div aria-labelledby="cancel-sale-title" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/70 p-4" role="dialog">
      <form className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6" onSubmit={submit}>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-red-700">Auditable reversal</p>
        <h2 className="mt-1 text-xl font-black text-[var(--color-text-strong)]" id="cancel-sale-title">Cancel {sale.receiptCode}?</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          This cancels the entire sale and restores its stock, serials, and linked cash entry. This workspace supports whole-sale cancellation, not individual line voiding.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Cancellation reason</span>
          <textarea
            autoFocus
            className="mt-2 min-h-28 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm outline-none focus:border-red-400"
            disabled={isSaving}
            onChange={(event) => {
              setReason(event.target.value)
              setMessage("")
            }}
            placeholder="Explain why this sale is being reversed"
            value={reason}
          />
        </label>
        {message ? <p className="mt-2 text-sm font-semibold text-red-700">{message}</p> : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] disabled:opacity-50"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Keep sale
          </button>
          <button
            className="rounded-2xl bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Cancelling…" : "Confirm cancellation"}
          </button>
        </div>
      </form>
    </div>
  )
}

function AppendSaleItemsDialog({ installmentRates, isSaving, onClose, onConfirm, sale }) {
  const isCreditSale = Boolean(sale?.creditAccount)
  const initialTerm = sale?.creditAccount?.term || "MONTH_12"
  const [selectedTerm, setSelectedTerm] = useState(initialTerm)
  const [items, setItems] = useState([])
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [remarks, setRemarks] = useState("")
  const [message, setMessage] = useState("")

  const termBasis = useMemo(() => {
    if (!isCreditSale) return 1
    if (selectedTerm === "CASH_PROMO") return 1
    const rate = installmentRates?.[selectedTerm] ?? DEFAULT_INSTALLMENT_BASIS[selectedTerm]
    return typeof rate === "number" && rate > 0 ? rate : (selectedTerm === "STRAIGHT" ? 0.96 : 1)
  }, [isCreditSale, installmentRates, selectedTerm])

  const months = useMemo(() => {
    return INSTALLMENT_TERM_MONTHS[selectedTerm] || 1
  }, [selectedTerm])

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }
    let active = true
    setIsSearching(true)
    const timer = setTimeout(() => {
      getItems({
        branchId: sale.branchId,
        status: "ACTIVE",
        search: search.trim(),
        limit: 10,
      })
        .then((res) => {
          if (!active) return
          const rows = getCatalogRows(res)
          setSearchResults(rows)
        })
        .catch(() => {
          if (active) setSearchResults([])
        })
        .finally(() => {
          if (active) setIsSearching(false)
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [sale.branchId, search])

  const addItem = (item) => {
    const defaultTier = 1
    const defaultPrice = Number(item.price1 || 0)
    const newLine = {
      id: generateUUID(),
      item,
      description: item.itemName,
      priceTier: defaultTier,
      quantity: 1,
      unitPrice: defaultPrice,
      serialNumber: "",
      discountAmount: 0,
    }
    setItems((prev) => [...prev, newLine])
    setSearch("")
    setSearchResults([])
    setMessage("")
  }

  const removeItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const updateLine = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const updated = { ...it, [field]: value }
        if (field === "priceTier" && it.item) {
          const tier = Number(value)
          const priceMap = {
            1: it.item.price1,
            2: it.item.price2,
            3: it.item.price3,
            4: it.item.price4,
            5: it.item.price5,
          }
          updated.unitPrice = Number(priceMap[tier] || it.item.price1 || 0)
        }
        return updated
      })
    )
  }

  const addedCashSubtotal = useMemo(() => {
    return items.reduce(
      (sum, it) => sum + Number(it.quantity || 0) * Number(it.unitPrice || 0),
      0
    )
  }, [items])

  const addedGrandTotal = addedCashSubtotal

  useEffect(() => {
    if (isCreditSale) {
      setPaymentAmount((prev) => (prev === "" ? "0.00" : prev))
    } else {
      setPaymentAmount(addedGrandTotal > 0 ? addedGrandTotal.toFixed(2) : "")
    }
  }, [addedGrandTotal, isCreditSale])

  // Financing live calculation breakdown
  const financingSummary = useMemo(() => {
    if (!isCreditSale) return null

    const prevCashPromo = Number(sale?.creditAccount?.cashPromoTotalAmount || sale?.creditAccount?.sourceTotalAmountSnapshot || sale?.subtotal || sale?.grandTotal || 0)
    const combinedCashPromo = prevCashPromo + addedGrandTotal
    const prevDownpayment = Number(sale?.creditAccount?.downpaymentAmount || 0)
    const addedDownpayment = Number(paymentAmount || 0)
    const totalDownpayment = prevDownpayment + addedDownpayment

    const isCreditCard = sale?.creditAccount?.provider === "CREDIT_CARD"

    let combinedRegularTotal
    let combinedFinancedBalance

    if (isCreditCard && totalDownpayment > 0) {
      const remainingCash = Math.max(combinedCashPromo - totalDownpayment, 0)
      const swipeAmount = Math.round((remainingCash / termBasis) * 100) / 100
      combinedRegularTotal = Math.round((totalDownpayment + swipeAmount) * 100) / 100
      combinedFinancedBalance = swipeAmount
    } else {
      combinedRegularTotal = selectedTerm === "CASH_PROMO" || termBasis === 1
        ? combinedCashPromo
        : Math.round((combinedCashPromo / termBasis) * 100) / 100
      combinedFinancedBalance = Math.max(Math.round((combinedRegularTotal - totalDownpayment) * 100) / 100, 0)
    }

    const prevCollected = Number(sale?.creditAccount?.totalCollected || 0)
    const newRemainingBalance = Math.max(combinedFinancedBalance - prevCollected, 0)
    const newMonthlyDue = Math.round((combinedFinancedBalance / months) * 100) / 100

    const addedFinancedAmount = selectedTerm === "CASH_PROMO" || termBasis === 1
      ? addedGrandTotal
      : Math.round((addedGrandTotal / termBasis) * 100) / 100
    const addedTermAdj = Math.max(addedFinancedAmount - addedGrandTotal, 0)
    const netAddedToBalance = Math.max(addedFinancedAmount - addedDownpayment, 0)
    const prevRemainingBalance = Number(sale?.creditAccount?.remainingBalance || 0)
    const termRestructureAdj = Math.round((newRemainingBalance - (prevRemainingBalance + netAddedToBalance)) * 100) / 100

    return {
      termBasis,
      months,
      prevCashPromo,
      combinedCashPromo,
      addedFinancedAmount,
      addedTermAdj,
      addedDownpayment,
      netAddedToBalance,
      combinedRegularTotal,
      combinedFinancedBalance,
      prevRemainingBalance,
      termRestructureAdj,
      newRemainingBalance,
      prevMonthlyDue: Number(sale?.creditAccount?.monthlyDueAmount || 0),
      newMonthlyDue,
    }
  }, [isCreditSale, sale, addedGrandTotal, paymentAmount, selectedTerm, termBasis, months])

  const changeAmount = useMemo(() => {
    const tender = Number(paymentAmount || 0)
    return Math.max(tender - addedGrandTotal, 0)
  }, [addedGrandTotal, paymentAmount])

  const submit = async (event) => {
    event.preventDefault()
    setMessage("")

    if (items.length === 0) {
      setMessage("Please add at least one item.")
      return
    }

    for (const it of items) {
      if (Number(it.quantity) <= 0) {
        setMessage(`Quantity for ${it.description || "item"} must be greater than 0.`)
        return
      }
      if (it.item?.isSerialized && !it.serialNumber?.trim()) {
        setMessage(`Serial number is required for serialized item: ${it.item.itemName}.`)
        return
      }
    }

    const tender = Number(paymentAmount || 0)
    if (!isCreditSale && tender < addedGrandTotal) {
      setMessage(`Payment amount must be at least ₱${formatMoney(addedGrandTotal)}.`)
      return
    }
    if (isCreditSale && tender < 0) {
      setMessage("Downpayment amount cannot be negative.")
      return
    }

    const payload = {
      items: items.map((it) => ({
        itemId: it.item?.id,
        description: it.item ? undefined : it.description,
        priceTier: it.item ? Number(it.priceTier || 1) : undefined,
        quantity: Number(it.quantity),
        unitPrice: it.item ? undefined : Number(it.unitPrice),
        serialNumber: it.serialNumber?.trim() || undefined,
      })),
      payments: tender > 0 ? [
        {
          paymentMethod,
          amount: tender,
          referenceNo: paymentReference.trim() || undefined,
        },
      ] : [],
      term: isCreditSale ? selectedTerm : undefined,
      remarks: remarks.trim() || undefined,
    }

    try {
      await onConfirm(payload)
    } catch (err) {
      setMessage(getApiErrorMessage(err, "Unable to add items to this sale."))
    }
  }

  const newReceiptTotal = Number(sale.grandTotal || 0) + addedGrandTotal

  return (
    <div
      aria-labelledby="append-items-title"
      aria-modal="true"
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/70 p-3 sm:p-5 overflow-y-auto backdrop-blur-xs"
      role="dialog"
    >
      <div className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                isCreditSale ? "text-blue-700 bg-blue-100" : "text-emerald-700 bg-emerald-100"
              }`}>
                {isCreditSale ? "Financed Sale Add-on" : "Same Receipt Add-on"}
              </span>
              <span className="font-mono text-xs font-bold text-slate-500">
                Receipt #{sale.receiptCode}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-black text-slate-900" id="append-items-title">
              Add Items to Sale #{sale.receiptCode}
            </h2>
            <p className="text-xs text-slate-500">
              Customer: <strong className="text-slate-700">{sale.customer?.fullName || "Walk-in customer"}</strong> · Current Total: <strong className="text-slate-900 font-mono">₱{formatMoney(sale.grandTotal)}</strong>
            </p>
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
            {isCreditSale && sale.creditAccount ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    💳 Active Financing · {formatStatus(sale.creditAccount.provider)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-900">
                      Basis: {termBasis.toFixed(4)} ({months} mos)
                    </span>
                    <span className="font-mono text-[11px] font-bold text-blue-700">
                      #{sale.creditAccount.creditCode}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                      Financing Term (Changeable)
                    </label>
                    <select
                      className="w-full rounded-xl border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-bold text-blue-900 outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={isSaving}
                      onChange={(e) => setSelectedTerm(e.target.value)}
                      value={selectedTerm}
                    >
                      <option value="STRAIGHT">Straight / 0% (1 mo)</option>
                      <option value="MONTH_3">Month 3 (3 mos)</option>
                      <option value="MONTH_6">Month 6 (6 mos)</option>
                      <option value="MONTH_9">Month 9 (9 mos)</option>
                      <option value="MONTH_12">Month 12 (12 mos)</option>
                      <option value="MONTH_18">Month 18 (18 mos)</option>
                      <option value="MONTH_24">Month 24 (24 mos)</option>
                    </select>
                  </div>
                  <div className="rounded-xl bg-white border border-blue-100 p-2">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Current Financed Balance</span>
                    <span className="font-mono font-bold text-blue-900 text-sm">₱{formatMoney(sale.creditAccount.remainingBalance)}</span>
                    <span className="text-[10px] text-slate-400 block">Due: ₱{formatMoney(sale.creditAccount.monthlyDueAmount || 0)}/mo</span>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2">
                    <span className="text-[10px] text-emerald-800 block font-bold uppercase">Additional Downpayment</span>
                    <span className="font-bold text-emerald-900 text-xs">Optional</span>
                    <span className="text-[10px] text-emerald-700 block">Can be ₱0.00 (charged to balance)</span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="relative">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Search & Add Product to this Receipt
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    disabled={isSaving}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type product name, code, or brand..."
                    value={search}
                  />
                  {isSearching ? (
                    <LoaderCircle className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  ) : null}
                </div>
              </label>

              {searchResults.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-100">
                  {searchResults.map((item) => (
                    <button
                      className="w-full text-left p-2.5 hover:bg-emerald-50/50 flex items-center justify-between text-xs transition"
                      key={item.id}
                      onClick={() => addItem(item)}
                      type="button"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{item.itemName}</p>
                        <p className="text-[10px] text-slate-400">{item.itemCode} {item.brand ? `· ${item.brand}` : ""} {item.isSerialized ? "· Serialized" : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-emerald-700">₱{formatMoney(item.price1)}</p>
                        <p className="text-[10px] text-slate-500">{Number(item.quantityAvailable ?? item.totalStock ?? item.stockQuantity ?? 0)} available</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Items to Append ({items.length})
                </span>
                {items.length === 0 ? (
                  <span className="text-xs text-slate-400">Search products above to add them to this sale.</span>
                ) : null}
              </div>

              {items.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5 w-24">Price Tier</th>
                        <th className="p-2.5 w-20">Qty</th>
                        <th className="p-2.5 w-32 text-right">Unit Price</th>
                        <th className="p-2.5 w-32 text-right">Total</th>
                        <th className="p-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5">
                            <p className="font-bold text-slate-900">{line.description}</p>
                            {line.item?.isSerialized ? (
                              <input
                                className="mt-1 w-full rounded-lg border border-amber-300 bg-amber-50/50 px-2 py-1 text-[11px] font-mono text-slate-800 outline-none focus:border-amber-500"
                                onChange={(e) => updateLine(line.id, "serialNumber", e.target.value)}
                                placeholder="Scan or type serial number *"
                                value={line.serialNumber}
                              />
                            ) : null}
                          </td>
                          <td className="p-2.5">
                            <select
                              className="w-full rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold outline-none"
                              onChange={(e) => updateLine(line.id, "priceTier", e.target.value)}
                              value={line.priceTier}
                            >
                              <option value="1">P1 (₱{formatMoney(line.item?.price1)})</option>
                              <option value="2">P2 (₱{formatMoney(line.item?.price2)})</option>
                              <option value="3">P3 (₱{formatMoney(line.item?.price3)})</option>
                              <option value="4">P4 (₱{formatMoney(line.item?.price4)})</option>
                              <option value="5">P5 (₱{formatMoney(line.item?.price5)})</option>
                            </select>
                          </td>
                          <td className="p-2.5">
                            <input
                              className="w-full rounded-lg border border-slate-200 bg-white p-1 text-xs font-mono font-bold text-center outline-none"
                              min="1"
                              onChange={(e) => updateLine(line.id, "quantity", Math.max(1, Number(e.target.value) || 1))}
                              type="number"
                              value={line.quantity}
                            />
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            <p className="font-semibold text-slate-700">₱{formatMoney(line.unitPrice)}</p>
                            {isCreditSale && termBasis < 1 ? (
                              <p className="text-[10px] text-blue-700 font-bold">
                                Financed: ₱{formatMoney(Math.round((line.unitPrice / termBasis) * 100) / 100)}
                              </p>
                            ) : null}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            <p className="font-bold text-slate-900">
                              ₱{formatMoney(Number(line.quantity || 0) * Number(line.unitPrice || 0))}
                            </p>
                            {isCreditSale && termBasis < 1 ? (
                              <p className="text-[10px] text-blue-900 font-black">
                                Financed: ₱{formatMoney(Math.round(((Number(line.quantity || 0) * Number(line.unitPrice || 0)) / termBasis) * 100) / 100)}
                              </p>
                            ) : null}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                              onClick={() => removeItem(line.id)}
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            {items.length > 0 ? (
              isCreditSale && financingSummary ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-blue-200/80 pb-1.5">
                    <span className="text-xs font-bold uppercase text-blue-900">
                      Installment Recomputation Summary ({formatStatus(selectedTerm)})
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-900">
                      Rate / Factor: {termBasis.toFixed(4)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-white border border-blue-100 p-2">
                      <span className="text-[10px] text-slate-500 block">Added Items (Cash Price)</span>
                      <span className="font-mono font-bold text-slate-900">₱{formatMoney(addedGrandTotal)}</span>
                    </div>
                    <div className="rounded-xl bg-white border border-blue-100 p-2">
                      <span className="text-[10px] text-blue-700 block">Term Interest / Adjustment</span>
                      <span className="font-mono font-bold text-blue-900">+{formatMoney(financingSummary.addedTermAdj)}</span>
                    </div>
                    <div className="rounded-xl bg-white border border-blue-100 p-2">
                      <span className="text-[10px] text-indigo-700 block">Added Items Financed Value</span>
                      <span className="font-mono font-bold text-indigo-900">₱{formatMoney(financingSummary.addedFinancedAmount)}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-blue-100 p-2.5 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Current Financed Balance:</span>
                      <span className="font-mono font-semibold text-slate-700">₱{formatMoney(financingSummary.prevRemainingBalance)}</span>
                    </div>
                    <div className="flex justify-between text-blue-900 font-bold">
                      <span>Added to Financed Balance (after DP):</span>
                      <span className="font-mono text-sm text-blue-900">+{formatMoney(financingSummary.netAddedToBalance)}</span>
                    </div>
                    {Math.abs(financingSummary.termRestructureAdj || 0) > 0.01 ? (
                      <div className="flex justify-between text-indigo-700 text-xs">
                        <span>Term Restructure Adjustment (on previous items):</span>
                        <span className="font-mono font-bold text-indigo-800">
                          {financingSummary.termRestructureAdj > 0 ? "+" : "−"}₱{formatMoney(Math.abs(financingSummary.termRestructureAdj))}
                        </span>
                      </div>
                    ) : null}
                    {Number(paymentAmount || 0) > 0 ? (
                      <div className="flex justify-between text-emerald-700 text-xs">
                        <span>Additional Downpayment Paid:</span>
                        <span className="font-mono font-bold text-emerald-800">−₱{formatMoney(Number(paymentAmount || 0))}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-slate-900 font-black pt-1.5 border-t border-blue-100 text-sm">
                      <span>New Total Financed Balance:</span>
                      <span className="font-mono text-base text-blue-950">₱{formatMoney(financingSummary.newRemainingBalance)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 font-bold pt-1 border-t border-blue-100">
                      <span>New Monthly Amortization ({months} months):</span>
                      <span className="font-mono text-sm text-emerald-900">₱{formatMoney(financingSummary.newMonthlyDue)} / mo</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Additional Items Total:</span>
                    <span className="font-mono font-bold text-emerald-800 text-sm">₱{formatMoney(addedGrandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-emerald-200">
                    <span>Original Receipt Total:</span>
                    <span className="font-mono font-semibold text-slate-700">₱{formatMoney(sale.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-900 font-black pt-1 border-t border-emerald-200">
                    <span>New Overall Receipt Grand Total:</span>
                    <span className="font-mono text-base text-emerald-900">₱{formatMoney(newReceiptTotal)}</span>
                  </div>
                </div>
              )
            ) : null}

            {items.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {isCreditSale ? "Additional Downpayment (Optional)" : `Payment for Added Items (₱${formatMoney(addedGrandTotal)})`}
                  </p>
                  {isCreditSale ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Can be 0.00 (charged to balance)
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Payment Method</span>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                      disabled={isSaving}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      value={paymentMethod}
                    >
                      <option value="CASH">Cash</option>
                      <option value="GCASH">GCash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        {isCreditSale ? "Downpayment Amount (₱)" : "Tendered Amount"}
                      </span>
                      {!isCreditSale && addedGrandTotal > 0 ? (
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(String(addedGrandTotal))}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition cursor-pointer"
                        >
                          Exact (₱{formatMoney(addedGrandTotal)})
                        </button>
                      ) : null}
                    </div>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-500"
                      disabled={isSaving}
                      min="0"
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={paymentAmount}
                    />
                  </label>
                </div>

                {Number(paymentAmount || 0) > 0 && paymentMethod !== "CASH" ? (
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Reference Number</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                      disabled={isSaving}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="e.g. GCash Ref # or Transaction ID"
                      value={paymentReference}
                    />
                  </label>
                ) : null}

                {paymentMethod === "CASH" && changeAmount > 0 ? (
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl">
                    <span>Change:</span>
                    <span className="font-mono text-sm text-emerald-700">₱{formatMoney(changeAmount)}</span>
                  </div>
                ) : null}

                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Remarks / Note (Optional)</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    disabled={isSaving}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={isCreditSale ? "e.g. Additional items added to financing" : "e.g. Additional cables & accessories requested by customer"}
                    value={remarks}
                  />
                </label>
              </div>
            ) : null}

            {message ? <p className="text-xs font-bold text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">{message}</p> : null}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition disabled:opacity-50"
              disabled={isSaving || items.length === 0}
              type="submit"
            >
              {isSaving ? <LoaderCircle className="animate-spin" size={14} /> : <Plus size={14} />}
              {isSaving
                ? "Appending items…"
                : isCreditSale && financingSummary
                  ? `Confirm & Append to Financing (+₱${formatMoney(financingSummary.netAddedToBalance)})`
                  : `Confirm & Append (₱${formatMoney(addedGrandTotal)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReturnSaleItemsDialog({ isSaving, onClose, onConfirm, sale }) {
  const eligibleItems = (sale.items || []).filter(
    (item) => item.itemId && Number(item.remainingReturnQuantity || 0) > 0,
  )
  const [quantities, setQuantities] = useState({})
  const [reason, setReason] = useState("")
  const [refundMethod, setRefundMethod] = useState("CASH")
  const [notes, setNotes] = useState("")
  const [message, setMessage] = useState("")

  const selectedItems = eligibleItems.flatMap((item) => {
    const quantity = Number(quantities[item.id] || 0)
    if (!Number.isFinite(quantity) || quantity <= 0) return []

    const originalQuantity = Number(item.quantity || 0)
    const originalRefund = Number(item.lineTotal || 0)
    const alreadyRefunded = getReturnedLineAmount(sale, item.id)
    const remainingQuantity = Number(item.remainingReturnQuantity || 0)
    const lineRefundAmount = roundMoney(
      quantity === remainingQuantity
        ? originalRefund - alreadyRefunded
        : (originalRefund * quantity) / originalQuantity,
    )

    return [{ item, quantity, lineRefundAmount }]
  })
  const totalRefundAmount = roundMoney(
    selectedItems.reduce((sum, entry) => sum + entry.lineRefundAmount, 0),
  )

  const submit = (event) => {
    event.preventDefault()
    const normalizedReason = reason.trim()
    if (!normalizedReason) {
      setMessage("Enter the customer-facing return reason.")
      return
    }
    if (selectedItems.length === 0) {
      setMessage("Select at least one remaining inventory line quantity.")
      return
    }

    for (const entry of selectedItems) {
      const remaining = Number(entry.item.remainingReturnQuantity || 0)
      if (entry.quantity > remaining) {
        setMessage(`${entry.item.description} exceeds its remaining return quantity.`)
        return
      }
      if (entry.item.isSerialized && entry.quantity !== 1) {
        setMessage(`${entry.item.description} must return its exact serialized unit.`)
        return
      }
    }

    onConfirm({
      reason: normalizedReason,
      notes: notes.trim() || undefined,
      refundMethod: totalRefundAmount > 0 ? refundMethod : "NONE",
      refundAmount: totalRefundAmount,
      items: selectedItems.map(({ item, quantity }) => ({
        saleItemId: item.id,
        quantity,
        ...(item.serialId ? { serialId: item.serialId } : {}),
      })),
    })
  }

  return (
    <div aria-labelledby="return-sale-title" aria-modal="true" className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 p-3 sm:p-6" role="dialog">
      <form className="mx-auto my-4 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:my-8 sm:p-6" onSubmit={submit}>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-700">Auditable item return</p>
        <h2 className="mt-1 text-xl font-black text-[var(--color-text-strong)]" id="return-sale-title">Return items from {sale.receiptCode}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">Only remaining inventory products are eligible. Stock, sold serials, refund records, cash, and product incentives update together.</p>

        {sale.creditAccount ? <ErrorBanner>This sale has an installment account and cannot be partially returned.</ErrorBanner> : null}

        <div className="mt-5 space-y-3">
          {eligibleItems.map((item) => {
            const maxQuantity = Number(item.remainingReturnQuantity || 0)
            return (
              <label className="grid gap-3 rounded-2xl border border-[var(--color-border)] p-4 sm:grid-cols-[1fr_150px] sm:items-center" key={item.id}>
                <span>
                  <span className="block font-bold text-[var(--color-text-strong)]">{item.description}</span>
                  <span className="mt-1 block text-xs text-[var(--color-muted)]">Remaining {maxQuantity} · line net {formatMoney(item.lineTotal)}{item.serial?.serialNumber ? ` · Serial ${item.serial.serialNumber}` : ""}</span>
                </span>
                <span>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Return qty</span>
                  <input className="mt-1 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" disabled={isSaving || Boolean(sale.creditAccount)} max={maxQuantity} min="0" onChange={(event) => { setQuantities((current) => ({ ...current, [item.id]: event.target.value })); setMessage("") }} step={item.isSerialized ? "1" : "0.01"} type="number" value={quantities[item.id] || ""} />
                </span>
              </label>
            )
          })}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Return reason</span><textarea autoFocus className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" disabled={isSaving} onChange={(event) => { setReason(event.target.value); setMessage("") }} placeholder="Why is the customer returning these items?" value={reason} /></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Notes</span><textarea className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" disabled={isSaving} onChange={(event) => setNotes(event.target.value)} placeholder="Optional condition or handling notes" value={notes} /></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Refund method</span><select className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm font-semibold" disabled={isSaving || totalRefundAmount <= 0} onChange={(event) => setRefundMethod(event.target.value)} value={refundMethod}>{RETURN_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Backend-matched refund</p><p className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">{formatMoney(totalRefundAmount)}</p></div>
        </div>

        {message ? <p className="mt-3 text-sm font-semibold text-red-700">{message}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-bold disabled:opacity-50" disabled={isSaving} onClick={onClose} type="button">Keep sale</button>
          <button className="rounded-2xl bg-orange-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={isSaving || Boolean(sale.creditAccount)} type="submit">{isSaving ? "Completing return…" : "Complete item return"}</button>
        </div>
      </form>
    </div>
  )
}

const isJobBilledInSales = (job, salesList = []) => {
  if (!job?.jobCode) return null
  const code = String(job.jobCode).trim()
  const digits = code.match(/\d+$/)?.[0] || ""

  return (
    salesList.find((s) => {
      if (s.status === "CANCELLED") return false
      if (Array.isArray(s.items)) {
        return s.items.some((i) => {
          const desc = String(i.description || "")
          return desc.includes(code) || (digits.length >= 4 && desc.includes(digits))
        })
      }
      return false
    }) || null
  )
}

function JobOrderLookupDialog({ branchId, cart = [], onClose, onSelectJob, sales = [] }) {
  const [searchText, setSearchText] = useState("")
  const [statusFilter, setStatusFilter] = useState("ACTIVE")
  const [jobs, setJobs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const loadJobs = useCallback(async () => {
    if (!branchId) return
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await getServiceJobs({
        branchId,
        search: searchText.trim() || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter === "READY_FOR_RELEASE" ? "READY_FOR_RELEASE" : undefined,
        limit: 50,
      })
      let rows = Array.isArray(response?.data) ? response.data : []
      if (statusFilter === "ACTIVE" || statusFilter === "READY_FOR_RELEASE") {
        rows = rows.filter((j) => {
          if (j.status === "COMPLETED" || j.status === "CANCELLED" || j.releasedAt) return false
          if (j.serviceNotes?.includes("[BILLED IN POS") || j.releaseNotes?.includes("Settled and released via POS invoice")) return false
          if (isJobBilledInSales(j, sales)) return false
          return true
        })
      }
      setJobs(rows)
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || "Failed to load Job Orders.")
    } finally {
      setIsLoading(false)
    }
  }, [branchId, searchText, statusFilter, sales])

  useEffect(() => {
    const timer = setTimeout(loadJobs, 250)
    return () => clearTimeout(timer)
  }, [loadJobs])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-rose-100 text-[var(--color-maroon)]">
              <Wrench size={16} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                Pay Service / Job Order in Cashiering
              </h2>
              <p className="text-[11px] text-slate-500">
                Scan or enter the customer's J.O. Number from their claim stub.
              </p>
            </div>
          </div>
          <button
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-4 space-y-3 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              autoFocus
              className="w-full rounded-xl border border-rose-200 bg-white pl-9 pr-9 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20"
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search J.O. # (e.g. JO-2026-0001), Customer Name, or Serial..."
              type="text"
              value={searchText}
            />
            {searchText ? (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setSearchText("")}
                type="button"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { key: "ACTIVE", label: "Active Jobs" },
              { key: "READY_FOR_RELEASE", label: "Ready for Release" },
              { key: "ALL", label: "All Job Orders" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  statusFilter === tab.key
                    ? "bg-[var(--color-maroon)] text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[55vh]">
          {isLoading ? (
            <div className="grid place-items-center py-10">
              <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={24} />
              <p className="text-xs text-slate-400 mt-2">Searching Job Orders...</p>
            </div>
          ) : errorMessage ? (
            <div className="p-4 text-center text-xs text-rose-600 font-bold">{errorMessage}</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Wrench size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700">No matching Job Orders found</p>
              <p className="mt-1">Check the J.O. number or search by customer name.</p>
            </div>
          ) : (
            jobs.map((job) => {
              const customerName = job.customerNameSnapshot || job.customer?.fullName || "Walk-in"
              const customerContact = job.customerContactSnapshot || job.customer?.mobileNumber || ""
              const finalPrice = Number(
                job.finalServiceCharge ??
                job.baseServiceCharge ??
                job.estimatedServiceCharge ??
                0
              )
              const techName = job.serviceDoneBy?.fullName || job.assignedTechnician?.fullName

              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-rose-300 hover:shadow-md transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-rose-50 text-[var(--color-maroon)] border border-rose-200">
                        {job.jobCode}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {job.status?.replace(/_/g, " ")}
                      </span>
                      {job.isQuickService ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                          Quick
                        </span>
                      ) : null}
                    </div>

                    <p className="font-bold text-xs text-slate-900 truncate">
                      {job.jobTitle || job.repairType?.replace(/_/g, " ")}
                    </p>

                    <p className="text-[11px] text-slate-500">
                      <strong>Unit:</strong> {job.deviceDescription || job.unitType || "General"}
                      {job.serialNumber ? ` • S/N: ${job.serialNumber}` : ""}
                    </p>

                    <p className="text-[11px] text-slate-500">
                      <strong>Customer:</strong> {customerName} {customerContact ? `(${customerContact})` : ""}
                      {techName ? ` • Tech: ${techName}` : ""}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto shrink-0 gap-2">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">JO Charge</span>
                      <span className="font-mono font-black text-sm text-[var(--color-maroon)]">
                        {formatMoney(finalPrice)}
                      </span>
                    </div>
                    {(() => {
                      const matchedSale = isJobBilledInSales(job, sales)
                      const isBilled = Boolean(
                        matchedSale ||
                        job.serviceNotes?.includes("[BILLED IN POS") ||
                        job.releaseNotes?.includes("Settled and released via POS invoice")
                      )
                      const billedRef =
                        matchedSale?.receiptCode ||
                        job.serviceNotes?.match(/\[BILLED IN POS:\s*Invoice\s*([^\]]+)\]/)?.[1] ||
                        job.releaseNotes?.match(/POS invoice\s*(\S+)/)?.[1]

                      if (cart.some((l) => l.isJobOrder && l.jobOrderId === job.id)) {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 text-xs font-bold">
                            <CheckCircle2 size={13} />
                            In Cart
                          </span>
                        )
                      }
                      if (isBilled || job.status === "COMPLETED" || job.releasedAt) {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 px-3 py-1.5 text-xs font-bold">
                            {billedRef ? `Already Billed (${billedRef})` : "Already Released / Billed"}
                          </span>
                        )
                      }
                      if (job.status === "CANCELLED") {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-500 px-3 py-1.5 text-xs font-bold">
                            Cancelled
                          </span>
                        )
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => onSelectJob(job)}
                          className="inline-flex items-center gap-1 rounded-xl bg-[var(--color-maroon)] hover:bg-[#6b0f1a] text-white px-3.5 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          <Plus size={14} />
                          Load to Cart
                        </button>
                      )
                    })()}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

const DATE_FILTER_LABELS = {
  TODAY: "Today (Ngayong Araw)",
  YESTERDAY: "Yesterday (Kahapon)",
  THIS_WEEK: "1 Week (Huling 7 Araw)",
  THIS_MONTH: "1 Month (Huling 30 Araw)",
  THIS_YEAR: "1 Year (Kasalukuyang Taon)",
  ALL: "All Records (Lahat ng Benta)",
}

function PosSalesPage({ initialContext, onNavigate, selectedBranch, user }) {
  const activeBranch = selectedBranch || user?.branch || null
  const branchId = activeBranch?.id
  const canCreateSale = SALE_MANAGER_ROLES.has(user?.role)
  const canCancelSale = SALE_CANCELLER_ROLES.has(user?.role)

  const [posViewMode, setPosViewMode] = useState(
    initialContext?.viewMode || (initialContext?.saleId ? "SALES_HISTORY" : "REGISTER")
  )
  const [dateFilterPeriod, setDateFilterPeriod] = useState("TODAY") // "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "THIS_YEAR" | "ALL"
  const [showSalesmenLeaderboard, setShowSalesmenLeaderboard] = useState(false)

  const [itemSearch, setItemSearch] = useState("")
  const [itemResults, setItemResults] = useState([])
  const [jobOrderResults, setJobOrderResults] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [itemMessage, setItemMessage] = useState("")
  const [addingItemId, setAddingItemId] = useState("")
  const itemRequestIdRef = useRef(0)

  const [customerSearch, setCustomerSearch] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.customerSearch || ""
  })
  const [customerAddress, setCustomerAddress] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.customerAddress || ""
  })
  const [customerPhone, setCustomerPhone] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.customerPhone || ""
  })
  const [customerEmail, setCustomerEmail] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.customerEmail || ""
  })
  const [customerCompany, setCustomerCompany] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.customerCompany || ""
  })
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.selectedCustomerId || ""
  })
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const [selectedPriceTier, setSelectedPriceTier] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.selectedPriceTier || 1
  })
  const [pricingTerm, setPricingTerm] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.pricingTerm || "CASH"
  })
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [customerMessage, setCustomerMessage] = useState("")
  const customerRequestIdRef = useRef(0)
  const customerDropdownRef = useRef(null)
  const customerInputRef = useRef(null)

  const [serviceStaffList, setServiceStaffList] = useState([])
  const [isLoadingServiceStaff, setIsLoadingServiceStaff] = useState(false)
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState("")
  const [selectedServiceStaffId, setSelectedServiceStaffId] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.selectedServiceStaffId || ""
  })
  const [serviceStaffSearch, setServiceStaffSearch] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.serviceStaffSearch || ""
  })
  const [isServiceStaffDropdownOpen, setIsServiceStaffDropdownOpen] = useState(false)
  const serviceStaffDropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false)
      }
      if (serviceStaffDropdownRef.current && !serviceStaffDropdownRef.current.contains(event.target)) {
        setIsServiceStaffDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const [cart, setCart] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return Array.isArray(draft?.cart) ? draft.cart : []
  })
  const [cartMessage, setCartMessage] = useState("")
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [showJobOrderLookup, setShowJobOrderLookup] = useState(false)
  const [serviceDescription, setServiceDescription] = useState("")
  const [serviceQuantity, setServiceQuantity] = useState("1")
  const [serviceUnitPrice, setServiceUnitPrice] = useState("")
  const [serviceMarkup, setServiceMarkup] = useState("")
  const [serviceDiscount, setServiceDiscount] = useState("0")
  const [serviceCharge, setServiceCharge] = useState("0")

  // Service Catalog
  const [serviceCatalog, setServiceCatalog] = useState([])
  const [selectedServiceCatalogId, setSelectedServiceCatalogId] = useState("")

  const handleSelectServiceCatalog = (catalogId) => {
    setSelectedServiceCatalogId(catalogId)
    if (!catalogId) return
    const item = serviceCatalog.find((s) => s.id === catalogId)
    if (item) {
      setServiceDescription(item.name || item.description || "")
      setServiceUnitPrice(item.basePrice !== undefined && item.basePrice !== null ? String(item.basePrice) : "")
      if (item.markupPercent) {
        setServiceMarkup(String(item.markupPercent))
      }
    }
  }
  const [remarks, setRemarks] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.remarks || ""
  })
  const [isPcBuild, setIsPcBuild] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return Boolean(draft?.isPcBuild)
  })
  const [selectedBuilderId, setSelectedBuilderId] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.selectedBuilderId || ""
  })

  const [paymentMethod, setPaymentMethod] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.paymentMethod || "CASH"
  })
  const [settlementMethod, setSettlementMethod] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.settlementMethod || "CASH"
  })
  const [paymentAmount, setPaymentAmount] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.paymentAmount || "0"
  })
  const [paymentAmountTouched, setPaymentAmountTouched] = useState(false)
  const [paymentReference, setPaymentReference] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.paymentReference || ""
  })
  const [paymentRemarks, setPaymentRemarks] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.paymentRemarks || ""
  })
  const [creditTerm, setCreditTerm] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.creditTerm || "MONTH_3"
  })
  const [creditDueDay, setCreditDueDay] = useState("")
  const [creditFirstDueDate, setCreditFirstDueDate] = useState("")
  const [creditRemarks, setCreditRemarks] = useState("")
  const [providerReference, setProviderReference] = useState("")
  const [installmentRates, setInstallmentRates] = useState(DEFAULT_INSTALLMENT_BASIS)
  const [isSubmittingSale, setIsSubmittingSale] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState("")
  const [completedSale, setCompletedSale] = useState(null)
  const [activeQuotationDoc, setActiveQuotationDoc] = useState(null)
  const [isQuotationDocOpen, setIsQuotationDocOpen] = useState(false)
  const [isQuotationPreviewMode, setIsQuotationPreviewMode] = useState(false)
  const [isCreatingQuotation, setIsCreatingQuotation] = useState(false)

  useEffect(() => {
    let isMounted = true
    getInstallmentBasisSettings()
      .then((res) => {
        if (isMounted && res?.data?.termBasis) {
          setInstallmentRates(res.data.termBasis)
        }
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!branchId || !user?.id) return
    const draftKey = `pos_draft_${user.id}_${branchId}`
    if (cart.length > 0 || customerSearch || customerAddress || customerPhone || customerCompany || remarks || selectedCustomerId) {
      saveFormDraft(draftKey, {
        cart,
        selectedCustomerId,
        customerSearch,
        customerAddress,
        customerPhone,
        customerEmail,
        customerCompany,
        selectedPriceTier,
        pricingTerm,
        remarks,
        isPcBuild,
        selectedBuilderId,
        paymentMethod,
        settlementMethod,
        paymentAmount,
        paymentReference,
        paymentRemarks,
        creditTerm,
        selectedServiceStaffId,
        serviceStaffSearch,
      })
    } else {
      clearFormDraft(draftKey)
    }
  }, [
    branchId,
    user?.id,
    cart,
    selectedCustomerId,
    customerSearch,
    customerAddress,
    customerPhone,
    customerEmail,
    customerCompany,
    selectedPriceTier,
    pricingTerm,
    remarks,
    isPcBuild,
    selectedBuilderId,
    paymentMethod,
    settlementMethod,
    paymentAmount,
    paymentReference,
    paymentRemarks,
    creditTerm,
    selectedServiceStaffId,
    serviceStaffSearch,
  ])

  const [sales, setSales] = useState([])
  const [salesMeta, setSalesMeta] = useState(null)
  const [salesPage, setSalesPage] = useState(1)
  const [salesSearch, setSalesSearch] = useState("")
  const [salesStatus, setSalesStatus] = useState("")
  const [paymentStatus, setPaymentStatus] = useState("")
  const [priceTierFilter, setPriceTierFilter] = useState("")
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [salesMessage, setSalesMessage] = useState("")
  const salesRequestIdRef = useRef(0)

  // Quotation History in POS
  const [historyTab, setHistoryTab] = useState("SALES") // "SALES" | "QUOTATIONS"
  const [quotations, setQuotations] = useState([])
  const [quotationsMeta, setQuotationsMeta] = useState(null)
  const [quotationsPage, setQuotationsPage] = useState(1)
  const [quotationStatusFilter, setQuotationStatusFilter] = useState("")
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(false)
  const [quotationsMessage, setQuotationsMessage] = useState("")
  const [quotationToConvert, setQuotationToConvert] = useState(null)
  const [quotationToView, setQuotationToView] = useState(null)
  const [isCancellingQuotation, setIsCancellingQuotation] = useState(false)
  const quotationRequestIdRef = useRef(0)

  const [detailSale, setDetailSale] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailMessage, setDetailMessage] = useState("")
  const [saleToCancel, setSaleToCancel] = useState(null)
  const [isCancellingSale, setIsCancellingSale] = useState(false)
  const [saleToReturn, setSaleToReturn] = useState(null)
  const [isReturningSale, setIsReturningSale] = useState(false)
  const [saleToAppend, setSaleToAppend] = useState(null)
  const [isAppendingSale, setIsAppendingSale] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState("")
  const [saleCheckoutPreview, setSaleCheckoutPreview] = useState(null)
  const saleRequestRef = useRef({ signature: "", key: "" })

  const termTotals = useMemo(() => {
    let cashGross = 0
    let totalDiscount = 0

    for (const line of cart) {
      cashGross += getLineGross(line, "CASH")
      totalDiscount += Number(line.discountAmount || 0)
    }

    const additionalCharge = Number(serviceCharge || 0)
    const cashGrand = Math.max(cashGross - totalDiscount + additionalCharge, 0)
    const srpGrand = Math.round((cashGrand / 0.96) * 100) / 100
    const regularGrand = Math.round((cashGrand / 0.875) * 100) / 100

    return {
      cashGross,
      totalDiscount,
      cashGrand,
      srpGrand,
      regularGrand,
    }
  }, [cart, serviceCharge])

  const totals = useMemo(() => {
    let productGross = 0
    let serviceGross = 0
    let totalDiscount = 0

    for (const line of cart) {
      const gross = getLineGross(line, pricingTerm)
      if (line.type === "SERVICE") serviceGross += gross
      else productGross += gross
      totalDiscount += Number(line.discountAmount || 0)
    }

    const additionalCharge = Number(serviceCharge || 0)
    const subtotal = productGross + serviceGross
    const grandTotal = Math.max(subtotal - totalDiscount + additionalCharge, 0)

    return { productGross, serviceGross, subtotal, totalDiscount, additionalCharge, grandTotal }
  }, [cart, serviceCharge, pricingTerm])

  const isReceivableCheckout = RECEIVABLE_PROVIDER_VALUES.has(paymentMethod)
  const isInHouseCheckout = paymentMethod === "IN_HOUSE_INSTALLMENT"

  const effectivePaymentAmount = paymentAmountTouched
    ? paymentAmount
    : isReceivableCheckout
      ? "0"
      : totals.grandTotal.toFixed(2)

  const installmentCalculation = useMemo(() => {
    if (!isReceivableCheckout) return null

    const termBasis = Number(
      installmentRates?.[creditTerm] || DEFAULT_INSTALLMENT_BASIS[creditTerm] || 1,
    )
    const months = INSTALLMENT_TERM_MONTHS[creditTerm] || 1
    const cashPromoTotal = totals.grandTotal
    const downpayment = Number(paymentAmount || 0)
    const isCreditCard = paymentMethod === "CREDIT_CARD"

    let regularPriceTotalAmount
    let financedBalance
    let swipeAmount = null
    let termAdjustment

    if (isCreditCard && downpayment > 0) {
      const remainingCash = Math.max(cashPromoTotal - downpayment, 0)
      swipeAmount = Math.round((remainingCash / termBasis) * 100) / 100
      regularPriceTotalAmount = Math.round((downpayment + swipeAmount) * 100) / 100
      financedBalance = swipeAmount
      termAdjustment = Math.max(swipeAmount - remainingCash, 0)
    } else {
      regularPriceTotalAmount =
        Math.round((cashPromoTotal / termBasis) * 100) / 100
      termAdjustment = Math.max(regularPriceTotalAmount - cashPromoTotal, 0)
      financedBalance = Math.max(
        Math.round((regularPriceTotalAmount - downpayment) * 100) / 100,
        0,
      )
      if (isCreditCard) {
        swipeAmount = financedBalance
      }
    }

    const monthlyDueAmount = Math.round((financedBalance / months) * 100) / 100

    return {
      termBasis,
      months,
      cashPromoTotal,
      downpayment,
      remainingCash: Math.max(cashPromoTotal - downpayment, 0),
      regularPriceTotalAmount,
      interestAmount: termAdjustment,
      termAdjustment,
      swipeAmount,
      financedBalance,
      monthlyDueAmount,
      isCreditCardWithDp: isCreditCard && downpayment > 0,
    }
  }, [isReceivableCheckout, installmentRates, creditTerm, totals.grandTotal, paymentAmount, paymentMethod])

  const amountPaidNumber = Number(effectivePaymentAmount || 0)
  const expectedBalance = isReceivableCheckout
    ? (installmentCalculation?.financedBalance ?? Math.max(totals.grandTotal - amountPaidNumber, 0))
    : Math.max(totals.grandTotal - amountPaidNumber, 0)
  const expectedChange = isReceivableCheckout
    ? 0
    : Math.max(amountPaidNumber - totals.grandTotal, 0)

  const serviceBaseUnitPrice = Number(serviceUnitPrice || 0)
  const serviceFinalUnitPrice = getServiceMarkupAdjustedPrice(serviceBaseUnitPrice, serviceMarkup)
  const serviceLineGross = Number(serviceQuantity || 0) * serviceFinalUnitPrice
  const serviceLineTotal = Math.max(serviceLineGross - Number(serviceDiscount || 0), 0)

  const loadItems = useCallback(async () => {
    if (!branchId) {
      setItemResults([])
      setJobOrderResults([])
      return
    }

    const requestId = itemRequestIdRef.current + 1
    itemRequestIdRef.current = requestId
    setIsLoadingItems(true)
    setItemMessage("")

    try {
      const trimmedSearch = itemSearch.trim()
      const [itemResponse, joResponse] = await Promise.all([
        getItems({
          branchId,
          status: "ACTIVE",
          search: trimmedSearch || undefined,
          page: 1,
          limit: 20,
        }),
        trimmedSearch
          ? getServiceJobs({
              branchId,
              search: trimmedSearch,
              limit: 5,
            }).catch(() => null)
          : Promise.resolve(null),
      ])

      if (requestId !== itemRequestIdRef.current) return

      const rows = getCatalogRows(itemResponse)
      setItemResults(rows)

      const joRows = (Array.isArray(joResponse?.data) ? joResponse.data : []).filter(
        (job) => job.status !== "COMPLETED" && job.status !== "CANCELLED",
      )
      setJobOrderResults(joRows)

      if (rows.length === 0 && joRows.length === 0 && trimmedSearch) {
        setItemMessage("No active products or Job Orders match this search.")
      }
    } catch (error) {
      if (requestId !== itemRequestIdRef.current) return
      setItemResults([])
      setJobOrderResults([])
      setItemMessage(getApiErrorMessage(error, "Unable to search products right now."))
    } finally {
      if (requestId === itemRequestIdRef.current) setIsLoadingItems(false)
    }
  }, [branchId, itemSearch])

  useEffect(() => {
    const timer = window.setTimeout(loadItems, itemSearch.trim() ? 250 : 0)
    return () => {
      window.clearTimeout(timer)
      itemRequestIdRef.current += 1
    }
  }, [loadItems, itemSearch])

  const loadCustomers = useCallback(async () => {
    if (!branchId) {
      setCustomers([])
      return
    }

    const requestId = customerRequestIdRef.current + 1
    customerRequestIdRef.current = requestId
    setIsLoadingCustomers(true)
    setCustomerMessage("")

    try {
      const response = await getCustomers({
        branchId,
        status: "ACTIVE",
        search: customerSearch.trim() || undefined,
        page: 1,
        limit: 100,
      })
      if (requestId !== customerRequestIdRef.current) return

      const rows = getCatalogRows(response)
      setCustomers(rows)
      if (rows.length === 0) {
        setCustomerMessage("No active customers match. Walk-in remains available.")
      }
    } catch (error) {
      if (requestId !== customerRequestIdRef.current) return
      setCustomers([])
      setCustomerMessage(getApiErrorMessage(error, "Unable to load customers. Walk-in remains available."))
    } finally {
      if (requestId === customerRequestIdRef.current) setIsLoadingCustomers(false)
    }
  }, [branchId, customerSearch])

  useEffect(() => {
    const timer = window.setTimeout(loadCustomers, customerSearch.trim() ? 250 : 0)
    return () => {
      window.clearTimeout(timer)
      customerRequestIdRef.current += 1
    }
  }, [customerSearch, loadCustomers])

  useEffect(() => {
    let isMounted = true
    const timer = window.setTimeout(() => {
      if (!branchId) {
        setServiceStaffList([])
        setSelectedServiceStaffId("")
        return
      }

      setIsLoadingServiceStaff(true)
      getQuotationServiceStaff({ branchId })
        .then((response) => {
          if (!isMounted) return
          const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []
          setServiceStaffList(rows)
          if (user?.id) {
            setSelectedSalesPersonId((prev) => prev || user.id)
            if (rows.some((staff) => staff.id === user.id)) {
              setSelectedServiceStaffId((prev) => prev || user.id)
            }
          }
        })
        .catch(() => {
          if (isMounted) setServiceStaffList([])
        })
        .finally(() => {
          if (isMounted) setIsLoadingServiceStaff(false)
        })
    }, 0)

    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [branchId, user?.id])

  useEffect(() => {
    let isMounted = true
    getServiceCatalog()
      .then((response) => {
        if (!isMounted) return
        const list = response?.data || response || []
        setServiceCatalog(Array.isArray(list) ? list.filter((s) => s.isActive !== false) : [])
      })
      .catch(() => {
        if (isMounted) setServiceCatalog([])
      })
    return () => {
      isMounted = false
    }
  }, [])

  const loadSales = useCallback(async () => {
    if (!branchId) {
      setSales([])
      setSalesMeta(null)
      return
    }

    const requestId = salesRequestIdRef.current + 1
    salesRequestIdRef.current = requestId
    setIsLoadingSales(true)
    setSalesMessage("")

    try {
      const response = await getSales({
        branchId,
        page: salesPage,
        limit: 20,
        search: salesSearch.trim() || undefined,
        status: salesStatus || undefined,
        paymentStatus: paymentStatus || undefined,
        priceTier: priceTierFilter ? Number(priceTierFilter) : undefined,
      })
      if (requestId !== salesRequestIdRef.current) return

      const result = getSaleListResult(response)
      setSales(result.rows)
      setSalesMeta(result.meta)
      if (result.rows.length === 0) setSalesMessage("No sales match the current filters.")
    } catch (error) {
      if (requestId !== salesRequestIdRef.current) return
      setSales([])
      setSalesMeta(null)
      setSalesMessage(getApiErrorMessage(error, "Unable to load sales history."))
    } finally {
      if (requestId === salesRequestIdRef.current) setIsLoadingSales(false)
    }
  }, [branchId, paymentStatus, priceTierFilter, salesPage, salesSearch, salesStatus])

  const filteredTierSummary = useMemo(() => {
    let tierUnits = 0
    let tierRevenue = 0
    let matchingReceiptsCount = 0

    sales.forEach((sale) => {
      if (sale.status === "CANCELLED") return
      let saleHasMatchingTier = false

      ;(sale.items || []).forEach((item) => {
        const itemTier = Number(item.priceTier || 1)
        const qty = Number(item.quantity || 1)
        const lineTot = Number(item.lineTotal || (Number(item.unitPrice || 0) * qty) || 0)

        if (priceTierFilter) {
          if (itemTier === Number(priceTierFilter)) {
            tierUnits += qty
            tierRevenue += lineTot
            saleHasMatchingTier = true
          }
        } else {
          tierUnits += qty
          tierRevenue += lineTot
          saleHasMatchingTier = true
        }
      })

      if (saleHasMatchingTier) {
        matchingReceiptsCount += 1
      }
    })

    return {
      tierUnits,
      tierRevenue,
      matchingReceiptsCount,
    }
  }, [sales, priceTierFilter])

  const loadQuotations = useCallback(async () => {
    if (!branchId) {
      setQuotations([])
      setQuotationsMeta(null)
      return
    }

    const requestId = quotationRequestIdRef.current + 1
    quotationRequestIdRef.current = requestId
    setIsLoadingQuotations(true)
    setQuotationsMessage("")

    try {
      const response = await getQuotations({
        branchId,
        page: quotationsPage,
        limit: 20,
        search: salesSearch.trim() || undefined,
        status: quotationStatusFilter || undefined,
      })
      if (requestId !== quotationRequestIdRef.current) return

      const result = response?.data ?? response ?? {}
      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result.items)
          ? result.items
          : Array.isArray(result.data)
            ? result.data
            : Array.isArray(result.records)
              ? result.records
              : Array.isArray(result.quotations)
                ? result.quotations
                : []
      const pagination = result.pagination || result.meta || response?.pagination || response?.meta || null

      setQuotations(rows)
      setQuotationsMeta(pagination)
      if (rows.length === 0) setQuotationsMessage("No quotations match the current search.")
    } catch (error) {
      if (requestId !== quotationRequestIdRef.current) return
      setQuotations([])
      setQuotationsMeta(null)
      setQuotationsMessage(getApiErrorMessage(error, "Unable to load quotations."))
    } finally {
      if (requestId === quotationRequestIdRef.current) setIsLoadingQuotations(false)
    }
  }, [branchId, quotationStatusFilter, quotationsPage, salesSearch])

  useEffect(() => {
    const timer = window.setTimeout(loadSales, salesSearch.trim() ? 300 : 0)
    return () => {
      window.clearTimeout(timer)
      salesRequestIdRef.current += 1
    }
  }, [loadSales, salesSearch])

  useEffect(() => {
    const timer = window.setTimeout(loadQuotations, salesSearch.trim() ? 300 : 0)
    return () => {
      window.clearTimeout(timer)
      quotationRequestIdRef.current += 1
    }
  }, [loadQuotations, salesSearch])

  const addProduct = async (item, preselectedSerial = null) => {
    if (!branchId || addingItemId) return

    setAddingItemId(item.id)
    setCartMessage("")

    try {
      const [batchResponse, serialResponse] = await Promise.all([
        getInventoryBatches({ branchId, itemId: item.id, status: "ACTIVE", limit: 100 }),
        item.isSerialized
          ? getInventorySerials({ branchId, itemId: item.id, status: "AVAILABLE", limit: 100 })
          : Promise.resolve(null),
      ])

      const batches = getInventoryRows(batchResponse).filter(
        (batch) => Number(batch.quantityAvailable || 0) > 0,
      )
      const serials = item.isSerialized ? getInventoryRows(serialResponse) : []

      const localId = `product-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const isCustomSerial = !preselectedSerial
      const initialSerialId = preselectedSerial?.id || ""
      const initialBatchId = item.isSerialized
        ? (preselectedSerial?.batch?.id || (!isCustomSerial ? serials[0]?.batch?.id : "") || "")
        : (batches[0]?.id || "")

      const activeCustomer = customers.find((c) => c.id === selectedCustomerId)
      const customerItemTiers = selectedCustomerId ? getCustomerItemTiers(selectedCustomerId) : {}
      const rememberedTier = customerItemTiers[item.id]
      const itemTiers = availablePriceTiers(item)

      let chosenTier
      let isRememberedTier = false

      if (rememberedTier && itemTiers.includes(Number(rememberedTier))) {
        chosenTier = Number(rememberedTier)
        isRememberedTier = true
      } else {
        const targetTier = (activeCustomer?.priceTier ? Number(activeCustomer.priceTier) : null) || selectedPriceTier
        chosenTier = targetTier && itemTiers.includes(targetTier) ? targetTier : defaultPriceTier(item)
      }

      setCart((current) => [
        ...current,
        {
          localId,
          type: "PRODUCT",
          item,
          itemId: item.id,
          priceTier: chosenTier,
          isRememberedTier,
          quantity: "1",
          markupPercent: "",
          discountAmount: "0",
          batchId: initialBatchId,
          serialId: initialSerialId,
          customSerialNumber: preselectedSerial?.serialNumber || "",
          isCustomSerial,
          warrantyType: item.isSerialized ? "MAJOR_PARTS" : "ACCESSORIES",
          warrantyDuration: parseItemWarranty(item),
          batches,
          serials,
        },
      ])
      setItemSearch("")
    } catch (error) {
      setCartMessage(getApiErrorMessage(error, `Unable to load stock for ${item.itemName}.`))
    } finally {
      setAddingItemId("")
    }
  }

  const handleItemSearchSubmit = async (event) => {
    event.preventDefault()
    const query = itemSearch.trim()
    const normalized = query.toLowerCase()
    const cleanDigits = query.replace(/\D/g, "")
    if (!normalized) return

    // 1. Check if exact product match by itemCode or barcode
    const exactItem = itemResults.find((item) => {
      return [item.itemCode, item.barcode]
        .filter(Boolean)
        .some((value) => String(value).trim().toLowerCase() === normalized)
    })

    if (exactItem) {
      await addProduct(exactItem)
      return
    }

    // 2. Check if matched Job Order in current results list
    const matchedJoFromList = jobOrderResults.find((job) => {
      const codeNorm = job.jobCode?.toLowerCase() || ""
      const codeDigits = job.jobCode?.replace(/\D/g, "") || ""
      const serialNorm = job.serialNumber?.toLowerCase() || ""
      return (
        codeNorm === normalized ||
        (cleanDigits.length >= 4 && codeDigits && (cleanDigits === codeDigits || codeDigits.includes(cleanDigits) || cleanDigits.includes(codeDigits))) ||
        (serialNorm && serialNorm === normalized)
      )
    })

    if (matchedJoFromList) {
      handleSelectJobOrder(matchedJoFromList)
      setItemSearch("")
      return
    }

    // 3. Check via live search for Job Orders
    try {
      const joRes = await getServiceJobs({ search: query, branchId, limit: 5 })
      const joList = (Array.isArray(joRes?.data) ? joRes.data : []).filter(
        (job) => job.status !== "COMPLETED" && job.status !== "CANCELLED",
      )
      const matchedJo = joList.find((job) => {
        const codeNorm = job.jobCode?.toLowerCase() || ""
        const codeDigits = job.jobCode?.replace(/\D/g, "") || ""
        const serialNorm = job.serialNumber?.toLowerCase() || ""
        return (
          codeNorm === normalized ||
          (cleanDigits.length >= 4 && codeDigits && (cleanDigits === codeDigits || codeDigits.includes(cleanDigits) || cleanDigits.includes(codeDigits))) ||
          (serialNorm && serialNorm === normalized)
        )
      }) || (joList.length === 1 ? joList[0] : null)

      if (matchedJo) {
        handleSelectJobOrder(matchedJo)
        setItemSearch("")
        return
      }
    } catch {
      // ignore
    }

    // 4. Check if the query is an existing available serial number in this branch
    try {
      const serialResponse = await getInventorySerials({
        branchId,
        search: query,
        status: "AVAILABLE",
        limit: 10,
      })
      const foundSerials = getInventoryRows(serialResponse)
      const matchedSerial = foundSerials.find(
        (s) => s.serialNumber?.toLowerCase() === normalized,
      )

      if (matchedSerial && matchedSerial.item) {
        await addProduct(matchedSerial.item, matchedSerial)
        return
      }
    } catch {
      // ignore
    }

    setItemMessage("No exact product barcode, item code, serial, or J.O. number found. Check the list below or click ⚡ PAY JOB ORDER.")
  }

  const handleSelectJobOrder = (job) => {
    if (!job) return

    const matchedSale = isJobBilledInSales(job, sales)
    if (
      matchedSale ||
      job.serviceNotes?.includes("[BILLED IN POS") ||
      job.releaseNotes?.includes("Settled and released via POS invoice")
    ) {
      const ref =
        matchedSale?.receiptCode ||
        job.serviceNotes?.match(/\[BILLED IN POS:\s*Invoice\s*([^\]]+)\]/)?.[1]
      setCartMessage(
        `Job Order ${job.jobCode} has already been billed${ref ? ` under POS Receipt #${ref}` : ""}.`,
      )
      setShowJobOrderLookup(false)
      return
    }

    if (job.status === "CANCELLED") {
      setCartMessage(`Job Order ${job.jobCode} is cancelled and cannot be loaded.`)
      setShowJobOrderLookup(false)
      return
    }

    if (cart.some((line) => line.isJobOrder && line.jobOrderId === job.id)) {
      setCartMessage(`Job Order ${job.jobCode} is already loaded in the cart.`)
      setShowJobOrderLookup(false)
      return
    }

    // Auto-fill customer info if present
    if (job.customerId) {
      setSelectedCustomerId(job.customerId)
      const found = customers.find((c) => c.id === job.customerId)
      if (found) {
        setCustomerSearch(found.fullName || "")
        setCustomerPhone(found.mobileNumber || "")
        setCustomerAddress(found.address || "")
        setCustomerEmail(found.email || "")
        setCustomerCompany(found.companyName || "")
      }
    } else if (job.customerNameSnapshot) {
      setCustomerSearch(job.customerNameSnapshot)
      setCustomerPhone(job.customerContactSnapshot || "")
      setCustomerAddress(job.customerAddressSnapshot || "")
    }

    const tasks = extractServiceTasks(job)
    const parts = extractServiceParts(job)
    const assignedStaff = job.serviceDoneBy || job.assignedTechnician

    const newLines = []
    if (tasks.length > 0) {
      tasks.forEach((task, idx) => {
        const staffName = task.technicianName || assignedStaff?.fullName || null
        const staffId = task.technicianId || assignedStaff?.id || null
        newLines.push({
          localId: `jo-${job.id}-task-${task.id || idx}-${Date.now()}-${idx}`,
          type: "SERVICE",
          isJobOrder: true,
          jobOrderId: job.id,
          jobOrderCode: job.jobCode,
          description: `[JO #${job.jobCode}] ${task.title || "Service"} - ${job.deviceDescription || job.unitType || "Unit"}${job.serialNumber ? ` (S/N: ${job.serialNumber})` : ""}${staffName ? ` [Done by: ${staffName}]` : ""}`,
          quantity: "1",
          baseUnitPrice: String(task.amount || 0),
          markupPercent: "0",
          unitPrice: String(task.amount || 0),
          discountAmount: "0",
          serviceStaffId: staffId,
          serviceStaffName: staffName,
          serviceStaffRole: null,
          warrantyDuration: task.warrantyDuration || "30 DAYS SERVICE WARRANTY",
        })
      })
    } else {
      const jobAmount = String(
        job.finalServiceCharge ??
        job.baseServiceCharge ??
        job.estimatedServiceCharge ??
        0
      )
      newLines.push({
        localId: `jo-${job.id}-${Date.now()}`,
        type: "SERVICE",
        isJobOrder: true,
        jobOrderId: job.id,
        jobOrderCode: job.jobCode,
        description: `[JO #${job.jobCode}] ${job.jobTitle || job.repairType?.replace(/_/g, " ") || "Service"} - ${job.deviceDescription || job.unitType || "Unit"}${job.serialNumber ? ` (S/N: ${job.serialNumber})` : ""}${assignedStaff?.fullName ? ` [Done by: ${assignedStaff.fullName}]` : ""}`,
        quantity: "1",
        baseUnitPrice: jobAmount,
        markupPercent: String(job.markupPercent || 0),
        unitPrice: jobAmount,
        discountAmount: "0",
        serviceStaffId: assignedStaff?.id || null,
        serviceStaffName: assignedStaff?.fullName || null,
        serviceStaffRole: assignedStaff ? getRoleLabel(assignedStaff.role) : null,
        warrantyDuration: "30 DAYS SERVICE WARRANTY",
      })
    }

    if (parts.length > 0) {
      parts.forEach((part, pIdx) => {
        newLines.push({
          localId: `jo-${job.id}-part-${part.id || pIdx}-${Date.now()}-${pIdx}`,
          type: "SERVICE",
          isJobOrder: true,
          jobOrderId: job.id,
          jobOrderCode: job.jobCode,
          description: `[JO #${job.jobCode} Part] ${part.partName || "Replacement Part"} (x${part.quantity || 1})`,
          quantity: String(part.quantity || 1),
          baseUnitPrice: String(part.unitPrice || 0),
          markupPercent: "0",
          unitPrice: String(part.unitPrice || 0),
          discountAmount: "0",
          serviceStaffId: null,
          serviceStaffName: null,
          serviceStaffRole: null,
          warrantyDuration: "REPLACEMENT PART",
        })
      })
    }

    setCart((current) => [...current, ...newLines])

    setShowJobOrderLookup(false)
    setNoticeMessage(`Loaded Job Order ${job.jobCode} (${newLines.length} item${newLines.length === 1 ? "" : "s"}) into cart.`)
  }

  // Auto-load Job Order if redirected from Services module
  useEffect(() => {
    let joId = initialContext?.loadJobId || initialContext?.loadJob?.id
    if (!joId) {
      try {
        joId = sessionStorage.getItem("pos_load_jo_id")
      } catch {
        // Ignore
      }
    }
    if (joId && branchId) {
      try {
        sessionStorage.removeItem("pos_load_jo_id")
      } catch {
        // Ignore
      }
      getServiceJobById(joId)
        .then((res) => {
          const job = res?.data || res
          if (job && job.id) {
            handleSelectJobOrder(job)
          }
        })
        .catch(() => {})
    }
  }, [initialContext, branchId])

  const updateCartLine = (localId, patch) => {
    setCart((current) =>
      current.map((line) => {
        if (line.localId !== localId) return line

        if (Object.hasOwn(patch, "serialId")) {
          const serial = line.serials.find((entry) => entry.id === patch.serialId)
          return { ...line, serialId: patch.serialId, batchId: serial?.batch?.id || "" }
        }

        const updatedLine = { ...line, ...patch }

        if (
          updatedLine.type === "SERVICE" &&
          (Object.hasOwn(patch, "baseUnitPrice") || Object.hasOwn(patch, "markupPercent"))
        ) {
          updatedLine.unitPrice = String(
            getServiceMarkupAdjustedPrice(
              updatedLine.baseUnitPrice,
              updatedLine.markupPercent,
            ),
          )
        }

        return updatedLine
      }),
    )
    setCartMessage("")
    setCheckoutMessage("")
  }

  const removeCartLine = (localId) => {
    setCart((current) => current.filter((line) => line.localId !== localId))
    setCartMessage("")
  }

  const addServiceLine = (event) => {
    event.preventDefault()
    const description = serviceDescription.trim()
    const quantity = Number(serviceQuantity || 0)
    const baseUnitPrice = Number(serviceUnitPrice || 0)
    const markupPercent = serviceMarkup === "" ? 0 : Number(serviceMarkup)
    const unitPrice = getServiceMarkupAdjustedPrice(baseUnitPrice, markupPercent)
    const discountAmount = Number(serviceDiscount || 0)
    const gross = quantity * unitPrice

    if (!description) {
      setCartMessage("Enter a service or custom-line description.")
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setCartMessage("Service quantity must be greater than zero.")
      return
    }
    if (!Number.isFinite(baseUnitPrice) || baseUnitPrice < 0) {
      setCartMessage("Service base unit price cannot be negative.")
      return
    }
    if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent >= 100) {
      setCartMessage("Service mark up percentage must be from 0 up to less than 100.")
      return
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > gross) {
      setCartMessage("Service discount must be between zero and the service line amount.")
      return
    }

    const assignedStaff = serviceStaffList.find((s) => s.id === selectedServiceStaffId)

    setCart((current) => [
      ...current,
      {
        localId: `service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "SERVICE",
        description,
        quantity: String(quantity),
        baseUnitPrice: String(baseUnitPrice),
        markupPercent: serviceMarkup,
        unitPrice: String(unitPrice),
        discountAmount: String(discountAmount),
        serviceStaffId: assignedStaff?.id || null,
        serviceStaffName: assignedStaff?.fullName || null,
        serviceStaffRole: assignedStaff ? getRoleLabel(assignedStaff.role) : null,
      },
    ])
    setServiceDescription("")
    setServiceQuantity("1")
    setServiceUnitPrice("")
    setServiceMarkup("")
    setServiceDiscount("0")
    setSelectedServiceCatalogId("")
    setCartMessage("")
    setShowServiceForm(false)
  }

  const validateCart = () => {
    if (!branchId) return "Select a branch before creating a sale."
    if (cart.length === 0) return "Cart is empty."

    const hasCustomer = Boolean(selectedCustomerId || customerSearch.trim())
    if (!hasCustomer) {
      customerInputRef.current?.focus()
      return "Customer name is required before proceeding. Please enter or select a customer."
    }

    const serialIds = new Set()
    const customSerials = new Set()
    const batchQuantities = new Map()

    for (const line of cart) {
      const quantity = Number(line.quantity || 0)
      const unitPrice = getLineUnitPrice(line)
      const discount = Number(line.discountAmount || 0)
      const gross = quantity * unitPrice

      if (!Number.isFinite(quantity) || quantity <= 0) return `${line.item?.itemName || line.description} needs a valid quantity.`
      if (!Number.isFinite(discount) || discount < 0 || discount > gross) return `${line.item?.itemName || line.description} has an invalid exact discount.`

      const markup =
        line.markupPercent === "" ||
        line.markupPercent === undefined ||
        line.markupPercent === null
          ? 0
          : Number(line.markupPercent)

      if (!Number.isFinite(markup) || markup < 0 || markup >= 100) {
        return `${line.item?.itemName || line.description || "Line"} needs a mark up percentage from 0 up to less than 100.`
      }

      if (line.type === "SERVICE") {
        if (!line.description?.trim()) return "Every service/custom line needs a description."
        const baseUnitPrice = getLineBaseUnitPrice(line)
        if (!Number.isFinite(baseUnitPrice) || baseUnitPrice < 0) return `${line.description} has an invalid base unit price.`
        if (!Number.isFinite(unitPrice) || unitPrice < 0) return `${line.description} has an invalid final unit price.`
        continue
      }

      if (line.item.isSerialized) {
        if (quantity !== 1) return `${line.item.itemName} must be sold one serialized unit per line.`
        const serialVal = line.isCustomSerial ? line.customSerialNumber?.trim() : line.serialId
        if (!serialVal) return `Select or scan a serial number for ${line.item.itemName}.`

        if (line.isCustomSerial) {
          const customSn = line.customSerialNumber?.trim().toLowerCase()
          if (customSn) {
            const itemSerialKey = `${line.item?.id || line.itemId}:${customSn}`
            if (customSerials.has(itemSerialKey)) {
              return `The same serial cannot be used more than once for ${line.item.itemName} in a sale.`
            }
            customSerials.add(itemSerialKey)
          }
        } else if (line.serialId) {
          if (serialIds.has(line.serialId)) return "The same serial unit cannot be used more than once in a sale."
          serialIds.add(line.serialId)
        }
      } else {
        if (!line.batchId) return `Select a branch batch for ${line.item.itemName}.`
        batchQuantities.set(line.batchId, (batchQuantities.get(line.batchId) || 0) + quantity)
      }
    }

    for (const [batchId, requestedQuantity] of batchQuantities) {
      const line = cart.find((entry) => entry.batchId === batchId)
      const batch = line?.batches.find((entry) => entry.id === batchId)
      if (batch && requestedQuantity > Number(batch.quantityAvailable || 0)) {
        return `${line.item.itemName} exceeds the selected batch's available quantity.`
      }
    }

    const additionalCharge = Number(serviceCharge || 0)
    if (!Number.isFinite(additionalCharge) || additionalCharge < 0) return "Additional service/delivery charge cannot be negative."

    const tendered = Number(effectivePaymentAmount || 0)
    if (!Number.isFinite(tendered) || tendered < 0) return "Payment amount cannot be negative."

    if (isReceivableCheckout) {
      if (tendered >= totals.grandTotal) {
        return "A receivable requires a positive outstanding transaction balance."
      }

      if (isInHouseCheckout && !selectedCustomerId) {
        return "Select an active customer for an in-house installment account."
      }

      if (!creditTerm) {
        return "Select an installment term."
      }

      const dueDay = creditDueDay === "" ? null : Number(creditDueDay)
      if (
        dueDay !== null &&
        (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
      ) {
        return "Installment due day must be a whole number from 1 to 31."
      }
    } else if (tendered < totals.grandTotal) {
      return "Immediate settlements must cover the transaction total, or select an AR provider."
    } else if (paymentMethod !== "CASH" && tendered > totals.grandTotal) {
      return "Only cash checkout can include overpayment and customer change."
    }

    return ""
  }

  const resetCheckout = () => {
    setCart([])
    setSelectedCustomerId("")
    setCustomerSearch("")
    setCustomerAddress("")
    setCustomerPhone("")
    setCustomerEmail("")
    setCustomerCompany("")
    setIsCustomerDropdownOpen(false)
    setSelectedPriceTier(1)
    setServiceCharge("0")
    setRemarks("")
    setIsPcBuild(false)
    setSelectedBuilderId("")
    setPaymentMethod("CASH")
    setSettlementMethod("CASH")
    setPaymentAmount("0")
    setPaymentAmountTouched(false)
    setPaymentReference("")
    setPaymentRemarks("")
    setCreditTerm("MONTH_3")
    setCreditDueDay("")
    setCreditFirstDueDate("")
    setCreditRemarks("")
    setProviderReference("")
    setCheckoutMessage("")
    setCartMessage("")
    if (user?.id && branchId) {
      clearFormDraft(`pos_draft_${user.id}_${branchId}`)
    }
  }

  const openSaleCheckoutPreview = () => {
    if (!canCreateSale || isSubmittingSale) return

    const validationMessage = validateCart()
    if (validationMessage) {
      setCheckoutMessage(validationMessage)
      return
    }
    setCheckoutMessage("")

    const matchedCustomer = customers.find((c) => c.id === selectedCustomerId)
    const customerObj =
      matchedCustomer ||
      (customerSearch.trim()
        ? {
            fullName: customerSearch.trim(),
            address: customerAddress.trim() || undefined,
            mobileNumber: customerPhone.trim() || undefined,
            email: customerEmail.trim() || undefined,
          }
        : { fullName: "Walk-in Customer" })

    const isCredit = isReceivableCheckout
    const termBasis = isCredit ? (installmentCalculation?.termBasis || 1) : 1
    const downpayment = Number(effectivePaymentAmount || 0)
    const financedBalance = isCredit ? (installmentCalculation?.financedBalance || 0) : 0
    const regularTotal = isCredit ? (installmentCalculation?.regularPriceTotalAmount || totals.grandTotal) : totals.grandTotal
    const grandTotalValue = isCredit ? (downpayment > 0 ? (downpayment + financedBalance) : regularTotal) : totals.grandTotal

    const serviceLineWithDoneBy = cart.find(
      (l) => l.type === "SERVICE" && l.serviceStaffName
    )
    const technicianName = serviceLineWithDoneBy?.serviceStaffName || undefined

    const assignedStaff = serviceStaffList.find((s) => s.id === selectedSalesPersonId)
    const previewCashier = assignedStaff || user

    const previewSaleDoc = {
      receiptCode: "CHECKOUT-PREVIEW",
      saleDate: new Date().toISOString(),
      branch: activeBranch,
      customer: {
        ...customerObj,
        fullName: customerSearch.trim() || customerObj.fullName,
        address: customerAddress.trim() || customerObj.address || "",
        mobileNumber: customerPhone.trim() || customerObj.mobileNumber || "",
        email: customerEmail.trim() || customerObj.email || "",
      },
      cashier: previewCashier,
      technician: technicianName ? { fullName: technicianName } : null,
      remarks: isPcBuild
        ? (() => {
            const builder = serviceStaffList.find((s) => s.id === selectedBuilderId)
            return builder?.fullName
              ? `[PC BUILD] Assembled by: ${builder.fullName}${remarks.trim() ? ` | ${remarks.trim()}` : ""}`
              : remarks.trim()
                ? `[PC BUILD] ${remarks.trim()}`
                : "[PC BUILD]"
          })()
        : remarks.trim() || undefined,
      isPcBuild,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      serviceCharge: totals.additionalCharge,
      grandTotal: grandTotalValue,
      amountPaid: downpayment,
      payments:
        downpayment > 0
          ? [
              {
                paymentMethod: isReceivableCheckout ? settlementMethod : paymentMethod,
                amount: downpayment,
              },
            ]
          : [],
      creditAccount: isReceivableCheckout
        ? {
            provider: paymentMethod,
            term: creditTerm,
            sourceTotalAmountSnapshot: totals.grandTotal,
            cashPromoTotalAmount: totals.grandTotal,
            initialPaymentAmount: downpayment,
            downpaymentAmount: downpayment,
            principalAmount: regularTotal,
            regularPriceTotalAmount: regularTotal,
            financedBalance: financedBalance,
            balanceAmount: financedBalance,
            remainingBalance: financedBalance,
            monthlyDueAmount: installmentCalculation?.monthlyDueAmount || 0,
            months: installmentCalculation?.months || 1,
            termBasis: termBasis,
          }
        : null,
      items: cart.map((line, index) => {
        const lineDesc =
          line.type === "SERVICE"
            ? line.serviceStaffName
              ? `${line.description.trim()} [Done by: ${line.serviceStaffName}]`
              : line.description.trim()
            : line.item?.itemName || "Item"

        const baseUnit = getLineUnitPrice(line, pricingTerm)
        const baseTotal = getLineTotal(line, pricingTerm)

        // When AR Installment is selected, show the financed unit price with interest rate
        const unitPrice = isCredit && termBasis < 1
          ? Math.round((baseUnit / termBasis) * 100) / 100
          : baseUnit

        const lineTotal = isCredit && termBasis < 1
          ? Math.round((baseTotal / termBasis) * 100) / 100
          : baseTotal

        let availableStock = null
        if (line.item?.availableStock !== undefined && line.item?.availableStock !== null) {
          availableStock = Number(line.item.availableStock)
        } else if (line.item?.inventoryBatches && Array.isArray(line.item.inventoryBatches)) {
          availableStock = line.item.inventoryBatches.reduce(
            (sum, b) => sum + Number(b.quantityAvailable || 0),
            0
          )
        } else if (line.item?.quantityAvailable !== undefined && line.item?.quantityAvailable !== null) {
          availableStock = Number(line.item.quantityAvailable)
        } else if (Array.isArray(line.batches)) {
          availableStock = line.batches.reduce(
            (sum, b) => sum + Number(b.quantityAvailable || 0),
            0
          )
        }

        return {
          id: line.localId || `item-${index}`,
          lineNo: index + 1,
          itemCodeSnapshot: line.item?.itemCode || "—",
          itemNameSnapshot: line.item?.itemName || lineDesc,
          description: lineDesc,
          quantity: Number(line.quantity || 1),
          baseUnitPriceSnapshot: baseUnit,
          unitPrice,
          discountAmount: Number(line.discountAmount || 0),
          lineTotal,
          warrantyDuration: line.warrantyDuration || (line.item?.hasWarranty ? "1 YEAR WARRANTY" : "—"),
          availableStock,
          serial: line.isCustomSerial
            ? { serialNumber: line.customSerialNumber?.trim() || "PENDING SCAN" }
            : line.serialId
              ? { serialNumber: line.serials?.find((serial) => serial.id === line.serialId)?.serialNumber || "—" }
              : null,
          batch: line.batchId ? line.batches?.find((batch) => batch.id === line.batchId) : null,
        }
      }),
    }

    setSaleCheckoutPreview(previewSaleDoc)
  }

  const submitSale = async (overrideCustomerDetails = null) => {
    if (!canCreateSale || isSubmittingSale) return

    const validationMessage = validateCart()
    if (validationMessage) {
      setCheckoutMessage(validationMessage)
      return
    }

    const effectiveName = (
      overrideCustomerDetails?.customerName ?? customerSearch
    ).trim()
    const effectiveAddress = (
      overrideCustomerDetails?.customerAddress ?? customerAddress
    ).trim()
    const effectivePhone = (
      overrideCustomerDetails?.customerPhone ?? customerPhone
    ).trim()
    const effectiveCompany = (
      overrideCustomerDetails?.customerCompany ?? customerCompany ?? ""
    ).trim()
    const effectiveEmail = (
      overrideCustomerDetails?.customerEmail ?? customerEmail
    ).trim()

    if (!effectiveName) {
      setCheckoutMessage("Customer name is required before completing the sale.")
      customerInputRef.current?.focus()
      return
    }

    setIsSubmittingSale(true)
    setCheckoutMessage("")

    const cartSnapshot = cart.map((line) => ({
      serialNumber: line.isCustomSerial
        ? line.customSerialNumber?.trim()
        : line.serials?.find((serial) => serial.id === line.serialId)?.serialNumber || null,
    }))

    try {
      let effectiveCustomerId = selectedCustomerId || undefined

      if (effectiveCustomerId) {
        // Update existing customer record if other details were supplied
        try {
          await updateCustomerById(effectiveCustomerId, {
            fullName: effectiveName || undefined,
            address: effectiveAddress || null,
            mobileNumber: effectivePhone || null,
            companyName: effectiveCompany || null,
            email: effectiveEmail || null,
          })
        } catch (updateErr) {
          console.warn("Updating customer details failed, proceeding with sale:", updateErr)
        }
      } else {
        // Check if existing customer matches by name
        const existingMatch = customers.find(
          (c) => c.fullName?.trim().toLowerCase() === effectiveName.toLowerCase()
        )
        if (existingMatch?.id) {
          effectiveCustomerId = existingMatch.id
          try {
            await updateCustomerById(existingMatch.id, {
              address: effectiveAddress || null,
              mobileNumber: effectivePhone || null,
              companyName: effectiveCompany || null,
              email: effectiveEmail || null,
            })
          } catch (updateErr) {
            console.warn("Updating existing customer details failed:", updateErr)
          }
        } else if (
          effectiveName.toLowerCase() !== "walk-in" &&
          effectiveName.toLowerCase() !== "walk-in customer"
        ) {
          try {
            const newCustRes = await createCustomer({
              fullName: effectiveName,
              address: effectiveAddress || undefined,
              mobileNumber: effectivePhone || undefined,
              companyName: effectiveCompany || undefined,
              email: effectiveEmail || undefined,
              branchId,
              priceTier: selectedPriceTier || 1,
            })
            const createdCust = newCustRes?.data || newCustRes
            if (createdCust?.id) {
              effectiveCustomerId = createdCust.id
            }
          } catch (custError) {
            console.warn("Auto-registering customer failed, continuing as walk-in:", custError)
          }
        }
      }

      // Update state with effective customer details
      setCustomerSearch(effectiveName)
      setCustomerAddress(effectiveAddress)
      setCustomerPhone(effectivePhone)
      setCustomerCompany(effectiveCompany)
      setCustomerEmail(effectiveEmail)

      const effectiveRemarks = (
        overrideCustomerDetails?.remarks ?? remarks
      ).trim()
      setRemarks(effectiveRemarks)

      const settlementAmount = Number(effectivePaymentAmount || 0)
      const termTag = pricingTerm !== "CASH" ? `[Term: ${PRICING_TERMS[pricingTerm]?.label || pricingTerm}]` : ""
      const builderStaff = serviceStaffList.find((s) => s.id === selectedBuilderId)
      const rawBuildRemarks = isPcBuild
        ? builderStaff?.fullName
          ? `[PC BUILD] Assembled by: ${builderStaff.fullName}${effectiveRemarks ? ` | ${effectiveRemarks}` : ""}`
          : effectiveRemarks
            ? `[PC BUILD] ${effectiveRemarks}`
            : "[PC BUILD]"
        : effectiveRemarks || ""
      const formattedRemarks = [rawBuildRemarks, termTag].filter(Boolean).join(" ") || undefined

      const salePayload = {
        branchId,
        customerId: effectiveCustomerId,
        serviceCharge: Number(serviceCharge || 0),
        remarks: formattedRemarks,
        items: cart.map((line) => {
          const explicitMarkup =
            line.markupPercent === "" ||
            line.markupPercent === undefined ||
            line.markupPercent === null
              ? 0
              : Number(line.markupPercent)
          const termMarkup = PRICING_TERMS[pricingTerm]?.markupPercent || 0
          const effectiveMarkup = explicitMarkup || termMarkup

          if (line.type === "SERVICE") {
            const rawDescription = line.description.trim()
            const finalDescription = line.serviceStaffName
              ? `${rawDescription} [Done by: ${line.serviceStaffName}]`
              : rawDescription

            return {
              description: finalDescription,
              quantity: Number(line.quantity),
              unitPrice: getLineUnitPrice(line, pricingTerm),
              markupPercent: effectiveMarkup,
              discountAmount: Number(line.discountAmount || 0),
            }
          }

          return {
            itemId: line.itemId,
            priceTier: Number(line.priceTier),
            markupPercent: effectiveMarkup,
            quantity: Number(line.quantity),
            discountAmount: Number(line.discountAmount || 0),
            batchId: line.isCustomSerial ? undefined : (line.batchId || undefined),
            serialId: (!line.isCustomSerial && line.serialId) ? line.serialId : undefined,
            serialNumber: (line.isCustomSerial && line.customSerialNumber?.trim()) ? line.customSerialNumber.trim() : undefined,
            warrantyType: line.warrantyType || undefined,
            warrantyDuration: line.warrantyDuration || undefined,
          }
        }),
        payments:
          settlementAmount > 0
            ? [
                {
                  paymentMethod: isReceivableCheckout
                    ? settlementMethod
                    : paymentMethod,
                  amount: settlementAmount,
                  referenceNo: paymentReference.trim() || undefined,
                  remarks: paymentRemarks.trim() || undefined,
                },
              ]
            : [],
        receivable: isReceivableCheckout
          ? {
              provider: paymentMethod,
              providerReferenceNo: providerReference.trim() || undefined,
              term: creditTerm,
              dueDay:
                creditDueDay === ""
                  ? undefined
                  : Number(creditDueDay),
              firstDueDate: creditFirstDueDate
                ? new Date(
                    `${creditFirstDueDate}T00:00:00+08:00`,
                  ).toISOString()
                : undefined,
              remarks: creditRemarks.trim() || undefined,
            }
          : undefined,
        cashierId: selectedSalesPersonId || user?.id || undefined,
      }
      const requestSignature = JSON.stringify(salePayload)

      if (saleRequestRef.current.signature !== requestSignature) {
        saleRequestRef.current = {
          signature: requestSignature,
          key: createRequestKey(),
        }
      }

      const response = await createSale({
        ...salePayload,
        idempotencyKey: saleRequestRef.current.key,
      })

      const sale = response?.data
      if (!response?.success || !sale) throw new Error("Invalid sale response")

      // Auto-save remembered customer-item price tiers
      if (effectiveCustomerId) {
        cart.forEach((line) => {
          if (line.itemId && line.priceTier) {
            saveCustomerItemTier(effectiveCustomerId, line.itemId, line.priceTier)
          }
        })
      }

      const assignedStaff = serviceStaffList.find((s) => s.id === selectedSalesPersonId)
      const effectiveCashier = sale.cashier || assignedStaff || user

      const isCredit = isReceivableCheckout
      const termBasis = isCredit ? (installmentCalculation?.termBasis || 1) : 1
      const downpayment = Number(effectivePaymentAmount || 0)
      const financedBalance = isCredit ? (installmentCalculation?.financedBalance || 0) : 0
      const regularTotal = isCredit ? (installmentCalculation?.regularPriceTotalAmount || totals.grandTotal) : totals.grandTotal

      const receiptSale = {
        ...sale,
        cashier: effectiveCashier,
        customer: {
          ...(sale.customer || {}),
          fullName: effectiveName || sale.customer?.fullName || "Walk-in Customer",
          address: effectiveAddress || sale.customer?.address || null,
          mobileNumber: effectivePhone || sale.customer?.mobileNumber || null,
          companyName: effectiveCompany || sale.customer?.companyName || null,
          email: effectiveEmail || sale.customer?.email || null,
        },
        creditAccount: isReceivableCheckout
          ? {
              ...(sale.creditAccount || {}),
              provider: paymentMethod,
              term: creditTerm,
              initialPaymentAmount: downpayment,
              downpaymentAmount: downpayment,
              principalAmount: regularTotal,
              regularPriceTotalAmount: regularTotal,
              financedBalance: financedBalance,
              balanceAmount: financedBalance,
              monthlyDueAmount: installmentCalculation?.monthlyDueAmount || 0,
              months: installmentCalculation?.months || 1,
              termBasis: termBasis,
            }
          : sale.creditAccount,
        items: (sale.items || []).map((item, index) => {
          const baseUnit = Number(item.unitPrice || 0)
          const baseTotal = Number(item.lineTotal || (Number(item.quantity || 1) * baseUnit))

          const unitPrice = isReceivableCheckout && termBasis < 1
            ? Math.round((baseUnit / termBasis) * 100) / 100
            : baseUnit

          const lineTotal = isReceivableCheckout && termBasis < 1
            ? Math.round((baseTotal / termBasis) * 100) / 100
            : baseTotal

          return {
            ...item,
            baseUnitPriceSnapshot: baseUnit,
            unitPrice,
            lineTotal,
            serialNumber: cartSnapshot[index]?.serialNumber || item.serialNumber || null,
          }
        }),
      }

      setSaleCheckoutPreview(null)
      setCompletedSale(receiptSale)

      // If sale included Job Order lines, auto-complete and release the Job Orders
      const joIds = [...new Set(cart.filter((l) => l.isJobOrder && l.jobOrderId).map((l) => l.jobOrderId))]
      if (joIds.length > 0) {
        for (const joId of joIds) {
          try {
            const joLines = cart.filter((l) => l.isJobOrder && l.jobOrderId === joId)
            const staffWithId = joLines.find((l) => l.serviceStaffId)
            const staffId = staffWithId?.serviceStaffId || undefined

            const jobRes = await getServiceJobById(joId).catch(() => null)
            const currentJob = jobRes?.data || jobRes

            const tasks = extractServiceTasks(currentJob)
            const taskTech = tasks.find((t) => t.technicianId)
            const taskTechId = taskTech?.technicianId || undefined

            const branchTech =
              serviceStaffList.find((s) => s.role === "TECHNICIAN" && s.id !== user?.id) ||
              serviceStaffList.find((s) => s.role === "TECHNICIAN") ||
              serviceStaffList[0]

            const effectiveDoneBy =
              staffId ||
              currentJob?.serviceDoneById ||
              taskTechId ||
              currentJob?.assignedTechnicianId ||
              selectedServiceStaffId ||
              branchTech?.id ||
              user?.id ||
              undefined

            const totalJoAmount = joLines.reduce(
              (sum, l) => sum + Number(l.unitPrice || 0) * Number(l.quantity || 1),
              0,
            )
            const finalCharge =
              totalJoAmount > 0
                ? totalJoAmount
                : Number(
                    currentJob?.finalServiceCharge ??
                    currentJob?.baseServiceCharge ??
                    currentJob?.estimatedServiceCharge ??
                    0,
                  )

            const repairType = currentJob?.repairType || "ORDINARY_REPAIR"

            // 1. Ensure Job Order is in a valid state for release (IN_PROGRESS / READY_FOR_RELEASE)
            if (currentJob && currentJob.status === "PENDING") {
              await updateServiceJobStatus(joId, {
                status: "IN_PROGRESS",
                repairType,
                ...(effectiveDoneBy ? { serviceDoneById: effectiveDoneBy } : {}),
              }).catch(() => null)
              await updateServiceJobStatus(joId, {
                status: "READY_FOR_RELEASE",
                repairType,
                ...(effectiveDoneBy ? { serviceDoneById: effectiveDoneBy } : {}),
              }).catch(() => null)
            } else if (currentJob && currentJob.status === "IN_PROGRESS") {
              await updateServiceJobStatus(joId, {
                status: "READY_FOR_RELEASE",
                repairType,
                ...(effectiveDoneBy ? { serviceDoneById: effectiveDoneBy } : {}),
              }).catch(() => null)
            }

            const cleanNotes = (currentJob?.serviceNotes || "")
              .replace(/\[BILLED IN POS:.*?\]/g, "")
              .trim()
            const invoiceTag = `[BILLED IN POS: Invoice ${sale.receiptCode}]`
            const combinedNotes = cleanNotes ? `${cleanNotes}\n\n${invoiceTag}` : invoiceTag

            const isAlreadyReleased = Boolean(currentJob?.releasedAt || currentJob?.status === "COMPLETED")

            if (isAlreadyReleased) {
              await updateServiceJobStatus(joId, {
                serviceNotes: combinedNotes,
              }).catch((err) => {
                console.warn(`Could not update service notes for completed Job Order ${joId}:`, err)
              })
            } else {
              const releasePayload = {
                releaseOutcome: "SERVICE_COMPLETED",
                repairType,
                baseServiceCharge: finalCharge,
                finalServiceCharge: finalCharge,
                markupPercent: 0,
                ...(effectiveDoneBy ? { serviceDoneById: effectiveDoneBy } : {}),
                releaseNotes: `Settled and released via POS invoice ${sale.receiptCode}`,
                serviceNotes: combinedNotes,
              }

              const releaseResult = await releaseServiceJob(joId, releasePayload).catch((err) => {
                console.warn(`Primary auto-release failed for Job Order ${joId}:`, err)
                return null
              })

              if (!releaseResult) {
                // Secondary fallback attempt with branch technician or current user
                const fallbackDoneBy =
                  effectiveDoneBy ||
                  branchTech?.id ||
                  currentJob?.assignedTechnicianId ||
                  currentJob?.serviceDoneById ||
                  user?.id ||
                  undefined

                await releaseServiceJob(joId, {
                  ...releasePayload,
                  ...(fallbackDoneBy ? { serviceDoneById: fallbackDoneBy } : {}),
                }).catch(async (fallbackErr) => {
                  console.warn(`Fallback auto-release failed for Job Order ${joId}:`, fallbackErr)
                  // If release endpoint still failed, save the billing note and mark ready for immediate claim
                  await updateServiceJobStatus(joId, {
                    repairType,
                    ...(fallbackDoneBy ? { serviceDoneById: fallbackDoneBy } : {}),
                    serviceNotes: combinedNotes,
                  }).catch(() => null)
                })
              }
            }
          } catch (releaseErr) {
            console.warn(`Could not auto-release Job Order ${joId}:`, releaseErr)
          }
        }
      }

      setNoticeMessage(
        `Sale ${sale.receiptCode} completed successfully${sale.creditAccount ? ` with receivable ${sale.creditAccount.creditCode}` : ""}.`,
      )
      saleRequestRef.current = { signature: "", key: "" }
      resetCheckout()
      setSalesPage(1)
      await loadSales()
      await loadCustomers()
      await loadItems()
    } catch (error) {
      setCheckoutMessage(getApiErrorMessage(error, "Unable to complete the sale. No success receipt was returned."))
    } finally {
      setIsSubmittingSale(false)
    }
  }

  const openCartPreview = () => {
    if (cart.length === 0) return
    const hasCustomer = Boolean(selectedCustomerId || customerSearch.trim())
    if (!hasCustomer) {
      setCheckoutMessage("Customer name is required before previewing quotation. Please enter or select a customer.")
      customerInputRef.current?.focus()
      return
    }
    setCheckoutMessage("")

    const matchedCustomer = customers.find((c) => c.id === selectedCustomerId)
    const customerObj = matchedCustomer || (customerSearch.trim() ? { fullName: customerSearch.trim() } : { fullName: "Walk-in customer" })

    const previewQuotation = {
      quotationCode: "PREVIEW",
      createdAt: new Date().toISOString(),
      branch: activeBranch,
      customer: customerObj,
      preparedBy: user,
      isPcBuild,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      grandTotal: totals.grandTotal,
      pricingTerm,
      notes: [
        remarks.trim(),
        `[Term: ${PRICING_TERMS[pricingTerm]?.label || pricingTerm}]`,
      ].filter(Boolean).join(" "),
      items: cart.map((line, index) => ({
        id: line.localId || `item-${index}`,
        lineNo: index + 1,
        itemCodeSnapshot: line.item?.itemCode || "—",
        description: line.type === "SERVICE" ? (line.description || "Service") : (line.item?.itemName || "Item"),
        quantity: Number(line.quantity || 1),
        unitPrice: getLineUnitPrice(line, pricingTerm),
        baseUnitPrice: getLineBaseUnitPrice(line),
        discountAmount: Number(line.discountAmount || 0),
        lineTotal: getLineTotal(line, pricingTerm),
        warrantyDuration: line.warrantyDuration || (line.item?.hasWarranty ? "1 YEAR WARRANTY" : ""),
        isPcBuildPart: isPcBuild,
      })),
    }

    setActiveQuotationDoc(previewQuotation)
    setIsQuotationPreviewMode(true)
    setIsQuotationDocOpen(true)
  }

  const submitQuotation = async () => {
    if (cart.length === 0 || isCreatingQuotation || !branchId) return
    const hasCustomer = Boolean(selectedCustomerId || customerSearch.trim())
    if (!hasCustomer) {
      setCheckoutMessage("Customer name is required before creating a quotation. Please enter or select a customer.")
      customerInputRef.current?.focus()
      return
    }
    setCheckoutMessage("")
    setIsCreatingQuotation(true)

    try {
      let effectiveCustomerId = selectedCustomerId || undefined
      const trimmedCustomerName = customerSearch.trim()

      if (!effectiveCustomerId && trimmedCustomerName) {
        const existingMatch = customers.find(
          (c) => c.fullName?.trim().toLowerCase() === trimmedCustomerName.toLowerCase()
        )
        if (existingMatch?.id) {
          effectiveCustomerId = existingMatch.id
        }
      }

      if (
        !effectiveCustomerId &&
        trimmedCustomerName &&
        trimmedCustomerName.toLowerCase() !== "walk-in" &&
        trimmedCustomerName.toLowerCase() !== "walk-in customer"
      ) {
        try {
          const newCustRes = await createCustomer({
            fullName: trimmedCustomerName,
            branchId,
            priceTier: selectedPriceTier || 1,
          })
          const createdCust = newCustRes?.data || newCustRes
          if (createdCust?.id) {
            effectiveCustomerId = createdCust.id
            loadCustomers()
          }
        } catch (custErr) {
          console.warn("Auto-registering customer for quotation failed, proceeding:", custErr)
        }
      }

      // Check if there is any service line with serviceDoneById
      const serviceLineWithDoneBy = cart.find(
        (l) => l.type === "SERVICE" && l.serviceStaffId
      )
      const serviceDoneById = serviceLineWithDoneBy?.serviceStaffId || undefined

      const formattedRemarks = [
        isPcBuild ? "[PC BUILD]" : "",
        remarks.trim(),
        `[Term: ${PRICING_TERMS[pricingTerm]?.label || pricingTerm}]`,
      ].filter(Boolean).join(" ")

      const settlementConfig = {
        paymentMethod,
        settlementMethod,
        paymentAmount: Number(effectivePaymentAmount) || 0,
        paymentReference: paymentReference.trim() || undefined,
        creditTerm: isReceivableCheckout ? creditTerm : undefined,
        creditDueDay: isReceivableCheckout ? creditDueDay : undefined,
        creditFirstDueDate: isReceivableCheckout ? creditFirstDueDate : undefined,
        providerReference: isReceivableCheckout ? providerReference.trim() : undefined,
        pricingTerm,
      }

      const quotationPayload = {
        branchId,
        customerId: effectiveCustomerId,
        serviceDoneById,
        title: isPcBuild ? "PC Build Quotation" : (formattedRemarks || undefined),
        notes: serializeQuotationNotes(formattedRemarks, settlementConfig),
        isPcBuild,
        items: cart.map((line) => {
          const unitPrice = getLineUnitPrice(line, pricingTerm)
          if (line.type === "SERVICE") {
            const rawDesc = line.description.trim()
            const finalDesc = line.serviceStaffName
              ? `${rawDesc} [Done by: ${line.serviceStaffName}]`
              : rawDesc

            return {
              description: finalDesc,
              priceTier: 1,
              quantity: Number(line.quantity),
              unitPrice,
              markupPercent:
                line.markupPercent === "" ||
                line.markupPercent === undefined ||
                line.markupPercent === null
                  ? 0
                  : Number(line.markupPercent),
              discountAmount: Number(line.discountAmount || 0),
              isPcBuildPart: isPcBuild,
            }
          }

          const serialText = line.isCustomSerial
            ? line.customSerialNumber?.trim()
            : line.serialId
              ? line.serials?.find((s) => s.id === line.serialId)?.serialNumber
              : null

          return {
            itemId: line.itemId,
            priceTier: Number(line.priceTier),
            unitPrice,
            markupPercent:
              line.markupPercent === "" ||
              line.markupPercent === undefined ||
              line.markupPercent === null
                ? 0
                : Number(line.markupPercent),
            quantity: Number(line.quantity),
            discountAmount: Number(line.discountAmount || 0),
            isPcBuildPart: isPcBuild,
            warrantyDuration: line.warrantyDuration || undefined,
            remarks: serialText ? `S/N: ${serialText}` : (line.remarks || undefined),
          }
        }),
      }

      const response = await createQuotation(quotationPayload)
      const createdQuote = response?.data || response

      if (!createdQuote?.id) {
        throw new Error("Invalid quotation response")
      }

      const displayCode = String(createdQuote.quotationCode || "").match(/\d+$/)?.[0]?.padStart(5, "0") || createdQuote.quotationCode

      setNoticeMessage(`Quotation No. ${displayCode} created successfully!`)
      setActiveQuotationDoc(createdQuote)
      setIsQuotationPreviewMode(false)
      setIsQuotationDocOpen(true)
      await loadQuotations()
    } catch (error) {
      setCheckoutMessage(getApiErrorMessage(error, "Unable to create quotation."))
    } finally {
      setIsCreatingQuotation(false)
    }
  }

  const openSaleDetails = async (sale) => {
    setIsDetailOpen(true)
    setDetailSale(sale)
    setIsLoadingDetail(true)
    setDetailMessage("")

    try {
      const response = await getSaleById(sale.id)
      const detail = response?.data
      if (response?.success && detail) {
        setDetailSale(detail)
      }
    } catch (error) {
      console.warn("Sale detail fetch failed, falling back to cached sale item:", error)
      // Do not block viewing if we already have the sale record from list
      if (!sale?.items || sale.items.length === 0) {
        setDetailMessage(getApiErrorMessage(error, "Unable to load the complete sale record."))
      }
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const handleOpenReturn = async (sale) => {
    try {
      const response = await getSaleById(sale.id)
      const detail = response?.data || sale
      setSaleToReturn(detail)
    } catch {
      setSaleToReturn(sale)
    }
  }

  const handleOpenCancel = async (sale) => {
    try {
      const response = await getSaleById(sale.id)
      const detail = response?.data || sale
      setSaleToCancel(detail)
    } catch {
      setSaleToCancel(sale)
    }
  }

  const handleOpenAddItems = async (sale) => {
    try {
      const response = await getSaleById(sale.id)
      const detail = response?.data || sale
      setSaleToAppend(detail)
    } catch {
      setSaleToAppend(sale)
    }
  }

  const handleConfirmAppendItems = async (payload) => {
    if (!saleToAppend?.id || isAppendingSale) return

    const saleId = saleToAppend.id
    const receiptCode = saleToAppend.receiptCode

    setIsAppendingSale(true)
    try {
      const response = await appendSaleItems(saleId, payload)
      const updated = response?.data || response
      setNoticeMessage(`Successfully added items to receipt #${receiptCode}.`)
      setSaleToAppend(null)
      setIsDetailOpen(false)
      setDetailSale(null)

      // Fetch complete fresh sale with all updated items, payments, and credit details
      let fullSale = updated
      try {
        const freshRes = await getSaleById(saleId)
        if (freshRes?.success && freshRes?.data) {
          fullSale = freshRes.data
        }
      } catch (fetchErr) {
        console.warn("Could not fetch full sale after append:", fetchErr)
      }

      await loadSales()
      await loadItems()

      if (fullSale?.id) {
        setCompletedSale(fullSale)
        try {
          printWarrantyReceipt(fullSale)
        } catch (printErr) {
          console.warn("Auto-print warranty receipt failed:", printErr)
        }
      }
    } catch (error) {
      const msg = getApiErrorMessage(error, "Unable to add items to this sale.")
      setNoticeMessage(msg)
      throw error
    } finally {
      setIsAppendingSale(false)
    }
  }

  const handleExportSalesExcel = () => {
    if (historyTab === "QUOTATIONS") {
      const exportColumns = [
        ["Quotation No", (row) => row.quoteNumber || "—"],
        ["Date", (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-PH") : "—"],
        ["Customer Name", (row) => row.customer?.fullName || "Walk-in Customer"],
        ["Status", (row) => formatStatus(row.status)],
        ["Items Count", (row) => (row.items || []).length],
        ["Grand Total", (row) => Number(row.grandTotal || 0)],
        ["Prepared By", (row) => row.preparedBy?.fullName || row.cashier?.fullName || row.preparedBy?.username || "—"],
        ["Service Done By", (row) => row.serviceDoneBy?.fullName || "—"],
        ["Remarks", (row) => row.remarks || "—"],
      ]
      exportReportExcel({
        label: "Customer Quotations",
        filename: `Quotations-${new Date().toISOString().slice(0, 10)}`,
        columns: exportColumns,
        records: quotations,
        branch: activeBranch,
        generatedBy: user,
        filters: [
          ["Search Query", salesSearch.trim() || "All"],
          ["Status", quotationStatusFilter || "All Quotation Statuses"],
        ],
        totals: [
          ["Total Quotations Exported", quotations.length],
          ["Combined Grand Total", quotations.reduce((sum, q) => sum + Number(q.grandTotal || 0), 0)],
        ],
      })
    } else if (priceTierFilter) {
      const tierName = TIER_LABELS[priceTierFilter] || `Tier ${priceTierFilter}`
      const itemRows = []
      let totalTierUnits = 0
      let totalTierRevenue = 0

      filteredSalesByDate.forEach((sale) => {
        ;(sale.items || []).forEach((item) => {
          const itemTier = Number(item.priceTier || 1)
          if (itemTier === Number(priceTierFilter)) {
            const qty = Number(item.quantity || 1)
            const lineTotal = Number(item.lineTotal || (Number(item.unitPrice || 0) * qty) || 0)
            totalTierUnits += qty
            totalTierRevenue += lineTotal
            itemRows.push({
              receiptCode: sale.receiptCode || "—",
              saleDate: sale.saleDate || sale.createdAt,
              customerName: sale.customer?.fullName || "Walk-in Customer",
              itemCode: item.item?.itemCode || item.itemCodeSnapshot || "—",
              description: item.description || item.itemNameSnapshot || "—",
              priceTier: `Tier ${itemTier} (${tierName})`,
              unitPrice: Number(item.unitPrice || 0),
              quantity: qty,
              lineTotal,
              paymentMethod: sale.creditAccount ? formatStatus(sale.creditAccount.provider) : formatStatus(sale.paymentMethod || "CASH"),
              cashierName: sale.cashier?.fullName || sale.cashier?.username || "—",
              saleStatus: formatStatus(sale.status),
            })
          }
        })
      })

      const exportColumns = [
        ["Receipt Code", (row) => row.receiptCode],
        ["Date & Time", (row) => row.saleDate ? new Date(row.saleDate).toLocaleString("en-PH") : "—"],
        ["Customer Name", (row) => row.customerName],
        ["Item Code", (row) => row.itemCode],
        ["Product / Description", (row) => row.description],
        ["Price Tier", (row) => row.priceTier],
        ["Unit Price", (row) => row.unitPrice],
        ["Quantity", (row) => row.quantity],
        ["Line Total", (row) => row.lineTotal],
        ["Payment Method", (row) => row.paymentMethod],
        ["Sales Agent / Cashier", (row) => row.cashierName],
        ["Sale Status", (row) => row.saleStatus],
      ]

      exportReportExcel({
        label: `Sales by Price Tier - ${tierName}`,
        filename: `Sales-Tier-${priceTierFilter}-${dateFilterPeriod}-${new Date().toISOString().slice(0, 10)}`,
        columns: exportColumns,
        records: itemRows,
        branch: activeBranch,
        generatedBy: user,
        filters: [
          ["Date Period", DATE_FILTER_LABELS[dateFilterPeriod] || dateFilterPeriod],
          ["Price Tier", `Tier ${priceTierFilter} (${tierName})`],
          ["Search Query", salesSearch.trim() || "All"],
          ["Sale Status", salesStatus || "All Statuses"],
          ["Payment Status", paymentStatus || "All Payment Statuses"],
        ],
        totals: [
          ["Date Period Filter", DATE_FILTER_LABELS[dateFilterPeriod] || dateFilterPeriod],
          ["Price Tier Filter", `Tier ${priceTierFilter} · ${tierName}`],
          ["Matching Line Items", itemRows.length],
          ["Total Units Sold", totalTierUnits],
          ["Total Sales Revenue (Tier " + priceTierFilter + ")", totalTierRevenue],
        ],
      })
    } else {
      const exportColumns = [
        ["Receipt Code", (row) => row.receiptCode || "—"],
        ["Date & Time", (row) => (row.saleDate || row.createdAt) ? new Date(row.saleDate || row.createdAt).toLocaleString("en-PH") : "—"],
        ["Customer Name", (row) => row.customer?.fullName || "Walk-in Customer"],
        ["Sale Status", (row) => formatStatus(row.status)],
        ["Payment Status", (row) => formatStatus(row.paymentStatus)],
        ["Payment Method", (row) => row.creditAccount ? formatStatus(row.creditAccount.provider) : formatStatus(row.paymentMethod || "CASH")],
        ["Financing Term", (row) => row.creditAccount?.term ? formatStatus(row.creditAccount.term) : "—"],
        ["Items Count", (row) => (row.items || []).length],
        ["Subtotal", (row) => Number(row.subtotal || 0)],
        ["Total Discount", (row) => Number(row.totalDiscount || 0)],
        ["Grand Total", (row) => Number(row.creditAccount?.regularPriceTotalAmount || row.grandTotal || 0)],
        ["Amount Paid", (row) => Number(row.amountPaid || 0)],
        ["Change", (row) => Number(row.changeAmount || 0)],
        ["Cashier", (row) => row.cashier?.fullName || row.cashier?.username || "—"],
        ["Remarks", (row) => row.remarks || "—"],
      ]
      exportReportExcel({
        label: "Branch Sales History",
        filename: `Sales-History-${dateFilterPeriod}-${new Date().toISOString().slice(0, 10)}`,
        columns: exportColumns,
        records: filteredSalesByDate,
        branch: activeBranch,
        generatedBy: user,
        filters: [
          ["Date Period", DATE_FILTER_LABELS[dateFilterPeriod] || dateFilterPeriod],
          ["Price Tier", "All Price Tiers"],
          ["Search Query", salesSearch.trim() || "All"],
          ["Sale Status", salesStatus || "All Statuses"],
          ["Payment Status", paymentStatus || "All Payment Statuses"],
        ],
        totals: [
          ["Date Period Filter", DATE_FILTER_LABELS[dateFilterPeriod] || dateFilterPeriod],
          ["Total Sales Records", filteredSalesByDate.length],
          ["Kabuuang Sale (Grand Total kasama AR, Mark Up, Interest)", detailedMetrics.kabuuangSale],
          ["Kinita sa Parts Lang", detailedMetrics.partsRevenue],
          ["Kinita sa Service Lang", detailedMetrics.serviceRevenue],
          ["Kinita sa Service & Parts (Base Total)", detailedMetrics.combinedBaseRevenue],
          ["Mark Up", detailedMetrics.totalMarkup],
          ["Interest (Financing Charges)", detailedMetrics.totalInterest],
          ["AR (Accounts Receivable Balanse)", detailedMetrics.totalArBalance],
          ["Aktwal na Nakolekta (Cash & Payments)", detailedMetrics.totalCollectedCash],
          ["Tubo (Estimated Profit)", detailedMetrics.estimatedProfit],
          ["Highest Sale Account (Top Salesman)", detailedMetrics.topSalesPerson ? `${detailedMetrics.topSalesPerson.name} (${formatMoney(detailedMetrics.topSalesPerson.totalSales)} · ${detailedMetrics.topSalesPerson.count} sales)` : "—"],
        ],
      })
    }
  }

  const confirmCancellation = async (reason) => {
    if (!saleToCancel?.id || isCancellingSale) return

    setIsCancellingSale(true)
    try {
      const response = await cancelSale(saleToCancel.id, { cancellationReason: reason })
      const cancelled = response?.data
      if (!response?.success || !cancelled) throw new Error("Invalid cancellation response")

      setSaleToCancel(null)
      setDetailSale(cancelled)
      setNoticeMessage(`Sale ${cancelled.receiptCode} was cancelled and recorded as a reversal.`)
      setCompletedSale((current) => (current?.id === cancelled.id ? cancelled : current))
      await loadSales()
      await loadItems()
    } catch (error) {
      setNoticeMessage(getApiErrorMessage(error, "Unable to cancel this sale."))
    } finally {
      setIsCancellingSale(false)
    }
  }

  const confirmSaleReturn = async (payload) => {
    if (!saleToReturn?.id || isReturningSale) return

    setIsReturningSale(true)
    try {
      const response = await createSaleReturn(saleToReturn.id, payload)
      const returnRequest = response?.data?.returnRequest
      if (!response?.success || !returnRequest) throw new Error("Invalid sale return response")

      const refreshed = await getSaleById(saleToReturn.id)
      const refreshedSale = refreshed?.data
      if (!refreshed?.success || !refreshedSale) throw new Error("Unable to refresh returned sale")

      setSaleToReturn(null)
      setDetailSale(refreshedSale)
      setNoticeMessage(`Return ${returnRequest.returnCode} completed and retained in the sale history.`)
      await loadSales()
      await loadItems()
    } catch (error) {
      setNoticeMessage(getApiErrorMessage(error, "Unable to complete this item return."))
    } finally {
      setIsReturningSale(false)
    }
  }

  const selectedSerialIds = useMemo(
    () =>
      new Set(
        cart
          .filter((line) => !line.isCustomSerial)
          .map((line) => line.serialId)
          .filter(Boolean),
      ),
    [cart],
  )

  const totalPages = salesMeta?.totalPages || 1

  const filteredSalesByDate = useMemo(() => {
    if (dateFilterPeriod === "ALL") return sales

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    return sales.filter((sale) => {
      const date = new Date(sale.saleDate || sale.createdAt)
      if (Number.isNaN(date.getTime())) return true

      if (dateFilterPeriod === "TODAY") {
        return date >= startOfToday && date <= endOfToday
      }
      if (dateFilterPeriod === "YESTERDAY") {
        const startOfYesterday = new Date(startOfToday)
        startOfYesterday.setDate(startOfYesterday.getDate() - 1)
        const endOfYesterday = new Date(endOfToday)
        endOfYesterday.setDate(endOfYesterday.getDate() - 1)
        return date >= startOfYesterday && date <= endOfYesterday
      }
      if (dateFilterPeriod === "THIS_WEEK") {
        const startOfWeek = new Date(startOfToday)
        startOfWeek.setDate(startOfWeek.getDate() - 6)
        return date >= startOfWeek && date <= endOfToday
      }
      if (dateFilterPeriod === "THIS_MONTH") {
        const startOfMonth = new Date(startOfToday)
        startOfMonth.setDate(startOfMonth.getDate() - 29)
        return date >= startOfMonth && date <= endOfToday
      }
      if (dateFilterPeriod === "THIS_YEAR") {
        const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
        return date >= startOfYear && date <= endOfToday
      }
      return true
    })
  }, [sales, dateFilterPeriod])

  const detailedMetrics = useMemo(() => {
    let totalTransactions = 0
    let completedCount = 0

    // Revenue categories
    let partsRevenue = 0 // Kinita sa parts lang
    let serviceRevenue = 0 // Kinita sa service lang
    let combinedBaseRevenue = 0 // Kinita sa service and parts

    // Margin, Markup, and Profit
    let totalMarkup = 0 // Mark up
    let totalCost = 0 // Cost ng pisa
    let estimatedProfit = 0 // Tubo / Net Margin

    // Financing & Credit
    let totalInterest = 0 // Interest / financing charges
    let totalArBalance = 0 // Accounts Receivable (unpaid balance)
    let totalCollectedCash = 0 // Aktwal na perang nakolekta

    // Grand Total
    let kabuuangSale = 0 // Kabuuang sale kasama ang AR, Markup, Interest

    // Sales Person / Salesman aggregation (Highest Sale Account)
    const salesPersonsMap = {}

    filteredSalesByDate.forEach((sale) => {
      if (sale.status === "CANCELLED") return

      totalTransactions += 1
      if (sale.status === "COMPLETED") completedCount += 1

      const effectiveSaleTotal = sale.creditAccount
        ? Number(sale.creditAccount.regularPriceTotalAmount || sale.grandTotal || 0)
        : Number(sale.grandTotal || 0)

      kabuuangSale += effectiveSaleTotal

      // Sales person / agent attribution
      const spId = sale.cashier?.id || sale.cashierId || (sale.cashier?.fullName ? `name-${sale.cashier.fullName}` : "unassigned")
      const spName = sale.cashier?.fullName || sale.cashier?.username || "Unassigned Staff"
      if (!salesPersonsMap[spId]) {
        salesPersonsMap[spId] = {
          id: spId,
          name: spName,
          username: sale.cashier?.username || "",
          role: sale.cashier?.role || "",
          totalSales: 0,
          count: 0,
          completedCount: 0,
        }
      }
      salesPersonsMap[spId].totalSales += effectiveSaleTotal
      salesPersonsMap[spId].count += 1
      if (sale.status === "COMPLETED") {
        salesPersonsMap[spId].completedCount += 1
      }

      // Cash & collected
      const upfrontPaid = Number(sale.amountPaid || 0)
      const creditCollected = sale.creditAccount ? Number(sale.creditAccount.totalCollected || 0) : 0
      totalCollectedCash += (upfrontPaid + creditCollected)

      // Credit & Interest
      if (sale.creditAccount) {
        const regularTotal = Number(sale.creditAccount.regularPriceTotalAmount || 0)
        const promoTotal = Number(
          sale.creditAccount.cashPromoTotalAmount ||
          sale.creditAccount.sourceTotalAmountSnapshot ||
          sale.grandTotal ||
          0
        )
        const interest = Math.max(regularTotal - promoTotal, 0)
        totalInterest += interest

        const remainingAr = Number(
          sale.creditAccount.remainingBalance ??
          (Number(sale.creditAccount.balanceAmount || 0) - Number(sale.creditAccount.totalCollected || 0))
        )
        totalArBalance += Math.max(remainingAr, 0)
      }

      // Items segregation: Parts vs Service
      const saleServiceCharge = Number(sale.serviceCharge || 0)
      let saleServiceFromItems = 0
      let salePartsFromItems = 0

      const items = Array.isArray(sale.items) ? sale.items : []
      items.forEach((line) => {
        const qty = Number(line.quantity || 1)
        const lineTotal = Number(line.lineTotal || (Number(line.unitPrice || 0) * qty) || 0)
        const desc = String(line.description || "").toLowerCase()
        const isServiceLine = !line.itemId || desc.includes("service") || desc.includes("labor") || desc.startsWith("[jo #")

        if (isServiceLine) {
          saleServiceFromItems += lineTotal
        } else {
          salePartsFromItems += lineTotal

          // Parts cost
          const unitCost = Number(line.operationalUnitCostSnapshot || line.acquisitionUnitCostSnapshot || 0)
          if (unitCost > 0) {
            totalCost += (unitCost * qty)
          }
        }

        // Markup
        const markupPct = Number(line.markupPercent || 0)
        const baseUnit = Number(line.baseUnitPriceSnapshot || 0)
        const unitPrice = Number(line.unitPrice || 0)
        if (markupPct > 0 && baseUnit > 0) {
          totalMarkup += Math.max(unitPrice - baseUnit, 0) * qty
        } else if (markupPct > 0 && unitPrice > 0) {
          const approxBase = unitPrice / (1 + markupPct / 100)
          totalMarkup += Math.max(unitPrice - approxBase, 0) * qty
        }
      })

      if (items.length > 0) {
        partsRevenue += salePartsFromItems
        serviceRevenue += (saleServiceFromItems + saleServiceCharge)
      } else {
        serviceRevenue += saleServiceCharge
        partsRevenue += Math.max(Number(sale.grandTotal || 0) - saleServiceCharge, 0)
      }
    })

    combinedBaseRevenue = partsRevenue + serviceRevenue
    const partsProfit = Math.max(partsRevenue - totalCost, 0)
    estimatedProfit = partsProfit + serviceRevenue + totalInterest

    const salesPersonsList = Object.values(salesPersonsMap).sort((a, b) => b.totalSales - a.totalSales)
    const topSalesPerson = salesPersonsList.length > 0 ? salesPersonsList[0] : null

    return {
      totalTransactions,
      completedCount,
      partsRevenue,
      serviceRevenue,
      combinedBaseRevenue,
      totalMarkup,
      totalInterest,
      totalArBalance,
      totalCollectedCash,
      estimatedProfit,
      kabuuangSale,
      salesPersonsList,
      topSalesPerson,
    }
  }, [filteredSalesByDate])

  return (
    <div className="min-w-0 space-y-4">
      {/* Top Header Banner & View Mode Switcher */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[var(--color-maroon)]/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              {posViewMode === "REGISTER" ? "POS Cashiering Register" : "Sales Archive & Records"}
            </span>
            {activeBranch ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                <Building2 size={11} />
                <span className="truncate">{activeBranch.code} · {activeBranch.name}</span>
              </span>
            ) : null}
          </div>
          <h1 className="mt-1 text-xl font-black text-slate-900 leading-tight">
            {posViewMode === "REGISTER" ? "POS Cashiering & Checkout" : "Branch Sales Records & Audit"}
          </h1>
          <p className="text-xs text-slate-500">
            {posViewMode === "REGISTER"
              ? "Fast checkout, barcode scanner, serial assignment, and quotation conversion."
              : "Review completed receipts, transaction details, official warranty slips, and item refunds."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented View Mode Switcher Pills */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                posViewMode === "REGISTER"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => setPosViewMode("REGISTER")}
              type="button"
            >
              <ShoppingCart size={13} />
              Register
              {cart.length > 0 ? (
                <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-800">
                  {cart.length}
                </span>
              ) : null}
            </button>
            <button
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                posViewMode === "SALES_HISTORY"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => {
                setPosViewMode("SALES_HISTORY")
                loadSales()
              }}
              type="button"
            >
              <ReceiptText size={13} />
              Sales Records
              {salesMeta?.total !== undefined ? (
                <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                  {salesMeta.total}
                </span>
              ) : null}
            </button>
          </div>

          {/* Clean 1-Button Date Range Filter */}
          {posViewMode === "SALES_HISTORY" ? (
            <div className="relative inline-flex items-center">
              <select
                aria-label="Filter by time period"
                className="appearance-none rounded-xl border border-[var(--color-maroon)]/40 bg-[var(--color-maroon)]/5 py-2 pl-8 pr-7 text-xs font-black text-[var(--color-maroon)] outline-none hover:bg-[var(--color-maroon)]/10 transition cursor-pointer"
                onChange={(e) => setDateFilterPeriod(e.target.value)}
                value={dateFilterPeriod}
              >
                <option value="TODAY">📅 Today (Ngayong Araw)</option>
                <option value="YESTERDAY">📅 Yesterday (Kahapon)</option>
                <option value="THIS_WEEK">📅 1 Week (Huling 7 Araw)</option>
                <option value="THIS_MONTH">📅 1 Month (Huling 30 Araw)</option>
                <option value="THIS_YEAR">📅 1 Year (Kasalukuyang Taon)</option>
                <option value="ALL">📅 All Records (Lahat)</option>
              </select>
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-maroon)]" size={13} />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-maroon)] text-[9px]">▼</span>
            </div>
          ) : null}

          {/* Quick Action Button */}
          {posViewMode === "REGISTER" ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
              onClick={() => {
                setPosViewMode("SALES_HISTORY")
                loadSales()
              }}
              type="button"
            >
              <ReceiptText className="text-[var(--color-maroon)]" size={14} />
              View Sales Records
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-black text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]"
              onClick={() => setPosViewMode("REGISTER")}
              type="button"
            >
              <Plus size={14} />
              + Open Register
              {cart.length > 0 ? ` (${cart.length})` : ""}
            </button>
          )}

          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
            disabled={posViewMode === "SALES_HISTORY" ? isLoadingSales : isLoadingItems}
            onClick={() => {
              if (posViewMode === "SALES_HISTORY") {
                loadSales()
              } else {
                loadItems()
                loadSales()
              }
            }}
            type="button"
          >
            <RefreshCw className={isLoadingSales || isLoadingItems ? "animate-spin" : ""} size={14} />
            Refresh
          </button>
        </div>
      </header>

      {noticeMessage ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          <span>{noticeMessage}</span>
          <button aria-label="Dismiss notice" className="rounded-md p-0.5 text-emerald-600 hover:bg-emerald-100" onClick={() => setNoticeMessage("")} type="button"><X size={14} /></button>
        </div>
      ) : null}

      {!canCreateSale && posViewMode === "REGISTER" ? (
        <ErrorBanner>Your role can view sales but cannot create them.</ErrorBanner>
      ) : null}

      {posViewMode === "REGISTER" && canCreateSale ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5 min-w-0 space-y-3">
            {/* Customer & Price Tier Card (at the very top) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-blue-50 text-blue-700">
                    <UserRound size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                      Customer <span className="text-red-500 font-bold">*</span>
                    </h2>
                  </div>
                </div>
                {selectedCustomerId || customerSearch.trim() || customerPhone.trim() || customerAddress.trim() ? (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-red-700 transition"
                    onClick={() => {
                      setSelectedCustomerId("")
                      setCustomerSearch("")
                      setCustomerAddress("")
                      setCustomerPhone("")
                      setCustomerEmail("")
                      setCustomerCompany("")
                      setIsCustomerDropdownOpen(false)
                      setSelectedPriceTier(1)
                    }}
                    title="Clear customer details"
                    type="button"
                  >
                    <X size={11} /> Clear
                  </button>
                ) : null}
              </div>

              {/* Customer Combobox */}
              <div className="relative" ref={customerDropdownRef}>
                <div className="relative">
                  <input
                    ref={customerInputRef}
                    aria-label="Search or enter customer name"
                    className={`w-full rounded-xl border bg-slate-50/50 py-1.5 pl-3 pr-8 text-xs font-medium outline-none transition focus:bg-white ${
                      !selectedCustomerId && !customerSearch.trim() && checkoutMessage?.includes("Customer name is required")
                        ? "border-red-400 focus:border-red-500"
                        : "border-slate-200 focus:border-[var(--color-maroon)]"
                    }`}
                    onChange={(event) => {
                      setCustomerSearch(event.target.value)
                      setIsCustomerDropdownOpen(true)
                      if (!event.target.value.trim()) {
                        setSelectedCustomerId("")
                      }
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    placeholder="Type customer name (e.g. Juan Dela Cruz) *required…"
                    value={customerSearch}
                  />
                  {customerSearch.trim() ? (
                    <button
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600"
                      onClick={() => {
                        setCustomerSearch("")
                        setSelectedCustomerId("")
                        setCustomerAddress("")
                        setCustomerPhone("")
                        setCustomerEmail("")
                        setCustomerCompany("")
                        setIsCustomerDropdownOpen(false)
                      }}
                      type="button"
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>

                {/* Autocomplete Dropdown */}
                {isCustomerDropdownOpen && customerSearch.trim() ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl text-xs">
                    {customers.length > 0 ? (
                      <div>
                        <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Existing Customers
                        </div>
                        {customers.slice(0, 8).map((customer) => (
                          <button
                            className="block w-full border-b border-slate-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-blue-50/60"
                            key={customer.id}
                            onClick={() => {
                              setSelectedCustomerId(customer.id)
                              setCustomerSearch(customer.fullName)
                              setCustomerAddress(customer.address || "")
                              setCustomerPhone(customer.mobileNumber || "")
                              setCustomerEmail(customer.email || "")
                              setCustomerCompany(customer.companyName || "")
                              setIsCustomerDropdownOpen(false)
                              const tier = customer.priceTier ? Number(customer.priceTier) : 1
                              setSelectedPriceTier(tier)
                              setCart((current) =>
                                current.map((line) => {
                                  if (line.type !== "PRODUCT" || !line.item) return line
                                  const available = availablePriceTiers(line.item)
                                  if (available.includes(tier)) {
                                    return { ...line, priceTier: tier }
                                  }
                                  return line
                                }),
                              )
                            }}
                            type="button"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900">{customer.fullName}</span>
                              {customer.priceTier ? (
                                <span className="shrink-0 rounded bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[10px] font-bold text-blue-800">
                                  Tier {customer.priceTier}
                                </span>
                              ) : null}
                            </div>
                            {customer.companyName || customer.mobileNumber || customer.address ? (
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {[customer.companyName, customer.mobileNumber, customer.address].filter(Boolean).join(" · ")}
                              </p>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {/* Free-text option for new customer / walk-in name */}
                    <div className="border-t border-slate-100 p-1.5">
                      <button
                        className="flex w-full items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-left text-xs font-bold text-[var(--color-maroon)] transition hover:bg-rose-50"
                        onClick={() => {
                          setSelectedCustomerId("")
                          setIsCustomerDropdownOpen(false)
                        }}
                        type="button"
                      >
                        <Plus size={13} />
                        <span>Use as new customer: <strong className="text-slate-900">"{customerSearch.trim()}"</strong></span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Contact Number & Address Fields */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Contact No.</span>
                  <input
                    className="mt-0.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs outline-none transition focus:bg-white focus:border-[var(--color-maroon)]"
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0917xxxxxxx"
                    value={customerPhone}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Address</span>
                  <input
                    className="mt-0.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs outline-none transition focus:bg-white focus:border-[var(--color-maroon)]"
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="City / Municipality"
                    value={customerAddress}
                  />
                </label>
              </div>

              {/* Active selection badge */}
              {selectedCustomerId ? (
                (() => {
                  const cust = customers.find((c) => c.id === selectedCustomerId)
                  return cust ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-xs">
                      <span className="font-bold text-blue-900 truncate">{cust.fullName} (Existing Customer)</span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-800 shrink-0">
                        Default Tier {cust.priceTier || 1}
                      </span>
                    </div>
                  ) : null
                })()
              ) : customerSearch.trim() && !isCustomerDropdownOpen ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs">
                  <span className="font-bold text-amber-900 truncate">"{customerSearch.trim()}" (New Customer)</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 shrink-0">
                    Tier {selectedPriceTier}
                  </span>
                </div>
              ) : null}

              {/* Sales Person / Attributed Staff Selector */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Sales Person
                    </span>
                    {selectedSalesPersonId && user?.id && selectedSalesPersonId !== user.id ? (
                      <button
                        type="button"
                        onClick={() => setSelectedSalesPersonId(user.id)}
                        className="text-[10px] font-bold text-[var(--color-maroon)] hover:underline"
                      >
                        Reset ({user.fullName})
                      </button>
                    ) : null}
                  </div>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none transition focus:bg-white focus:border-[var(--color-maroon)]"
                    value={selectedSalesPersonId || user?.id || ""}
                    onChange={(e) => setSelectedSalesPersonId(e.target.value)}
                  >
                    {user ? (
                      <option value={user.id}>
                        {user.fullName}
                      </option>
                    ) : null}
                    {serviceStaffList
                      .filter((staff) => staff.id !== user?.id)
                      .map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.fullName}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {/* Price Tier Toolbar */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Global Sale Tier:</span>
                  <span className="text-[10px] font-bold text-[var(--color-maroon)]">Active: Price {selectedPriceTier}</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((tier) => {
                    const isSelected = selectedPriceTier === tier
                    return (
                      <button
                        className={`rounded-lg py-1.5 text-xs font-bold transition ${
                          isSelected
                            ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                            : "border border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300 hover:bg-white"
                        }`}
                        key={tier}
                        onClick={() => {
                          setSelectedPriceTier(tier)
                          setCart((current) =>
                            current.map((line) => {
                              if (line.type !== "PRODUCT" || !line.item) return line
                              const available = availablePriceTiers(line.item)
                              if (available.includes(tier)) {
                                return { ...line, priceTier: tier }
                              }
                              return line
                            }),
                          )
                        }}
                        type="button"
                      >
                        Tier {tier}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Product & Job Order Search Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-rose-50 text-[var(--color-maroon)]">
                    <PackageSearch size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Find Products & Job Orders
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] hover:bg-[#6b0f1a] text-white px-3 py-1.5 text-xs font-bold shadow-sm hover:shadow-md transition transform active:scale-95 cursor-pointer ring-1 ring-rose-200"
                    onClick={() => setShowJobOrderLookup(true)}
                    title="Scan barcode or type JO number to load and pay Job Order"
                    type="button"
                  >
                    <Wrench size={13} className="text-white" />
                    <span>Pay Job Order</span>
                  </button>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">Scan or Enter</span>
                </div>
              </div>

              <form className="relative" onSubmit={handleItemSearchSubmit}>
                <Barcode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  aria-label="Search products or job orders by barcode, code, or JO number"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-9 text-xs font-medium text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white focus:ring-2 focus:ring-rose-500/10"
                  onChange={(event) => setItemSearch(event.target.value)}
                  placeholder="Scan barcode / serial or enter J.O. # (e.g. 202609020001)…"
                  value={itemSearch}
                />
                {isLoadingItems ? <LoaderCircle className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-maroon)]" size={15} /> : null}
              </form>

              {itemMessage ? <p className="text-xs font-semibold text-amber-700">{itemMessage}</p> : null}

              <div className="max-h-[260px] sm:max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
                {/* 1. Show Matching Job Orders at the very top */}
                {jobOrderResults.map((job) => {
                  const finalPrice = Number(
                    job.finalServiceCharge ??
                    job.baseServiceCharge ??
                    job.estimatedServiceCharge ??
                    0
                  )
                  const customerName = job.customerNameSnapshot || job.customer?.fullName || "Walk-in"
                  const techName = job.serviceDoneBy?.fullName || job.assignedTechnician?.fullName

                  return (
                    <div
                      className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-rose-300 bg-rose-50/80 p-2.5 text-left transition hover:border-[var(--color-maroon)] hover:bg-rose-100 shadow-xs cursor-pointer group"
                      key={job.id}
                      onClick={() => handleSelectJobOrder(job)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="rounded-md bg-[var(--color-maroon)] text-white px-2 py-0.5 text-[10px] font-black font-mono tracking-wider">
                            {job.jobCode}
                          </span>
                          <span className="text-[10px] font-bold text-rose-900 bg-rose-200/80 px-1.5 py-0.2 rounded">
                            Job Order
                          </span>
                          <span className="text-[10px] font-bold text-slate-600">
                            {job.status?.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-black text-slate-900 truncate">
                          {job.jobTitle || job.repairType?.replace(/_/g, " ")} — {job.deviceDescription || job.unitType}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          Customer: <strong>{customerName}</strong> {job.serialNumber ? `• S/N: ${job.serialNumber}` : ""} {techName ? `• Tech: ${techName}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs font-mono font-black text-[var(--color-maroon)]">
                          Amount: {formatMoney(finalPrice)} <span className="text-[10px] font-normal text-slate-500">(Editable in cart)</span>
                        </p>
                      </div>
                      <button
                        className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--color-maroon)] text-white group-hover:bg-[#6b0f1a] shadow-xs font-bold text-xs"
                        type="button"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )
                })}

                {/* 2. Show Matching Products */}
                {itemResults.map((item) => {
                  const stock = Number(item.quantityAvailable ?? item.totalStock ?? item.stockQuantity ?? 0)
                  const isOutOfStock = stock <= 0
                  const isLowStock = !isOutOfStock && stock <= (Number(item.reorderLevel) || 5)

                  return (
                    <button
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:border-[var(--color-maroon)] hover:bg-rose-50/20 disabled:opacity-50 shadow-2xs group"
                      disabled={Boolean(addingItemId)}
                      key={item.id}
                      onClick={() => addProduct(item)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-900">{item.itemName}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <span>{item.itemCode}</span>
                          {item.barcode ? <span>· {item.barcode}</span> : null}
                          {item.isSerialized ? <span className="rounded bg-slate-100 text-slate-600 px-1 py-0.2 font-sans font-bold">Serial</span> : null}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[var(--color-maroon)]">
                            From ₱{formatMoney(item[`price${defaultPriceTier(item)}`])}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              isOutOfStock
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : isLowStock
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                isOutOfStock
                                  ? "bg-red-500"
                                  : isLowStock
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                            />
                            <span>Stock: <strong className="font-mono font-black">{stock}</strong></span>
                            {isOutOfStock ? <span className="font-normal opacity-80">(Out of stock)</span> : null}
                          </span>
                        </span>
                      </span>
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-[var(--color-maroon)] group-hover:text-white transition">
                        {addingItemId === item.id ? <LoaderCircle className="animate-spin" size={14} /> : <Plus size={14} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Service & Labor Line Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-violet-50 text-violet-700">
                    <Wrench size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">Service Line</h2>
                  </div>
                </div>
                <button
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  onClick={() => {
                    setShowServiceForm((current) => {
                      const next = !current
                      if (next && branchId) {
                        getQuotationServiceStaff({ branchId })
                          .then((response) => {
                            const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []
                            setServiceStaffList(rows)
                          })
                          .catch(() => {})
                      }
                      return next
                    })
                  }}
                  type="button"
                >
                  {showServiceForm ? "Close" : "+ Add Service"}
                </button>
              </div>

              {showServiceForm ? (
                <form className="grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-slate-100 text-xs" onSubmit={addServiceLine}>
                  {/* Service Done By */}
                  <div className="sm:col-span-2 space-y-1 rounded-xl border border-violet-100 bg-violet-50/40 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-violet-900 flex items-center gap-1">
                        <UserRound size={12} /> Service Performer
                      </span>
                      {selectedServiceStaffId ? (
                        <button
                          type="button"
                          onClick={() => setSelectedServiceStaffId("")}
                          className="text-[10px] font-bold text-violet-700 hover:text-red-700"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>

                    <div className="relative" ref={serviceStaffDropdownRef}>
                      {(() => {
                        const selectedStaff = serviceStaffList.find((s) => s.id === selectedServiceStaffId)
                        const filteredStaff = serviceStaffList.filter((s) => {
                          const query = serviceStaffSearch.toLowerCase().trim()
                          if (!query) return true
                          const roleName = getRoleLabel(s.role).toLowerCase()
                          return s.fullName.toLowerCase().includes(query) || roleName.includes(query)
                        })

                        return (
                          <>
                            <input
                              type="text"
                              className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-violet-500 transition"
                              placeholder={
                                isLoadingServiceStaff
                                  ? "Loading staff…"
                                  : selectedStaff
                                  ? selectedStaff.fullName
                                  : "Select staff name…"
                              }
                              value={serviceStaffSearch}
                              onChange={(e) => {
                                setServiceStaffSearch(e.target.value)
                                setIsServiceStaffDropdownOpen(true)
                              }}
                              onFocus={() => {
                                setIsServiceStaffDropdownOpen(true)
                                if (branchId) {
                                  getQuotationServiceStaff({ branchId })
                                    .then((response) => {
                                      const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []
                                      setServiceStaffList(rows)
                                    })
                                    .catch(() => {})
                                }
                              }}
                            />

                            {isServiceStaffDropdownOpen && (
                              <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                                {filteredStaff.length === 0 ? (
                                  <div className="p-2.5 text-center text-xs text-slate-400">
                                    No staff matching "{serviceStaffSearch}"
                                  </div>
                                ) : (
                                  filteredStaff.map((staff) => (
                                    <button
                                      key={staff.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedServiceStaffId(staff.id)
                                        setServiceStaffSearch("")
                                        setIsServiceStaffDropdownOpen(false)
                                      }}
                                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-violet-50 transition"
                                    >
                                      <div>
                                        <p className="font-bold text-slate-900">{staff.fullName}</p>
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Saved Service Catalog Template Selector */}
                  {serviceCatalog.length > 0 ? (
                    <div className="sm:col-span-2 space-y-1 rounded-xl border border-violet-100 bg-violet-50/40 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-violet-900 flex items-center gap-1">
                          <Sparkles size={12} className="text-violet-600" /> Saved Service Catalog (Optional)
                        </span>
                        {selectedServiceCatalogId ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedServiceCatalogId("")
                              setServiceDescription("")
                              setServiceUnitPrice("")
                              setServiceMarkup("")
                            }}
                            className="text-[10px] font-bold text-violet-700 hover:text-red-700"
                          >
                            Clear Template
                          </button>
                        ) : null}
                      </div>
                      <select
                        className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-violet-500 transition"
                        value={selectedServiceCatalogId}
                        onChange={(e) => handleSelectServiceCatalog(e.target.value)}
                      >
                        <option value="">-- Select from Saved Service Catalog or type below --</option>
                        {serviceCatalog.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — ₱{Number(s.basePrice || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })} {s.deviceType ? `(${s.deviceType})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <label className="sm:col-span-2 block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Description *</span>
                    <input
                      list="pos-service-catalog-options"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]"
                      onChange={(event) => {
                        const val = event.target.value
                        setServiceDescription(val)
                        const matched = serviceCatalog.find((s) => s.name?.toLowerCase() === val.trim().toLowerCase())
                        if (matched) {
                          handleSelectServiceCatalog(matched.id)
                        }
                      }}
                      placeholder="Labor, setup, diagnostics, delivery…"
                      value={serviceDescription}
                    />
                    <datalist id="pos-service-catalog-options">
                      {serviceCatalog.map((s) => (
                        <option key={s.id} value={s.name}>
                          ₱{Number(s.basePrice || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </datalist>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Qty</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]" min="0.01" onChange={(event) => setServiceQuantity(event.target.value)} step="0.01" type="number" value={serviceQuantity} />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Base Price (₱)</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono outline-none focus:border-[var(--color-maroon)]" min="0" onChange={(event) => setServiceUnitPrice(event.target.value)} step="0.01" type="number" value={serviceUnitPrice} />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Mark up %</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]" max="99.9999" min="0" onChange={(event) => setServiceMarkup(event.target.value)} placeholder="Optional" step="0.01" type="number" value={serviceMarkup} />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Discount (₱)</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono outline-none focus:border-[var(--color-maroon)]" min="0" onChange={(event) => setServiceDiscount(event.target.value)} step="0.01" type="number" value={serviceDiscount} />
                  </label>
                  <div className="rounded-lg bg-slate-50 p-2.5 text-xs sm:col-span-2 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Preview: Base {formatMoney(serviceBaseUnitPrice)} · Final {formatMoney(serviceFinalUnitPrice)}</span>
                    <span className="font-mono font-bold text-slate-900">Total: {formatMoney(serviceLineTotal)}</span>
                  </div>
                  <button className="sm:col-span-2 rounded-xl bg-[var(--color-maroon)] py-2 text-xs font-bold text-white transition hover:bg-[var(--color-maroon-hover)] shadow-2xs" type="submit">
                    + Add Service to Cart
                  </button>
                </form>
              ) : null}
            </section>
          </div>

          {/* Right Column: Active Cart & Settlement */}
          <section className="lg:col-span-7 min-w-0 self-start rounded-2xl border border-slate-200 bg-white shadow-2xs lg:sticky lg:top-4 overflow-hidden flex flex-col">
            {/* Cart Header */}
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-[var(--color-maroon)] text-white">
                  <ShoppingCart size={15} />
                </span>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Current Cart <span className="text-slate-400 font-normal">({cart.length} lines)</span>
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={isPcBuild}
                    onChange={(e) => setIsPcBuild(e.target.checked)}
                    className="size-3.5 rounded border-slate-300 text-[var(--color-maroon)] focus:ring-[var(--color-maroon)]"
                  />
                  <span className="text-[11px] font-bold text-slate-700">🖥️ PC Build</span>
                </label>
                {cart.length > 0 ? (
                  <button className="text-[11px] font-bold text-red-600 hover:text-red-700" onClick={() => { if (window.confirm("Clear all items in cart?")) setCart([]) }} type="button">
                    Clear
                  </button>
                ) : null}
              </div>
            </header>

            {isPcBuild ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200 bg-rose-50/75 px-3.5 py-2 text-xs">
                <span className="font-bold text-[var(--color-maroon)] flex items-center gap-1.5">
                  <Wrench size={13} />
                  Assembled / Built By:
                </span>
                <select
                  className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                  value={selectedBuilderId}
                  onChange={(e) => setSelectedBuilderId(e.target.value)}
                >
                  <option value="">-- Select Staff / Assembler (Optional) --</option>
                  {serviceStaffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {cartMessage ? <div className="border-b border-amber-200 bg-amber-50 p-2.5 text-xs font-semibold text-amber-800">{cartMessage}</div> : null}

            {cart.length === 0 ? (
              <div className="h-[200px] grid place-content-center p-4 text-center text-slate-400">
                <ShoppingCart className="mx-auto text-slate-300" size={30} />
                <p className="mt-1.5 text-xs font-bold text-slate-600">Cart is empty</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Search product or add service line on the left.</p>
              </div>
            ) : (
              <div className="h-[200px] space-y-2 overflow-y-auto p-2.5 text-xs">
                {cart.map((line, index) => {
                  const gross = getLineGross(line)
                  const selectedBatch = line.batches?.find((batch) => batch.id === line.batchId)

                  return (
                    <article className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-2.5 space-y-2 shadow-2xs" key={line.localId}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              #{index + 1} · {line.isJobOrder ? "Job Order Service" : line.type === "SERVICE" ? "Service" : "Product"}
                            </span>
                            {line.isJobOrder ? (
                              <span className="rounded bg-rose-100 border border-rose-300 px-1.5 py-0.2 text-[9px] font-black text-[var(--color-maroon)]">
                                {line.jobOrderCode}
                              </span>
                            ) : null}
                            {isPcBuild && line.type === "PRODUCT" ? (
                              <span className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.2 text-[9px] font-black text-[var(--color-maroon)]">
                                PC Part
                              </span>
                            ) : null}
                          </div>
                          <h3 className="truncate font-bold text-slate-900">{line.item?.itemName || line.description}</h3>
                          {line.item ? (
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                              <span>{line.item.itemCode}</span>
                              {line.item.isSerialized ? <span className="font-sans font-bold text-slate-500">· Serialized</span> : null}
                              <span className="text-slate-500">· Stock: <strong className="text-slate-700">{Number(line.item.quantityAvailable ?? line.item.totalStock ?? line.item.stockQuantity ?? 0)}</strong></span>
                            </div>
                          ) : null}
                          {line.type === "SERVICE" && line.serviceStaffName ? (
                            <p className="text-[10px] font-semibold text-rose-800">👤 {line.serviceStaffName}</p>
                          ) : null}
                        </div>
                        <button aria-label="Remove line" className="rounded-lg p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition shrink-0" onClick={() => removeCartLine(line.localId)} type="button">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {line.type === "PRODUCT" ? (
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                          <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-4">
                            {/* Price Tier */}
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Tier</span>
                              <select
                                className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
                                onChange={(event) =>
                                  updateCartLine(line.localId, {
                                    priceTier: Number(event.target.value),
                                    isRememberedTier: false,
                                  })
                                }
                                value={line.priceTier}
                              >
                                {availablePriceTiers(line.item).map((tier) => (
                                  <option key={tier} value={tier}>
                                    T{tier} ({formatMoney(line.item[`price${tier}`])})
                                  </option>
                                ))}
                              </select>
                            </label>

                            {/* Markup % */}
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Markup %</span>
                              <input
                                className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-[var(--color-maroon)]"
                                max="99.9999"
                                min="0"
                                onChange={(event) =>
                                  updateCartLine(line.localId, {
                                    markupPercent: event.target.value,
                                  })
                                }
                                placeholder="0"
                                step="0.01"
                                type="number"
                                value={line.markupPercent ?? ""}
                              />
                            </label>

                            {/* Quantity */}
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Qty</span>
                              <input
                                className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-slate-100"
                                disabled={line.item.isSerialized}
                                min="0.01"
                                onChange={(event) =>
                                  updateCartLine(line.localId, { quantity: event.target.value })
                                }
                                step="0.01"
                                type="number"
                                value={line.quantity}
                              />
                            </label>

                            {/* Exact Discount */}
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Discount</span>
                              <input
                                className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono outline-none focus:border-[var(--color-maroon)]"
                                max={gross}
                                min="0"
                                onChange={(event) =>
                                  updateCartLine(line.localId, { discountAmount: event.target.value })
                                }
                                step="0.01"
                                type="number"
                                value={line.discountAmount}
                              />
                            </label>
                          </div>

                          {/* Serial or Source Batch */}
                          {line.item.isSerialized ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold uppercase tracking-wider text-slate-500">
                                  {line.isCustomSerial ? "Barcode / Serial Input" : "Available Serial"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCartLine(line.localId, {
                                      isCustomSerial: !line.isCustomSerial,
                                      serialId: !line.isCustomSerial ? "" : (line.serials[0]?.id || ""),
                                      batchId: !line.isCustomSerial ? "" : (line.serials[0]?.batch?.id || ""),
                                      customSerialNumber: "",
                                    })
                                  }
                                  className="font-bold text-[var(--color-maroon)] underline hover:opacity-80"
                                >
                                  {line.isCustomSerial
                                    ? "← Choose from existing serials"
                                    : "+ Scan / Enter New Serial Barcode"}
                                </button>
                              </div>

                              {line.isCustomSerial ? (
                                <div>
                                  <input
                                    autoFocus
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                                    placeholder="Scan barcode or type serial number…"
                                    value={line.customSerialNumber || ""}
                                    onChange={(event) =>
                                      updateCartLine(line.localId, {
                                        customSerialNumber: event.target.value,
                                      })
                                    }
                                  />
                                </div>
                              ) : (
                                <select
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono outline-none focus:border-[var(--color-maroon)]"
                                  onChange={(event) =>
                                    updateCartLine(line.localId, { serialId: event.target.value })
                                  }
                                  value={line.serialId}
                                >
                                  <option value="">Select one serial</option>
                                  {line.serials.map((serial) => (
                                    <option
                                      disabled={
                                        selectedSerialIds.has(serial.id) &&
                                        serial.id !== line.serialId
                                      }
                                      key={serial.id}
                                      value={serial.id}
                                    >
                                      {serial.serialNumber} · {serial.batch?.batchCode || "No batch"}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ) : (
                            <label className="block">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Source Batch</span>
                              <select
                                className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-[var(--color-maroon)]"
                                onChange={(event) => updateCartLine(line.localId, { batchId: event.target.value })}
                                value={line.batchId}
                              >
                                <option value="">Select active batch</option>
                                {line.batches.map((batch) => (
                                  <option key={batch.id} value={batch.id}>
                                    {batch.batchCode} · {Number(batch.quantityAvailable || 0)} available
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}

                          {/* Line Total & Warranty Banner */}
                          <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                              <ShieldCheck size={12} /> {line.warrantyDuration || "1 YEAR WARRANTY"}
                            </span>
                            <span className="font-mono font-black text-slate-900 text-xs">
                              {formatMoney(getLineTotal(line, pricingTerm))}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                          <div className="grid gap-1.5 grid-cols-4">
                            <label className="block"><span className="text-[10px] font-bold uppercase text-slate-500 block">Qty</span><input className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" min="0.01" onChange={(event) => updateCartLine(line.localId, { quantity: event.target.value })} step="0.01" type="number" value={line.quantity} /></label>
                            <label className="block">
                              <span className={`text-[10px] font-bold uppercase block ${line.isJobOrder ? "text-[var(--color-maroon)] font-black" : "text-slate-500"}`}>
                                {line.isJobOrder ? "Price (Editable)" : "Base Price"}
                              </span>
                              <input
                                className={`mt-0.5 w-full rounded-lg border px-2 py-1 text-xs font-mono font-bold ${line.isJobOrder ? "border-rose-300 bg-rose-50/50 text-[var(--color-maroon)] focus:border-[var(--color-maroon)] focus:bg-white" : "border-slate-200 bg-white"}`}
                                min="0"
                                onChange={(event) => updateCartLine(line.localId, { baseUnitPrice: event.target.value })}
                                step="0.01"
                                type="number"
                                value={line.baseUnitPrice ?? line.unitPrice}
                              />
                            </label>
                            <label className="block"><span className="text-[10px] font-bold uppercase text-slate-500 block">Markup %</span><input className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" max="99.9999" min="0" onChange={(event) => updateCartLine(line.localId, { markupPercent: event.target.value })} placeholder="0" step="0.01" type="number" value={line.markupPercent ?? ""} /></label>
                            <label className="block"><span className="text-[10px] font-bold uppercase text-slate-500 block">Discount</span><input className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-mono" min="0" onChange={(event) => updateCartLine(line.localId, { discountAmount: event.target.value })} step="0.01" type="number" value={line.discountAmount} /></label>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400">
                              {line.isJobOrder ? "ℹ️ Changeable price for this Job Order" : ""}
                            </span>
                            <div className="text-right font-mono font-black text-slate-900 text-xs">
                              Total: {formatMoney(getLineTotal(line, pricingTerm))}
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}

            {/* Surcharges, Totals, & Payment Setup */}
            <div className="space-y-2.5 border-t border-slate-200 p-3.5 bg-slate-50/50 text-xs">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Surcharge / Delivery Fee</span>
                  <input className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono outline-none focus:border-[var(--color-maroon)]" min="0" onChange={(event) => setServiceCharge(event.target.value)} step="0.01" type="number" value={serviceCharge} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Sale Remarks</span>
                  <input className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => setRemarks(event.target.value)} placeholder="e.g. Warranty notes, special instructions, freebies..." value={remarks} />
                </label>
              </div>

              {/* Standard Pricing Terms Selector (Cash, SRP: /0.96, Regular: /0.875) */}
              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Pricing Term
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {PRICING_TERMS[pricingTerm]?.note}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPricingTerm("CASH")}
                    className={`rounded-xl py-2 px-1 text-center transition cursor-pointer ${
                      pricingTerm === "CASH"
                        ? "bg-[var(--color-maroon)] text-white shadow-2xs font-bold"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <div className="text-[11px] leading-tight">Cash Discount</div>
                    <div className="text-[10px] font-mono mt-0.5 opacity-90">{formatMoney(termTotals.cashGrand)}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingTerm("SRP")}
                    className={`rounded-xl py-2 px-1 text-center transition cursor-pointer ${
                      pricingTerm === "SRP"
                        ? "bg-blue-700 text-white shadow-2xs font-bold"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <div className="text-[11px] leading-tight">SRP (/0.96)</div>
                    <div className="text-[10px] font-mono mt-0.5 opacity-90">{formatMoney(termTotals.srpGrand)}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingTerm("REGULAR")}
                    className={`rounded-xl py-2 px-1 text-center transition cursor-pointer ${
                      pricingTerm === "REGULAR"
                        ? "bg-indigo-700 text-white shadow-2xs font-bold"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <div className="text-[11px] leading-tight">Regular (/0.875)</div>
                    <div className="text-[10px] font-mono mt-0.5 opacity-90">{formatMoney(termTotals.regularGrand)}</div>
                  </button>
                </div>
              </div>

              {/* Totals Summary Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1 shadow-2xs">
                <div className="flex justify-between text-slate-600"><span>Products Gross</span><span className="font-mono">{formatMoney(totals.productGross)}</span></div>
                {totals.serviceGross > 0 ? <div className="flex justify-between text-slate-600"><span>Service/Custom</span><span className="font-mono">{formatMoney(totals.serviceGross)}</span></div> : null}
                {totals.totalDiscount > 0 ? <div className="flex justify-between text-emerald-700"><span>Discounts</span><span className="font-mono">-{formatMoney(totals.totalDiscount)}</span></div> : null}
                {totals.additionalCharge > 0 ? <div className="flex justify-between text-slate-600"><span>Additional Charge</span><span className="font-mono">{formatMoney(totals.additionalCharge)}</span></div> : null}
                <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 text-slate-900 font-bold">
                  <span className="text-xs uppercase tracking-wider">Grand Total</span>
                  <span className="font-mono text-base font-black text-slate-900">{formatMoney(totals.grandTotal)}</span>
                </div>
              </div>

              {/* Payment Settings */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                  <CreditCard size={14} className="text-[var(--color-maroon)]" />
                  <span>Payment Arrangement</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Method</span>
                    <select
                      className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
                      onChange={(event) => {
                        const nextMethod = event.target.value
                        setPaymentMethod(nextMethod)
                        if (nextMethod === "DEBIT_CARD") {
                          setCreditTerm("STRAIGHT")
                        }
                        if (RECEIVABLE_PROVIDER_VALUES.has(nextMethod)) {
                          setPaymentAmount("0")
                          setPaymentAmountTouched(true)
                        } else {
                          setPaymentAmount("0")
                          setPaymentAmountTouched(false)
                        }
                      }}
                      value={paymentMethod}
                    >
                      <optgroup label="Immediate Settlement">
                        {IMMEDIATE_PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </optgroup>
                      <optgroup label="Accounts Receivable">
                        {RECEIVABLE_PROVIDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </optgroup>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      {isReceivableCheckout ? "Downpayment (₱)" : "Amount Tendered (₱)"}
                    </span>
                    <input
                      className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:border-[var(--color-maroon)]"
                      max={isReceivableCheckout ? totals.grandTotal : undefined}
                      min="0"
                      onChange={(event) => { setPaymentAmount(event.target.value); setPaymentAmountTouched(true) }}
                      step="0.01"
                      type="number"
                      value={effectivePaymentAmount}
                    />
                  </label>

                  {isReceivableCheckout ? (
                    <>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Downpayment Method</span>
                        <select className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]" onChange={(event) => setSettlementMethod(event.target.value)} value={settlementMethod}>
                          {IMMEDIATE_PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Provider Ref</span>
                        <input className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => setProviderReference(event.target.value)} placeholder="Approval/Ref" value={providerReference} />
                      </label>
                    </>
                  ) : null}

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Reference No.</span>
                    <input className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => setPaymentReference(event.target.value)} placeholder="Traceability ref" value={paymentReference} />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Payment Remarks</span>
                    <input className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => setPaymentRemarks(event.target.value)} placeholder="Optional note" value={paymentRemarks} />
                  </label>
                </div>

                {/* Accounts Receivable / Financing Summary */}
                {isReceivableCheckout ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-blue-200/80 pb-1.5">
                      <span className="font-bold text-blue-900 text-xs">Accounts Receivable · {formatStatus(paymentMethod)}</span>
                      <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-900">
                        Term Basis: {installmentCalculation?.termBasis ?? "1.00"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 text-xs">
                      <div className="rounded-lg bg-white border border-blue-100 p-1.5">
                        <span className="text-[10px] text-slate-400 block">Cash Promo</span>
                        <span className="font-mono font-bold text-slate-900">{formatMoney(totals.grandTotal)}</span>
                      </div>
                      <div className="rounded-lg bg-white border border-blue-100 p-1.5">
                        <span className="text-[10px] text-blue-700 block">
                          {installmentCalculation?.isCreditCardWithDp ? "CC Term Adj" : "Term Adj"}
                        </span>
                        <span className="font-mono font-bold text-blue-900">+{formatMoney(installmentCalculation?.termAdjustment || installmentCalculation?.interestAmount || 0)}</span>
                      </div>
                      <div className="rounded-lg bg-white border border-blue-100 p-1.5">
                        <span className="text-[10px] text-[var(--color-maroon)] block">
                          {installmentCalculation?.isCreditCardWithDp ? "CC Swipe Amount" : "Financed Total"}
                        </span>
                        <span className="font-mono font-bold text-[var(--color-maroon)]">
                          {formatMoney(installmentCalculation?.isCreditCardWithDp ? (installmentCalculation?.swipeAmount ?? installmentCalculation?.financedBalance) : (installmentCalculation?.regularPriceTotalAmount || totals.grandTotal))}
                        </span>
                      </div>
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-1.5">
                        <span className="text-[10px] text-emerald-800 block">
                          {creditTerm === "STRAIGHT" ? "Schedule" : `Monthly (${installmentCalculation?.months} mos)`}
                        </span>
                        <span className="font-mono font-bold text-emerald-950">
                          {creditTerm === "STRAIGHT" ? "No Fixed Due" : `${formatMoney(installmentCalculation?.monthlyDueAmount || 0)}/mo`}
                        </span>
                      </div>
                    </div>

                    {installmentCalculation?.isCreditCardWithDp ? (
                      <div className="rounded-lg bg-blue-100/50 border border-blue-200 p-2 text-xs space-y-1">
                        <div className="flex justify-between text-slate-700">
                          <span>Original Cash Price:</span>
                          <span className="font-mono font-bold text-slate-900">{formatMoney(installmentCalculation.cashPromoTotal)}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Cash Downpayment (DP):</span>
                          <span className="font-mono font-bold text-emerald-700">−{formatMoney(installmentCalculation.downpayment)}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Remaining Cash Balance:</span>
                          <span className="font-mono font-bold text-slate-800">{formatMoney(installmentCalculation.remainingCash)}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>CC Term Basis / Factor:</span>
                          <span className="font-mono font-bold text-blue-900">{installmentCalculation.termBasis}</span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-bold border-t border-blue-200 pt-1">
                          <span>Credit Card Swipe:</span>
                          <span className="font-mono text-blue-900">{formatMoney(installmentCalculation.financedBalance)}</span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-bold border-t border-blue-200 pt-1">
                          <span>Total Customer Payment / Financed Amount:</span>
                          <span className="font-mono text-[var(--color-maroon)]">{formatMoney(installmentCalculation.regularPriceTotalAmount)}</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-1.5 sm:grid-cols-3">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase text-blue-900 block">Term</span>
                        <select
                          className="mt-0.5 w-full rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                          onChange={(event) => setCreditTerm(event.target.value)}
                          value={creditTerm}
                        >
                          {(paymentMethod === "DEBIT_CARD"
                            ? INSTALLMENT_TERMS.filter(([val]) => val === "STRAIGHT" || val === "CASH_PROMO")
                            : INSTALLMENT_TERMS
                          ).map(([value, label]) => {
                            const rate = installmentRates?.[value] ?? DEFAULT_INSTALLMENT_BASIS[value]
                            return (
                              <option key={value} value={value}>
                                {label} {rate ? `(Rate: ${rate})` : ""}
                              </option>
                            )
                          })}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-[10px] font-bold uppercase text-blue-900 block">Due Day (Optional)</span>
                        <input
                          className="mt-0.5 w-full rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs outline-none focus:border-[var(--color-maroon)]"
                          max="31"
                          min="1"
                          onChange={(event) => setCreditDueDay(event.target.value)}
                          placeholder="Optional (1–31)"
                          step="1"
                          type="number"
                          value={creditDueDay}
                        />
                      </label>

                      <label className="block">
                        <span className="text-[10px] font-bold uppercase text-blue-900 block">First Due Date (Optional)</span>
                        <input
                          className="mt-0.5 w-full rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs outline-none focus:border-[var(--color-maroon)]"
                          onChange={(event) => setCreditFirstDueDate(event.target.value)}
                          type="date"
                          value={creditFirstDueDate}
                        />
                      </label>

                      <label className="sm:col-span-3 block">
                        <span className="text-[10px] font-bold uppercase text-blue-900 block">AR Notes</span>
                        <input
                          className="mt-0.5 w-full rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs outline-none focus:border-[var(--color-maroon)]"
                          onChange={(event) => setCreditRemarks(event.target.value)}
                          placeholder="Provider approval code or account notes"
                          value={creditRemarks}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
                  <span>Balance: <strong className="font-mono text-slate-800">{formatMoney(expectedBalance)}</strong></span>
                  <span>Change: <strong className="font-mono text-emerald-700">{formatMoney(expectedChange)}</strong></span>
                </div>
              </div>

              {cart.length > 0 && !selectedCustomerId && !customerSearch.trim() ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <span>⚠️ Customer name is required to complete sale.</span>
                  <button
                    type="button"
                    onClick={() => customerInputRef.current?.focus()}
                    className="font-bold text-[var(--color-maroon)] underline shrink-0"
                  >
                    Enter Name ↑
                  </button>
                </div>
              ) : null}

              {checkoutMessage ? <ErrorBanner>{checkoutMessage}</ErrorBanner> : null}

              {/* Action Buttons Toolbar: Preview, Quote, and Complete Sale */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-1">
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={cart.length === 0 || (!selectedCustomerId && !customerSearch.trim())}
                  onClick={openCartPreview}
                  title={!selectedCustomerId && !customerSearch.trim() ? "Please enter customer name first" : "Preview quotation before finalizing"}
                  type="button"
                >
                  <Eye size={15} />
                  Preview
                </button>

                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-maroon)] bg-white px-3 py-2.5 text-xs font-bold text-[var(--color-maroon)] shadow-2xs transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={cart.length === 0 || isCreatingQuotation || (!selectedCustomerId && !customerSearch.trim())}
                  onClick={submitQuotation}
                  title={!selectedCustomerId && !customerSearch.trim() ? "Please enter customer name first" : "Save as official quotation"}
                  type="button"
                >
                  {isCreatingQuotation ? <LoaderCircle className="animate-spin" size={15} /> : <FileText size={15} />}
                  Quote
                </button>

                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-3 py-2.5 text-xs font-black text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canCreateSale || cart.length === 0 || isSubmittingSale}
                  onClick={openSaleCheckoutPreview}
                  type="button"
                >
                  {isSubmittingSale ? (
                    <>
                      <LoaderCircle className="animate-spin" size={15} />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <ReceiptText size={15} />
                      Complete Sale · {formatMoney(isReceivableCheckout ? (installmentCalculation?.regularPriceTotalAmount || totals.grandTotal) : totals.grandTotal)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* Quick link bar when in Register mode */}
      {posViewMode === "REGISTER" && canCreateSale ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/75 p-3.5 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-slate-600">
            <ReceiptText className="text-[var(--color-maroon)]" size={16} />
            <span className="font-semibold">
              Looking for past receipts, customer transactions, or quotation conversions?
            </span>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-100"
            onClick={() => {
              setPosViewMode("SALES_HISTORY")
              loadSales()
            }}
            type="button"
          >
            <Eye size={13} />
            <span>View Sales Records ({salesMeta?.total ?? sales.length}) →</span>
          </button>
        </div>
      ) : null}

      {/* Sales History & Customer Quotations Section (Active when in SALES_HISTORY mode) */}
      {posViewMode === "SALES_HISTORY" ? (
        <>
          {/* Executive Filter & Date Period Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Period Filter:
              </span>
              {/* Clean 1-button dropdown selector */}
              <div className="relative inline-flex items-center">
                <select
                  aria-label="Filter by time period"
                  className="appearance-none rounded-xl border border-[var(--color-maroon)]/40 bg-white py-2 pl-8 pr-8 text-xs font-black text-[var(--color-maroon)] shadow-2xs outline-none hover:border-[var(--color-maroon)] focus:ring-2 focus:ring-[var(--color-maroon)]/20 transition cursor-pointer"
                  onChange={(e) => setDateFilterPeriod(e.target.value)}
                  value={dateFilterPeriod}
                >
                  <option value="TODAY">📅 Today (Ngayong Araw)</option>
                  <option value="YESTERDAY">📅 Yesterday (Kahapon)</option>
                  <option value="THIS_WEEK">📅 1 Week (Huling 7 Araw)</option>
                  <option value="THIS_MONTH">📅 1 Month (Huling 30 Araw)</option>
                  <option value="THIS_YEAR">📅 1 Year (Kasalukuyang Taon)</option>
                  <option value="ALL">📅 All Records (Lahat)</option>
                </select>
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-maroon)]" size={13} />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-maroon)] text-[9px]">▼</span>
              </div>

              {/* Quick Pills for 1-Click Fast Switching */}
              <div className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
                {[
                  ["TODAY", "Today"],
                  ["YESTERDAY", "Yesterday"],
                  ["THIS_WEEK", "1 Week"],
                  ["THIS_MONTH", "1 Month"],
                  ["THIS_YEAR", "1 Year"],
                  ["ALL", "All"],
                ].map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDateFilterPeriod(val)}
                    className={`rounded-lg px-2.5 py-1 transition ${
                      dateFilterPeriod === val
                        ? "bg-white text-slate-900 shadow-2xs font-black"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 shadow-2xs">
                {detailedMetrics.totalTransactions} Resibo ({detailedMetrics.completedCount} Completed)
              </span>
            </div>
          </div>

          {/* Highest Sale Account (Top Salesman) Banner / Spotlight */}
          {detailedMetrics.topSalesPerson && detailedMetrics.kabuuangSale > 0 ? (
            <div className="relative overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-500/10 via-amber-50/70 to-orange-500/10 p-4 shadow-2xs">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-xl text-white shadow-soft">
                    🏆
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-amber-300 bg-amber-200/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950">
                        Highest Sale Account ({DATE_FILTER_LABELS[dateFilterPeriod] || dateFilterPeriod})
                      </span>
                      {detailedMetrics.salesPersonsList.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setShowSalesmenLeaderboard((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-white/90 px-2 py-0.5 text-[10px] font-bold text-amber-900 hover:bg-white transition shadow-2xs cursor-pointer"
                        >
                          <Users size={11} />
                          {showSalesmenLeaderboard ? "Hide Rankings" : `View All Sales Staff (${detailedMetrics.salesPersonsList.length})`}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {detailedMetrics.topSalesPerson.name}
                      {detailedMetrics.topSalesPerson.username ? (
                        <span className="ml-1.5 font-mono text-xs font-semibold text-slate-500">
                          (@{detailedMetrics.topSalesPerson.username})
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Highest Sales Generated
                    </p>
                    <p className="font-mono text-lg font-black text-amber-950">
                      {formatMoney(detailedMetrics.topSalesPerson.totalSales)}
                    </p>
                  </div>
                  <div className="border-l border-amber-300/60 pl-4 text-left sm:text-right">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Volume / Share
                    </p>
                    <p className="font-mono text-xs font-black text-slate-800">
                      {detailedMetrics.topSalesPerson.count} Resibo ({detailedMetrics.kabuuangSale > 0 ? `${Math.round((detailedMetrics.topSalesPerson.totalSales / detailedMetrics.kabuuangSale) * 100)}%` : "0%"} ng total)
                    </p>
                  </div>
                </div>
              </div>

              {/* Collapsible Full Sales Staff Leaderboard */}
              {showSalesmenLeaderboard && detailedMetrics.salesPersonsList.length > 1 ? (
                <div className="mt-3.5 border-t border-amber-200/80 pt-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-2">
                    Ranking ng mga Nag-cater na Sales Staff ({DATE_FILTER_LABELS[dateFilterPeriod] || dateFilterPeriod})
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {detailedMetrics.salesPersonsList.map((sp, idx) => (
                      <div
                        key={sp.id}
                        className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition ${
                          idx === 0
                            ? "border-amber-300 bg-amber-100/60 shadow-2xs font-bold"
                            : "border-slate-200/70 bg-white/80"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`grid size-6 shrink-0 place-items-center rounded-lg text-[10px] font-black ${
                              idx === 0
                                ? "bg-amber-500 text-white"
                                : idx === 1
                                  ? "bg-slate-400 text-white"
                                  : idx === 2
                                    ? "bg-amber-700 text-white"
                                    : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div className="min-w-0 truncate">
                            <p className="truncate font-bold text-slate-900">{sp.name}</p>
                            <p className="text-[10px] text-slate-400">{sp.count} receipt{sp.count === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                        <p className="font-mono font-black text-slate-900 pl-2 shrink-0">
                          {formatMoney(sp.totalSales)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Tier 1: 4 Key Financial Metric Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Kabuuang Sale */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Kabuuang Sale (Grand Total)
                </span>
                <span className="grid size-8 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <ReceiptText size={16} />
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-emerald-950">
                {formatMoney(detailedMetrics.kabuuangSale)}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-emerald-700/90">
                Kasama ang AR, Mark Up, at Interest
              </p>
            </div>

            {/* Card 2: Kinita sa Parts Lang */}
            <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">
                  Kinita sa Parts Lang
                </span>
                <span className="grid size-8 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
                  <PackageSearch size={16} />
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-blue-950">
                {formatMoney(detailedMetrics.partsRevenue)}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-blue-700/90">
                Benta mula sa mga piyesa / produkto lamang
              </p>
            </div>

            {/* Card 3: Kinita sa Service Lang */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  Kinita sa Service Lang
                </span>
                <span className="grid size-8 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
                  <Wrench size={16} />
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-amber-950">
                {formatMoney(detailedMetrics.serviceRevenue)}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-amber-700/90">
                Benta mula sa labor & service charges lamang
              </p>
            </div>

            {/* Card 4: Tubo (Gross Profit) */}
            <div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-purple-50/40 p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">
                  Tubo (Gross Profit)
                </span>
                <span className="grid size-8 place-items-center rounded-xl bg-purple-600 text-white shadow-xs">
                  <TrendingUp size={16} />
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-purple-950">
                {formatMoney(detailedMetrics.estimatedProfit)}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-purple-700/90">
                Kita bawas ang cost ng pisa (+ labor & interest)
              </p>
            </div>
          </div>

          {/* Tier 2: 5 Breakdown Categories Strip */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {/* Strip 1: Kinita sa Service & Parts */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] font-black uppercase tracking-wider">Service & Parts</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">Base</span>
              </div>
              <p className="mt-1 font-mono text-base font-black text-slate-900">
                {formatMoney(detailedMetrics.combinedBaseRevenue)}
              </p>
              <p className="text-[10px] text-slate-500">Pinagsamang pisa at serbisyo</p>
            </div>

            {/* Strip 2: Mark Up */}
            <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-teal-700">
                <span className="text-[10px] font-black uppercase tracking-wider">Mark Up</span>
                <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-teal-800">Patong</span>
              </div>
              <p className="mt-1 font-mono text-base font-black text-teal-950">
                {formatMoney(detailedMetrics.totalMarkup)}
              </p>
              <p className="text-[10px] text-teal-700/80">Ipinatong na halaga sa base price</p>
            </div>

            {/* Strip 3: Interest */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-indigo-700">
                <span className="text-[10px] font-black uppercase tracking-wider">Interest</span>
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-800">Hulugan</span>
              </div>
              <p className="mt-1 font-mono text-base font-black text-indigo-950">
                {formatMoney(detailedMetrics.totalInterest)}
              </p>
              <p className="text-[10px] text-indigo-700/80">Financing fee sa installment</p>
            </div>

            {/* Strip 4: AR (Accounts Receivable) */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-rose-700">
                <span className="text-[10px] font-black uppercase tracking-wider">AR (Pautang Balanse)</span>
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-800">Credit</span>
              </div>
              <p className="mt-1 font-mono text-base font-black text-rose-950">
                {formatMoney(detailedMetrics.totalArBalance)}
              </p>
              <p className="text-[10px] text-rose-700/80">Natitirang sisingilin sa accounts</p>
            </div>

            {/* Strip 5: Aktwal na Nakolekta */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-700">
                <span className="text-[10px] font-black uppercase tracking-wider">Aktwal na Nakolekta</span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">Cash In</span>
              </div>
              <p className="mt-1 font-mono text-base font-black text-emerald-950">
                {formatMoney(detailedMetrics.totalCollectedCash)}
              </p>
              <p className="text-[10px] text-emerald-700/80">Cash at payment sa kaha</p>
            </div>
          </div>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="border-b border-slate-200 bg-slate-50/75 p-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className={`grid size-7 place-items-center rounded-lg ${historyTab === "QUOTATIONS" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                {historyTab === "QUOTATIONS" ? <FileText size={15} /> : <ReceiptText size={15} />}
              </span>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {historyTab === "QUOTATIONS" ? "Customer Quotations" : "Branch Sales History"}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
                <button
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    historyTab === "SALES"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  onClick={() => {
                    setHistoryTab("SALES")
                    loadSales()
                  }}
                  type="button"
                >
                  <ReceiptText size={13} />
                  Sales History
                  {salesMeta?.total !== undefined ? (
                    <span className="ml-1 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                      {salesMeta.total}
                    </span>
                  ) : null}
                </button>
                <button
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    historyTab === "QUOTATIONS"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  onClick={() => {
                    setHistoryTab("QUOTATIONS")
                    loadQuotations()
                  }}
                  type="button"
                >
                  <FileText size={13} />
                  Quotations (Convert)
                  {quotationsMeta?.totalItems !== undefined || quotationsMeta?.total !== undefined ? (
                    <span className="ml-1 rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[10px] font-bold text-blue-800">
                      {quotationsMeta?.totalItems ?? quotationsMeta?.total}
                    </span>
                  ) : null}
                </button>
              </div>

              <ExportExcelButton
                filteredCount={historyTab === "QUOTATIONS" ? quotations.length : filteredSalesByDate.length}
                label={historyTab === "QUOTATIONS" ? "Export Quotes (.xlsx)" : "Export Sales (.xlsx)"}
                onExport={handleExportSalesExcel}
                size="sm"
              />
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <label className="relative md:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--color-maroon)]"
                onChange={(event) => {
                  setSalesSearch(event.target.value)
                  setSalesPage(1)
                  setQuotationsPage(1)
                }}
                placeholder={historyTab === "QUOTATIONS" ? "Search customer name, quote no…" : "Search customer, receipt code, remarks…"}
                value={salesSearch}
              />
            </label>

            {historyTab === "SALES" ? (
              <>
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSalesStatus(event.target.value); setSalesPage(1) }} value={salesStatus}>
                  <option value="">All sale statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="REFUNDED">Refunded</option>
                  <option value="PARTIALLY_REFUNDED">Partially refunded</option>
                </select>
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setPaymentStatus(event.target.value); setSalesPage(1) }} value={paymentStatus}>
                  <option value="">All payment statuses</option>
                  <option value="PAID">Paid</option>
                  <option value="PARTIALLY_PAID">Partially paid</option>
                  <option value="UNPAID">Unpaid</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
                <select
                  className={`rounded-xl border px-3 py-2 text-xs font-bold outline-none transition ${
                    priceTierFilter
                      ? "border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-300"
                      : "border-slate-200 bg-white text-slate-800 focus:border-[var(--color-maroon)]"
                  }`}
                  onChange={(event) => {
                    setPriceTierFilter(event.target.value)
                    setSalesPage(1)
                  }}
                  value={priceTierFilter}
                >
                  <option value="">All Price Tiers</option>
                  <option value="1">Price Tier 1 · SRP / Retail</option>
                  <option value="2">Price Tier 2 · Wholesale / Dealer</option>
                  <option value="3">Price Tier 3 · VIP / Contractor</option>
                  <option value="4">Price Tier 4 · Corporate / Special</option>
                  <option value="5">Price Tier 5 · Promo / Clearance</option>
                </select>
              </>
            ) : (
              <select
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] md:col-span-3"
                onChange={(event) => {
                  setQuotationStatusFilter(event.target.value)
                  setQuotationsPage(1)
                }}
                value={quotationStatusFilter}
              >
                <option value="">All quotation statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="CONVERTED">Converted</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            )}
          </div>

          {historyTab === "SALES" && priceTierFilter ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-amber-500 font-mono font-black text-sm text-white shadow-xs">
                  T{priceTierFilter}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 text-xs">
                      Filtered by Price Tier {priceTierFilter} ({TIER_LABELS[priceTierFilter] || `Tier ${priceTierFilter}`})
                    </p>
                    <span className="rounded-full bg-amber-200/70 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-900">
                      Tier Filter Active
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Showing receipts containing products sold under this specific pricing tier
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Units Sold (Tier {priceTierFilter})
                  </p>
                  <p className="font-mono text-sm font-black text-slate-800">
                    {filteredTierSummary.tierUnits} pc(s)
                  </p>
                </div>
                <div className="h-7 w-px bg-amber-200" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-maroon)]">
                    Total Sales (Tier {priceTierFilter})
                  </p>
                  <p className="font-mono text-base font-black text-[var(--color-maroon)]">
                    {formatMoney(filteredTierSummary.tierRevenue)}
                  </p>
                </div>
                <button
                  className="rounded-xl border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-2xs"
                  onClick={() => {
                    setPriceTierFilter("")
                    setSalesPage(1)
                  }}
                  type="button"
                >
                  Clear Tier
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {historyTab === "SALES" ? (
          isLoadingSales ? (
            <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-slate-400"><LoaderCircle className="animate-spin" size={16} />Loading sales…</div>
          ) : sales.length === 0 ? (
            <div className="p-8 text-center"><ReceiptText className="mx-auto text-slate-300" size={32} /><p className="mt-2 text-xs font-bold text-slate-700">{salesMessage || "No sales yet"}</p><p className="mt-0.5 text-[11px] text-slate-400">Completed transactions will appear here.</p></div>
          ) : filteredSalesByDate.length === 0 ? (
            <div className="p-8 text-center">
              <ReceiptText className="mx-auto text-slate-300" size={32} />
              <p className="mt-2 text-xs font-bold text-slate-700">Walang sales record para sa {DATE_FILTER_LABELS[dateFilterPeriod] || dateFilterPeriod}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Subukang pumili ng ibang date filter o tingnan ang lahat ng benta.</p>
              <button
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                onClick={() => setDateFilterPeriod("ALL")}
                type="button"
              >
                Ipakita Lahat (All Records)
              </button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Receipt</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Sales Agent</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredSalesByDate.map((sale) => (
                      <tr className="hover:bg-slate-50/50 transition" key={sale.id}>
                        <td className="px-4 py-3">
                          <p className="font-mono font-bold text-slate-900">{sale.receiptCode}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(sale.saleDate)}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{sale.customer?.fullName || "Walk-in"}</td>
                        <td className="px-4 py-3 text-slate-600">{sale.cashier?.fullName || "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={sale.status} /></td>
                        <td className="px-4 py-3 space-y-1">
                          <div>
                            {sale.creditAccount ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-900">
                                💳 {formatStatus(sale.creditAccount.provider)}
                                {sale.creditAccount.term ? ` (${sale.creditAccount.term === "CASH_PROMO" ? "0% Interest" : formatStatus(sale.creditAccount.term)})` : ""}
                              </span>
                            ) : (sale.payments || []).length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                {sale.payments.map((p) => formatStatus(p.paymentMethod)).join(", ")}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px] font-medium">Cash</span>
                            )}
                          </div>
                          <div>
                            <StatusBadge status={sale.paymentStatus} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(() => {
                            const cr = sale.creditAccount
                            const cashTotal = Number(
                              cr?.cashPromoTotalAmount ||
                                cr?.sourceTotalAmountSnapshot ||
                                sale.grandTotal ||
                                sale.subtotal ||
                                0
                            )
                            const rawBasis = Number(cr?.termBasis || 0)
                            const termKey = cr?.term
                            const basis =
                              rawBasis > 0 && rawBasis < 1
                                ? rawBasis
                                : (termKey && DEFAULT_TERM_RATES[termKey]) || 1
                            const savedRegular = Number(cr?.regularPriceTotalAmount || 0)
                            const dp = Number(cr?.downpaymentAmount || sale.amountPaid || 0)
                            const collected = Number(cr?.totalCollected || 0)

                            const effectiveTotal =
                              basis < 1 && cashTotal > 0
                                ? (savedRegular > cashTotal
                                    ? savedRegular
                                    : Math.round((cashTotal / basis) * 100) / 100)
                                : (savedRegular > 0 ? savedRegular : Number(sale.grandTotal || 0))

                            const rawRemaining = Number(cr?.remainingBalance || 0)
                            const effectiveBal = cr
                              ? (basis < 1 && cashTotal > 0 && rawRemaining <= cashTotal
                                  ? Math.max(0, Math.round((effectiveTotal - dp - collected) * 100) / 100)
                                  : rawRemaining)
                              : 0

                            return (
                              <>
                                <p className="font-mono font-bold text-slate-900 text-xs">
                                  {formatMoney(effectiveTotal)}
                                </p>
                                {priceTierFilter ? (
                                  <p className="mt-0.5 font-mono text-[10px] font-bold text-amber-800 bg-amber-100/80 border border-amber-200 rounded px-1.5 py-0.5 inline-block">
                                    T{priceTierFilter}: {formatMoney(
                                      (sale.items || [])
                                        .filter((it) => Number(it.priceTier || 1) === Number(priceTierFilter))
                                        .reduce(
                                          (sum, it) =>
                                            sum +
                                            Number(
                                              it.lineTotal ||
                                                Number(it.unitPrice || 0) *
                                                  Number(it.quantity || 1) ||
                                                0
                                            ),
                                          0
                                        )
                                    )}
                                  </p>
                                ) : null}
                                {cr && effectiveBal > 0 ? (
                                  <p className="text-[10px] text-blue-700 font-mono">
                                    Bal: {formatMoney(effectiveBal)}
                                  </p>
                                ) : null}
                              </>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                              onClick={() => openSaleDetails(sale)}
                              type="button"
                            >
                              <Eye size={12} /> View
                            </button>
                            {canCancelSale && (sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED") ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                                onClick={() => handleOpenAddItems(sale)}
                                type="button"
                                title="Add more items to this receipt"
                              >
                                <Plus size={12} /> Add Items
                              </button>
                            ) : null}
                            {canCancelSale && (sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED") && !sale.creditAccount ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-800 hover:bg-orange-100 transition"
                                onClick={() => handleOpenReturn(sale)}
                                type="button"
                                title="Refund or return specific items"
                              >
                                <RotateCcw size={12} /> Refund
                              </button>
                            ) : null}
                            {canCancelSale && sale.status === "COMPLETED" ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 transition"
                                onClick={() => handleOpenCancel(sale)}
                                type="button"
                                title="Cancel whole sale"
                              >
                                <X size={12} /> Cancel
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2.5 p-3 lg:hidden text-xs">
                {filteredSalesByDate.map((sale) => (
                  <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs" key={sale.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono font-bold text-slate-900">{sale.receiptCode}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(sale.saleDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-slate-900">
                          {formatMoney(sale.creditAccount?.regularPriceTotalAmount || sale.grandTotal)}
                        </p>
                        {priceTierFilter ? (
                          <p className="mt-0.5 font-mono text-[10px] font-bold text-amber-800 bg-amber-100/80 border border-amber-200 rounded px-1.5 py-0.5 inline-block">
                            T{priceTierFilter}: {formatMoney(
                              (sale.items || [])
                                .filter((it) => Number(it.priceTier || 1) === Number(priceTierFilter))
                                .reduce((sum, it) => sum + Number(it.lineTotal || (Number(it.unitPrice || 0) * Number(it.quantity || 1)) || 0), 0)
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-1.5 text-slate-700">{sale.customer?.fullName || "Walk-in customer"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={sale.status} />
                      <StatusBadge status={sale.paymentStatus} />
                      {sale.creditAccount ? (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-900">
                          💳 {formatStatus(sale.creditAccount.provider)}
                          {sale.creditAccount.term ? ` (${sale.creditAccount.term === "CASH_PROMO" ? "0% Interest" : formatStatus(sale.creditAccount.term)})` : ""}
                        </span>
                      ) : (sale.payments || []).length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {sale.payments.map((p) => formatStatus(p.paymentMethod)).join(", ")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        className="flex-1 min-w-[65px] inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700"
                        onClick={() => openSaleDetails(sale)}
                        type="button"
                      >
                        <Eye size={12} /> View
                      </button>
                      {canCancelSale && (sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED") ? (
                        <button
                          className="flex-1 min-w-[75px] inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800"
                          onClick={() => handleOpenAddItems(sale)}
                          type="button"
                        >
                          <Plus size={12} /> Add Items
                        </button>
                      ) : null}
                      {canCancelSale && (sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED") && !sale.creditAccount ? (
                        <button
                          className="flex-1 min-w-[65px] inline-flex items-center justify-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-800"
                          onClick={() => handleOpenReturn(sale)}
                          type="button"
                        >
                          <RotateCcw size={12} /> Refund
                        </button>
                      ) : null}
                      {canCancelSale && sale.status === "COMPLETED" ? (
                        <button
                          className="flex-1 min-w-[65px] inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700"
                          onClick={() => handleOpenCancel(sale)}
                          type="button"
                        >
                          <X size={12} /> Cancel
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )
        ) : (
          /* Quotations History View */
          isLoadingQuotations ? (
            <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-slate-400">
              <LoaderCircle className="animate-spin" size={16} /> Loading quotations…
            </div>
          ) : quotations.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="mx-auto text-slate-300" size={32} />
              <p className="mt-2 text-xs font-bold text-slate-700">{quotationsMessage || "No quotations found"}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Quotations created in POS will appear here ready to convert.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Quotation No.</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Prepared by</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Grand Total</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {quotations.map((quote) => {
                      const displayCode = String(quote.quotationCode || "").match(/\d+$/)?.[0]?.padStart(5, "0") || quote.quotationCode
                      const itemCount = quote._count?.items ?? quote.items?.length ?? "—"
                      const canConvert = !["CONVERTED", "CANCELLED", "REJECTED"].includes(quote.status)
                      const canCancel = !["CONVERTED", "CANCELLED"].includes(quote.status)

                      return (
                        <tr className="hover:bg-slate-50/50 transition" key={quote.id}>
                          <td className="px-4 py-3">
                            <p className="font-mono font-bold text-slate-900">#{displayCode}</p>
                            <p className="text-[10px] text-slate-400">{formatDate(quote.createdAt)}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {quote.customer?.fullName || "Walk-in customer"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {itemCount} item(s)
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {quote.preparedBy?.fullName || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              quote.status === "CONVERTED"
                                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                                : quote.status === "CANCELLED"
                                  ? "bg-rose-50 border border-rose-200 text-rose-800"
                                  : "bg-blue-50 border border-blue-200 text-blue-800"
                            }`}>
                              {quote.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {formatMoney(quote.grandTotal)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                                onClick={async () => {
                                  try {
                                    const detailed = await getQuotationById(quote.id)
                                    setQuotationToView(detailed?.data || detailed)
                                  } catch {
                                    setQuotationToView(quote)
                                  }
                                }}
                                type="button"
                              >
                                <Eye size={12} /> View
                              </button>

                              {canConvert ? (
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                                  onClick={async () => {
                                    try {
                                      const detailed = await getQuotationById(quote.id)
                                      setQuotationToConvert(detailed?.data || detailed)
                                    } catch (err) {
                                      setNoticeMessage(getApiErrorMessage(err, "Failed to load quotation items for conversion."))
                                    }
                                  }}
                                  type="button"
                                  title="Convert directly into a completed sale"
                                >
                                  <ReceiptText size={12} /> Convert
                                </button>
                              ) : null}

                              {canCancel ? (
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 transition"
                                  disabled={isCancellingQuotation}
                                  onClick={async () => {
                                    if (!window.confirm(`Are you sure you want to cancel Quotation #${displayCode}?`)) {
                                      return
                                    }
                                    try {
                                      setIsCancellingQuotation(true)
                                      await updateQuotationStatus(quote.id, {
                                        status: "CANCELLED",
                                        remarks: "Cancelled from POS history",
                                      })
                                      setNoticeMessage(`Quotation #${displayCode} cancelled.`)
                                      await loadQuotations()
                                    } catch (err) {
                                      setNoticeMessage(getApiErrorMessage(err, "Failed to cancel quotation."))
                                    } finally {
                                      setIsCancellingQuotation(false)
                                    }
                                  }}
                                  type="button"
                                  title="Cancel quotation"
                                >
                                  <X size={12} /> Cancel
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2.5 p-3 lg:hidden text-xs">
                {quotations.map((quote) => {
                  const displayCode = String(quote.quotationCode || "").match(/\d+$/)?.[0]?.padStart(5, "0") || quote.quotationCode
                  const canConvert = !["CONVERTED", "CANCELLED", "REJECTED"].includes(quote.status)
                  const canCancel = !["CONVERTED", "CANCELLED"].includes(quote.status)

                  return (
                    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs" key={quote.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono font-bold text-slate-900">#{displayCode}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(quote.createdAt)}</p>
                        </div>
                        <p className="font-mono font-bold text-slate-900">{formatMoney(quote.grandTotal)}</p>
                      </div>
                      <p className="mt-1.5 text-slate-700">{quote.customer?.fullName || "Walk-in customer"}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-flex rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                          {quote.status}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 pt-2 border-t border-slate-100">
                        <button
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700"
                          onClick={async () => {
                            try {
                              const detailed = await getQuotationById(quote.id)
                              setQuotationToView(detailed?.data || detailed)
                            } catch {
                              setQuotationToView(quote)
                            }
                          }}
                          type="button"
                        >
                          <Eye size={12} /> View
                        </button>
                        {canConvert ? (
                          <button
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                            onClick={async () => {
                              try {
                                const detailed = await getQuotationById(quote.id)
                                setQuotationToConvert(detailed?.data || detailed)
                              } catch (err) {
                                setNoticeMessage(getApiErrorMessage(err, "Failed to load quotation items for conversion."))
                              }
                            }}
                            type="button"
                          >
                            <ReceiptText size={12} /> Convert
                          </button>
                        ) : null}
                        {canCancel ? (
                          <button
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700"
                            disabled={isCancellingQuotation}
                            onClick={async () => {
                              if (!window.confirm(`Are you sure you want to cancel Quotation #${displayCode}?`)) {
                                return
                              }
                              try {
                                setIsCancellingQuotation(true)
                                await updateQuotationStatus(quote.id, {
                                  status: "CANCELLED",
                                  remarks: "Cancelled from POS history",
                                })
                                setNoticeMessage(`Quotation #${displayCode} cancelled.`)
                                await loadQuotations()
                              } catch (err) {
                                setNoticeMessage(getApiErrorMessage(err, "Failed to cancel quotation."))
                              } finally {
                                setIsCancellingQuotation(false)
                              }
                            }}
                            type="button"
                          >
                            <X size={12} /> Cancel
                          </button>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )
        )}

        {/* Pagination Footer */}
        {historyTab === "SALES" ? (
          !isLoadingSales && sales.length > 0 ? (
            <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500">
              <p>Page {salesMeta?.page || salesPage} of {totalPages} · {salesMeta?.total ?? sales.length} sale(s)</p>
              <div className="flex gap-1.5">
                <button
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30"
                  disabled={salesPage <= 1}
                  onClick={() => setSalesPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30"
                  disabled={salesPage >= totalPages}
                  onClick={() => setSalesPage((current) => current + 1)}
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          ) : null
        ) : (
          !isLoadingQuotations && quotations.length > 0 ? (
            <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500">
              <p>Page {quotationsMeta?.page || quotationsPage} of {quotationsMeta?.totalPages || 1} · {quotationsMeta?.totalItems ?? quotations.length} quotation(s)</p>
              <div className="flex gap-1.5">
                <button
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30"
                  disabled={quotationsPage <= 1}
                  onClick={() => setQuotationsPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30"
                  disabled={quotationsPage >= (quotationsMeta?.totalPages || 1)}
                  onClick={() => setQuotationsPage((current) => current + 1)}
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          ) : null
        )}
      </section>
    </>
  ) : null}

      {saleCheckoutPreview ? (
        <SaleDetailDialog
          canCancel={false}
          canReturn={false}
          errorMessage=""
          isCheckoutPreview={true}
          isLoading={false}
          isSubmittingCheckout={isSubmittingSale}
          onCancelSale={() => {}}
          onClose={() => setSaleCheckoutPreview(null)}
          onConfirmCheckout={submitSale}
          onReturnItems={() => {}}
          sale={saleCheckoutPreview}
        />
      ) : null}

      {completedSale ? (
        <SaleDetailDialog
          canCancel={false}
          canReturn={false}
          errorMessage=""
          isLoading={false}
          onAddItems={(sale) => {
            setCompletedSale(null)
            handleOpenAddItems(sale)
          }}
          onCancelSale={() => {}}
          onClose={() => setCompletedSale(null)}
          onReturnItems={() => {}}
          sale={completedSale}
          title="Warranty Receipt · Customer Copy"
        />
      ) : null}

      {isDetailOpen ? (
        <SaleDetailDialog
          canCancel={canCancelSale}
          canReturn={canCancelSale}
          errorMessage={detailMessage}
          isLoading={isLoadingDetail}
          onAddItems={(sale) => {
            setIsDetailOpen(false)
            setDetailSale(null)
            handleOpenAddItems(sale)
          }}
          onCancelSale={(sale) => setSaleToCancel(sale)}
          onClose={() => { setIsDetailOpen(false); setDetailSale(null); setDetailMessage("") }}
          onReturnItems={(sale) => setSaleToReturn(sale)}
          sale={detailSale}
        />
      ) : null}

      {saleToCancel ? (
        <CancelSaleDialog isSaving={isCancellingSale} onClose={() => setSaleToCancel(null)} onConfirm={confirmCancellation} sale={saleToCancel} />
      ) : null}

      {saleToReturn ? (
        <ReturnSaleItemsDialog isSaving={isReturningSale} onClose={() => setSaleToReturn(null)} onConfirm={confirmSaleReturn} sale={saleToReturn} />
      ) : null}

      {saleToAppend ? (
        <AppendSaleItemsDialog
          installmentRates={installmentRates}
          isSaving={isAppendingSale}
          onClose={() => setSaleToAppend(null)}
          onConfirm={handleConfirmAppendItems}
          sale={saleToAppend}
        />
      ) : null}

      {isQuotationDocOpen && activeQuotationDoc ? (
        <QuotationDetailDialog
          installmentCalculation={isReceivableCheckout ? installmentCalculation : null}
          isPreview={isQuotationPreviewMode}
          isSavingQuotation={isCreatingQuotation}
          onClose={() => {
            setIsQuotationDocOpen(false)
            setActiveQuotationDoc(null)
          }}
          onSaveQuotation={isQuotationPreviewMode ? submitQuotation : null}
          quotation={activeQuotationDoc}
        />
      ) : null}

      {quotationToView ? (
        <QuotationDetailDialog
          onClose={() => setQuotationToView(null)}
          onConvertToSale={(quote) => {
            setQuotationToView(null)
            setQuotationToConvert(quote)
          }}
          quotation={quotationToView}
        />
      ) : null}

      {quotationToConvert ? (
        <QuotationConversionDialog
          branchId={branchId}
          installmentRates={installmentRates}
          onClose={() => setQuotationToConvert(null)}
          onSuccess={(createdSale) => {
            setQuotationToConvert(null)
            setNoticeMessage(`Sale ${createdSale.receiptCode} completed successfully from quotation!`)
            setCompletedSale(createdSale)
            loadSales()
            loadQuotations()
            loadItems()
          }}
          quotation={quotationToConvert}
        />
      ) : null}

      {showJobOrderLookup ? (
        <JobOrderLookupDialog
          branchId={branchId}
          cart={cart}
          onClose={() => setShowJobOrderLookup(false)}
          onSelectJob={handleSelectJobOrder}
          sales={sales}
        />
      ) : null}
    </div>
  )
}

export default PosSalesPage
