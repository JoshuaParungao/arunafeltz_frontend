import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AlertCircle, Truck, X } from "lucide-react"
import { dispatchSupplierReturn } from "../../features/supplier-returns/supplierReturns.api"

export default function DispatchReturnModal({
  returnData,
  isOpen,
  onClose,
  onDispatched,
}) {
  const [driverName, setDriverName] = useState("")
  const [driverContact, setDriverContact] = useState("")
  const [vehiclePlate, setVehiclePlate] = useState("")
  const [courierName, setCourierName] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (returnData) {
      setDriverName(returnData.driverName || "")
      setDriverContact(returnData.driverContact || "")
      setVehiclePlate(returnData.vehiclePlate || "")
      setCourierName(returnData.courierName || "Store Delivery Van")
      setTrackingNumber(returnData.trackingNumber || "")
      setNotes(returnData.notes || "")
      setDispatchDate(new Date().toISOString().split("T")[0])
    }
  }, [returnData])

  if (!isOpen || !returnData) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const payload = {
        driverName: driverName.trim() || undefined,
        driverContact: driverContact.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        courierName: courierName.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        dispatchDate: dispatchDate || undefined,
        notes: notes.trim() || undefined,
      }

      const res = await dispatchSupplierReturn(returnData.id, payload)
      onDispatched?.(res?.data || res)
      onClose()
    } catch (err) {
      console.error("Dispatch return error:", err)
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to dispatch return order. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const warrantyItemsCount = returnData.items?.filter((it) => it.warrantyClaimId)?.length || 0

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Truck className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Dispatch / Handover to Supplier
              </h2>
              <p className="text-xs text-slate-500">
                {returnData.returnCode} • {returnData.supplier?.name}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
              {error}
            </div>
          )}

          {warrantyItemsCount > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl bg-blue-50/80 p-3 text-xs text-blue-900 border border-blue-200">
              <AlertCircle className="size-4 shrink-0 text-blue-600 mt-0.5" />
              <div>
                <strong>Interconnected Warranty Sync:</strong> Dispatching will update{" "}
                <strong>{warrantyItemsCount} linked Customer Warranty Claim(s)</strong> status to{" "}
                <span className="font-mono font-bold text-blue-800">SENT_TO_SUPPLIER</span> with courier tracking.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Driver / Representative Name
              </label>
              <input
                type="text"
                placeholder="e.g. Juan dela Cruz"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Driver Phone / Contact
              </label>
              <input
                type="text"
                placeholder="e.g. 0917-123-4567"
                value={driverContact}
                onChange={(e) => setDriverContact(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Vehicle Plate #
              </label>
              <input
                type="text"
                placeholder="e.g. NBD 1234"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Courier / Logistics Mode
              </label>
              <input
                type="text"
                placeholder="e.g. Store Van, Lalamove"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Waybill / Tracking #
              </label>
              <input
                type="text"
                placeholder="e.g. LLM-991208"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Handover / Dispatch Date
              </label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dispatch Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Handed over to supplier pickup messenger..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2 text-xs focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
              className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
            >
              <Truck className="size-4" />
              {isSubmitting ? "Dispatching..." : "Confirm Handover & Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

