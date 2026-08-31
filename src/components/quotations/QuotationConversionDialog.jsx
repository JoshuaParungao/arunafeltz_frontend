import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, DollarSign, FileText, LoaderCircle, Package, ShieldCheck, X } from "lucide-react"
import { getInventoryBatches, getInventorySerials } from "../../features/inventory/inventory.api"
import { createSale } from "../../features/sales/sales.api"
import { parseQuotationSettlement, stripSettlementTag } from "../../utils/quotationSettlement"

const IMMEDIATE_PAYMENT_METHODS = [
  ["CASH", "Cash"],
  ["GCASH", "GCash"],
  ["BANK_TRANSFER", "Bank Transfer"],
  ["PAYMAYA", "Maya"],
  ["CREDIT_CARD", "Credit Card"],
  ["DEBIT_CARD", "Debit Card"],
]

const RECEIVABLE_PROVIDERS = [
  ["IN_HOUSE_INSTALLMENT", "In-House AR"],
  ["HOME_CREDIT", "Home Credit"],
  ["BILLEASE", "BillEase"],
  ["SALARY_DEDUCTION", "Salary Deduction"],
]

const RECEIVABLE_PROVIDER_VALUES = new Set(RECEIVABLE_PROVIDERS.map(([val]) => val))

const DEFAULT_INSTALLMENT_BASIS = {
  MONTH_3: 0.94,
  MONTH_6: 0.9,
  MONTH_12: 0.85,
}

const INSTALLMENT_TERM_MONTHS = {
  MONTH_3: 3,
  MONTH_6: 6,
  MONTH_12: 12,
}

