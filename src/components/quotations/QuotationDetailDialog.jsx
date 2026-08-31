import { useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { Download, FileText, Printer, X } from "lucide-react"
import { exportCustomerQuotationPdf, printCustomerQuotation } from "../../utils/businessDocumentExport"

function formatMoney(value) {
  const amount = Number(value || 0)
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).toUpperCase()
}

export default function QuotationDetailDialog({
  quotation,
  onClose,
  isPreview = false,
  installmentCalculation = null,
  onConvertToSale = null,
  onSaveQuotation = null,
  isSavingQuotation = false,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const branch = quotation?.branch || {}
  const customer = quotation?.customer || {}
  const salesman =
    quotation?.preparedBy?.fullName ||
    quotation?.preparedBy?.username ||
    quotation?.cashier?.fullName ||
    quotation?.cashier?.username ||
    quotation?.salesman ||
    "—"

  const branchAddress =
    branch.address ||
    "Kingspire Business Centre, Km.71, Mac Arthur Highway, San Isidro, City of San Fernando, Pampanga"
  const branchContact = branch.contactNo || "0961-873-5798 / 045-404-0673"

  const rawCode = String(quotation?.quotationCode || quotation?.code || (isPreview ? "PREVIEW" : "—")).trim()
  const numericMatch = rawCode.match(/\d+$/)
  const displayCode = isPreview ? "PREVIEW" : (numericMatch ? numericMatch[0].padStart(5, "0") : rawCode)

  const items = quotation?.items || []

  const cashPromoTotal = useMemo(() => {
    return Number(quotation?.grandTotal || quotation?.subtotal || 0)
  }, [quotation])

  const srpTotal = useMemo(() => {
    return Math.round((cashPromoTotal / 0.96) * 100) / 100
  }, [cashPromoTotal])

  const regularTotal = useMemo(() => {
    return Math.round((cashPromoTotal / 0.875) * 100) / 100
  }, [cashPromoTotal])

  const quoteDate = quotation?.createdAt || quotation?.quotationDate || new Date()
  const isPcBuild = quotation?.isPcBuild || false

  return createPortal(
    <div
      aria-labelledby="quotation-detail-title"
      aria-modal="true"
      className="quotation-dialog-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-2 sm:p-6"
      role="dialog"
    >
      <div className="quotation-dialog-shell mx-auto min-h-full max-w-4xl py-2 sm:py-6">
        <section className="quotation-dialog-document overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-2xl">
          {/* Top Bar for Dialog Controls */}
          <header className="quotation-dialog-actions flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-[#002060] px-2.5 py-1 text-xs font-bold text-white">
                <FileText size={14} /> QUOTATION
              </span>
              {isPcBuild ? (
                <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-white">
                  🖥️ PC Build / Set
                </span>
              ) : null}
              {isPreview ? (
                <span className="rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-white">
                  Draft Preview
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {isPreview && onSaveQuotation ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-soft transition hover:bg-emerald-700 disabled:opacity-50"
                  disabled={isSavingQuotation}
                  onClick={onSaveQuotation}
                  type="button"
                >
                  <FileText size={15} />
                  {isSavingQuotation ? "Saving Quote…" : "Save Quotation"}
                </button>
              ) : null}

              {onConvertToSale && !isPreview && !["CONVERTED", "CANCELLED"].includes(quotation.status) ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
                  onClick={() => {
                    onClose()
                    onConvertToSale(quotation)
                  }}
                  type="button"
                >
                  Convert to Sale
                </button>
              ) : null}

              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100"
                onClick={() => exportCustomerQuotationPdf(quotation, { installmentCalculation })}
                title="Export as PDF file"
                type="button"
              >
                <Download size={15} /> Export PDF
              </button>

              <button
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#002060] px-3.5 py-2 text-xs font-bold text-white shadow-soft transition hover:bg-[#001740]"
                onClick={() => printCustomerQuotation(quotation, { installmentCalculation })}
                title="Print quotation"
                type="button"
              >
                <Printer size={15} /> Print
              </button>

              <button
                aria-label="Close quotation details"
                className="rounded-xl border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-100"
                onClick={onClose}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="p-6 sm:p-8 space-y-6">
            {isPreview && onSaveQuotation ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-2xs">
                <div className="space-y-0.5">
                  <p className="font-bold text-amber-900 flex items-center gap-1.5 text-sm">
                    <span>📝</span> Preview Mode · Hindi pa naka-save sa database
                  </p>
                  <p className="text-amber-800">
                    Suriin muna ang mga presyo at items. Kung pinal na, i-click ang <strong>Save Quotation</strong> button para pormal na mai-save sa records.
                  </p>
                </div>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-soft transition hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                  disabled={isSavingQuotation}
                  onClick={onSaveQuotation}
                  type="button"
                >
                  <FileText size={15} />
                  {isSavingQuotation ? "Saving to database…" : "Save Quotation"}
                </button>
              </div>
            ) : null}

            {/* Quotation Body Matching QUOTATION-FOR-NEW-SYSTEM (4).xlsx */}
            <div className="border border-slate-300 p-5 rounded-xl bg-white shadow-xs font-sans text-xs text-slate-900">
              {/* Header Grid: Left = Store info, Right = Customer & Sales Meta */}
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

                {/* Right Customer & Sales Meta */}
                <div className="md:col-span-6 grid grid-cols-3 gap-y-1 text-[11px]">
                  <span className="font-bold text-slate-600">Date:</span>
                  <span className="col-span-2 font-bold uppercase">{formatDate(quoteDate)}</span>

                  <span className="font-bold text-slate-600">Customer Name:</span>
                  <span className="col-span-2 font-bold uppercase">{customer.fullName || "WALK-IN CUSTOMER"}</span>

                  <span className="font-bold text-slate-600">Address:</span>
                  <span className="col-span-2">{customer.address || "—"}</span>

                  <span className="font-bold text-slate-600">Contact No.:</span>
                  <span className="col-span-2">{customer.mobileNumber || customer.email || "—"}</span>

                  <span className="font-bold text-slate-600">Salesman:</span>
                  <span className="col-span-2 font-bold uppercase">{salesman}</span>
                </div>
              </div>

              {/* Banner: EXACT ORIGINAL "QUOTATION" (Navy Blue Bold Italic) & Number */}
              <div className="py-2.5 my-1 flex items-center justify-between">
                <div className="flex-1 text-center pl-12">
                  <h2 className="text-base font-bold italic tracking-wide text-[#002060] uppercase leading-none">
                    QUOTATION
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-right text-xs">
                  <span className="font-bold italic text-[#002060]">No.</span>
                  <span className="font-mono font-bold text-[#002060] text-sm border-b border-[#002060] pb-0.5">
                    {displayCode}
                  </span>
                </div>
              </div>

              {/* Items Table with Exact Columns: ITEM CODE, ITEM DESCRIPTION, QTY., CASH DISCOUNTED PRICE, AMOUNT */}
              <div className="overflow-x-auto my-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-t-2 border-b-2 border-slate-900 text-slate-900 font-bold uppercase text-[11px]">
                      <th className="py-2 px-2 w-[16%]">ITEM CODE</th>
                      <th className="py-2 px-2 w-[48%]">ITEM DESCRIPTION</th>
                      <th className="py-2 px-2 text-center w-[10%]">QTY.</th>
                      <th className="py-2 px-2 text-right w-[13%]">CASH DISCOUNTED PRICE</th>
                      <th className="py-2 px-2 text-right w-[13%]">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {items.map((item, index) => {
                      const itemCode = item.itemCodeSnapshot || item.item?.itemCode || "—"
                      const desc = item.description || item.item?.itemName || "Item"
                      const qty = Number(item.quantity || 0)
                      const unitPrice = Number(item.unitPrice ?? item.baseUnitPrice ?? 0)
                      const lineTotal = Number(item.lineTotal ?? (qty * unitPrice - (Number(item.discountAmount) || 0)))

                      return (
                        <tr className="hover:bg-slate-50/50" key={item.id || item.lineNo || index}>
                          <td className="py-2 px-2 font-mono font-semibold text-slate-700 align-top">
                            {itemCode}
                          </td>
                          <td className="py-2 px-2 align-top space-y-0.5">
                            <p className="font-medium text-slate-900">{desc}</p>
                            {item.warrantyDuration ? (
                              <p className="text-[10px] text-slate-500 font-semibold">{item.warrantyDuration}</p>
                            ) : null}
                          </td>
                          <td className="py-2 px-2 text-center font-bold align-top">
                            {qty}
                          </td>
                          <td className="py-2 px-2 text-right align-top">
                            {formatMoney(unitPrice)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold align-top">
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

              {/* Pricing Breakdown & Disclaimers matching QUOTATION-FOR-NEW-SYSTEM (4).xlsx */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 py-3 items-start">
                <div className="sm:col-span-7 space-y-1.5">
                  {isPcBuild ? (
                    <div className="space-y-0.5 pb-1">
                      <p className="font-bold text-[11px] text-slate-900">
                        (FREE PC BUILD, CABLE MANAGEMENT &amp; ESSENTIAL APP INSTALLATION)
                      </p>
                      <p className="text-[10px] text-slate-600">
                        Exclusive to complete PC builds purchased from us. Not applicable to individual component purchases.
                      </p>
                    </div>
                  ) : null}
                  <p className="font-bold text-[11px] text-slate-900">
                    ONE (1) YEAR WARRANTY ON MAJOR PARTS &amp; ONE (1) MONTH ON ACCESSORIES
                  </p>
                  <p className="text-[10px] text-slate-600">
                    COMPLETE BOX &amp; INCLUSIONS (7 DAYS OUTRIGHT REPLACEMENT EXCEPT FOR PRINTERS)
                  </p>
                  <p className="font-bold text-[11px] text-red-700">
                    CASH DISCOUNTED PRICE APPLIES ONLY FOR CASH, GCASH, BANK TRANSFER
                  </p>
                </div>

                <div className="sm:col-span-5 space-y-1.5 text-xs text-right">
                  <div className="flex justify-between font-bold text-slate-900 text-xs">
                    <span>TOTAL CASH DISCOUNTED PRICE</span>
                    <span className="font-mono">{formatMoney(cashPromoTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700 text-[11px]">
                    <span>SUGGESTED RETAIL PRICE</span>
                    <span className="font-mono">{formatMoney(srpTotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 text-[11px]">
                    <span>REGULAR PRICE (CREDIT / AR)</span>
                    <span className="font-mono">{formatMoney(regularTotal)}</span>
                  </div>

                  {installmentCalculation ? (
                    <div className="flex justify-between font-black text-[#002060] border-t border-slate-200 pt-1 text-[11px]">
                      <span>SELECTED AR ({installmentCalculation.months} MOS)</span>
                      <span className="font-mono">{formatMoney(installmentCalculation.monthlyDueAmount)}/mo</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Signatures Section: Prepared by & Conforme matching Excel Rows 56-59 */}
              <div className="mt-8 pt-4 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-8 text-center text-xs">
                  <div className="space-y-6">
                    <p className="text-left font-bold text-slate-600 text-[11px]">Prepared by:</p>
                    <div className="border-b border-slate-400 pt-2 font-semibold text-[11px] uppercase">
                      {salesman}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <p className="text-left font-bold text-slate-600 text-[11px]">CONFORME:</p>
                    <div className="border-b border-slate-400 pt-2 text-[10px] text-slate-500">
                      Signature over Printed Name/ Date
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body
  )
}
