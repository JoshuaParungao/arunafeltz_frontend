import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  AlertCircle,
  Barcode,
  Building2,
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
  Trash2,
  UserRound,
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
import { getServiceJobs } from "../../features/service-jobs/serviceJobs.api"
import { generateUUID } from "../../utils/uuid"
import {
  cancelSale,
  createSaleReturn,
  createSale,
  getSaleById,
  getSales,
} from "../../features/sales/sales.api"
import { getInstallmentBasisSettings } from "../../features/settings/settings.api"
import {
  exportWarrantyReceiptPdf,
  printWarrantyReceipt,
} from "../../utils/businessDocumentExport"
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
  ["KYRO", "Kyro"],
  ["OTHER_FINANCING", "Other financing"],
  ["IN_HOUSE_INSTALLMENT", "In-house installment"],
]

const RECEIVABLE_PROVIDER_VALUES = new Set(
  RECEIVABLE_PROVIDERS.map(([value]) => value),
)

const INSTALLMENT_TERMS = [
  ["STRAIGHT", "Cash Promo (0% Interest)"],
  ["MONTH_3", "3 months"],
  ["MONTH_6", "6 months"],
  ["MONTH_9", "9 months"],
  ["MONTH_12", "12 months"],
  ["MONTH_18", "18 months"],
  ["MONTH_24", "24 months"],
]

const INSTALLMENT_TERM_MONTHS = {
  STRAIGHT: 1,
  MONTH_3: 3,
  MONTH_6: 6,
  MONTH_9: 9,
  MONTH_12: 12,
  MONTH_18: 18,
  MONTH_24: 24,
}

const DEFAULT_INSTALLMENT_BASIS = {
  STRAIGHT: 1.0,
  MONTH_3: 0.96,
  MONTH_6: 0.935,
  MONTH_9: 0.905,
  MONTH_12: 0.875,
  MONTH_18: 0.815,
  MONTH_24: 0.755,
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

function getApiErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    (typeof error?.response?.data?.error === "string" ? error.response.data.error : null) ||
    error?.message ||
    fallback
  )
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

function getLineUnitPrice(line) {
  if (line.type === "SERVICE") {
    return getServiceMarkupAdjustedPrice(
      getLineBaseUnitPrice(line),
      line.markupPercent,
    )
  }

  return getMarkupAdjustedPrice(
    getLineBaseUnitPrice(line),
    line.markupPercent,
  )
}

function getLineGross(line) {
  return Number(line.quantity || 0) * getLineUnitPrice(line)
}

