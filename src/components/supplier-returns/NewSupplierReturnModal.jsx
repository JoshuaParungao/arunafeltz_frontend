import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  PackagePlus,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Undo2,
  X,
} from "lucide-react"
import { getSuppliers } from "../../features/suppliers/suppliers.api"
import { getEligibleDefects, createSupplierReturn } from "../../features/supplier-returns/supplierReturns.api"
import { getItems } from "../../features/items/items.api"

export default function NewSupplierReturnModal({
  isOpen,
  onClose,
  onCreated,
  branchId,
}) {
  const [suppliers, setSuppliers] = useState([])
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [supplierRmaNumber, setSupplierRmaNumber] = useState("")
  const [expectedResolutionDate, setExpectedResolutionDate] = useState("")
  const [driverName, setDriverName] = useState("")
  const [driverContact, setDriverContact] = useState("")
  const [vehiclePlate, setVehiclePlate] = useState("")
  const [courierName, setCourierName] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [notes, setNotes] = useState("")

  // Eligible defect items from server
  const [eligibleDefects, setEligibleDefects] = useState({
    customerWarrantyClaims: [],
    customerReturns: [],
    storeDefects: [],
  })
  const [isLoadingEligible, setIsLoadingEligible] = useState(false)
  const [activeSourceTab, setActiveSourceTab] = useState("WARRANTY") // 'WARRANTY' | 'CUSTOMER_RETURN' | 'STORE_DEFECT' | 'MANUAL'
  const [defectSearch, setDefectSearch] = useState("")

  // Selected items in this return voucher
  const [items, setItems] = useState([])

  // Manual item addition state
  const [manualItemSearch, setManualItemSearch] = useState("")
  const [manualCatalogItems, setManualCatalogItems] = useState([])
  const [selectedManualItem, setSelectedManualItem] = useState(null)
  const [manualSerial, setManualSerial] = useState("")
  const [manualReason, setManualReason] = useState("")
  const [manualCost, setManualCost] = useState(0)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isOpen) return

    // Load active suppliers
    getSuppliers({ limit: 100, status: "ACTIVE" })
      .then((res) => {
        const list = res?.data || res || []
        setSuppliers(Array.isArray(list) ? list : [])
        if (list.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(list[0].id)
        }
      })
      .catch((err) => console.error("Error loading suppliers:", err))

    // Load eligible defects for this branch
    setIsLoadingEligible(true)
    getEligibleDefects({ branchId })
      .then((res) => {
        const data = res?.data || res || {}
        setEligibleDefects({
          customerWarrantyClaims: data.customerWarrantyClaims || [],
          customerReturns: data.customerReturns || [],
          storeDefects: data.storeDefects || [],
        })
      })
      .catch((err) => console.error("Error loading eligible defects:", err))
      .finally(() => setIsLoadingEligible(false))
  }, [isOpen, branchId])

  // Handle manual item catalog search
  useEffect(() => {
    if (activeSourceTab !== "MANUAL" || !manualItemSearch.trim()) {
      setManualCatalogItems([])
      return
    }
    const timer = setTimeout(() => {
      getItems({ search: manualItemSearch.trim(), limit: 10 })
        .then((res) => {
          const list = res?.data || res || []
          setManualCatalogItems(Array.isArray(list) ? list : [])
        })
        .catch(() => setManualCatalogItems([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [manualItemSearch, activeSourceTab])

  if (!isOpen) return null

  const handleAddWarrantyClaim = (claim) => {
    // Check if already in list
    if (items.some((it) => it.warrantyClaimId === claim.id)) return

    setItems((prev) => [
      ...prev,
      {
        itemId: claim.itemId,
        itemName: claim.itemName,
        itemCode: claim.itemCode,
        brandModel: [claim.brand, claim.modelName].filter(Boolean).join(" "),
        itemSerialId: claim.serialId,
        serialNumber: claim.serialNumber,
        quantity: 1,
        unitCost: claim.unitCost || 0,
        defectReason: claim.defectReason || "Defective unit under warranty",
        sourceType: "CUSTOMER_WARRANTY",
        warrantyClaimId: claim.id,
        claimCode: claim.code,
        customerName: claim.customerName,
      },
    ])
  }

  const handleAddCustomerReturn = (ret) => {
    if (items.some((it) => it.returnRequestId === ret.returnRequestId && it.itemId === ret.itemId)) return

    setItems((prev) => [
      ...prev,
      {
        itemId: ret.itemId,
        itemName: ret.itemName,
        itemCode: ret.itemCode,
        brandModel: [ret.brand, ret.modelName].filter(Boolean).join(" "),
        itemSerialId: ret.serialId,
        serialNumber: ret.serialNumber,
        quantity: 1,
        unitCost: ret.unitCost || 0,
        defectReason: ret.defectReason || "Returned defective by customer",
        sourceType: "CUSTOMER_RETURN",
        returnRequestId: ret.returnRequestId,
        returnCode: ret.code,
        customerName: ret.customerName,
      },
    ])
  }

  const handleAddStoreDefect = (def) => {
    if (items.some((it) => it.itemSerialId === def.serialId)) return

    setItems((prev) => [
      ...prev,
      {
        itemId: def.itemId,
        itemName: def.itemName,
        itemCode: def.itemCode,
        brandModel: [def.brand, def.modelName].filter(Boolean).join(" "),
        itemSerialId: def.serialId,
        serialNumber: def.serialNumber,
        quantity: 1,
        unitCost: def.unitCost || 0,
        defectReason: def.defectReason || "Damaged store inventory / B.O.",
        sourceType: "STORE_DEFECT",
      },
    ])
  }

  const handleAddManualItem = () => {
    if (!selectedManualItem) return
    if (!manualReason.trim()) {
      setError("Please describe the defect or fault for the manual item.")
      return
    }

    setItems((prev) => [
      ...prev,
      {
        itemId: selectedManualItem.id,
        itemName: selectedManualItem.itemName,
        itemCode: selectedManualItem.itemCode,
        brandModel: [selectedManualItem.brand, selectedManualItem.modelName].filter(Boolean).join(" "),
        itemSerialId: null,
        serialNumber: manualSerial.trim() || null,
        quantity: 1,
        unitCost: manualCost || Number(selectedManualItem.costPrice || 0),
        defectReason: manualReason.trim(),
        sourceType: "STORE_DEFECT",
      },
    ])

    setSelectedManualItem(null)
    setManualItemSearch("")
    setManualSerial("")
    setManualReason("")
    setManualCost(0)
    setError("")
  }

  const handleRemoveItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleUpdateItemDefect = (idx, text) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, defectReason: text } : it))
    )
  }

  const subtotalValue = items.reduce(
    (sum, it) => sum + Number(it.quantity || 1) * Number(it.unitCost || 0),
    0
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedSupplierId) {
      setError("Please select a target supplier / distributor.")
      return
    }
    if (items.length === 0) {
      setError("Please select at least 1 Bad Order / defective unit to return.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const payload = {
        branchId,
        supplierId: selectedSupplierId,
        supplierRmaNumber: supplierRmaNumber.trim() || undefined,
        expectedResolutionDate: expectedResolutionDate || undefined,
        driverName: driverName.trim() || undefined,
        driverContact: driverContact.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        courierName: courierName.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          itemId: it.itemId,
          itemSerialId: it.itemSerialId || undefined,
          quantity: Number(it.quantity || 1),
          unitCost: Number(it.unitCost || 0),
          defectReason: it.defectReason || "Defective unit",
          sourceType: it.sourceType,
          warrantyClaimId: it.warrantyClaimId || undefined,
          returnRequestId: it.returnRequestId || undefined,
        })),
      }

      const res = await createSupplierReturn(payload)
      const created = res?.data || res
      onCreated?.(created)
      onClose()
    } catch (err) {
      console.error("Create Supplier Return error:", err)
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to create supplier return. Please verify inputs."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtered lists for the defect picker
  const filteredClaims = eligibleDefects.customerWarrantyClaims.filter((c) => {
    if (!defectSearch.trim()) return true
    const s = defectSearch.toLowerCase()
    return (
      c.code?.toLowerCase().includes(s) ||
      c.itemName?.toLowerCase().includes(s) ||
      c.serialNumber?.toLowerCase().includes(s) ||
      c.customerName?.toLowerCase().includes(s)
    )
  })

  const filteredCustomerReturns = eligibleDefects.customerReturns.filter((r) => {
    if (!defectSearch.trim()) return true
    const s = defectSearch.toLowerCase()
    return (
      r.code?.toLowerCase().includes(s) ||
      r.itemName?.toLowerCase().includes(s) ||
      r.serialNumber?.toLowerCase().includes(s) ||
      r.customerName?.toLowerCase().includes(s)
    )
  })

  const filteredStoreDefects = eligibleDefects.storeDefects.filter((d) => {
    if (!defectSearch.trim()) return true
    const s = defectSearch.toLowerCase()
    return (
      d.itemName?.toLowerCase().includes(s) ||
      d.serialNumber?.toLowerCase().includes(s) ||
      d.itemCode?.toLowerCase().includes(s)
    )
  })

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <PackagePlus className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                New Supplier Return Order (Bad Order / RMA)
              </h2>
              <p className="text-xs text-slate-500">
                Create a batch pull-out voucher for defective store stock, customer claims, or sales returns.
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

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* TOP METADATA ROW */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Supplier / Distributor <span className="text-rose-600">*</span>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-rose-500 focus:outline-none"
                  required
                >
                  <option value="">Select Supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplierCode || "Code"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supplier RMA / Reference #
                </label>
                <input
                  type="text"
                  placeholder="e.g. RMA-2026-9912 or Banros #812"
                  value={supplierRmaNumber}
                  onChange={(e) => setSupplierRmaNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expected Return / Resolution Date
                </label>
                <input
                  type="date"
                  value={expectedResolutionDate}
                  onChange={(e) => setExpectedResolutionDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            {/* DEFECT SOURCE SELECTOR TABS & QUICK PICKER */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Add Items from:</span>
                  <div className="flex rounded-lg bg-slate-200/80 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setActiveSourceTab("WARRANTY")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                        activeSourceTab === "WARRANTY"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <ShieldAlert className="size-3.5 text-rose-600" />
                      Customer Warranty ({eligibleDefects.customerWarrantyClaims.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSourceTab("CUSTOMER_RETURN")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                        activeSourceTab === "CUSTOMER_RETURN"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <RotateCcw className="size-3.5 text-amber-600" />
                      Sales Returns ({eligibleDefects.customerReturns.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSourceTab("STORE_DEFECT")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                        activeSourceTab === "STORE_DEFECT"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Boxes className="size-3.5 text-blue-600" />
                      Store B.O. ({eligibleDefects.storeDefects.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSourceTab("MANUAL")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                        activeSourceTab === "MANUAL"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Plus className="size-3.5 text-slate-600" />
                      Search Catalog
                    </button>
                  </div>
                </div>

                {activeSourceTab !== "MANUAL" && (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search defects, serials..."
                      value={defectSearch}
                      onChange={(e) => setDefectSearch(e.target.value)}
                      className="w-full sm:w-56 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs shadow-sm focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* LIST OF AVAILABLE DEFECTS */}
              {activeSourceTab === "WARRANTY" && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {filteredClaims.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No customer warranty claims pending supplier RMA.
                    </div>
                  ) : (
                    filteredClaims.map((claim) => {
                      const isAdded = items.some((it) => it.warrantyClaimId === claim.id)
                      return (
                        <div
                          key={claim.id}
                          className="flex items-center justify-between p-3 hover:bg-slate-50 transition"
                        >
                          <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                                {claim.code}
                              </span>
                              <span className="text-xs font-bold text-slate-900">{claim.itemName}</span>
                              {claim.serialNumber && (
                                <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  SN: {claim.serialNumber}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                              <span>Customer: <strong>{claim.customerName || "Walk-in"}</strong></span>
                              <span>Defect: <strong className="text-rose-600">{claim.defectReason}</strong></span>
                              <span>Est. Cost: ₱{Number(claim.unitCost).toFixed(2)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => handleAddWarrantyClaim(claim)}
                            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition ${
                              isAdded
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-rose-700 text-white hover:bg-rose-800"
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <CheckCircle2 className="size-3.5" /> Added
                              </>
                            ) : (
                              <>
                                <Plus className="size-3.5" /> Add Claim
                              </>
                            )}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {activeSourceTab === "CUSTOMER_RETURN" && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {filteredCustomerReturns.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No sales returns pending supplier RMA.
                    </div>
                  ) : (
                    filteredCustomerReturns.map((ret) => {
                      const isAdded = items.some(
                        (it) => it.returnRequestId === ret.returnRequestId && it.itemId === ret.itemId
                      )
                      return (
                        <div
                          key={ret.id}
                          className="flex items-center justify-between p-3 hover:bg-slate-50 transition"
                        >
                          <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                {ret.code}
                              </span>
                              <span className="text-xs font-bold text-slate-900">{ret.itemName}</span>
                              {ret.serialNumber && (
                                <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  SN: {ret.serialNumber}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                              <span>Customer: <strong>{ret.customerName || "Customer"}</strong></span>
                              <span>Return Reason: <strong className="text-amber-700">{ret.defectReason}</strong></span>
                              <span>Cost: ₱{Number(ret.unitCost).toFixed(2)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => handleAddCustomerReturn(ret)}
                            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition ${
                              isAdded
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-amber-600 text-white hover:bg-amber-700"
                            }`}
                          >
                            {isAdded ? "Added" : "+ Add Return"}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {activeSourceTab === "STORE_DEFECT" && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {filteredStoreDefects.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No damaged store inventory items found.
                    </div>
                  ) : (
                    filteredStoreDefects.map((def) => {
                      const isAdded = items.some((it) => it.itemSerialId === def.serialId)
                      return (
                        <div
                          key={def.id}
                          className="flex items-center justify-between p-3 hover:bg-slate-50 transition"
                        >
                          <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{def.itemName}</span>
                              <span className="font-mono text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold">
                                SN: {def.serialNumber}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                              <span>Finding: <strong className="text-slate-700">{def.defectReason}</strong></span>
                              <span>Cost: ₱{Number(def.unitCost).toFixed(2)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => handleAddStoreDefect(def)}
                            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition ${
                              isAdded
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-slate-900 text-white hover:bg-slate-800"
                            }`}
                          >
                            {isAdded ? "Added" : "+ Add B.O."}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {activeSourceTab === "MANUAL" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2 relative">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Search Catalog Product
                      </label>
                      <input
                        type="text"
                        placeholder="Search product name or code..."
                        value={manualItemSearch}
                        onChange={(e) => setManualItemSearch(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                      />
                      {manualCatalogItems.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
                          {manualCatalogItems.map((prod) => (
                            <button
                              type="button"
                              key={prod.id}
                              onClick={() => {
                                setSelectedManualItem(prod)
                                setManualCost(Number(prod.costPrice || 0))
                                setManualCatalogItems([])
                                setManualItemSearch(prod.itemName)
                              }}
                              className="w-full text-left p-2 text-xs hover:bg-slate-50 flex justify-between items-center"
                            >
                              <span className="font-semibold text-slate-800">{prod.itemName}</span>
                              <span className="text-[11px] text-slate-500">₱{Number(prod.costPrice).toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Serial Number (if any)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SN-883912"
                        value={manualSerial}
                        onChange={(e) => setManualSerial(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Unit Cost (₱)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={manualCost}
                        onChange={(e) => setManualCost(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Defect Reason / Problem Found <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. No display, Artifacts, Burnt capacitors, DOA"
                        value={manualReason}
                        onChange={(e) => setManualReason(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!selectedManualItem}
                      onClick={handleAddManualItem}
                      className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-slate-800 disabled:opacity-50"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RETURN ITEMS TABLE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Return Manifest ({items.length} units to pull out)
                </h3>
                <span className="text-xs font-extrabold text-slate-900">
                  Subtotal B.O. Value: ₱{subtotalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">Origin / Source</th>
                      <th className="px-3 py-2.5">Item Description</th>
                      <th className="px-3 py-2.5">Serial Number</th>
                      <th className="px-3 py-2.5">Reported Defect</th>
                      <th className="px-3 py-2.5 text-right">Cost</th>
                      <th className="px-3 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No items added yet. Click &quot;Add Claim&quot;, &quot;Add Return&quot;, or &quot;Add B.O.&quot; above to populate the return order.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            {it.sourceType === "CUSTOMER_WARRANTY" ? (
                              <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                <ShieldAlert className="size-3" />
                                Claim #{it.claimCode}
                              </span>
                            ) : it.sourceType === "CUSTOMER_RETURN" ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                <RotateCcw className="size-3" />
                                Return #{it.returnCode}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                <Boxes className="size-3" />
                                Store B.O.
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-slate-900">{it.itemName}</div>
                            <div className="text-[11px] text-slate-500">{it.brandModel}</div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-slate-700">
                            {it.serialNumber || "Non-serialized"}
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={it.defectReason}
                              onChange={(e) => handleUpdateItemDefect(idx, e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-rose-700 font-medium focus:border-rose-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                            ₱{Number(it.unitCost).toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COURIER & LOGISTICS DETAILS */}
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Truck className="size-4 text-slate-500" />
                <span>Pull-Out Courier & Driver Handover (Optional for Draft)</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Driver / Representative Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Juan dela Cruz"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Driver Phone / Contact
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0917-123-4567"
                    value={driverContact}
                    onChange={(e) => setDriverContact(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Vehicle Plate #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NBD 1234"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Courier / Logistics Co.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Store Van, Lalamove"
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Waybill / Tracking Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. LLM-9921820"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Notes / Packaging Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Complete box with anti-static pouch and warranty card..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="text-xs text-slate-500">
              {items.length} items ready for pull-out • Total: <strong className="text-slate-900">₱{subtotalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>
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
                disabled={isSubmitting || items.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50"
              >
                {isSubmitting ? "Generating..." : "Save Pull-Out Order (Draft)"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
