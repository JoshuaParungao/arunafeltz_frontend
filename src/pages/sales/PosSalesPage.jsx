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

import { USER_ROLES } from "../../constants/roles"
import { getCustomers } from "../../features/customers/customers.api"
import {
  getInventoryBatches,
  getInventorySerials,
} from "../../features/inventory/inventory.api"
import { getItems } from "../../features/items/items.api"
import { generateUUID } from "../../utils/uuid"
import {
  cancelSale,
  createSaleReturn,
  createSale,
  getSaleById,
  getSales,
} from "../../features/sales/sales.api"
import { getInstallmentBasisSettings } from "../../features/settings/settings.api"
import { exportWarrantyReceiptPdf, printWarrantyReceipt } from "../../utils/businessDocumentExport"

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
  ["STRAIGHT", "Straight / 1 month"],
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
  STRAIGHT: 0.96,
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
  title = "Warranty Receipt · Customer Copy",
}) {
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
    if ((sale?.payments || []).length > 0) {
      return sale.payments
        .map((p) => formatStatus(p.paymentMethod))
        .join(", ")
    }
    if (sale?.creditAccount) {
      return `${formatStatus(sale.creditAccount.provider)} Receivable`
    }
    return "CASH"
  }, [sale])

  const termsText = useMemo(() => {
    if (sale?.creditAccount?.term) {
      return formatStatus(sale.creditAccount.term)
    }
    return "FULL / OUTRIGHT"
  }, [sale])

  const technicianName = useMemo(() => {
    return (
      sale?.technician?.fullName ||
      sale?.quotation?.serviceDoneBy?.fullName ||
      "—"
    )
  }, [sale])

  const totalAmount = Number(sale?.grandTotal || sale?.subtotal || 0)
  const paidAmount = Number(sale?.amountPaid || 0)
  const balanceToPay = Math.max(0, totalAmount - paidAmount)

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
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-maroon)] px-2.5 py-1 text-xs font-bold text-white">
                <ReceiptText size={14} /> WARRANTY RECEIPT
              </span>
              {Boolean(sale?.quotation?.isPcBuild || sale?.remarks?.includes("[PC BUILD]") || sale?.isPcBuild) ? (
                <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-white">
                  🖥️ PC Build / Set
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
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
                    <span className="col-span-2 font-bold uppercase">{sale.customer?.fullName || "WALK-IN CUSTOMER"}</span>

                    <span className="font-bold text-slate-600">Address:</span>
                    <span className="col-span-2">{sale.customer?.address || "—"}</span>

                    <span className="font-bold text-slate-600">Contact No.:</span>
                    <span className="col-span-2">{sale.customer?.mobileNumber || sale.customer?.email || "—"}</span>

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
                              {Number(item.quantity || 0)}
                            </td>
                            <td className="py-2 px-2 text-right align-top">
                              {formatMoney(item.unitPrice)}
                            </td>
                            <td className="py-2 px-2 text-right font-bold align-top">
                              {formatMoney(item.lineTotal)}
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
                    <div className="flex justify-between text-slate-700">
                      <span>CASH DOWNPAYMENT / PAID</span>
                      <span>{formatMoney(paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                      <span>BALANCE TO PAY</span>
                      <span>{formatMoney(balanceToPay)}</span>
                    </div>
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

function PosSalesPage({ selectedBranch, user }) {
  const activeBranch = selectedBranch || user?.branch || null
  const branchId = activeBranch?.id
  const canCreateSale = SALE_MANAGER_ROLES.has(user?.role)
  const canCancelSale = SALE_CANCELLER_ROLES.has(user?.role)

  const [itemSearch, setItemSearch] = useState("")
  const [itemResults, setItemResults] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [itemMessage, setItemMessage] = useState("")
  const [addingItemId, setAddingItemId] = useState("")
  const itemRequestIdRef = useRef(0)

  const [customerSearch, setCustomerSearch] = useState("")
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [customerMessage, setCustomerMessage] = useState("")
  const customerRequestIdRef = useRef(0)

  const [cart, setCart] = useState([])
  const [cartMessage, setCartMessage] = useState("")
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [serviceDescription, setServiceDescription] = useState("")
  const [serviceQuantity, setServiceQuantity] = useState("1")
  const [serviceUnitPrice, setServiceUnitPrice] = useState("")
  const [serviceMarkup, setServiceMarkup] = useState("")
  const [serviceDiscount, setServiceDiscount] = useState("0")
  const [serviceCharge, setServiceCharge] = useState("0")
  const [remarks, setRemarks] = useState("")
  const [isPcBuild, setIsPcBuild] = useState(false)

  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [settlementMethod, setSettlementMethod] = useState("CASH")
  const [paymentAmount, setPaymentAmount] = useState("0")
  const [paymentAmountTouched, setPaymentAmountTouched] = useState(false)
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentRemarks, setPaymentRemarks] = useState("")
  const [creditTerm, setCreditTerm] = useState("MONTH_3")
  const [creditDueDay, setCreditDueDay] = useState("")
  const [creditFirstDueDate, setCreditFirstDueDate] = useState("")
  const [creditRemarks, setCreditRemarks] = useState("")
  const [providerReference, setProviderReference] = useState("")
  const [installmentRates, setInstallmentRates] = useState(DEFAULT_INSTALLMENT_BASIS)
  const [isSubmittingSale, setIsSubmittingSale] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState("")
  const [completedSale, setCompletedSale] = useState(null)

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

  const [sales, setSales] = useState([])
  const [salesMeta, setSalesMeta] = useState(null)
  const [salesPage, setSalesPage] = useState(1)
  const [salesSearch, setSalesSearch] = useState("")
  const [salesStatus, setSalesStatus] = useState("")
  const [paymentStatus, setPaymentStatus] = useState("")
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [salesMessage, setSalesMessage] = useState("")
  const salesRequestIdRef = useRef(0)

  const [detailSale, setDetailSale] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailMessage, setDetailMessage] = useState("")
  const [saleToCancel, setSaleToCancel] = useState(null)
  const [isCancellingSale, setIsCancellingSale] = useState(false)
  const [saleToReturn, setSaleToReturn] = useState(null)
  const [isReturningSale, setIsReturningSale] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState("")
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
      return
    }

    const requestId = itemRequestIdRef.current + 1
    itemRequestIdRef.current = requestId
    setIsLoadingItems(true)
    setItemMessage("")

    try {
      const response = await getItems({
        branchId,
        status: "ACTIVE",
        search: itemSearch.trim() || undefined,
        page: 1,
        limit: 20,
      })
      if (requestId !== itemRequestIdRef.current) return

      const rows = getCatalogRows(response)
      setItemResults(rows)
      if (rows.length === 0) setItemMessage("No active products match this search.")
    } catch (error) {
      if (requestId !== itemRequestIdRef.current) return
      setItemResults([])
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

  useEffect(() => {
    const timer = window.setTimeout(loadSales, salesSearch.trim() ? 300 : 0)
    return () => {
      window.clearTimeout(timer)
      salesRequestIdRef.current += 1
    }
  }, [loadSales, salesSearch])

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
      const targetTier = activeCustomer?.priceTier ? Number(activeCustomer.priceTier) : null
      const itemTiers = availablePriceTiers(item)
      const chosenTier = targetTier && itemTiers.includes(targetTier) ? targetTier : defaultPriceTier(item)

      setCart((current) => [
        ...current,
        {
          localId,
          type: "PRODUCT",
          item,
          itemId: item.id,
          priceTier: chosenTier,
          quantity: "1",
          markupPercent: "",
          discountAmount: "0",
          batchId: initialBatchId,
          serialId: initialSerialId,
          customSerialNumber: preselectedSerial?.serialNumber || "",
          isCustomSerial: !preselectedSerial,
          warrantyType: item.isSerialized ? "MAJOR_PARTS" : "ACCESSORIES",
          warrantyDuration: item.isSerialized || item.hasWarranty ? "1 YEAR WARRANTY" : "1 MONTH WARRANTY",
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
    if (!normalized) return

    const exactItem = itemResults.find((item) => {
      return [item.itemCode, item.barcode]
        .filter(Boolean)
        .some((value) => String(value).trim().toLowerCase() === normalized)
    })

    if (exactItem) {
      await addProduct(exactItem)
      return
    }

    // Check if the query is an existing available serial number in this branch
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

    setItemMessage("No exact item code, barcode, or available serial found. Select a product from the list.")
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
    if (cart.length === 0) return "Add at least one product or service line."

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
  }

  const submitSale = async () => {
    if (!canCreateSale || isSubmittingSale) return

    const validationMessage = validateCart()
    if (validationMessage) {
      setCheckoutMessage(validationMessage)
      return
    }

    const confirmPrompt = isReceivableCheckout
      ? `Complete this AR sale for ${formatMoney(installmentCalculation?.regularPriceTotalAmount || totals.grandTotal)} (Cash promo: ${formatMoney(totals.grandTotal)}, ${INSTALLMENT_TERMS.find(([v]) => v === creditTerm)?.[1] || creditTerm}) and deduct branch inventory?`
      : `Complete this sale for ${formatMoney(totals.grandTotal)} and deduct branch inventory?`

    if (!window.confirm(confirmPrompt)) return

    setIsSubmittingSale(true)
    setCheckoutMessage("")

    const cartSnapshot = cart.map((line) => ({
      serialNumber: line.isCustomSerial
        ? line.customSerialNumber?.trim()
        : line.serials?.find((serial) => serial.id === line.serialId)?.serialNumber || null,
    }))

    try {
      const settlementAmount = Number(effectivePaymentAmount || 0)
      const formattedRemarks = isPcBuild
        ? (remarks.trim() ? `[PC BUILD] ${remarks.trim()}` : "[PC BUILD]")
        : remarks.trim() || undefined
      const salePayload = {
        branchId,
        customerId: selectedCustomerId || undefined,
        serviceCharge: Number(serviceCharge || 0),
        remarks: formattedRemarks,
        items: cart.map((line) => {
          if (line.type === "SERVICE") {
            return {
              description: line.description.trim(),
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

      const receiptSale = {
        ...sale,
        items: (sale.items || []).map((item, index) => ({
          ...item,
          serialNumber: cartSnapshot[index]?.serialNumber || null,
        })),
      }

      setCompletedSale(receiptSale)
      setNoticeMessage(
        `Sale ${sale.receiptCode} completed successfully${sale.creditAccount ? ` with receivable ${sale.creditAccount.creditCode}` : ""}.`,
      )
      saleRequestRef.current = { signature: "", key: "" }
      resetCheckout()
      setSalesPage(1)
      await loadSales()
      await loadItems()
    } catch (error) {
      setCheckoutMessage(getApiErrorMessage(error, "Unable to complete the sale. No success receipt was returned."))
    } finally {
      setIsSubmittingSale(false)
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
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--color-maroon)]">POS / Sales</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-text-strong)]">Branch checkout and sales history</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
            Product prices use the selected tier. Stock, serial availability, totals, and payments are revalidated when the sale is saved.
          </p>
          {activeBranch ? (
            <p className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--color-soft)] px-3 py-1.5 text-xs font-bold text-[var(--color-muted)]">
              <Building2 size={14} />
              <span className="truncate">{activeBranch.code} · {activeBranch.name}</span>
            </p>
          ) : null}
        </div>

        <button
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)] disabled:opacity-50"
          disabled={isLoadingSales}
          onClick={loadSales}
          type="button"
        >
          <RefreshCw className={isLoadingSales ? "animate-spin" : ""} size={17} />
          Refresh sales
        </button>
      </header>

      {noticeMessage ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          <span>{noticeMessage}</span>
          <button aria-label="Dismiss notice" className="rounded-lg p-1 hover:bg-emerald-100" onClick={() => setNoticeMessage("")} type="button"><X size={16} /></button>
        </div>
      ) : null}

      {!canCreateSale ? (
        <ErrorBanner>Your role can view sales but cannot create them.</ErrorBanner>
      ) : null}

      {canCreateSale ? (
        <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)]">
          <div className="min-w-0 space-y-5">
            <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-soft)] text-[var(--color-maroon)]"><PackageSearch size={20} /></span>
                <div>
                  <h2 className="font-black text-[var(--color-text-strong)]">Find a product</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">Search by name, item code, brand, model, or barcode. Press Enter for an exact code/barcode match.</p>
                </div>
              </div>

              <form className="relative mt-4" onSubmit={handleItemSearchSubmit}>
                <Barcode className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={19} />
                <input
                  aria-label="Search products by name, code, brand, model, or barcode"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] py-3.5 pl-12 pr-12 text-sm font-semibold outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                  onChange={(event) => setItemSearch(event.target.value)}
                  placeholder="Scan barcode or enter product search"
                  value={itemSearch}
                />
                {isLoadingItems ? <LoaderCircle className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-muted)]" size={18} /> : null}
              </form>

              {itemMessage ? <p className="mt-3 text-sm font-semibold text-amber-700">{itemMessage}</p> : null}

              <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {itemResults.map((item) => (
                  <button
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] p-4 text-left transition hover:border-[var(--color-maroon)] hover:bg-[var(--color-maroon-soft)] disabled:opacity-50"
                    disabled={Boolean(addingItemId)}
                    key={item.id}
                    onClick={() => addProduct(item)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-[var(--color-text-strong)]">{item.itemName}</span>
                      <span className="mt-1 block truncate text-xs text-[var(--color-muted)]">
                        {item.itemCode}{item.barcode ? ` · Barcode ${item.barcode}` : ""}{item.isSerialized ? " · Serialized" : ""}
                      </span>
                      <span className="mt-1 block text-sm font-bold text-[var(--color-maroon)]">From {formatMoney(item[`price${defaultPriceTier(item)}`])}</span>
                    </span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-soft)]">
                      {addingItemId === item.id ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={17} />}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"><UserRound size={20} /></span>
                <div>
                  <h2 className="font-black text-[var(--color-text-strong)]">Customer</h2>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Optional. Leave as walk-in when no customer record is needed.</p>
                </div>
              </div>
              <input
                aria-label="Search customers"
                className="mt-4 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)] focus:bg-white"
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search customer by name, mobile, or company"
                value={customerSearch}
              />
              <select
                aria-label="Select customer"
                className="mt-3 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--color-maroon)]"
                onChange={(event) => {
                  const newCustId = event.target.value
                  setSelectedCustomerId(newCustId)
                  const targetCustomer = customers.find((c) => c.id === newCustId)
                  if (targetCustomer?.priceTier) {
                    const tier = Number(targetCustomer.priceTier)
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
                  }
                }}
                value={selectedCustomerId}
              >
                <option value="">Walk-in customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName}
                    {customer.companyName ? ` (${customer.companyName})` : ""}
                    {customer.priceTier ? ` · Price ${customer.priceTier}` : ""}
                  </option>
                ))}
              </select>
              {isLoadingCustomers ? <p className="mt-2 text-xs text-[var(--color-muted)]">Loading customers…</p> : null}
              {customerMessage ? <p className="mt-2 text-xs font-semibold text-amber-700">{customerMessage}</p> : null}
            </section>

            <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700"><Wrench size={20} /></span>
                  <div>
                    <h2 className="font-black text-[var(--color-text-strong)]">Service / custom line</h2>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">Add optional labor, setup, delivery, or other non-inventory revenue.</p>
                  </div>
                </div>
                <button className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-bold" onClick={() => setShowServiceForm((current) => !current)} type="button">
                  {showServiceForm ? "Close" : "Add service"}
                </button>
              </div>

              {showServiceForm ? (
                <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={addServiceLine}>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Description</span>
                    <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => setServiceDescription(event.target.value)} placeholder="Labor, setup, delivery service…" value={serviceDescription} />
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Quantity</span>
                    <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" min="0.01" onChange={(event) => setServiceQuantity(event.target.value)} step="0.01" type="number" value={serviceQuantity} />
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Base unit price</span>
                    <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" min="0" onChange={(event) => setServiceUnitPrice(event.target.value)} step="0.01" type="number" value={serviceUnitPrice} />
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Mark up %</span>
                    <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" max="99.9999" min="0" onChange={(event) => setServiceMarkup(event.target.value)} placeholder="Optional" step="0.01" type="number" value={serviceMarkup} />
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Exact discount</span>
                    <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" min="0" onChange={(event) => setServiceDiscount(event.target.value)} step="0.01" type="number" value={serviceDiscount} />
                  </label>
                  <button className="self-end rounded-xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-maroon-hover)]" type="submit">Add service line</button>
                  <div className="rounded-xl bg-[var(--color-soft)] p-3 text-sm sm:col-span-2">
                    <div className="flex flex-wrap justify-between gap-2"><span>Base unit price</span><strong>{formatMoney(serviceBaseUnitPrice)}</strong></div>
                    <div className="mt-1 flex flex-wrap justify-between gap-2"><span>Final unit price</span><strong>{formatMoney(serviceFinalUnitPrice)}</strong></div>
                    <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-[var(--color-border)] pt-2"><span>Line total preview</span><strong>{formatMoney(serviceLineTotal)}</strong></div>
                  </div>
                </form>
              ) : null}
            </section>
          </div>

          <section className="min-w-0 self-start rounded-3xl border border-[var(--color-border)] bg-white shadow-card 2xl:sticky 2xl:top-5">
            <header className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-maroon)] text-white"><ShoppingCart size={20} /></span>
                <div><h2 className="font-black text-[var(--color-text-strong)]">Current sale</h2><p className="text-xs text-[var(--color-muted)]">{cart.length} line(s)</p></div>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-1.5 transition hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={isPcBuild}
                    onChange={(e) => setIsPcBuild(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-maroon)] focus:ring-[var(--color-maroon)]"
                  />
                  <span className="text-xs font-bold text-[var(--color-text-strong)]">🖥️ PC Build Sale</span>
                </label>
                {cart.length > 0 ? <button className="text-xs font-bold text-red-700" onClick={() => { if (window.confirm("Clear the unsaved cart?")) setCart([]) }} type="button">Clear cart</button> : null}
              </div>
            </header>

            {cartMessage ? <div className="border-b border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{cartMessage}</div> : null}

            {cart.length === 0 ? (
              <div className="grid place-items-center p-10 text-center">
                <ShoppingCart className="text-[var(--color-muted)]" size={42} />
                <p className="mt-3 font-bold text-[var(--color-text-strong)]">Cart is empty</p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--color-muted)]">Search for a product or add an optional service/custom line.</p>
              </div>
            ) : (
              <div className="max-h-[720px] space-y-3 overflow-y-auto p-4 sm:p-5">
                {cart.map((line, index) => {
                  const gross = getLineGross(line)
                  const selectedBatch = line.batches?.find((batch) => batch.id === line.batchId)

                  return (
                    <article className="rounded-2xl border border-[var(--color-border)] p-4" key={line.localId}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Line {index + 1} · {line.type === "SERVICE" ? "Service" : "Product"}</p>
                            {isPcBuild && line.type === "PRODUCT" ? (
                              <span className="rounded-md bg-[var(--color-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--color-maroon)]">
                                PC Part
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-1 truncate font-black text-[var(--color-text-strong)]">{line.item?.itemName || line.description}</h3>
                          {line.item ? <p className="mt-1 text-xs text-[var(--color-muted)]">{line.item.itemCode}{line.item.isSerialized ? " · Serialized" : ""}</p> : null}
                        </div>
                        <button aria-label="Remove line" className="rounded-xl p-2 text-red-700 transition hover:bg-red-50" onClick={() => removeCartLine(line.localId)} type="button"><Trash2 size={17} /></button>
                      </div>

                      {line.type === "PRODUCT" ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label>
                            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Price tier</span>
                            <select className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm font-semibold outline-none focus:border-[var(--color-maroon)]" onChange={(event) => updateCartLine(line.localId, { priceTier: Number(event.target.value) })} value={line.priceTier}>
                              {availablePriceTiers(line.item).map((tier) => <option key={tier} value={tier}>Price {tier} · {formatMoney(line.item[`price${tier}`])}</option>)}
                            </select>
                          </label>
                          <label>
                            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Mark up %</span>
                            <input
                              className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-maroon)]"
                              max="99.9999"
                              min="0"
                              onChange={(event) =>
                                updateCartLine(line.localId, {
                                  markupPercent: event.target.value,
                                })
                              }
                              placeholder="Optional"
                              step="0.01"
                              type="number"
                              value={line.markupPercent ?? ""}
                            />
                            <p className="mt-1 text-xs text-[var(--color-muted)]">
                              Base {formatMoney(getLineBaseUnitPrice(line))} · Final {formatMoney(getLineUnitPrice(line))}
                            </p>
                          </label>

                          <label>
                            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Quantity</span>
                            <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)]" disabled={line.item.isSerialized} min="0.01" onChange={(event) => updateCartLine(line.localId, { quantity: event.target.value })} step="0.01" type="number" value={line.quantity} />
                          </label>

                          {line.item.isSerialized ? (
                            <div className="sm:col-span-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
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
                                  className="text-[11px] font-bold text-[var(--color-maroon)] underline hover:opacity-80"
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
                                    className="w-full rounded-xl border border-[var(--color-maroon)] bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--color-maroon)]"
                                    placeholder="Scan barcode or type serial number…"
                                    value={line.customSerialNumber || ""}
                                    onChange={(event) =>
                                      updateCartLine(line.localId, {
                                        customSerialNumber: event.target.value,
                                      })
                                    }
                                  />
                                  <p className="mt-1 text-xs text-emerald-700 font-semibold">
                                    ⚡ Scanned serial will be automatically added to inventory and tracked upon sale completion.
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <select
                                    className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm font-semibold outline-none focus:border-[var(--color-maroon)]"
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
                                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                                    The selected serial determines its source batch.
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <label className="sm:col-span-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Source batch</span>
                              <select className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm font-semibold outline-none focus:border-[var(--color-maroon)]" onChange={(event) => updateCartLine(line.localId, { batchId: event.target.value })} value={line.batchId}>
                                <option value="">Select active batch</option>
                                {line.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchCode} · {Number(batch.quantityAvailable || 0)} available</option>)}
                              </select>
                            </label>
                          )}

                          <label>
                            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Exact discount</span>
                            <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-maroon)]" max={gross} min="0" onChange={(event) => updateCartLine(line.localId, { discountAmount: event.target.value })} step="0.01" type="number" value={line.discountAmount} />
                          </label>
                          <div className="rounded-xl bg-[var(--color-soft)] p-3 text-right text-sm">
                            <p className="text-xs text-[var(--color-muted)]">Line total preview</p>
                            <p className="mt-1 font-black text-[var(--color-text-strong)]">{formatMoney(getLineTotal(line))}</p>
                            {!line.item.isSerialized && selectedBatch ? <p className="mt-1 text-xs text-[var(--color-muted)]">Batch stock {Number(selectedBatch.quantityAvailable || 0)}</p> : null}
                          </div>

                          <div className="sm:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)]/60 p-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-maroon)] flex items-center gap-1.5">
                                <ShieldCheck size={14} /> Warranty Coverage
                              </span>
                              <div className="flex gap-1 flex-wrap">
                                {[
                                  { label: "1 Year", duration: "1 YEAR WARRANTY" },
                                  { label: "2 Years", duration: "2 YEARS WARRANTY" },
                                  { label: "6 Months", duration: "6 MONTHS WARRANTY" },
                                  { label: "1 Month", duration: "1 MONTH WARRANTY" },
                                  { label: "7 Days", duration: "7 DAYS REPLACEMENT" },
                                  { label: "No Warranty", duration: "NO WARRANTY" },
                                ].map((preset) => (
                                  <button
                                    key={preset.duration}
                                    type="button"
                                    onClick={() => updateCartLine(line.localId, { warrantyDuration: preset.duration })}
                                    className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                                      (line.warrantyDuration || "").trim().toUpperCase() === preset.duration
                                        ? "bg-[var(--color-maroon)] text-white shadow-xs"
                                        : "bg-white text-[var(--color-text-strong)] hover:bg-slate-100 border border-slate-200"
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <input
                              type="text"
                              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)] text-slate-800"
                              placeholder="e.g. 1 YEAR WARRANTY, 3 YEARS DISTRO WARRANTY, etc."
                              value={line.warrantyDuration || ""}
                              onChange={(e) => updateCartLine(line.localId, { warrantyDuration: e.target.value })}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3 sm:grid-cols-4">
                          <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Qty</span><input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" min="0.01" onChange={(event) => updateCartLine(line.localId, { quantity: event.target.value })} step="0.01" type="number" value={line.quantity} /></label>
                          <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Base unit price</span><input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" min="0" onChange={(event) => updateCartLine(line.localId, { baseUnitPrice: event.target.value })} step="0.01" type="number" value={line.baseUnitPrice ?? line.unitPrice} /></label>
                          <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Mark up %</span><input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" max="99.9999" min="0" onChange={(event) => updateCartLine(line.localId, { markupPercent: event.target.value })} placeholder="Optional" step="0.01" type="number" value={line.markupPercent ?? ""} /></label>
                          <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Discount</span><input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" min="0" onChange={(event) => updateCartLine(line.localId, { discountAmount: event.target.value })} step="0.01" type="number" value={line.discountAmount} /></label>
                          <p className="sm:col-span-4 text-right text-sm font-black text-[var(--color-text-strong)]">Base {formatMoney(getLineBaseUnitPrice(line))} · Final {formatMoney(getLineUnitPrice(line))} · Line total {formatMoney(getLineTotal(line))}</p>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}

            <div className="space-y-5 border-t border-[var(--color-border)] p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Additional service / delivery charge</span>
                  <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" min="0" onChange={(event) => setServiceCharge(event.target.value)} step="0.01" type="number" value={serviceCharge} />
                </label>
                <label>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Sale remarks</span>
                  <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => setRemarks(event.target.value)} placeholder="Optional internal note" value={remarks} />
                </label>
              </div>

              <div className="grid gap-2 rounded-2xl bg-[var(--color-soft)] p-4 text-sm">
                <div className="flex justify-between gap-3"><span>Product revenue</span><strong>{formatMoney(totals.productGross)}</strong></div>
                <div className="flex justify-between gap-3"><span>Service/custom revenue</span><strong>{formatMoney(totals.serviceGross)}</strong></div>
                <div className="flex justify-between gap-3"><span>Exact discounts</span><strong>-{formatMoney(totals.totalDiscount)}</strong></div>
                <div className="flex justify-between gap-3"><span>Additional charge</span><strong>{formatMoney(totals.additionalCharge)}</strong></div>
                <div className="mt-1 flex justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-lg text-[var(--color-text-strong)]"><strong>Grand total</strong><strong>{formatMoney(totals.grandTotal)}</strong></div>
              </div>

              <div>
                <div className="flex items-center gap-2"><CreditCard className="text-[var(--color-maroon)]" size={18} /><h3 className="font-black text-[var(--color-text-strong)]">Payment</h3></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Settlement arrangement</span><select className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm font-semibold" onChange={(event) => { const nextMethod = event.target.value; setPaymentMethod(nextMethod); if (RECEIVABLE_PROVIDER_VALUES.has(nextMethod)) { setPaymentAmount("0"); setPaymentAmountTouched(true) } else { setPaymentAmount("0"); setPaymentAmountTouched(false) } }} value={paymentMethod}><optgroup label="Immediate settlement">{IMMEDIATE_PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup><optgroup label="Accounts receivable">{RECEIVABLE_PROVIDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup></select></label>
                  <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">{isReceivableCheckout ? "Immediate settlement / downpayment" : "Amount paid"}</span><input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm" max={isReceivableCheckout ? totals.grandTotal : undefined} min="0" onChange={(event) => { setPaymentAmount(event.target.value); setPaymentAmountTouched(true) }} step="0.01" type="number" value={effectivePaymentAmount} /></label>
                  {isReceivableCheckout ? <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Immediate settlement method</span><select className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm font-semibold" onChange={(event) => setSettlementMethod(event.target.value)} value={settlementMethod}>{IMMEDIATE_PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
                  {isReceivableCheckout ? <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Provider reference</span><input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm" onChange={(event) => setProviderReference(event.target.value)} placeholder="Optional provider approval/reference" value={providerReference} /></label> : null}
                  <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Reference number</span><input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm" onChange={(event) => setPaymentReference(event.target.value)} placeholder="Optional for traceability" value={paymentReference} /></label>
                  <label><span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Payment remarks</span><input className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm" onChange={(event) => setPaymentRemarks(event.target.value)} placeholder="Optional" value={paymentRemarks} /></label>
                </div>

                {isReceivableCheckout ? (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 pb-2.5">
                      <div>
                        <p className="text-sm font-black text-blue-900">
                          Accounts Receivable · {formatStatus(paymentMethod)}
                        </p>
                        <p className="text-xs text-blue-800">
                          {isInHouseCheckout
                            ? "In-house installment requires a selected registered customer."
                            : "Financed through provider. Computes interest based on configured term rates."}
                        </p>
                      </div>
                      <span className="rounded-xl border border-blue-200 bg-white px-2.5 py-1 text-xs font-black text-blue-900 shadow-2xs">
                        Rate Basis: {installmentCalculation?.termBasis ?? "1.00"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl border border-blue-100 bg-white p-2.5 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted)]">Cash Promo Total</span>
                        <p className="mt-0.5 text-sm font-black text-[var(--color-text-strong)]">{formatMoney(totals.grandTotal)}</p>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-white p-2.5 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Interest / Rate Adj</span>
                        <p className="mt-0.5 text-sm font-black text-blue-900">+{formatMoney(installmentCalculation?.interestAmount || 0)}</p>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-white p-2.5 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-maroon)]">Financed Total</span>
                        <p className="mt-0.5 text-sm font-black text-[var(--color-maroon)]">{formatMoney(installmentCalculation?.regularPriceTotalAmount || totals.grandTotal)}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Monthly ({installmentCalculation?.months} mos)</span>
                        <p className="mt-0.5 text-sm font-black text-emerald-950">{formatMoney(installmentCalculation?.monthlyDueAmount || 0)}/mo</p>
                      </div>
                    </div>

                    <div className="grid gap-3 pt-1 sm:grid-cols-3">
                      <label>
                        <span className="text-xs font-bold uppercase tracking-wide text-blue-900">Installment Term</span>
                        <select
                          className="mt-1.5 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-semibold text-[var(--color-text-strong)]"
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

                      <label>
                        <span className="text-xs font-bold uppercase tracking-wide text-blue-900">Due day (optional)</span>
                        <input
                          className="mt-1.5 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm"
                          max="31"
                          min="1"
                          onChange={(event) => setCreditDueDay(event.target.value)}
                          placeholder="1–31"
                          step="1"
                          type="number"
                          value={creditDueDay}
                        />
                      </label>

                      <label>
                        <span className="text-xs font-bold uppercase tracking-wide text-blue-900">First due date (optional)</span>
                        <input
                          className="mt-1.5 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm"
                          onChange={(event) => setCreditFirstDueDate(event.target.value)}
                          type="date"
                          value={creditFirstDueDate}
                        />
                      </label>

                      <label className="sm:col-span-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-blue-900">AR Remarks / Approval notes</span>
                        <input
                          className="mt-1.5 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm"
                          onChange={(event) => setCreditRemarks(event.target.value)}
                          placeholder="Provider approval code, account notes, or reference"
                          value={creditRemarks}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap justify-between gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-muted)]">
                  <span>Expected balance: {formatMoney(expectedBalance)}</span>
                  <span>Expected change: {formatMoney(expectedChange)}</span>
                </div>
              </div>

              {checkoutMessage ? <ErrorBanner>{checkoutMessage}</ErrorBanner> : null}

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-5 py-4 text-sm font-black text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cart.length === 0 || isSubmittingSale || !branchId}
                onClick={submitSale}
                type="button"
              >
                {isSubmittingSale ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <ReceiptText size={18} />
                )}
                {isSubmittingSale
                  ? "Completing sale…"
                  : isReceivableCheckout
                    ? `Complete AR sale · ${formatMoney(installmentCalculation?.regularPriceTotalAmount || totals.grandTotal)}`
                    : `Complete sale · ${formatMoney(totals.grandTotal)}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        <div className="border-b border-[var(--color-border)] p-4 sm:p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ReceiptText size={20} /></span><div><h2 className="font-black text-[var(--color-text-strong)]">Sales history</h2><p className="text-xs text-[var(--color-muted)]">Records for the active branch.</p></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="relative md:col-span-1"><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={17} /><input className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] py-3 pl-11 pr-4 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSalesSearch(event.target.value); setSalesPage(1) }} placeholder="Receipt code or remarks" value={salesSearch} /></label>
            <select className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-semibold" onChange={(event) => { setSalesStatus(event.target.value); setSalesPage(1) }} value={salesStatus}><option value="">All sale statuses</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="REFUNDED">Refunded</option><option value="PARTIALLY_REFUNDED">Partially refunded</option></select>
            <select className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm font-semibold" onChange={(event) => { setPaymentStatus(event.target.value); setSalesPage(1) }} value={paymentStatus}><option value="">All payment statuses</option><option value="PAID">Paid</option><option value="PARTIALLY_PAID">Partially paid</option><option value="UNPAID">Unpaid</option><option value="REFUNDED">Refunded</option></select>
          </div>
        </div>

        {isLoadingSales ? (
          <div className="flex items-center gap-3 p-6 text-sm font-semibold text-[var(--color-muted)]"><LoaderCircle className="animate-spin" size={18} />Loading sales…</div>
        ) : sales.length === 0 ? (
          <div className="grid place-items-center p-10 text-center"><ReceiptText className="text-[var(--color-muted)]" size={40} /><p className="mt-3 font-bold text-[var(--color-text-strong)]">{salesMessage || "No sales yet"}</p><p className="mt-1 text-sm text-[var(--color-muted)]">Completed transactions will appear here.</p></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
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
                <tbody className="divide-y divide-[var(--color-border)]">
                  {sales.map((sale) => (
                    <tr className="transition hover:bg-[var(--color-soft)]" key={sale.id}>
                      <td className="px-4 py-4">
                        <p className="font-bold text-[var(--color-text-strong)]">{sale.receiptCode}</p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">{formatDate(sale.saleDate)}</p>
                      </td>
                      <td className="px-4 py-4">{sale.customer?.fullName || "Walk-in"}</td>
                      <td className="px-4 py-4">{sale.cashier?.fullName || "—"}</td>
                      <td className="px-4 py-4"><StatusBadge status={sale.status} /></td>
                      <td className="px-4 py-4"><StatusBadge status={sale.paymentStatus} /></td>
                      <td className="px-4 py-4 text-right font-black">{formatMoney(sale.grandTotal)}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs font-bold transition hover:bg-[var(--color-soft)]"
                            onClick={() => openSaleDetails(sale)}
                            type="button"
                          >
                            <Eye size={13} /> View
                          </button>
                          {canCancelSale && (sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED") && !sale.creditAccount ? (
                            <button
                              className="inline-flex items-center gap-1 rounded-xl border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-bold text-orange-800 transition hover:bg-orange-100"
                              onClick={() => handleOpenReturn(sale)}
                              type="button"
                              title="Refund or return specific items"
                            >
                              <RotateCcw size={13} /> Refund
                            </button>
                          ) : null}
                          {canCancelSale && sale.status === "COMPLETED" ? (
                            <button
                              className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
                              onClick={() => handleOpenCancel(sale)}
                              type="button"
                              title="Cancel whole sale"
                            >
                              <X size={13} /> Cancel
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 lg:hidden">
              {sales.map((sale) => (
                <article className="rounded-2xl border border-[var(--color-border)] p-4" key={sale.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-[var(--color-text-strong)]">{sale.receiptCode}</p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">{formatDate(sale.saleDate)}</p>
                    </div>
                    <p className="font-black text-[var(--color-text-strong)]">{formatMoney(sale.grandTotal)}</p>
                  </div>
                  <p className="mt-3 text-sm">{sale.customer?.fullName || "Walk-in customer"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={sale.status} />
                    <StatusBadge status={sale.paymentStatus} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-bold"
                      onClick={() => openSaleDetails(sale)}
                      type="button"
                    >
                      <Eye size={14} /> View
                    </button>
                    {canCancelSale && (sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED") && !sale.creditAccount ? (
                      <button
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800"
                        onClick={() => handleOpenReturn(sale)}
                        type="button"
                      >
                        <RotateCcw size={14} /> Refund
                      </button>
                    ) : null}
                    {canCancelSale && sale.status === "COMPLETED" ? (
                      <button
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                        onClick={() => handleOpenCancel(sale)}
                        type="button"
                      >
                        <X size={14} /> Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!isLoadingSales && sales.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[var(--color-muted)]">Page {salesMeta?.page || salesPage} of {totalPages} · {salesMeta?.total ?? sales.length} sale(s)</p>
            <div className="grid grid-cols-2 gap-2 sm:flex"><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-40" disabled={salesPage <= 1} onClick={() => setSalesPage((current) => Math.max(1, current - 1))} type="button"><ChevronLeft size={16} />Previous</button><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-40" disabled={salesPage >= totalPages} onClick={() => setSalesPage((current) => current + 1)} type="button">Next<ChevronRight size={16} /></button></div>
          </div>
        ) : null}
      </section>

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
    </div>
  )
}

export default PosSalesPage
