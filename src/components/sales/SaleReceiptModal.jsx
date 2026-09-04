import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { AlertCircle, Download, LoaderCircle, Printer, X } from "lucide-react"
import { getSaleById } from "../../features/sales/sales.api"
import { exportWarrantyReceiptPdf, printWarrantyReceipt } from "../../utils/businessDocumentExport"

function formatMoney(value) {
  const amount = Number(value || 0)
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value, withTime = false) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).toUpperCase()
}

function formatStatus(value) {
  if (!value) return "—"
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const INSTALLMENT_TERM_MONTHS = {
  STRAIGHT: 1,
  MONTH_3: 3,
  MONTH_6: 6,
  MONTH_9: 9,
  MONTH_12: 12,
  MONTH_18: 18,
  MONTH_24: 24,
}

export default function SaleReceiptModal({ sale: initialSale, saleId, onClose }) {
  const [sale, setSale] = useState(initialSale || null)
  const [isLoading, setIsLoading] = useState(!initialSale && Boolean(saleId))
  const [errorMessage, setErrorMessage] = useState("")

  const targetSaleId = saleId || initialSale?.id

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!initialSale?.items || initialSale.items.length === 0) {
      if (targetSaleId) {
        let active = true
        setIsLoading(true)
        getSaleById(targetSaleId)
          .then((res) => {
            if (active) {
              setSale(res?.data || initialSale)
            }
          })
          .catch((err) => {
            if (active) {
              setErrorMessage(err?.response?.data?.message || err?.message || "Failed to load full sale receipt.")
            }
          })
          .finally(() => {
            if (active) setIsLoading(false)
          })
        return () => {
          active = false
        }
      }
    } else {
      setSale(initialSale)
    }
  }, [initialSale, targetSaleId])

  const branchAddress =
    sale?.branch?.address ||
    "Kingspire Business Centre, Km.71, Mac Arthur Highway, San Isidro, City of San Fernando, Pampanga"
  const branchContact = sale?.branch?.contactNo || "0961-873-5798 / 045-404-0673"

  const isCredit = Boolean(sale?.creditAccount || sale?.receivable || (sale?.items || []).some((item) => item.baseUnitPriceSnapshot != null))

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

  const totalAmount = useMemo(() => {
    if (
      isCredit &&
      (sale?.creditAccount?.regularPriceTotalAmount ||
        sale?.creditAccount?.principalAmount ||
        sale?.installmentCalculation?.regularPriceTotalAmount)
    ) {
      return Number(
        sale?.creditAccount?.regularPriceTotalAmount ||
          sale?.creditAccount?.principalAmount ||
          sale?.installmentCalculation?.regularPriceTotalAmount
      )
    }
    return Number(sale?.grandTotal || sale?.subtotal || 0)
  }, [isCredit, sale])

  const paidAmount = useMemo(() => {
    return Number(
      sale?.amountPaid ??
        sale?.creditAccount?.downpaymentAmount ??
        sale?.creditAccount?.initialPaymentAmount ??
        sale?.installmentCalculation?.downpayment ??
        0
    )
  }, [sale])

  const balanceToPay = useMemo(() => {
    return Math.max(0, totalAmount - paidAmount)
  }, [paidAmount, totalAmount])

  return createPortal(
    <div
      aria-labelledby="sale-receipt-title"
      aria-modal="true"
      className="sale-receipt-print-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-2 sm:p-6 backdrop-blur-xs flex items-center justify-center"
      role="dialog"
    >
      <div className="sale-receipt-print-shell mx-auto w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden bg-white shadow-2xl border border-slate-300">
        <header className="sale-receipt-print-actions flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 shrink-0">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Official Sales Document
            </span>
            <h2 className="text-base font-black text-slate-900 leading-tight" id="sale-receipt-title">
              Warranty Receipt #{sale?.receiptCode || "—"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {sale ? (
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
                  <Printer size={15} /> Print Receipt
                </button>
              </>
            ) : null}
            <button
              aria-label="Close sale receipt"
              className="rounded-xl border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-100"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto p-6 sm:p-8 flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-sm font-semibold text-slate-500">
              <LoaderCircle className="animate-spin" size={20} />
              Loading complete warranty receipt details…
            </div>
          ) : errorMessage ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <span>{errorMessage}</span>
            </div>
          ) : sale ? (
            <div className="border border-slate-300 p-6 rounded-2xl bg-white shadow-xs font-sans text-xs text-slate-900 space-y-4">
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

                  <span className="font-bold text-slate-600">Customer:</span>
                  <span className="col-span-2 font-bold uppercase">
                    {sale.customer?.fullName || "WALK-IN CUSTOMER"}
                    {sale.customer?.companyName ? (
                      <span className="ml-1.5 text-slate-500 font-semibold normal-case">
                        ({sale.customer.companyName})
                      </span>
                    ) : null}
                  </span>

                  <span className="font-bold text-slate-600">Address:</span>
                  <span className="col-span-2">
                    {sale.customer?.address || "—"}
                  </span>

                  <span className="font-bold text-slate-600">Contact No.:</span>
                  <span className="col-span-2">
                    {sale.customer?.mobileNumber || sale.customer?.email || "—"}
                  </span>

                  <span className="font-bold text-slate-600">Salesman:</span>
                  <span className="col-span-2 font-bold uppercase">{sale.cashier?.fullName || sale.cashier?.username || "—"}</span>

                  <span className="font-bold text-slate-600">Payment:</span>
                  <span className="col-span-2">{paymentType}</span>

                  <span className="font-bold text-slate-600">TERMS:</span>
                  <span className="col-span-2">{termsText}</span>

                  <span className="font-bold text-slate-600">TECHNICIAN:</span>
                  <span className="col-span-2 font-bold uppercase">{technicianName}</span>
                </div>
              </div>

              {/* Banner: WARRANTY RECEIPT & Receipt No */}
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

              {/* Items Table */}
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
                  Pls. read all WARRANTY GUIDELINES &amp; PROCEDURES at the back of this page. (BRING–IN WARRANTY)
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
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