function getLineTotal(line) {
  return Math.max(getLineGross(line) - Number(line.discountAmount || 0), 0)
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

  useEffect(() => {
    setPreviewCustomerName(sale?.customer?.fullName || "")
    setPreviewCustomerAddress(sale?.customer?.address || "")
    setPreviewCustomerPhone(sale?.customer?.mobileNumber || sale?.customer?.phone || "")
    setPreviewCustomerEmail(sale?.customer?.email || "")
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
  const paidAmount = Number(sale?.amountPaid ?? sale?.creditAccount?.downpaymentAmount ?? sale?.creditAccount?.initialPaymentAmount ?? 0)
  const totalAmount = isCredit && (sale?.creditAccount?.regularPriceTotalAmount || sale?.creditAccount?.principalAmount)
    ? Number(sale.creditAccount.regularPriceTotalAmount || sale.creditAccount.principalAmount)
    : Number(sale?.grandTotal || sale?.subtotal || 0)
  const balanceToPay = isCredit && (sale?.creditAccount?.balanceAmount != null || sale?.creditAccount?.financedBalance != null)
    ? Number(sale.creditAccount.balanceAmount ?? sale.creditAccount.financedBalance)
    : Math.max(0, totalAmount - paidAmount)

  const handleConfirmCheckout = () => {
    if (onConfirmCheckout) {
      onConfirmCheckout({
        customerName: previewCustomerName,
        customerAddress: previewCustomerAddress,
        customerPhone: previewCustomerPhone,
        customerEmail: previewCustomerEmail,
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
                      You can enter or update the customer address and contact number before finalizing.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 shrink-0">
                  Updates receipt in real-time
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                    Customer Full Name <span className="text-red-500">*</span>
                  </span>
                  <input
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] transition"
                    value={previewCustomerName}
                    onChange={(e) => setPreviewCustomerName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                    Contact / Mobile No.
                  </span>
                  <input
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] transition"
                    value={previewCustomerPhone}
                    onChange={(e) => setPreviewCustomerPhone(e.target.value)}
                    placeholder="e.g. 0917-123-4567 / 0961-873-5798"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                    Address (Street, City, Province)
                  </span>
                  <input
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] transition"
                    value={previewCustomerAddress}
                    onChange={(e) => setPreviewCustomerAddress(e.target.value)}
                    placeholder="e.g. Brgy. San Isidro, CSFP"
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
                        <th className="py-2 px-2 w-[16%]">ITEM CODE</th>
                        <th className="py-2 px-2 w-[48%]">ITEM DESCRIPTION</th>
                        <th className="py-2 px-2 text-center w-[10%]">QTY.</th>
                        <th className="py-2 px-2 text-right w-[13%]">UNIT PRICE</th>
                        <th className="py-2 px-2 text-right w-[13%]">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {(sale.items || []).map((item) => {
                        const itemCode = item.itemCodeSnapshot || item.item?.itemCode || "—"
                        const isSerialized = item.serialNumber || item.serial?.serialNumber
                        const warrantyBadge = item.warrantyDuration || (item.item?.hasWarranty ? "1 YEAR WARRANTY" : null)

                        const termBasis = Number(sale?.creditAccount?.termBasis || (isCredit && sale?.installmentCalculation?.termBasis) || 1)
                        const baseSnapshot = item.baseUnitPriceSnapshot != null ? Number(item.baseUnitPriceSnapshot) : null
                        const unitPrice = baseSnapshot != null && termBasis < 1
                          ? Math.round((baseSnapshot / termBasis) * 100) / 100
                          : Number(item.unitPrice || 0)
                        const qty = Number(item.quantity || 1)
                        const lineTotal = baseSnapshot != null && termBasis < 1
                          ? Math.round((qty * unitPrice) * 100) / 100
                          : Number(item.lineTotal || (qty * unitPrice))

                        return (
                          <tr className="hover:bg-slate-50/50" key={item.id || item.lineNo}>
                            <td className="py-2 px-2 font-mono font-semibold text-slate-700 align-top">
                              {itemCode}
                            </td>
                            <td className="py-2 px-2 align-top space-y-0.5">
                              <p className="font-medium text-slate-900">
                                {item.description || item.item?.itemName}
                                {warrantyBadge ? ` | ${warrantyBadge}` : ""}
                              </p>
                              {isSerialized ? (
                                <p className="text-[11px] font-mono text-slate-600">
                                  S/N: <strong className="text-slate-800">{isSerialized}</strong>
                                </p>
                              ) : null}
                              {Number(item.returnedQuantity || 0) > 0 ? (
                                <p className="text-[10px] font-bold text-orange-700">
                                  Returned: {Number(item.returnedQuantity)}
                                </p>
                              ) : null}
                            </td>
                            <td className="py-2 px-2 text-center font-bold align-top">
                              {qty}
                            </td>
                            <td className="py-2 px-2 text-right align-top font-mono">
                              {formatMoney(unitPrice)}
                            </td>
                            <td className="py-2 px-2 text-right font-bold align-top font-mono">
                              {formatMoney(lineTotal)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

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
                    <div className="flex justify-between font-bold text-slate-900 text-sm">
                      <span>TOTAL AMOUNT</span>
                      <span>{formatMoney(totalAmount)}</span>
                    </div>
                    {isCredit || paidAmount > 0 ? (
                      <div className="flex justify-between text-slate-700">
                        <span>{isCredit ? "CASH DOWNPAYMENT / PAID" : "AMOUNT PAID"}</span>
                        <span>{formatMoney(paidAmount)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                      <span>BALANCE TO PAY</span>
                      <span>{formatMoney(balanceToPay)}</span>
                    </div>
                    {isCredit && sale?.creditAccount?.monthlyDueAmount ? (
                      <div className="flex justify-between font-bold text-[#002060] text-[11px] pt-0.5">
                        <span>
                          MONTHLY ({sale.creditAccount.months || (INSTALLMENT_TERM_MONTHS[sale.creditAccount.term] || "")} MOS)
                        </span>
                        <span>{formatMoney(sale.creditAccount.monthlyDueAmount)}/mo</span>
                      </div>
                    ) : null}
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
                      <div className="border-b border-slate-400 pt-2 font-semibold text-[11px] uppercase">
                        {sale.cashier?.fullName || sale.cashier?.username || "Staff"}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="text-left font-bold text-slate-600 text-[11px]">Warehouse:</p>
                      <div className="border-b border-slate-400 pt-2 font-semibold text-[11px] text-slate-400">
                        Staff
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="text-left font-bold text-slate-600 text-[11px]">Releasing:</p>
                      <div className="border-b border-slate-400 pt-2 font-semibold text-[11px] text-slate-400">
                        Staff
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

                  {(canCancel || canReturn) && ["COMPLETED", "PARTIALLY_REFUNDED"].includes(sale.status) ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Audit Actions & Reversals
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-500 max-w-md">
                          Authorized staff can process an item refund/return or void the whole sale receipt.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
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

function JobOrderLookupDialog({ branchId, onClose, onSelectJob }) {
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
        limit: 30,
      })
      const rows = Array.isArray(response?.data) ? response.data : []
      setJobs(rows)
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || "Failed to load Job Orders.")
    } finally {
      setIsLoading(false)
    }
  }, [branchId, searchText, statusFilter])

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
                    <button
                      type="button"
                      onClick={() => onSelectJob(job)}
                      className="inline-flex items-center gap-1 rounded-xl bg-[var(--color-maroon)] hover:bg-[#6b0f1a] text-white px-3.5 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <Plus size={14} />
                      Load to Cart
                    </button>
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

function PosSalesPage({ selectedBranch, user }) {
  const activeBranch = selectedBranch || user?.branch || null
  const branchId = activeBranch?.id
  const canCreateSale = SALE_MANAGER_ROLES.has(user?.role)
  const canCancelSale = SALE_CANCELLER_ROLES.has(user?.role)

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
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [customerMessage, setCustomerMessage] = useState("")
  const customerRequestIdRef = useRef(0)
  const customerDropdownRef = useRef(null)
  const customerInputRef = useRef(null)

  const [serviceStaffList, setServiceStaffList] = useState([])
  const [isLoadingServiceStaff, setIsLoadingServiceStaff] = useState(false)
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
  const [remarks, setRemarks] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return draft?.remarks || ""
  })
  const [isPcBuild, setIsPcBuild] = useState(() => {
    const draft = branchId && user?.id ? getFormDraft(`pos_draft_${user.id}_${branchId}`) : null
    return Boolean(draft?.isPcBuild)
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
    if (cart.length > 0 || customerSearch || customerAddress || customerPhone || remarks || selectedCustomerId) {
      saveFormDraft(draftKey, {
        cart,
        selectedCustomerId,
        customerSearch,
        customerAddress,
        customerPhone,
        customerEmail,
        selectedPriceTier,
        remarks,
        isPcBuild,
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
    selectedPriceTier,
    remarks,
    isPcBuild,
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
  const [noticeMessage, setNoticeMessage] = useState("")
  const [saleCheckoutPreview, setSaleCheckoutPreview] = useState(null)
  const saleRequestRef = useRef({ signature: "", key: "" })

  const totals = useMemo(() => {
    let productGross = 0
    let serviceGross = 0
    let totalDiscount = 0

    for (const line of cart) {
      const gross = getLineGross(line)
      if (line.type === "SERVICE") serviceGross += gross
      else productGross += gross
      totalDiscount += Number(line.discountAmount || 0)
    }

    const additionalCharge = Number(serviceCharge || 0)
    const subtotal = productGross + serviceGross
    const grandTotal = Math.max(subtotal - totalDiscount + additionalCharge, 0)

    return { productGross, serviceGross, subtotal, totalDiscount, additionalCharge, grandTotal }
  }, [cart, serviceCharge])

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

    const regularPriceTotalAmount =
      Math.round((cashPromoTotal / termBasis) * 100) / 100
    const interestAmount = Math.max(regularPriceTotalAmount - cashPromoTotal, 0)
    const financedBalance = Math.max(
      Math.round(((cashPromoTotal - downpayment) / termBasis) * 100) / 100,
      0,
    )
    const monthlyDueAmount = Math.round((financedBalance / months) * 100) / 100

    return {
      termBasis,
      months,
      cashPromoTotal,
      downpayment,
      regularPriceTotalAmount,
      interestAmount,
      financedBalance,
      monthlyDueAmount,
    }
  }, [isReceivableCheckout, installmentRates, creditTerm, totals.grandTotal, paymentAmount])

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

      const joRows = Array.isArray(joResponse?.data) ? joResponse.data : []
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
          if (user?.id && rows.some((staff) => staff.id === user.id)) {
            setSelectedServiceStaffId((prev) => prev || user.id)
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
  }, [branchId, paymentStatus, salesPage, salesSearch, salesStatus])

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
      const initialSerialId = preselectedSerial?.id || serials[0]?.id || ""
      const initialBatchId = item.isSerialized
        ? (preselectedSerial?.batch?.id || serials[0]?.batch?.id || "")
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
          isCustomSerial: !preselectedSerial,
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
      const joList = Array.isArray(joRes?.data) ? joRes.data : []
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

    // Auto-fill customer info if present
    if (job.customerId) {
      setSelectedCustomerId(job.customerId)
      const found = customers.find((c) => c.id === job.customerId)
      if (found) {
        setCustomerSearch(found.fullName || "")
        setCustomerPhone(found.mobileNumber || "")
        setCustomerAddress(found.address || "")
        setCustomerEmail(found.email || "")
      }
    } else if (job.customerNameSnapshot) {
      setCustomerSearch(job.customerNameSnapshot)
      setCustomerPhone(job.customerContactSnapshot || "")
      setCustomerAddress(job.customerAddressSnapshot || "")
    }

    const jobAmount = String(
      job.finalServiceCharge ??
      job.baseServiceCharge ??
      job.estimatedServiceCharge ??
      0
    )
    const assignedStaff = job.serviceDoneBy || job.assignedTechnician

    setCart((current) => [
      ...current,
      {
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
      },
    ])

    setShowJobOrderLookup(false)
    setNoticeMessage(`Loaded Job Order ${job.jobCode} into cart. You can change the final price directly in the cart before paying.`)
  }

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
        if (line.serialId) {
          if (serialIds.has(line.serialId)) return "The same serial cannot be used more than once in a sale."
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
    setIsCustomerDropdownOpen(false)
    setSelectedPriceTier(1)
    setServiceCharge("0")
    setRemarks("")
    setIsPcBuild(false)
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
      cashier: user,
      technician: technicianName ? { fullName: technicianName } : null,
      remarks: isPcBuild
        ? (remarks.trim() ? `[PC BUILD] ${remarks.trim()}` : "[PC BUILD]")
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

        const baseUnit = getLineUnitPrice(line)
        const baseTotal = getLineTotal(line)

        // When AR Installment is selected, show the financed unit price with interest rate
        const unitPrice = isCredit && termBasis < 1
          ? Math.round((baseUnit / termBasis) * 100) / 100
          : baseUnit

        const lineTotal = isCredit && termBasis < 1
          ? Math.round((baseTotal / termBasis) * 100) / 100
          : baseTotal

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
      setCustomerEmail(effectiveEmail)

      const settlementAmount = Number(effectivePaymentAmount || 0)
      const formattedRemarks = isPcBuild
        ? (remarks.trim() ? `[PC BUILD] ${remarks.trim()}` : "[PC BUILD]")
        : remarks.trim() || undefined
      const salePayload = {
        branchId,
        customerId: effectiveCustomerId,
        serviceCharge: Number(serviceCharge || 0),
        remarks: formattedRemarks,
        items: cart.map((line) => {
          if (line.type === "SERVICE") {
            const rawDescription = line.description.trim()
            const finalDescription = line.serviceStaffName
              ? `${rawDescription} [Done by: ${line.serviceStaffName}]`
              : rawDescription

            return {
              description: finalDescription,
              quantity: Number(line.quantity),
              unitPrice: Number(line.baseUnitPrice ?? line.unitPrice),
              markupPercent:
                line.markupPercent === "" ||
                line.markupPercent === undefined ||
                line.markupPercent === null
                  ? 0
                  : Number(line.markupPercent),
              discountAmount: Number(line.discountAmount || 0),
            }
          }

          return {
            itemId: line.itemId,
            priceTier: Number(line.priceTier),
            markupPercent:
              line.markupPercent === "" ||
              line.markupPercent === undefined ||
              line.markupPercent === null
                ? 0
                : Number(line.markupPercent),
            quantity: Number(line.quantity),
            discountAmount: Number(line.discountAmount || 0),
            batchId: line.batchId || undefined,
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

      const isCredit = isReceivableCheckout
      const termBasis = isCredit ? (installmentCalculation?.termBasis || 1) : 1
      const downpayment = Number(effectivePaymentAmount || 0)
      const financedBalance = isCredit ? (installmentCalculation?.financedBalance || 0) : 0
      const regularTotal = isCredit ? (installmentCalculation?.regularPriceTotalAmount || totals.grandTotal) : totals.grandTotal

      const receiptSale = {
        ...sale,
        customer: {
          ...(sale.customer || {}),
          fullName: effectiveName || sale.customer?.fullName || "Walk-in Customer",
          address: effectiveAddress || sale.customer?.address || null,
          mobileNumber: effectivePhone || sale.customer?.mobileNumber || null,
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
      items: cart.map((line, index) => ({
        id: line.localId || `item-${index}`,
        lineNo: index + 1,
        itemCodeSnapshot: line.item?.itemCode || "—",
        description: line.type === "SERVICE" ? (line.description || "Service") : (line.item?.itemName || "Item"),
        quantity: Number(line.quantity || 1),
        unitPrice: getLineUnitPrice(line),
        baseUnitPrice: getLineBaseUnitPrice(line),
        discountAmount: Number(line.discountAmount || 0),
        lineTotal: getLineTotal(line),
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

      const formattedRemarks = isPcBuild
        ? (remarks.trim() ? `[PC BUILD] ${remarks.trim()}` : "[PC BUILD]")
        : remarks.trim() || undefined

      const settlementConfig = {
        paymentMethod,
        settlementMethod,
        paymentAmount: Number(effectivePaymentAmount) || 0,
        paymentReference: paymentReference.trim() || undefined,
        creditTerm: isReceivableCheckout ? creditTerm : undefined,
        creditDueDay: isReceivableCheckout ? creditDueDay : undefined,
        creditFirstDueDate: isReceivableCheckout ? creditFirstDueDate : undefined,
        providerReference: isReceivableCheckout ? providerReference.trim() : undefined,
      }

      const quotationPayload = {
        branchId,
        customerId: effectiveCustomerId,
        serviceDoneById,
        title: isPcBuild ? "PC Build Quotation" : (formattedRemarks || undefined),
        notes: serializeQuotationNotes(remarks.trim(), settlementConfig),
        isPcBuild,
        items: cart.map((line) => {
          if (line.type === "SERVICE") {
            const rawDesc = line.description.trim()
            const finalDesc = line.serviceStaffName
              ? `${rawDesc} [Done by: ${line.serviceStaffName}]`
              : rawDesc

            return {
              description: finalDesc,
              priceTier: 1,
              quantity: Number(line.quantity),
              unitPrice: Number(line.baseUnitPrice ?? line.unitPrice),
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

          return {
            itemId: line.itemId,
            priceTier: Number(line.priceTier),
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
    () => new Set(cart.map((line) => line.serialId).filter(Boolean)),
    [cart],
  )

  const totalPages = salesMeta?.totalPages || 1

  return (
    <div className="min-w-0 space-y-4">
      {/* Top Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              POS Cashiering
            </span>
            {activeBranch ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                <Building2 size={11} />
                <span className="truncate">{activeBranch.code} · {activeBranch.name}</span>
              </span>
            ) : null}
          </div>
          <h1 className="mt-0.5 text-xl font-black text-slate-900 leading-tight">
            Branch Checkout & Sales History
          </h1>
          <p className="text-xs text-slate-500">
            Fast checkout, serial assignment, and quotation conversion with live inventory validation.
          </p>
        </div>

        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
          disabled={isLoadingSales}
          onClick={loadSales}
          type="button"
        >
          <RefreshCw className={isLoadingSales ? "animate-spin" : ""} size={14} />
          Refresh Sales
        </button>
      </header>

      {noticeMessage ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          <span>{noticeMessage}</span>
          <button aria-label="Dismiss notice" className="rounded-md p-0.5 text-emerald-600 hover:bg-emerald-100" onClick={() => setNoticeMessage("")} type="button"><X size={14} /></button>
        </div>
      ) : null}

      {!canCreateSale ? (
        <ErrorBanner>Your role can view sales but cannot create them.</ErrorBanner>
      ) : null}

      {canCreateSale ? (
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
                {itemResults.map((item) => (
                  <button
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-[var(--color-maroon)] hover:bg-rose-50/20 disabled:opacity-50 shadow-2xs"
                    disabled={Boolean(addingItemId)}
                    key={item.id}
                    onClick={() => addProduct(item)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-slate-900">{item.itemName}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <span>{item.itemCode}</span>
                        {item.barcode ? <span>· {item.barcode}</span> : null}
                        {item.isSerialized ? <span className="rounded bg-slate-100 text-slate-600 px-1 py-0.2 font-sans font-bold">Serial</span> : null}
                      </span>
                      <span className="mt-0.5 block text-xs font-mono font-bold text-[var(--color-maroon)]">
                        From {formatMoney(item[`price${defaultPriceTier(item)}`])}
                      </span>
                    </span>
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700 hover:bg-[var(--color-maroon)] hover:text-white transition">
                      {addingItemId === item.id ? <LoaderCircle className="animate-spin" size={14} /> : <Plus size={14} />}
                    </span>
                  </button>
                ))}
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
                  onClick={() => setShowServiceForm((current) => !current)}
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
                                  ? `${selectedStaff.fullName} (${getRoleLabel(selectedStaff.role)})`
                                  : "Type name or role (e.g. Technician)…"
                              }
                              value={serviceStaffSearch}
                              onChange={(e) => {
                                setServiceStaffSearch(e.target.value)
                                setIsServiceStaffDropdownOpen(true)
                              }}
                              onFocus={() => setIsServiceStaffDropdownOpen(true)}
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
                                        <p className="text-[10px] text-slate-400">{getRoleLabel(staff.role)}</p>
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

                  <label className="sm:col-span-2 block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Description</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => setServiceDescription(event.target.value)} placeholder="Labor, setup, diagnostics, delivery…" value={serviceDescription} />
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
                          {line.item ? <p className="text-[10px] font-mono text-slate-400">{line.item.itemCode}{line.item.isSerialized ? " · Serialized" : ""}</p> : null}
                          {line.type === "SERVICE" && line.serviceStaffName ? (
                            <p className="text-[10px] font-semibold text-rose-800">👤 {line.serviceStaffName} {line.serviceStaffRole ? `(${line.serviceStaffRole})` : ""}</p>
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
                                    className="w-full rounded-lg border border-[var(--color-maroon)] bg-white px-2.5 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-[var(--color-maroon)]"
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
                              {formatMoney(getLineTotal(line))}
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
                              Total: {formatMoney(getLineTotal(line))}
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
                  <input className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => setRemarks(event.target.value)} placeholder="Optional internal note" value={remarks} />
                </label>
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
                        <span className="text-[10px] text-blue-700 block">Interest Adj</span>
                        <span className="font-mono font-bold text-blue-900">+{formatMoney(installmentCalculation?.interestAmount || 0)}</span>
                      </div>
                      <div className="rounded-lg bg-white border border-blue-100 p-1.5">
                        <span className="text-[10px] text-[var(--color-maroon)] block">Financed Total</span>
                        <span className="font-mono font-bold text-[var(--color-maroon)]">{formatMoney(installmentCalculation?.regularPriceTotalAmount || totals.grandTotal)}</span>
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

                    <div className="grid gap-1.5 sm:grid-cols-3">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase text-blue-900 block">Term</span>
                        <select
                          className="mt-0.5 w-full rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
                          onChange={(event) => setCreditTerm(event.target.value)}
                          value={creditTerm}
                        >
                          {INSTALLMENT_TERMS.map(([value, label]) => {
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

      {/* Sales History & Customer Quotations Section */}
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
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
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
              </>
            ) : (
              <select
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] md:col-span-2"
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
        </div>

        {historyTab === "SALES" ? (
          isLoadingSales ? (
            <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-slate-400"><LoaderCircle className="animate-spin" size={16} />Loading sales…</div>
          ) : sales.length === 0 ? (
            <div className="p-8 text-center"><ReceiptText className="mx-auto text-slate-300" size={32} /><p className="mt-2 text-xs font-bold text-slate-700">{salesMessage || "No sales yet"}</p><p className="mt-0.5 text-[11px] text-slate-400">Completed transactions will appear here.</p></div>
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
                    {sales.map((sale) => (
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
                                {sale.creditAccount.term ? ` (${formatStatus(sale.creditAccount.term)})` : ""}
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
                          <p className="font-mono font-bold text-slate-900 text-xs">
                            {formatMoney(sale.creditAccount?.regularPriceTotalAmount || sale.grandTotal)}
                          </p>
                          {sale.creditAccount && Number(sale.creditAccount.remainingBalance || 0) > 0 ? (
                            <p className="text-[10px] text-blue-700 font-mono">
                              Bal: {formatMoney(sale.creditAccount.remainingBalance)}
                            </p>
                          ) : null}
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
                {sales.map((sale) => (
                  <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs" key={sale.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono font-bold text-slate-900">{sale.receiptCode}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(sale.saleDate)}</p>
                      </div>
                      <p className="font-mono font-bold text-slate-900">
                        {formatMoney(sale.creditAccount?.regularPriceTotalAmount || sale.grandTotal)}
                      </p>
                    </div>
                    <p className="mt-1.5 text-slate-700">{sale.customer?.fullName || "Walk-in customer"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={sale.status} />
                      <StatusBadge status={sale.paymentStatus} />
                      {sale.creditAccount ? (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-900">
                          💳 {formatStatus(sale.creditAccount.provider)}
                          {sale.creditAccount.term ? ` (${formatStatus(sale.creditAccount.term)})` : ""}
                        </span>
                      ) : (sale.payments || []).length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {sale.payments.map((p) => formatStatus(p.paymentMethod)).join(", ")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700"
                        onClick={() => openSaleDetails(sale)}
                        type="button"
                      >
                        <Eye size={12} /> View
                      </button>
                      {canCancelSale && (sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED") && !sale.creditAccount ? (
                        <button
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-800"
                          onClick={() => handleOpenReturn(sale)}
                          type="button"
                        >
                          <RotateCcw size={12} /> Refund
                        </button>
                      ) : null}
                      {canCancelSale && sale.status === "COMPLETED" ? (
                        <button
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700"
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
        <SaleDetailDialog canCancel={false} canReturn={false} errorMessage="" isLoading={false} onCancelSale={() => {}} onClose={() => setCompletedSale(null)} onReturnItems={() => {}} sale={completedSale} title="Warranty Receipt · Customer Copy" />
      ) : null}

      {isDetailOpen ? (
        <SaleDetailDialog canCancel={canCancelSale} canReturn={canCancelSale} errorMessage={detailMessage} isLoading={isLoadingDetail} onCancelSale={(sale) => setSaleToCancel(sale)} onClose={() => { setIsDetailOpen(false); setDetailSale(null); setDetailMessage("") }} onReturnItems={(sale) => setSaleToReturn(sale)} sale={detailSale} />
      ) : null}

      {saleToCancel ? (
        <CancelSaleDialog isSaving={isCancellingSale} onClose={() => setSaleToCancel(null)} onConfirm={confirmCancellation} sale={saleToCancel} />
      ) : null}

      {saleToReturn ? (
        <ReturnSaleItemsDialog isSaving={isReturningSale} onClose={() => setSaleToReturn(null)} onConfirm={confirmSaleReturn} sale={saleToReturn} />
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
          onClose={() => setShowJobOrderLookup(false)}
          onSelectJob={handleSelectJobOrder}
        />
      ) : null}
    </div>
  )
}

export default PosSalesPage
