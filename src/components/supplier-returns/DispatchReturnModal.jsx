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
        err.response?.data?.error?.message ||
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

          {/* QUICK DELIVERY MODE PRESETS */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Select Handover / Delivery Mode
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  setCourierName("Store Staff Handover")
                  if (!driverName || driverName.includes("Store") || driverName.includes("Driver") || driverName.includes("Juan")) {
                    setDriverName("Store Staff / Employee")
                  }
                  setTrackingNumber("Direct Handover")
                }}
                className={`rounded-xl border p-2 text-left transition ${
                  courierName.includes("Staff")
                    ? "border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-2xs"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <div className="font-bold text-xs">🏢 Employee / Staff</div>
                <div className="text-[10px] text-slate-500">Employee delivers</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCourierName("Owner Direct Delivery")
                  setDriverName("Store Owner")
                  setTrackingNumber("Direct Handover")
                }}
                className={`rounded-xl border p-2 text-left transition ${
                  courierName.includes("Owner")
                    ? "border-amber-600 bg-amber-50 text-amber-900 font-bold shadow-2xs"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <div className="font-bold text-xs">👑 Store Owner</div>
                <div className="text-[10px] text-slate-500">Owner delivers</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCourierName("Supplier Van Pickup")
                  setDriverName("Supplier Driver")
                  setTrackingNumber("Supplier Pickup")
                }}
                className={`rounded-xl border p-2 text-left transition ${
                  courierName.includes("Supplier")
                    ? "border-purple-600 bg-purple-50 text-purple-900 font-bold shadow-2xs"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <div className="font-bold text-xs">🚐 Supplier Van</div>
                <div className="text-[10px] text-slate-500">Supplier picked up</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCourierName("Lalamove / Grab")
                  setTrackingNumber("")
                }}
                className={`rounded-xl border p-2 text-left transition ${
                  courierName.includes("Lalamove") || courierName.includes("Grab")
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-2xs"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <div className="font-bold text-xs">📦 3rd-Party Courier</div>
                <div className="text-[10px] text-slate-500">Lalamove / Grab</div>
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              💡 Kung Employee o Owner mismo ang nagdala sa opisina/depo ng supplier, opsyonal ang Vehicle Plate at Tracking #.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Handover Person / Driver / Rep Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Employee Name, Owner, or Driver"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone / Contact No. (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 0917-123-4567"
                value={driverContact}
                onChange={(e) => setDriverContact(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Courier / Logistics Mode *
              </label>
              <input
                type="text"
                placeholder="e.g. Store Staff Handover, Owner Direct, Lalamove"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Vehicle Plate # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. NBD 1234 or Personal Vehicle"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Waybill / Tracking # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Direct Handover or Tracking #"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
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
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
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

