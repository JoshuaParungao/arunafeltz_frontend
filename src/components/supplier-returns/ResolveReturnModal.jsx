import { useState } from "react"
import { createPortal } from "react-dom"
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  CreditCard,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from "lucide-react"
import { resolveSupplierReturn } from "../../features/supplier-returns/supplierReturns.api"

export default function ResolveReturnModal({
  returnData,
  isOpen,
  onClose,
  onResolved,
}) {
  const [resolutionType, setResolutionType] = useState("REPLACEMENT")
  const [creditMemoNumber, setCreditMemoNumber] = useState("")
  const [creditMemoAmount, setCreditMemoAmount] = useState(
    () => returnData?.subtotalCost || 0
  )
  const [refundAmount, setRefundAmount] = useState(
    () => returnData?.subtotalCost || 0
  )
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [rejectionReason, setRejectionReason] = useState(
    "Customer Induced Damage (CID) / Burnt PCB / Void Warranty Sticker Broken"
  )

  // Per-item replacement serial numbers if REPLACEMENT chosen
  const [replacementSerials, setReplacementSerials] = useState({})

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  if (!isOpen || !returnData) return null

  const items = returnData.items || []
  const hasWarrantyItems = items.some((it) => it.warrantyClaimId)

  const handleSerialChange = (itemId, val) => {
    setReplacementSerials((prev) => ({
      ...prev,
      [itemId]: val,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const payload = {
        resolutionType,
        creditMemoNumber: creditMemoNumber.trim() || undefined,
        creditMemoAmount: creditMemoAmount ? Number(creditMemoAmount) : undefined,
        refundAmount: refundAmount ? Number(refundAmount) : undefined,
        resolutionNotes: resolutionNotes.trim() || undefined,
        rejectionReason:
          resolutionType === "RETURN_TO_CUSTOMER_DEFECTIVE"
            ? rejectionReason.trim()
            : undefined,
        items: items.map((it) => ({
          supplierReturnItemId: it.id,
          resolutionStatus:
            resolutionType === "REPLACEMENT"
              ? "REPLACED"
              : resolutionType === "REPAIRED"
              ? "REPAIRED"
              : resolutionType === "RETURN_TO_CUSTOMER_DEFECTIVE"
              ? "RETURNED_DEFECTIVE"
              : resolutionType === "CREDIT_MEMO"
              ? "CREDIT_MEMO"
              : resolutionType === "REFUND"
              ? "REFUND"
              : "SCRAPPED",
          replacementSerialNumber: replacementSerials[it.id]?.trim() || undefined,
          resolutionNotes: resolutionNotes.trim() || undefined,
        })),
      }

      const res = await resolveSupplierReturn(returnData.id, payload)
      onResolved?.(res?.data || res)
      onClose()
    } catch (err) {
      console.error("Resolve return error:", err)
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to resolve supplier return. Please verify inputs."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Resolve Supplier Return (RMA Settle)
              </h2>
              <p className="text-xs text-slate-500">
                {returnData.returnCode} • {returnData.supplier?.name} • {items.length} units
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                {error}
              </div>
            )}

            {/* RESOLUTION TYPE CHOICES */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Supplier RMA Resolution Outcome <span className="text-rose-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {/* 1. REPLACEMENT */}
                <button
                  type="button"
                  onClick={() => setResolutionType("REPLACEMENT")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    resolutionType === "REPLACEMENT"
                      ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    Replacement Unit
                  </div>
                  <span className="mt-1 text-[11px] text-slate-500">
                    Brand new replacement unit provided by supplier.
                  </span>
                </button>

                {/* 2. REPAIRED */}
                <button
                  type="button"
                  onClick={() => setResolutionType("REPAIRED")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    resolutionType === "REPAIRED"
                      ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-blue-900">
                    <Wrench className="size-4 text-blue-600" />
                    Repaired / Serviced
                  </div>
                  <span className="mt-1 text-[11px] text-slate-500">
                    Supplier fixed & tested original unit functional.
                  </span>
                </button>

                {/* 3. RETURN TO CUSTOMER DEFECTIVE */}
                <button
                  type="button"
                  onClick={() => setResolutionType("RETURN_TO_CUSTOMER_DEFECTIVE")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    resolutionType === "RETURN_TO_CUSTOMER_DEFECTIVE"
                      ? "border-rose-600 bg-rose-50/60 ring-2 ring-rose-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-rose-900">
                    <RotateCcw className="size-4 text-rose-600" />
                    Return Defective
                  </div>
                  <span className="mt-1 text-[11px] text-slate-500">
                    Supplier rejected RMA (CID/Void). Unit returned still broken.
                  </span>
                </button>

                {/* 4. CREDIT MEMO */}
                <button
                  type="button"
                  onClick={() => setResolutionType("CREDIT_MEMO")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    resolutionType === "CREDIT_MEMO"
                      ? "border-purple-600 bg-purple-50/60 ring-2 ring-purple-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-purple-900">
                    <CreditCard className="size-4 text-purple-600" />
                    Credit Memo
                  </div>
                  <span className="mt-1 text-[11px] text-slate-500">
                    Supplier issued CM voucher to deduct from payables.
                  </span>
                </button>

                {/* 5. REFUND */}
                <button
                  type="button"
                  onClick={() => setResolutionType("REFUND")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    resolutionType === "REFUND"
                      ? "border-teal-600 bg-teal-50/60 ring-2 ring-teal-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-teal-900">
                    <Award className="size-4 text-teal-600" />
                    Cash / Bank Refund
                  </div>
                  <span className="mt-1 text-[11px] text-slate-500">
                    Supplier refunded payment directly.
                  </span>
                </button>

                {/* 6. SCRAP */}
                <button
                  type="button"
                  onClick={() => setResolutionType("SCRAP_SHRINKAGE")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    resolutionType === "SCRAP_SHRINKAGE"
                      ? "border-slate-600 bg-slate-100 ring-2 ring-slate-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <Trash2 className="size-4 text-slate-600" />
                    Write-off / Scrap
                  </div>
                  <span className="mt-1 text-[11px] text-slate-500">
                    Unit written off as loss or destroyed.
                  </span>
                </button>
              </div>
            </div>

            {/* CONDITIONAL DETAILS PER OUTCOME */}
            {resolutionType === "REPLACEMENT" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                <div className="text-xs font-bold text-emerald-900">
                  New Replacement Serial Numbers:
                </div>
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1">
                      <span className="font-semibold text-slate-800">{it.item?.itemName}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-500">
                        (Old SN: {it.itemSerial?.serialNumber || it.serialNumberSnapshot || "N/A"})
                      </span>
                    </div>
                    <div className="w-56">
                      <input
                        type="text"
                        placeholder="New Serial Number"
                        value={replacementSerials[it.id] || ""}
                        onChange={(e) => handleSerialChange(it.id, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resolutionType === "RETURN_TO_CUSTOMER_DEFECTIVE" && (
              <div className="rounded-xl border border-rose-300 bg-rose-50/60 p-4 space-y-3">
                <div className="flex items-start gap-2 text-xs text-rose-900">
                  <ShieldAlert className="size-4 text-rose-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Supplier Declined RMA:</strong> The unit was evaluated as not eligible for supplier warranty. The physical defective unit has arrived back at the branch and is marked ready to be released back to the customer.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supplier Rejection Finding / Reason <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Burnt pin on PCIe slot / Customer Induced Damage / Corrosion"
                    className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs text-slate-900 font-medium focus:border-rose-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    This reason will automatically appear in the customer warranty release slip and claim diagnosis.
                  </p>
                </div>
              </div>
            )}

            {resolutionType === "CREDIT_MEMO" && (
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Credit Memo # <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CM-2026-0044"
                      value={creditMemoNumber}
                      onChange={(e) => setCreditMemoNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Credited Amount (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={creditMemoAmount}
                      onChange={(e) => setCreditMemoAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-bold focus:border-purple-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {resolutionType === "REFUND" && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Refund Amount Received (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-bold focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Resolution Notes / Supplier Remarks
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Supplier tested functional and replaced original board with Rev 2.0..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="text-xs text-slate-500">
              {hasWarrantyItems && (
                <span className="font-semibold text-emerald-700">
                  ✓ Automatically updates linked customer claims
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" />
                {isSubmitting ? "Settling..." : "Confirm & Resolve Return"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