function formatMoney(value) {
  const amount = Number(value || 0)
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function createRequestKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function QuotationConversionDialog({
  quotation,
  branchId,
  onClose,
  onSuccess,
  installmentRates = null,
}) {
  const [conversionLines, setConversionLines] = useState([])
  const [isLoadingStock, setIsLoadingStock] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  // Payment state - initialized from saved settlement config if present
  const savedSettlement = useMemo(() => {
    return parseQuotationSettlement(quotation?.notes) || {}
  }, [quotation?.notes])

  const initialMethod = savedSettlement.paymentMethod || "CASH"
  const isInitialReceivable = RECEIVABLE_PROVIDER_VALUES.has(initialMethod)

  const [paymentMethod, setPaymentMethod] = useState(initialMethod)
  const [settlementMethod, setSettlementMethod] = useState(savedSettlement.settlementMethod || "CASH")
  const [amountPaid, setAmountPaid] = useState(
    savedSettlement.paymentAmount !== undefined
      ? String(savedSettlement.paymentAmount)
      : isInitialReceivable
        ? "0"
        : String(Number(quotation?.grandTotal || 0))
  )
  const [referenceNo, setReferenceNo] = useState(savedSettlement.paymentReference || "")
  const [providerReferenceNo, setProviderReferenceNo] = useState(savedSettlement.providerReference || "")
  const [creditTerm, setCreditTerm] = useState(savedSettlement.creditTerm || "MONTH_3")
  const [creditDueDay, setCreditDueDay] = useState(savedSettlement.creditDueDay || "")
  const [creditFirstDueDate, setCreditFirstDueDate] = useState(savedSettlement.creditFirstDueDate || "")
  const [remarks, setRemarks] = useState(stripSettlementTag(quotation?.notes || ""))

  const requestRef = useRef({ signature: "", key: "" })

  const isReceivable = RECEIVABLE_PROVIDER_VALUES.has(paymentMethod)
  const isInHouse = paymentMethod === "IN_HOUSE_INSTALLMENT"

  const grandTotal = Number(quotation?.grandTotal || 0)

  const installmentCalculation = useMemo(() => {
    if (!isReceivable) return null

    const termBasis = Number(
      installmentRates?.[creditTerm] || DEFAULT_INSTALLMENT_BASIS[creditTerm] || 1,
    )
    const months = INSTALLMENT_TERM_MONTHS[creditTerm] || 1
    const cashPromoTotal = grandTotal
    const downpayment = Number(amountPaid || 0)

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
  }, [isReceivable, installmentRates, creditTerm, grandTotal, amountPaid])

  // Load batches & serials for each item in the quotation
  useEffect(() => {
    let isCancelled = false

    async function loadStock() {
      if (!quotation?.items?.length || !branchId) {
        setIsLoadingStock(false)
        return
      }

      setIsLoadingStock(true)
      setErrorMessage("")

      try {
        const preparedLineGroups = await Promise.all(
          (quotation.items || []).map(async (item) => {
            if (!item.itemId) {
              return [
                {
                  ...item,
                  conversionKey: `custom-${item.id || item.lineNo}`,
                  batchId: "",
                  serialId: "",
                  availableBatches: [],
                  availableSerials: [],
                },
              ]
            }

            const [batchResponse, serialResponse] = await Promise.all([
              getInventoryBatches({
                branchId,
                itemId: item.itemId,
                status: "ACTIVE",
                limit: 100,
              }),
              getInventorySerials({
                branchId,
                itemId: item.itemId,
                status: "AVAILABLE",
                limit: 100,
              }),
            ])

            const batchesResult = batchResponse?.data ?? batchResponse ?? {}
            const serialsResult = serialResponse?.data ?? serialResponse ?? {}
            const availableBatches = Array.isArray(batchesResult.data)
              ? batchesResult.data
              : Array.isArray(batchesResult.items)
                ? batchesResult.items
                : Array.isArray(batchesResult.records)
                  ? batchesResult.records
                  : Array.isArray(batchResponse)
                    ? batchResponse
                    : []

            const availableSerials = Array.isArray(serialsResult.data)
              ? serialsResult.data
              : Array.isArray(serialsResult.items)
                ? serialsResult.items
                : Array.isArray(serialsResult.records)
                  ? serialsResult.records
                  : Array.isArray(serialResponse)
                    ? serialResponse
                    : []

            const isSerialized = Boolean(item.item?.isSerialized)
            const baseLine = {
              ...item,
              isSerialized,
              batchId: isSerialized ? "" : availableBatches[0]?.id || "",
              serialId: "",
              availableBatches,
              availableSerials,
            }

            if (!isSerialized) {
              return [
                {
                  ...baseLine,
                  conversionKey: `product-${item.id || item.lineNo}`,
                },
              ]
            }

            const quantity = Number(item.quantity || 0)
            return Array.from({ length: quantity }, (_, unitIndex) => ({
              ...baseLine,
              conversionKey: `serial-${item.id || item.lineNo}-${unitIndex + 1}`,
              quantity: 1,
              unitSequence: unitIndex + 1,
              originalQuantity: quantity,
            }))
          }),
        )

        if (!isCancelled) {
          setConversionLines(preparedLineGroups.flat())
        }
      } catch (err) {
        if (!isCancelled) {
          const msg =
            err?.response?.data?.message ||
            err?.response?.data?.error?.message ||
            "Unable to check inventory stock for quotation items."
          setErrorMessage(msg)
          setConversionLines([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingStock(false)
        }
      }
    }

    loadStock()

    return () => {
      isCancelled = true
    }
  }, [quotation, branchId])

  const updateLineStock = (conversionKey, field, value) => {
    setConversionLines((lines) =>
      lines.map((line) => {
        if (line.conversionKey !== conversionKey) return line

        if (field === "serialId") {
          const selectedSerial = line.availableSerials?.find((s) => s.id === value)
          return {
            ...line,
            serialId: value,
            batchId: selectedSerial?.batch?.id || "",
          }
        }

        return { ...line, [field]: value }
      }),
    )
  }

  const handleConvert = async (e) => {
    e.preventDefault()
    if (isSubmitting || !quotation?.id) return

    // 1. Stock validation
    const missingStock = conversionLines.find((line) => {
      if (!line.itemId) return false
      return line.isSerialized ? !line.serialId : !line.batchId
    })

    if (missingStock) {
      setErrorMessage(
        missingStock.isSerialized
          ? `Please select an available serial number for ${missingStock.description || missingStock.itemNameSnapshot || "serialized item"}.`
          : `Please select an active stock batch for ${missingStock.description || missingStock.itemNameSnapshot || "item"}.`,
      )
      return
    }

    // 2. Payment validation
    const numPaid = Number(amountPaid || 0)
    if (!Number.isFinite(numPaid) || numPaid < 0) {
      setErrorMessage("Payment amount must be a positive number.")
      return
    }

    if (isReceivable) {
      if (numPaid >= grandTotal) {
        setErrorMessage("Accounts receivable conversion requires an outstanding financed balance.")
        return
      }
      if (isInHouse && !quotation.customer?.id) {
        setErrorMessage("In-house installment requires a registered customer on the quotation.")
        return
      }
      if (!creditTerm) {
        setErrorMessage("Please select an installment credit term.")
        return
      }
    } else {
      if (numPaid < grandTotal) {
        setErrorMessage(`Full payment of ₱${formatMoney(grandTotal)} is required for immediate settlement, or switch to Accounts Receivable.`)
        return
      }
      if (paymentMethod !== "CASH" && numPaid > grandTotal) {
        setErrorMessage("Non-cash payments cannot exceed the total amount.")
        return
      }
    }

    setIsSubmitting(true)
    setErrorMessage("")

    try {
      const salePayload = {
        branchId,
        customerId: quotation.customer?.id || undefined,
        quotationId: quotation.id,
        remarks: remarks.trim() || undefined,
        items: conversionLines.map((line) => ({
          itemId: line.itemId || undefined,
          description: line.description,
          priceTier: Number(line.priceTier || 1),
          quantity: Number(line.quantity || 0),
          unitPrice: line.itemId ? undefined : Number(line.unitPrice || 0),
          discountAmount: Number(line.discountAmount || 0),
          batchId: line.batchId || undefined,
          serialId: line.serialId || undefined,
        })),
        payments:
          numPaid > 0
            ? [
                {
                  paymentMethod: isReceivable ? settlementMethod : paymentMethod,
                  amount: numPaid,
                  referenceNo: referenceNo.trim() || undefined,
                  remarks: remarks.trim() || undefined,
                },
              ]
            : [],
        receivable: isReceivable
          ? {
              provider: paymentMethod,
              providerReferenceNo: providerReferenceNo.trim() || undefined,
              term: creditTerm,
              dueDay: creditDueDay === "" ? undefined : Number(creditDueDay),
              firstDueDate: creditFirstDueDate
                ? new Date(`${creditFirstDueDate}T00:00:00+08:00`).toISOString()
                : undefined,
              remarks: remarks.trim() || undefined,
            }
          : undefined,
      }

      const sig = JSON.stringify(salePayload)
      if (requestRef.current.signature !== sig) {
        requestRef.current = {
          signature: sig,
          key: createRequestKey(),
        }
      }

      const response = await createSale({
        ...salePayload,
        idempotencyKey: requestRef.current.key,
      })

      const sale = response?.data || response
      if (!sale?.id) throw new Error("Invalid sale response from server")

      onSuccess(sale)
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        "Failed to convert quotation to sale. Please check stock and amounts."
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const codeMatch = String(quotation?.quotationCode || "").match(/\d+$/)
  const displayCode = codeMatch ? codeMatch[0].padStart(5, "0") : quotation?.quotationCode || "—"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
              <FileText size={20} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Convert Quotation #{displayCode} to Sale</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  {quotation?.status || "DRAFT"}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Customer: <span className="font-semibold text-slate-800">{quotation?.customer?.fullName || "Walk-in"}</span> • Created: {new Date(quotation?.createdAt || Date.now()).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Item Inventory Allocation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Package size={15} className="text-[#002060]" />
                <span>Quoted Items & Stock Allocation</span>
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                {conversionLines.length} line(s) to convert
              </span>
            </div>

            {isLoadingStock ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-xs font-semibold text-slate-500">
                <LoaderCircle size={16} className="animate-spin text-emerald-600" />
                Loading inventory stock availability...
              </div>
            ) : conversionLines.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                No items found in quotation.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {conversionLines.map((line) => {
                  const isSerialized = Boolean(line.isSerialized)
                  const desc = line.description || line.itemNameSnapshot || line.item?.itemName || "Item"
                  const hasStock = isSerialized
                    ? (line.availableSerials || []).length > 0
                    : (line.availableBatches || []).length > 0

                  return (
                    <div
                      key={line.conversionKey}
                      className={`grid gap-3 rounded-2xl border p-3.5 text-xs sm:grid-cols-12 sm:items-center ${
                        hasStock ? "border-slate-200 bg-white" : "border-red-200 bg-red-50/50"
                      }`}
                    >
                      <div className="sm:col-span-6 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 truncate">{desc}</span>
                          {line.unitSequence && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                              Unit {line.unitSequence}/{line.originalQuantity}
                            </span>
                          )}
                          {isSerialized && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-900">
                              Serialized
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Qty: <span className="font-semibold">{line.quantity}</span> • Unit: ₱{formatMoney(line.unitPrice)} • Total: ₱{formatMoney(Number(line.quantity) * Number(line.unitPrice))}
                        </p>
                      </div>

                      <div className="sm:col-span-6">
                        {!line.itemId ? (
                          <span className="italic text-slate-500">Custom / Service line (no stock deduction)</span>
                        ) : isSerialized ? (
                          <div>
                            <select
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#002060] disabled:bg-red-50 disabled:text-red-700"
                              disabled={(line.availableSerials || []).length === 0}
                              onChange={(e) => updateLineStock(line.conversionKey, "serialId", e.target.value)}
                              value={line.serialId}
                            >
                              <option value="">
                                {(line.availableSerials || []).length === 0
                                  ? "⚠️ Out of stock: 0 available serials"
                                  : "Select available serial number *"}
                              </option>
                              {(line.availableSerials || []).map((serial) => {
                                const isUsedInOtherLine = conversionLines.some(
                                  (l) => l.conversionKey !== line.conversionKey && l.serialId === serial.id
                                )
                                return (
                                  <option key={serial.id} value={serial.id} disabled={isUsedInOtherLine}>
                                    {serial.serialNumber} {isUsedInOtherLine ? "(Already selected)" : ""} • {serial.batch?.batchCode || "No batch"}
                                  </option>
                                )
                              })}
                            </select>
                            {(line.availableSerials || []).length === 0 && (
                              <p className="mt-1 text-[10px] font-bold text-red-600">
                                Out of stock in this branch!
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <select
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#002060] disabled:bg-red-50 disabled:text-red-700"
                              disabled={(line.availableBatches || []).length === 0}
                              onChange={(e) => updateLineStock(line.conversionKey, "batchId", e.target.value)}
                              value={line.batchId}
                            >
                              <option value="">
                                {(line.availableBatches || []).length === 0
                                  ? "⚠️ Out of stock: 0 available quantity"
                                  : "Select active batch *"}
                              </option>
                              {(line.availableBatches || []).map((batch) => (
                                <option key={batch.id} value={batch.id}>
                                  Batch {batch.batchCode} ({Number(batch.quantityAvailable || 0)} available)
                                </option>
                              ))}
                            </select>
                            {(line.availableBatches || []).length === 0 && (
                              <p className="mt-1 text-[10px] font-bold text-red-600">
                                Out of stock in this branch!
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section 2: Settlement Arrangement */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <DollarSign size={15} className="text-emerald-700" />
                <span>Mode of Payment & Settlement Arrangement</span>
              </h3>
              {savedSettlement.paymentMethod && (
                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-900">
                  Retained from saved quotation
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs">
                <span className="font-bold text-slate-600">Payment Mode</span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#002060]"
                  onChange={(e) => {
                    const next = e.target.value
                    setPaymentMethod(next)
                    setAmountPaid(
                      RECEIVABLE_PROVIDER_VALUES.has(next) ? "0" : String(grandTotal)
                    )
                  }}
                  value={paymentMethod}
                >
                  <optgroup label="Immediate Settlement">
                    {IMMEDIATE_PAYMENT_METHODS.map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Accounts Receivable">
                    {RECEIVABLE_PROVIDERS.map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <label className="block text-xs">
                <span className="font-bold text-slate-600">
                  {isReceivable ? "Downpayment / Immediate" : "Amount Paid"}
                </span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[#002060]"
                  max={isReceivable ? grandTotal : undefined}
                  min="0"
                  onChange={(e) => setAmountPaid(e.target.value)}
                  step="0.01"
                  type="number"
                  value={amountPaid}
                />
              </label>

              {isReceivable ? (
                <label className="block text-xs">
                  <span className="font-bold text-slate-600">Downpayment Method</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#002060]"
                    onChange={(e) => setSettlementMethod(e.target.value)}
                    value={settlementMethod}
                  >
                    {IMMEDIATE_PAYMENT_METHODS.map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block text-xs">
                  <span className="font-bold text-slate-600">Reference No. (Optional)</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-[#002060]"
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="GCash / Bank ref #"
                    value={referenceNo}
                  />
                </label>
              )}

              {isReceivable ? (
                <label className="block text-xs">
                  <span className="font-bold text-slate-600">Provider Approval Ref</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-[#002060]"
                    onChange={(e) => setProviderReferenceNo(e.target.value)}
                    placeholder="Approval / Claim #"
                    value={providerReferenceNo}
                  />
                </label>
              ) : (
                <label className="block text-xs">
                  <span className="font-bold text-slate-600">Remarks (Optional)</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-[#002060]"
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Notes..."
                    value={remarks}
                  />
                </label>
              )}
            </div>

            {/* If Accounts Receivable Breakdown */}
            {isReceivable && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/80 pb-2">
                  <span className="font-black text-blue-950 uppercase tracking-wide">
                    AR Installment Terms & Calculation
                  </span>
                  <span className="rounded bg-blue-200/80 px-2 py-0.5 text-[10px] font-black text-blue-900">
                    Rate Basis: {installmentCalculation?.termBasis ?? "1.00"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-blue-100 bg-white p-2 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Cash Promo Total</span>
                    <p className="font-black text-slate-900">₱{formatMoney(grandTotal)}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white p-2 text-center">
                    <span className="text-[10px] uppercase font-bold text-blue-700">Interest / Rate Adj</span>
                    <p className="font-black text-blue-900">+₱{formatMoney(installmentCalculation?.interestAmount || 0)}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white p-2 text-center">
                    <span className="text-[10px] uppercase font-bold text-amber-700">Financed Total</span>
                    <p className="font-black text-amber-900">₱{formatMoney(installmentCalculation?.regularPriceTotalAmount || grandTotal)}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-800">Monthly ({installmentCalculation?.months} mos)</span>
                    <p className="font-black text-emerald-950">₱{formatMoney(installmentCalculation?.monthlyDueAmount || 0)}/mo</p>
                  </div>
                </div>

                <div className="grid gap-2 pt-1 sm:grid-cols-3">
                  <label className="block">
                    <span className="font-bold text-blue-900">Credit Term</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
                      onChange={(e) => setCreditTerm(e.target.value)}
                      value={creditTerm}
                    >
                      <option value="MONTH_3">3 Months</option>
                      <option value="MONTH_6">6 Months</option>
                      <option value="MONTH_12">12 Months</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-bold text-blue-900">Monthly Due Day (1-31)</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs"
                      max="31"
                      min="1"
                      onChange={(e) => setCreditDueDay(e.target.value)}
                      placeholder="e.g. 15"
                      type="number"
                      value={creditDueDay}
                    />
                  </label>
                  <label className="block">
                    <span className="font-bold text-blue-900">First Due Date</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs"
                      onChange={(e) => setCreditFirstDueDate(e.target.value)}
                      type="date"
                      value={creditFirstDueDate}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-6 py-4">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Sale Grand Total:</span>
            <span className="ml-2 font-mono text-lg font-black text-slate-900">
              ₱{formatMoney(isReceivable ? (installmentCalculation?.regularPriceTotalAmount || grandTotal) : grandTotal)}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              className="flex-1 sm:flex-initial rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-soft transition hover:bg-emerald-700 disabled:opacity-50"
              disabled={isSubmitting || isLoadingStock}
              onClick={handleConvert}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle size={15} className="animate-spin" />
                  Converting & Deducting Stock...
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  Complete Sale & Issue Receipt
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
