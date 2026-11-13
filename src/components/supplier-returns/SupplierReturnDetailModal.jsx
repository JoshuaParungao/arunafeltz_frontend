import { useState } from "react"
import { createPortal } from "react-dom"
import {
  Boxes,
  Calendar,
  CheckCircle2,
  FileText,
  Printer,
  RotateCcw,
  ShieldAlert,
  Truck,
  User,
  X,
  XCircle,
} from "lucide-react"
import { approveSupplierReturn, cancelSupplierReturn } from "../../features/supplier-returns/supplierReturns.api"

function formatDate(dateValue) {
  if (!dateValue) return "—"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(dateValue)
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCurrency(val) {
  return `₱${Number(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SupplierReturnDetailModal({
  returnData,
  isOpen,
  onClose,
  onPrint,
  onOpenDispatch,
  onOpenResolve,
  onUpdated,
}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")

  if (!isOpen || !returnData) return null

  const items = returnData.items || []
  const canApprove = returnData.status === "DRAFT"
  const canDispatch = ["DRAFT", "APPROVED"].includes(returnData.status)
  const canResolve = ["OUT_TO_SUPPLIER", "APPROVED"].includes(returnData.status)
  const canCancel = !["RESOLVED", "CANCELLED"].includes(returnData.status)

  const handleApprove = async () => {
    if (!window.confirm(`Approve Supplier Return ${returnData.returnCode}?`)) return
    setIsProcessing(true)
    setError("")
    try {
      const res = await approveSupplierReturn(returnData.id)
      onUpdated?.(res?.data || res)
    } catch (err) {
      console.error("Approve error:", err)
      setError(err.response?.data?.message || err.message || "Failed to approve return order")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = async () => {
    const reason = window.prompt("Enter cancellation reason for this supplier return:")
    if (!reason || !reason.trim()) return
    setIsProcessing(true)
    setError("")
    try {
      const res = await cancelSupplierReturn(returnData.id, { reason })
      onUpdated?.(res?.data || res)
    } catch (err) {
      console.error("Cancel error:", err)
      setError(err.response?.data?.message || err.message || "Failed to cancel return order")
    } finally {
      setIsProcessing(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800 font-bold">
              <FileText className="size-5 text-rose-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {returnData.returnCode}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    returnData.status === "RESOLVED"
                      ? "bg-emerald-100 text-emerald-800"
                      : returnData.status === "OUT_TO_SUPPLIER"
                      ? "bg-blue-100 text-blue-800"
                      : returnData.status === "APPROVED"
                      ? "bg-purple-100 text-purple-800"
                      : returnData.status === "CANCELLED"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {returnData.status}
                </span>
                {returnData.resolutionType !== "PENDING" && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-300">
                    {returnData.resolutionType}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Created on {formatDate(returnData.createdAt)} • Prepared by {returnData.createdBy?.fullName || "Staff"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint?.(returnData)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Printer className="size-3.5" /> Print A4 Slip
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
              {error}
            </div>
          )}

          {/* TWO-COLUMN METADATA */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* SUPPLIER DETAILS */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs">
              <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Supplier / Destination
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {returnData.supplier?.name}
              </div>
              <div className="text-slate-600">
                Contact: {returnData.supplier?.contactPerson || "—"} ({returnData.supplier?.contactNo || "—"})
              </div>
              <div className="text-slate-500">
                Address: {returnData.supplier?.address || "—"}
              </div>
              {returnData.supplierRmaNumber && (
                <div className="font-mono text-indigo-700 font-bold">
                  Supplier RMA #: {returnData.supplierRmaNumber}
                </div>
              )}
            </div>

            {/* DISPATCH / COURIER DETAILS */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs">
              <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Logistics & Dispatch
              </div>
              <div className="text-slate-800">
                Driver / Rep: <strong>{returnData.driverName || "Direct Handover / None"}</strong>
                {returnData.driverContact && ` (${returnData.driverContact})`}
              </div>
              <div className="text-slate-600">
                Vehicle Plate: <strong>{returnData.vehiclePlate || "—"}</strong> • Courier: {returnData.courierName || "—"}
              </div>
              <div className="text-slate-600">
                Tracking / Waybill #: <strong>{returnData.trackingNumber || "—"}</strong>
              </div>
              <div className="text-slate-500">
                Dispatched Date: {formatDate(returnData.dispatchDate || returnData.dispatchedAt)}
              </div>
            </div>
          </div>

          {/* RESOLUTION BANNER IF SETTLED */}
          {returnData.status === "RESOLVED" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="size-4 text-emerald-700" />
                <span>Resolved Outcome: {returnData.resolutionType}</span>
                <span className="text-emerald-700 font-normal">
                  on {formatDate(returnData.resolvedDate)} by {returnData.resolvedBy?.fullName || "Staff"}
                </span>
              </div>
              {returnData.rejectionReason && (
                <div className="text-rose-800 mt-1">
                  <strong>Rejection Finding:</strong> {returnData.rejectionReason}
                </div>
              )}
              {returnData.creditMemoNumber && (
                <div className="text-purple-800 mt-1">
                  <strong>Credit Memo:</strong> #{returnData.creditMemoNumber} • Amount: {formatCurrency(returnData.creditMemoAmount)}
                </div>
              )}
              {returnData.resolutionNotes && (
                <div className="text-slate-600 mt-1">
                  <strong>Notes:</strong> {returnData.resolutionNotes}
                </div>
              )}
            </div>
          )}

          {/* ITEMS TABLE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Manifest Items ({items.length})
              </h3>
              <span className="text-xs font-bold text-slate-900">
                Subtotal B.O. Value: {formatCurrency(returnData.subtotalCost)}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Origin</th>
                    <th className="px-3 py-2.5">Item Description</th>
                    <th className="px-3 py-2.5">Serial Number</th>
                    <th className="px-3 py-2.5">Reported Defect</th>
                    <th className="px-3 py-2.5 text-right">Cost</th>
                    <th className="px-3 py-2.5">Status / Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        {it.sourceType === "CUSTOMER_WARRANTY" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            <ShieldAlert className="size-3" />
                            Claim #{it.warrantyClaim?.claimCode || "WTY"}
                          </span>
                        ) : it.sourceType === "CUSTOMER_RETURN" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <RotateCcw className="size-3" />
                            Return #{it.returnRequest?.returnCode || "RET"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            <Boxes className="size-3" />
                            Store B.O.
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{it.item?.itemName}</div>
                        <div className="text-[11px] text-slate-500">
                          {[it.item?.brand, it.item?.modelName].filter(Boolean).join(" ")}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-slate-800">
                        {it.itemSerial?.serialNumber || it.serialNumberSnapshot || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-rose-700 font-medium">
                        {it.defectReason}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(it.unitCost)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            it.resolutionStatus === "REPLACED"
                              ? "bg-emerald-100 text-emerald-800"
                              : it.resolutionStatus === "REPAIRED"
                              ? "bg-blue-100 text-blue-800"
                              : it.resolutionStatus === "RETURNED_DEFECTIVE"
                              ? "bg-rose-100 text-rose-800"
                              : it.resolutionStatus === "CREDIT_MEMO"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {it.resolutionStatus}
                        </span>
                        {it.replacementSerialNumber && (
                          <div className="mt-1 font-mono text-[10px] text-emerald-800">
                            New SN: {it.replacementSerialNumber}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            {canCancel && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCancel}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 disabled:opacity-50"
              >
                Cancel Order
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canApprove && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleApprove}
                className="rounded-xl border border-purple-300 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-800 hover:bg-purple-100 disabled:opacity-50"
              >
                Approve Pull-Out
              </button>
            )}

            {canDispatch && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  onClose()
                  onOpenDispatch?.(returnData)
                }}
                className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
              >
                <Truck className="size-3.5" />
                Dispatch to Supplier
              </button>
            )}

            {canResolve && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  onClose()
                  onOpenResolve?.(returnData)
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800"
              >
                <CheckCircle2 className="size-3.5" />
                Settle / Resolve RMA
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
